import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, pin, firstName, lastName, phone, gender, jobId, locationId, branchId } = body;

    // 1. Generate Username
    const rawUsername = `${firstName.charAt(0)}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = rawUsername;
    
    // Check if username exists, append random digits if it does
    const { data: existingUser } = await supabaseAdmin.from('employee').select('USERNAME').eq('USERNAME', username).maybeSingle();
    if (existingUser) {
      username = `${rawUsername}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 2. Create User in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { name: `${firstName} ${lastName}` }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 3. Insert into Employee Table
    const payload = {
      FIRST_NAME: firstName,
      LAST_NAME: lastName,
      GENDER: gender,
      EMAIL: email,
      PHONE_NUMBER: phone,
      JOB_ID: jobId,
      LOCATION_ID: locationId,
      USERNAME: username,
      PIN: pin, // Stored for fast lookup/recovery if needed by admin
      BRANCH_ID: branchId || 1
    };

    const { error: dbError } = await supabaseAdmin.from('employee').insert([payload]);

    if (dbError) {
      // Rollback Auth user if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, username });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
