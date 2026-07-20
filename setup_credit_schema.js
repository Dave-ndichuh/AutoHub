const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

const createTablesQuery = `
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_account_status') THEN
        CREATE TYPE credit_account_status AS ENUM ('active', 'blocked', 'overdue');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type') THEN
        CREATE TYPE credit_transaction_type AS ENUM ('debit', 'credit', 'b/f');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_reference_type') THEN
        CREATE TYPE credit_reference_type AS ENUM ('sale', 'payment', 'adjustment');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id INTEGER NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    credit_limit NUMERIC(10, 2) DEFAULT 150000.00,
    current_balance NUMERIC(10, 2) DEFAULT 0.00,
    status credit_account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    type credit_transaction_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, 
    reference_type credit_reference_type,
    reference_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_transaction_id UUID NOT NULL REFERENCES credit_transactions(id) ON DELETE CASCADE,
    sale_id INTEGER, 
    allocated_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(createTablesQuery);
    console.log('Successfully created credit tables.');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
