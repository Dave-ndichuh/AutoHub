const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Make sure .env.local exists.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function onboardExistingDebt() {
  console.log("Starting debt onboarding process...");

  try {
    // Fetch all unsettled credit transactions
    const { data: unsettledSales, error: salesErr } = await supabase
      .from('transaction')
      .select('TRANS_ID, CREDIT_CUSTOMER_ID, ADJUSTED_TOTAL, GRAND_TOTAL, CASH_AMOUNT, MPESA_AMOUNT')
      .eq('IS_CREDIT', true)
      .eq('IS_SETTLED', false);

    if (salesErr) throw salesErr;

    console.log(`Found ${unsettledSales.length} unsettled credit sales.`);

    // Group by customer
    const customerDebts = {};
    unsettledSales.forEach(sale => {
      const custId = sale.CREDIT_CUSTOMER_ID;
      if (!custId) return;

      const total = Number(sale.ADJUSTED_TOTAL || sale.GRAND_TOTAL || 0);
      const paid = Number(sale.CASH_AMOUNT || 0) + Number(sale.MPESA_AMOUNT || 0);
      const debt = total - paid;

      if (debt > 0) {
        if (!customerDebts[custId]) {
          customerDebts[custId] = 0;
        }
        customerDebts[custId] += debt;
      }
    });

    const custIds = Object.keys(customerDebts);
    console.log(`Found ${custIds.length} customers with outstanding debt.`);

    for (const custId of custIds) {
      const debtAmount = customerDebts[custId];
      console.log(`Processing customer ${custId} with debt: Ksh. ${debtAmount}`);

      // Check if account already exists
      const { data: existingAcc, error: accCheckErr } = await supabase
        .from('credit_accounts')
        .select('*')
        .eq('customer_id', custId)
        .single();

      if (accCheckErr && accCheckErr.code !== 'PGRST116') {
        console.error(`Error checking account for customer ${custId}:`, accCheckErr.message);
        continue;
      }

      let accountId;

      if (!existingAcc) {
        // Create new account
        const { data: newAcc, error: createErr } = await supabase
          .from('credit_accounts')
          .insert([{
            customer_id: custId,
            credit_limit: 150000.00,
            current_balance: debtAmount
          }])
          .select()
          .single();

        if (createErr) {
          console.error(`Failed to create account for customer ${custId}:`, createErr.message);
          continue;
        }
        accountId = newAcc.id;
        console.log(`  -> Created new credit account.`);
      } else {
        // Account exists, skip creating B/F to avoid double counting if already run
        console.log(`  -> Account already exists. Skipping B/F transaction to avoid duplicates.`);
        continue;
      }

      // Create B/F Transaction
      const { error: transErr } = await supabase
        .from('credit_transactions')
        .insert([{
          account_id: accountId,
          type: 'b/f',
          amount: debtAmount,
          notes: 'Balance Brought Forward from legacy system'
        }]);

      if (transErr) {
        console.error(`Failed to create B/F transaction for customer ${custId}:`, transErr.message);
      } else {
        console.log(`  -> Created B/F transaction.`);
      }
    }

    console.log("Onboarding process complete.");

  } catch (err) {
    console.error("Onboarding failed:", err);
  }
}

onboardExistingDebt();
