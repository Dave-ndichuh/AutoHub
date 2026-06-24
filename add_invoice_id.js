const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

const alterTableQuery = `
ALTER TABLE transaction
ADD COLUMN IF NOT EXISTS "INVOICE_ID" INTEGER DEFAULT NULL;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(alterTableQuery);
    console.log('Successfully altered transaction table.');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
