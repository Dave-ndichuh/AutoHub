const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dyoicvurrhuokfufsrwc:DaveAccounts%40254d@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
});

const setupQueries = `
CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES product("PRODUCT_ID") ON DELETE CASCADE,
    change_qty INTEGER NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_id BIGINT
);

CREATE OR REPLACE FUNCTION public.get_inventory_metrics(
  p_branch_id bigint DEFAULT NULL::bigint,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  stock_val NUMERIC := 0;
  low_stock INTEGER := 0;
  out_of_stock INTEGER := 0;
BEGIN
  WITH product_stock AS (
    SELECT 
      p."PRODUCT_ID",
      p."COST_PRICE",
      p."ON_HAND" - COALESCE((
        SELECT SUM(change_qty)
        FROM stock_movements sm
        WHERE sm.product_id = p."PRODUCT_ID"
          AND (end_date IS NOT NULL AND sm.created_at > end_date)
      ), 0) AS historical_on_hand
    FROM product p
    WHERE (p_branch_id IS NULL OR p."BRANCH_ID" = p_branch_id)
  )
  SELECT 
    COALESCE(SUM(CASE WHEN historical_on_hand > 0 THEN historical_on_hand * COALESCE("COST_PRICE", 0) ELSE 0 END), 0),
    COUNT(CASE WHEN historical_on_hand > 0 AND historical_on_hand <= 5 THEN 1 END),
    COUNT(CASE WHEN historical_on_hand <= 0 THEN 1 END)
  INTO stock_val, low_stock, out_of_stock
  FROM product_stock;

  RETURN json_build_object(
    'stockValue', stock_val,
    'lowStockCount', low_stock,
    'outOfStockCount', out_of_stock
  );
END;
$function$;

CREATE OR REPLACE FUNCTION log_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW."ON_HAND" IS DISTINCT FROM OLD."ON_HAND") THEN
        INSERT INTO stock_movements (product_id, change_qty, movement_type, branch_id)
        VALUES (
            NEW."PRODUCT_ID",
            NEW."ON_HAND" - COALESCE(OLD."ON_HAND", 0),
            CASE 
                WHEN NEW."ON_HAND" > COALESCE(OLD."ON_HAND", 0) THEN 'restock/return'
                ELSE 'sale/adjustment'
            END,
            NEW."BRANCH_ID"
        );
    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW."ON_HAND" > 0 THEN
            INSERT INTO stock_movements (product_id, change_qty, movement_type, branch_id)
            VALUES (
                NEW."PRODUCT_ID",
                NEW."ON_HAND",
                'initial_stock',
                NEW."BRANCH_ID"
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_stock_trigger ON product;

CREATE TRIGGER product_stock_trigger
AFTER INSERT OR UPDATE OF "ON_HAND" ON product
FOR EACH ROW
EXECUTE FUNCTION log_stock_movement();
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    await client.query(setupQueries);
    console.log('Successfully applied DB migrations for stock_movements.');
    
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
