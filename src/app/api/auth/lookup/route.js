import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { pin } = await request.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('employee')
      .select('EMAIL, FIRST_NAME, LAST_NAME, EMPLOYEE_ID')
      .eq('PIN', pin)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 404 });
    }

    return NextResponse.json({ 
      email: data.EMAIL,
      firstName: data.FIRST_NAME,
      lastName: data.LAST_NAME,
      employeeId: data.EMPLOYEE_ID
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
