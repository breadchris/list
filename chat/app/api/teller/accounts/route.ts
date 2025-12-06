import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  fetchTellerAccounts,
  fetchTellerBalances,
  type TellerAccountMetadata,
} from '@/lib/teller-client';

interface AccountsRequestBody {
  enrollment_id: string;
  access_token: string;
  group_id: string;
  user_id: string;
}

export async function POST(req: Request) {
  try {
    const body: AccountsRequestBody = await req.json();
    const { enrollment_id, access_token, group_id, user_id } = body;

    // Validate required fields
    if (!enrollment_id || !access_token || !group_id || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch accounts from Teller API
    const accounts = await fetchTellerAccounts(access_token);
    const accountIds: string[] = [];

    for (const account of accounts) {
      // Fetch balance for this account
      let balanceAvailable: number | undefined;
      let balanceCurrent: number | undefined;
      try {
        const balance = await fetchTellerBalances(access_token, account.id);
        balanceAvailable = parseFloat(balance.available);
        balanceCurrent = parseFloat(balance.ledger);
      } catch (balanceError) {
        console.warn(`Could not fetch balance for account ${account.id}:`, balanceError);
      }

      // Create account metadata (include access_token for subsequent API calls)
      const accountMetadata: TellerAccountMetadata & { access_token: string } = {
        account_id: account.id,
        enrollment_id: account.enrollment_id,
        institution_name: account.institution.name,
        account_type: account.type,
        subtype: account.subtype,
        currency: account.currency,
        last_four: account.last_four,
        balance_available: balanceAvailable,
        balance_current: balanceCurrent,
        last_synced: new Date().toISOString(),
        access_token, // Store for subsequent balance/transaction calls
      };

      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('content')
        .select('id')
        .eq('type', 'teller_account')
        .eq('group_id', group_id)
        .eq('metadata->>account_id', account.id)
        .single();

      if (existingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('content')
          .update({
            data: `${account.name} ****${account.last_four}`,
            metadata: accountMetadata,
          })
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating account:', updateError);
        } else {
          accountIds.push(existingAccount.id);
        }
      } else {
        // Create new account content item
        const { data: newAccount, error: insertError } = await supabase
          .from('content')
          .insert({
            type: 'teller_account',
            data: `${account.name} ****${account.last_four}`,
            group_id,
            user_id,
            parent_content_id: enrollment_id,
            metadata: accountMetadata,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating account:', insertError);
        } else if (newAccount) {
          accountIds.push(newAccount.id);
        }
      }
    }

    // Update enrollment last_synced
    await supabase
      .from('content')
      .update({
        metadata: supabase.rpc('jsonb_set_key', {
          target: 'metadata',
          key: 'last_synced',
          value: JSON.stringify(new Date().toISOString()),
        }),
      })
      .eq('id', enrollment_id);

    return NextResponse.json({
      success: true,
      data: accountIds,
      accounts_synced: accounts.length,
    });
  } catch (error) {
    console.error('Error in teller/accounts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
