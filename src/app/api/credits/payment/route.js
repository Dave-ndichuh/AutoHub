import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { customer_id, amount, payment_method, reference_no, notes, employee_id, branch_id } = await req.json();

    if (!customer_id || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    // 1. Get Credit Account
    const { data: account, error: accError } = await supabaseAdmin
      .from('credit_accounts')
      .select('*')
      .eq('customer_id', customer_id)
      .single();

    if (accError || !account) {
      return NextResponse.json({ success: false, error: 'Credit account not found' }, { status: 404 });
    }

    if (amount > account.current_balance) {
      return NextResponse.json({ success: false, error: 'Payment exceeds current balance' }, { status: 400 });
    }

    // 2. Start a Supabase transaction (simulate with sequential calls, using RPC if available, but doing manual for now)
    // Decrement balance
    const newBalance = Number(account.current_balance) - Number(amount);
    const { error: updateAccErr } = await supabaseAdmin
      .from('credit_accounts')
      .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', account.id);
      
    if (updateAccErr) throw updateAccErr;

    // 3. Insert Payment Transaction
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('credit_transactions')
      .insert([{
        account_id: account.id,
        type: 'credit',
        amount: amount,
        created_by: employee_id,
        reference_type: 'payment',
        reference_id: reference_no,
        notes: `Payment via ${payment_method}${notes ? ' - ' + notes : ''}`,
        branch_id: branch_id
      }])
      .select()
      .single();

    if (transError) throw transError;

    // 4. FIFO Allocation Logic
    let remainingAmount = Number(amount);
    
    // Get all unsettled credit sales for this customer, oldest first, ignoring reversed sales
    const { data: unsettledSales, error: salesError } = await supabaseAdmin
      .from('transaction')
      .select('TRANS_ID, ADJUSTED_TOTAL, GRAND_TOTAL, CASH_AMOUNT, MPESA_AMOUNT')
      .eq('CREDIT_CUSTOMER_ID', customer_id)
      .eq('IS_CREDIT', true)
      .eq('IS_SETTLED', false)
      .neq('status', 'Reversed')
      .order('CREATED_AT', { ascending: true });

    if (salesError) throw salesError;

    const allocations = [];
    const salesToSettle = [];
    const salesToUpdatePartial = []; // if we track partial in transaction table

    for (const sale of unsettledSales) {
      if (remainingAmount <= 0) break;

      const saleTotal = Number(sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL);
      const alreadyPaid = Number(sale.CASH_AMOUNT || 0) + Number(sale.MPESA_AMOUNT || 0);
      const pendingAmount = saleTotal - alreadyPaid;

      if (pendingAmount <= 0) {
          salesToSettle.push(sale.TRANS_ID);
          continue;
      }

      const allocated = Math.min(pendingAmount, remainingAmount);
      
      allocations.push({
        credit_transaction_id: transaction.id,
        sale_id: sale.TRANS_ID,
        allocated_amount: allocated
      });

      remainingAmount -= allocated;
      
      // Update the sale in transaction table
      let newCash = Number(sale.CASH_AMOUNT || 0);
      let newMpesa = Number(sale.MPESA_AMOUNT || 0);
      if (payment_method === 'Cash') newCash += allocated;
      else newMpesa += allocated;

      if (allocated >= pendingAmount) {
        // Fully settled
        salesToSettle.push({ id: sale.TRANS_ID, cash: newCash, mpesa: newMpesa });
      } else {
        // Partially settled
        salesToUpdatePartial.push({ id: sale.TRANS_ID, cash: newCash, mpesa: newMpesa });
      }
    }

    // Insert Allocations
    if (allocations.length > 0) {
      await supabaseAdmin.from('credit_allocations').insert(allocations);
    }

    // Update settled sales
    for (const s of salesToSettle) {
      await supabaseAdmin.from('transaction').update({ 
        IS_SETTLED: true,
        CASH_AMOUNT: s.cash,
        MPESA_AMOUNT: s.mpesa 
      }).eq('TRANS_ID', s.id);
    }
    
    // Update partially settled sales
    for (const s of salesToUpdatePartial) {
      await supabaseAdmin.from('transaction').update({
        CASH_AMOUNT: s.cash,
        MPESA_AMOUNT: s.mpesa
      }).eq('TRANS_ID', s.id);
    }

    return NextResponse.json({ success: true, transaction, newBalance });

  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
