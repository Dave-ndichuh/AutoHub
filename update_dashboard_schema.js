const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

const setupQueries = `
ALTER TABLE employee ADD COLUMN IF NOT EXISTS last_dashboard_renewal_month VARCHAR(7) DEFAULT '2020-01';

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  t_sales NUMERIC := 0;
  t_cost NUMERIC := 0;
  t_count INTEGER := 0;
  gross_profit NUMERIC := 0;
  profit_margin NUMERIC := 0;
  atv NUMERIC := 0;
BEGIN
  -- Aggregate metrics for the given period
  SELECT 
    COALESCE(SUM(COALESCE(ADJUSTED_TOTAL, GRAND_TOTAL, 0)), 0),
    COUNT(*)
  INTO t_sales, t_count
  FROM transaction
  WHERE CREATED_AT >= start_date 
    AND (end_date IS NULL OR CREATED_AT <= end_date)
    AND status != 'Reversed'
    AND (IS_CREDIT = false OR IS_SETTLED = true)
    AND (p_branch_id IS NULL OR BRANCH_ID = p_branch_id);

  -- To calculate cost, we need to join transaction_details and product
  SELECT COALESCE(SUM(td.QTY * COALESCE(p.COST_PRICE, 0)), 0)
  INTO t_cost
  FROM transaction t
  JOIN transaction_details td ON t.TRANSACTION_ID = td.TRANSACTION_ID
  JOIN product p ON td.PRODUCT_ID = p.PRODUCT_ID
  WHERE t.CREATED_AT >= start_date 
    AND (end_date IS NULL OR t.CREATED_AT <= end_date)
    AND t.status != 'Reversed'
    AND (t.IS_CREDIT = false OR t.IS_SETTLED = true)
    AND (p_branch_id IS NULL OR t.BRANCH_ID = p_branch_id);
    
  gross_profit := t_sales - t_cost;
  IF t_sales > 0 THEN
    profit_margin := (gross_profit / t_sales) * 100;
  END IF;
  
  IF t_count > 0 THEN
    atv := t_sales / t_count;
  END IF;

  RETURN json_build_object(
    'totalSales', t_sales,
    'grossProfit', gross_profit,
    'profitMargin', profit_margin,
    'transactionCount', t_count,
    'atv', atv
  );
END;
$$ LANGUAGE plpgsql;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    await client.query(setupQueries);
    console.log('Successfully applied DB migrations for dashboard metrics.');
    
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
