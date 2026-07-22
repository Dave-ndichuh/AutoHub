const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(`ALTER TABLE product ADD COLUMN IF NOT EXISTS "UPDATED_AT" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`);
    console.log('Successfully added UPDATED_AT to product table.');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
