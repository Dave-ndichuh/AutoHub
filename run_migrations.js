const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We use the same connection string logic as before, from supabase pooler or direct
// Actually, we can just use supabase-js to RPC a raw query if we had one, but we don't.
// I will just use pg since I have the connection string in setup_credit_schema.js
const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({ connectionString });

const sql = `
  ALTER TABLE customer ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) DEFAULT 0;

  CREATE TABLE IF NOT EXISTS outsourced_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(255),
    brand VARCHAR(255),
    cost_price NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    transaction_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER
  );
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('Schema updated successfully');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
