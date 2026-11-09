// ==============================================================================
// FLOWER2U - Sync Staff Users to Supabase Auth (auth.users)
// ==============================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });
}

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('🔄 Provisioning staff_users into Supabase auth.users...\n');
  const { data: staffList, error } = await client
    .from('staff_users')
    .select('id,username,password,full_name,nickname,email');

  if (error) {
    console.error('Fetch staff error:', error);
    return;
  }

  const { data: existingUsersData } = await client.auth.admin.listUsers({ perPage: 1000 });
  const existingUsers = existingUsersData?.users || [];

  for (const s of staffList) {
    const rawUsername = (s.username || '').toLowerCase().trim();
    const email = (s.email && s.email.includes('@')) ? s.email.trim() : `${rawUsername}@flower2u.internal`;
    const rawPass = String(s.password || '123456');
    const authPass = rawPass.length >= 6 ? rawPass : rawPass.padEnd(6, '0');

    const existing = existingUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      console.log(`👤 User ${s.username} (${email}) already exists. Updating password and metadata...`);
      await client.auth.admin.updateUserById(existing.id, {
        password: authPass,
        email_confirm: true,
        user_metadata: {
          username: s.username,
          staffCode: s.id,
          name: s.full_name || s.nickname || s.username
        }
      });
      // Also link auth_user_id in staff_users
      await client.from('staff_users').update({ auth_user_id: existing.id }).eq('id', s.id);
      console.log(`   ✅ Synced & Linked: ${s.username} -> auth ID: ${existing.id}`);
    } else {
      console.log(`➕ Creating auth user for ${s.username} (${email})...`);
      const { data: created, error: createErr } = await client.auth.admin.createUser({
        email,
        password: authPass,
        email_confirm: true,
        user_metadata: {
          username: s.username,
          staffCode: s.id,
          name: s.full_name || s.nickname || s.username
        }
      });

      if (createErr) {
        console.error(`   ❌ Failed to create ${s.username}:`, createErr.message);
      } else {
        await client.from('staff_users').update({ auth_user_id: created.user.id }).eq('id', s.id);
        console.log(`   ✅ Created & Linked: ${s.username} -> auth ID: ${created.user.id}`);
      }
    }
  }

  console.log('\n🎉 All staff accounts are now registered in Supabase Authentication!');
}

run();
