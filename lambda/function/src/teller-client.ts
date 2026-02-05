import https from 'https';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Cache for Teller certificates (persists across Lambda invocations)
let cachedCerts: { cert: string; key: string } | null = null;

/**
 * Fetches Teller mTLS certificates from AWS Secrets Manager.
 * Caches the result to avoid repeated API calls.
 */
async function getTellerCertificates(): Promise<{ cert: string; key: string }> {
  if (cachedCerts) {
    return cachedCerts;
  }

  const secretArn = process.env.TELLER_SECRET_ARN;
  if (!secretArn) {
    throw new Error('TELLER_SECRET_ARN environment variable not set');
  }

  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));

  if (!response.SecretString) {
    throw new Error('Teller secret has no value');
  }

  cachedCerts = JSON.parse(response.SecretString);
  return cachedCerts!;
}

// Teller API response types
export interface TellerAccount {
  id: string;
  enrollment_id: string;
  institution: {
    id: string;
    name: string;
  };
  name: string;
  type: string;
  subtype: string;
  currency: string;
  last_four: string;
  status: string;
}

export interface TellerBalance {
  account_id: string;
  available: string;
  ledger: string;
}

export interface TellerTransaction {
  id: string;
  account_id: string;
  date: string;
  description: string;
  details: {
    category: string;
    counterparty: {
      name: string;
      type: string;
    };
    processing_status: string;
  };
  status: string;
  amount: string;
  running_balance: string | null;
  type: string;
}

export interface TellerIdentity {
  id: string;
  enrollment_id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
  };
}

/**
 * Creates an HTTPS agent with mTLS client certificates for Teller API authentication.
 * Certificates are fetched from AWS Secrets Manager and cached.
 */
export async function createTellerAgent(): Promise<https.Agent> {
  const { cert, key } = await getTellerCertificates();

  return new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
  });
}

/**
 * Makes an authenticated request to the Teller API using mTLS and Basic Auth.
 * @param endpoint - API endpoint path (e.g., '/accounts', '/accounts/{id}/balances')
 * @param accessToken - The access token from Teller Connect enrollment
 * @returns Promise with the parsed JSON response
 */
export async function tellerFetch<T>(endpoint: string, accessToken: string): Promise<T> {
  const agent = await createTellerAgent();
  // Teller uses Basic Auth with access token as username, empty password
  const auth = Buffer.from(`${accessToken}:`).toString('base64');

  const response = await fetch(`https://api.teller.io${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    // @ts-ignore - Node.js fetch supports agent option
    agent,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Teller API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches all accounts for an enrollment.
 */
export async function fetchTellerAccounts(accessToken: string): Promise<TellerAccount[]> {
  return tellerFetch<TellerAccount[]>('/accounts', accessToken);
}

/**
 * Fetches balances for a specific account.
 */
export async function fetchTellerBalances(accessToken: string, accountId: string): Promise<TellerBalance> {
  return tellerFetch<TellerBalance>(`/accounts/${accountId}/balances`, accessToken);
}

/**
 * Fetches transactions for a specific account.
 * @param count - Number of transactions to fetch (default 100, max 100 per page)
 */
export async function fetchTellerTransactions(
  accessToken: string,
  accountId: string,
  count: number = 100
): Promise<TellerTransaction[]> {
  return tellerFetch<TellerTransaction[]>(`/accounts/${accountId}/transactions?count=${count}`, accessToken);
}

/**
 * Fetches identity information for an enrollment.
 */
export async function fetchTellerIdentity(accessToken: string): Promise<TellerIdentity[]> {
  return tellerFetch<TellerIdentity[]>('/identity', accessToken);
}

/**
 * Deletes an enrollment (disconnects the account).
 */
export async function deleteTellerEnrollment(accessToken: string, enrollmentId: string): Promise<void> {
  const agent = await createTellerAgent();
  const auth = Buffer.from(`${accessToken}:`).toString('base64');

  const response = await fetch(`https://api.teller.io/enrollments/${enrollmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    // @ts-ignore
    agent,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete enrollment (${response.status}): ${errorText}`);
  }
}
