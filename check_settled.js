require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  try {
    // 1. Get all settled credit sales that don't have their payment method correctly updated
    // Typically they will have "Pending Payment" or "Credit" as payment method
    const { data: sales, error } = await supabase
      .from('transaction')
      .select('TRANS_ID, PAYMENT_METHOD, IS_SETTLED, CASH_AMOUNT, MPESA_AMOUNT, BANK_AMOUNT, CHEQUE_AMOUNT')
      .eq('IS_CREDIT', true)
      .eq('IS_SETTLED', true);

    if (error) {
      throw error;
    }

    console.log(`Found ${sales.length} settled credit sales.`);
    
    // Process each one
    let updatedCount = 0;
    
    for (const sale of sales) {
      if (sale.PAYMENT_METHOD === 'Pending Payment' || sale.PAYMENT_METHOD === 'Credit') {
        let newMethod = 'Pending Payment';
        
        // Infer method based on amounts
        const c = Number(sale.CASH_AMOUNT) || 0;
        const m = Number(sale.MPESA_AMOUNT) || 0;
        const b = Number(sale.BANK_AMOUNT) || 0;
        const ch = Number(sale.CHEQUE_AMOUNT) || 0;
        
        const types = [];
        if (c > 0) types.push('Cash');
        if (m > 0) types.push('M-Pesa');
        if (b > 0) types.push('Bank');
        if (ch > 0) types.push('Cheque');
        
        if (types.length === 1) {
          newMethod = types[0];
        } else if (types.length > 1) {
          newMethod = 'Hybrid';
        } else {
          // If no amounts, default to 'Cash' or whatever since they are fully settled
          newMethod = 'Cash'; 
        }
        
        console.log(`Updating ${sale.TRANS_ID} from ${sale.PAYMENT_METHOD} to ${newMethod}`);
        
        const { error: updErr } = await supabase
          .from('transaction')
          .update({ PAYMENT_METHOD: newMethod })
          .eq('TRANS_ID', sale.TRANS_ID);
          
        if (updErr) {
          console.error(`Failed to update ${sale.TRANS_ID}`, updErr);
        } else {
          updatedCount++;
        }
      }
    }
    
    console.log(`Successfully updated ${updatedCount} old settled credit sales!`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
