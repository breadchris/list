import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { fetchTellerBalances } from '@/lib/teller-client';

interface BalancesRequestBody {
  content_id: string;
  access_token: string;
  account_id: string;
}

export async function POST(req: Request) {
  try {
    const body: BalancesRequestBody = await req.json();
    const { content_id, access_token, account_id } = body;

    // Validate required fields
    if (!content_id || !access_token || !account_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch balance from Teller API
    const balance = await fetchTellerBalances(access_token, account_id);

    const balanceAvailable = parseFloat(balance.available);
    const balanceCurrent = parseFloat(balance.ledger);

    // Update content metadata with new balance
    const supabase = createServerSupabaseClient();

    // Get current metadata
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select('metadata')
      .eq('id', content_id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch content: ${fetchError.message}`);
    }

    // Update metadata with new balance
    const updatedMetadata = {
      ...content.metadata,
      balance_available: balanceAvailable,
      balance_current: balanceCurrent,
      last_synced: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('content')
      .update({ metadata: updatedMetadata })
      .eq('id', content_id);

    if (updateError) {
      throw new Error(`Failed to update content: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      balance: {
        available: balanceAvailable,
        current: balanceCurrent,
      },
    });
  } catch (error) {
    console.error('Error in teller/balances:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
