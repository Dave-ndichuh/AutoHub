const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

async function run() {
  try {
    await client.connect();
    
    console.log("--- Tables ---");
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(tablesRes.rows.map(r => r.table_name).join(", "));

    console.log("\n--- product schema ---");
    const prodRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product'
    `);
    console.table(prodRes.rows);
    
    console.log("\n--- inventory_ledger schema (if exists) ---");
    const ledgerRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_ledger'
    `);
    console.table(ledgerRes.rows);

    console.log("\n--- stock_movements schema (if exists) ---");
    const stockMovementsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_movements'
    `);
    console.table(stockMovementsRes.rows);

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
