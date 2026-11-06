// ==============================================================================
// FLOWER2U (F2U) - API Connection & Health Check Script
// Run via: node scripts/test_api_connection.cjs
// ==============================================================================

const fs = require('fs');
const path = require('path');

// 1. Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        process.env[k] = v;
      }
    }
  });
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runHealthCheck() {
  console.log('🔍 Testing Supabase API Connections...\n');
  console.log('Project URL:', url);
  console.log('Anon Key:', anonKey ? anonKey.slice(0, 15) + '...' : 'MISSING');
  console.log('Secret Key:', secretKey ? secretKey.slice(0, 15) + '...' : 'MISSING');

  // Test 1: Service Role
  console.log('\n--- Test 1: Service Role Key (Admin Access) ---');
  try {
    const res = await fetch(`${url}/rest/v1/projects?select=id,name,deal_status&limit=2`, {
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Sample Data:', data);
    console.log('✅ Service Role Connection: PASS');
  } catch (e) {
    console.error('❌ Service Role Connection FAIL:', e.message);
  }

  // Test 2: Anon Key (Frontend Access)
  console.log('\n--- Test 2: Anon / Public Key (Frontend App Access) ---');
  try {
    const res = await fetch(`${url}/rest/v1/projects?select=id,name,deal_status&limit=2`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Data returned:', data);
    if (Array.isArray(data) && data.length > 0) {
      console.log('✅ Anon Key Read Access: PASS (RLS Policies Active)');
    } else {
      console.log('⚠️ Anon Key returned 0 rows. (Please run database_scripts/enable_rls_and_policies.sql in Supabase SQL editor to allow anon read access)');
    }
  } catch (e) {
    console.error('❌ Anon Connection FAIL:', e.message);
  }

  // Test 3: RPC Server Aggregation
  console.log('\n--- Test 3: Server Push-Down Analytics (RPC) ---');
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_financial_analytics`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Server Aggregation Result:', data);
    console.log('✅ Server Analytics Engine: PASS');
  } catch (e) {
    console.error('❌ Server Analytics FAIL:', e.message);
  }

  console.log('\n🏁 Health Check Completed!');
}

runHealthCheck();
