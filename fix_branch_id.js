require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  try {
    // Check credit_transactions where branch_id is null
    const { data: trans, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .is('branch_id', null);

    if (error) {
      throw error;
    }

    console.log(`Found ${trans.length} credit transactions with null branch_id.`);
    
    if (trans.length > 0) {
      const { error: updErr } = await supabase
        .from('credit_transactions')
        .update({ branch_id: '1' })
        .is('branch_id', null);
        
      if (updErr) {
        console.error('Failed to update', updErr);
      } else {
        console.log('Successfully updated all null branch_ids to 1!');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
