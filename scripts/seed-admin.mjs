#!/usr/bin/env node
// Creates (or repairs) the local admin account: the auth.users row, and the
// public.profiles row with role = 'admin' that public.is_admin() checks.
//
// Idempotent by design, not by accident: npm run db:reset wipes the
// database, and a seed script that only succeeds once would leave the next
// person with no way into the admin dashboard. Run: npm run db:seed-admin
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Normalised once, here, rather than at each comparison. GoTrue stores
// addresses lowercased, so a mixed-case ADMIN_EMAIL previously slipped past
// the existing-admin guard (which compared lowercased) while missing the
// existing user (which compared exactly) — then died on a duplicate-email
// error that named nothing useful. Lowercasing at the boundary means that
// address is simply idempotent like any other.
const EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!URL || !SERVICE || !EMAIL || !PASSWORD) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_EMAIL / ADMIN_PASSWORD.');
  console.error('Try:');
  console.error(`  eval "$(supabase status -o env | sed 's/^/export /')"`);
  console.error('  export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"');
  console.error('  export ADMIN_EMAIL="admin@example.test" ADMIN_PASSWORD="local-dev-password"');
  process.exit(2);
}

// service_role bypasses Row Level Security — this script exists precisely
// because there is no admin session yet for that RLS to check against.
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// Not paginated past the first 1000 users. Past that, a lookup can miss an
// existing user and createUser then fails loudly on the duplicate email —
// a loud failure, not a silent one, so this degrades safely. Not fixed here;
// left for whenever the local admin list plausibly exceeds four digits.
async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  return data.users.find((u) => u.email === email) ?? null;
}

async function emailForUserId(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(`getUserById failed: ${error.message}`);
  return data.user?.email ?? null;
}

// A typo in ADMIN_EMAIL is not a new local account, it's a second
// permanent grant of full admin access — silent locally, a real security
// incident against a hosted project. Refuse rather than create one, unless
// someone deliberately opts in. Re-running with the SAME email must still
// pass this check silently: that is what keeps the script idempotent.
async function refuseIfAnotherAdminExists(email) {
  if (process.env.ALLOW_ADDITIONAL_ADMIN === 'true') return;

  const { data, error } = await admin.from('profiles').select('user_id').eq('role', 'admin');
  if (error) throw new Error(`profiles lookup failed: ${error.message}`);

  const target = email.toLowerCase();
  const others = [];
  for (const row of data) {
    const existingEmail = await emailForUserId(row.user_id);
    if (existingEmail && existingEmail.toLowerCase() !== target) {
      others.push(existingEmail);
    }
  }

  if (others.length > 0) {
    console.error(`seed-admin: refusing — an admin already exists: ${others.join(', ')}.`);
    console.error(`ADMIN_EMAIL=${email} would create an additional admin, not replace one.`);
    console.error('If that is deliberate, re-run with ALLOW_ADDITIONAL_ADMIN=true.');
    process.exit(1);
  }
}

// Create the user if absent, or update the password if present — either way
// this returns a user id to attach the admin profile to, and either way a
// second run lands in the same place instead of erroring on "already
// registered".
async function ensureAuthUser(email, password) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user;
}

async function ensureAdminProfile(userId) {
  const { error } = await admin
    .from('profiles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' });
  if (error) throw new Error(`profiles upsert failed: ${error.message}`);
}

async function main() {
  await refuseIfAnotherAdminExists(EMAIL);
  const user = await ensureAuthUser(EMAIL, PASSWORD);
  await ensureAdminProfile(user.id);
  // Confirms which account this run configured — never the password, a
  // token, or a session.
  console.log(`seed-admin: configured admin ${EMAIL}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
