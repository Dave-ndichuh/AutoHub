const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query('ALTER TABLE product ALTER COLUMN "PRODUCT_CODE" TYPE VARCHAR(255);');
    console.log('Successfully altered PRODUCT_CODE column.');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
