import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  fetchTellerTransactions,
  type TellerTransactionMetadata,
} from '@/lib/teller-client';

interface TransactionsRequestBody {
  parent_content_id: string;
  access_token: string;
  account_id: string;
  group_id: string;
  user_id: string;
  count?: number;
}

export async function POST(req: Request) {
  try {
    const body: TransactionsRequestBody = await req.json();
    const { parent_content_id, access_token, account_id, group_id, user_id, count = 100 } = body;

    // Validate required fields
    if (!parent_content_id || !access_token || !account_id || !group_id || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch transactions from Teller API
    const transactions = await fetchTellerTransactions(access_token, account_id, count);
    const transactionIds: string[] = [];

    for (const txn of transactions) {
      // Create transaction metadata
      const txnMetadata: TellerTransactionMetadata = {
        transaction_id: txn.id,
        account_id: txn.account_id,
        amount: parseFloat(txn.amount),
        date: txn.date,
        category: txn.details?.category || 'uncategorized',
        status: txn.status,
        merchant_name: txn.details?.counterparty?.name,
        running_balance: txn.running_balance ? parseFloat(txn.running_balance) : undefined,
      };

      // Check if transaction already exists
      const { data: existingTxn } = await supabase
        .from('content')
        .select('id')
        .eq('type', 'teller_transaction')
        .eq('group_id', group_id)
        .eq('metadata->>transaction_id', txn.id)
        .single();

      if (existingTxn) {
        // Update existing transaction
        const { error: updateError } = await supabase
          .from('content')
          .update({
            data: txn.description,
            metadata: txnMetadata,
          })
          .eq('id', existingTxn.id);

        if (updateError) {
          console.error('Error updating transaction:', updateError);
        } else {
          transactionIds.push(existingTxn.id);
        }
      } else {
        // Create new transaction content item
        const { data: newTxn, error: insertError } = await supabase
          .from('content')
          .insert({
            type: 'teller_transaction',
            data: txn.description,
            group_id,
            user_id,
            parent_content_id,
            metadata: txnMetadata,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating transaction:', insertError);
        } else if (newTxn) {
          transactionIds.push(newTxn.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: transactionIds,
      transactions_synced: transactions.length,
    });
  } catch (error) {
    console.error('Error in teller/transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
