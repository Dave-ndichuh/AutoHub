const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  try {
    // wait, we can't fetch function definition via anon key.
  } catch (err) {
    console.error(err);
  }
}

run();
