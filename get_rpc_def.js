const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres' }); 
async function run() { 
  await client.connect(); 
  const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'reverse_transaction'"); 
  console.log(res.rows[0].pg_get_functiondef); 
  await client.end(); 
} 
run();
