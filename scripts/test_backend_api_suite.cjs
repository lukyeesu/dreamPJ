const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load credentials
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 FLOWER2U REST API TESTING & VERIFICATION SUITE');
  console.log('Target:', SUPABASE_URL);
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${extra ? '(' + extra + ')' : ''}`);
      passedTests++;
    } else {
      console.log(`  ❌ [FAIL] ${name} ${extra ? '(' + extra + ')' : ''}`);
      failedTests++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: REST GET Status & Headers
  // -------------------------------------------------------------
  console.log('📡 TEST SUITE 1: REST Endpoints Status, Latency & Headers:');
  const endpoints = [
    { name: 'Projects (Filtered Month)', path: '/rest/v1/projects?select=id,name,raw_delivery_start,wage&limit=5' },
    { name: 'Quotation Items', path: '/rest/v1/project_quotation_items?select=id,project_id,price&limit=5' },
    { name: 'Customer Support Items', path: '/rest/v1/project_customer_support?select=id,project_id,price&limit=5' },
    { name: 'Expenses', path: '/rest/v1/project_expenses?select=id,project_id,price&limit=5' },
    { name: 'Delivery Locations', path: '/rest/v1/delivery_locations?select=id,name,zone&limit=5' },
    { name: 'Shop Settings', path: '/rest/v1/shop_settings?select=id,shop_name,updated_at&limit=1' },
    { name: 'Artists Directory', path: '/rest/v1/artists?select=id,name,fandom_name&limit=5' },
    { name: 'Customers Directory', path: '/rest/v1/customers?select=id,name,vip_tier&limit=5' },
    { name: 'Staff Users (Service Auth)', path: '/rest/v1/staff_users?select=id,username,full_name&limit=5' },
    { name: 'Roles', path: '/rest/v1/roles?select=id,name,code&limit=5' },
    { name: 'Deleted Records (Tombstones)', path: '/rest/v1/deleted_records?select=id,record_id,table_name&limit=5' }
  ];

  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const resp = await fetch(`${SUPABASE_URL}${ep.path}`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Accept': 'application/json'
        }
      });
      const ms = Date.now() - t0;
      const contentType = resp.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = await resp.json();
      const count = Array.isArray(data) ? data.length : 1;

      assert(`${ep.name}`, resp.status === 200 && isJson, `Status: ${resp.status}, Latency: ${ms}ms, Items: ${count}`);
    } catch (err) {
      assert(`${ep.name}`, false, err.message);
    }
  }

  // -------------------------------------------------------------
  // Test 2: Security & RLS Isolation Tests
  // -------------------------------------------------------------
  console.log('\n🔒 TEST SUITE 2: Security & Row Level Security (RLS) Isolation:');
  
  // 2.1 Unauthenticated client trying to access staff_users passwords or confidential details
  const { data: anonStaff, error: anonStaffErr } = await anonClient.from('staff_users').select('id, username, password_hash');
  assert('Anon Client blocked from viewing staff user records or returned empty', !anonStaff || anonStaff.length === 0, `Returned: ${anonStaff?.length || 0} rows`);

  // 2.2 Unauthenticated client trying to query projects with sensitive wages
  const { data: anonProjects, error: anonProjectsErr } = await anonClient.from('projects').select('id, wage, net_profit');
  assert('Anon Client restricted by RLS on projects table', !anonProjects || anonProjects.length === 0, `Returned: ${anonProjects?.length || 0} rows`);

  // 2.3 Public catalog tables should be accessible to anyone (locations, active artists)
  const { data: anonVenues } = await anonClient.from('delivery_locations').select('id, name').limit(1);
  assert('Anon Client permitted to read public delivery locations', anonVenues && anonVenues.length > 0, `Venues: ${anonVenues?.length || 0}`);

  const { data: anonArtists } = await anonClient.from('artists').select('id, name').limit(1);
  assert('Anon Client permitted to read public artist directory', anonArtists && anonArtists.length > 0, `Artists: ${anonArtists?.length || 0}`);

  // -------------------------------------------------------------
  // Test 3: End-to-End CRUD Lifecycle & Tombstone Integrity
  // -------------------------------------------------------------
  console.log('\n🔄 TEST SUITE 3: Full CRUD Lifecycle & Tombstone Synchronization:');
  const testId = `TEST_${Date.now()}`;
  
  // 3.1 Create test project record
  const newProject = {
    id: testId,
    name: 'Automated Backend Test Project',
    category: 'Backdrop',
    artist_name: 'LingOrm',
    customer_name: 'Automated Test Client',
    wage: 9999,
    raw_delivery_start: '2026-11-20T10:00:00',
    deal_status: 'custom-1771415025673',
    transport_status: 'custom-1771415299552',
    payment_status: 'unpaid'
  };

  const { data: createdProj, error: createErr } = await serviceClient
    .from('projects')
    .insert([newProject])
    .select()
    .single();

  assert('CREATE: Insert project via Service Client', !createErr && createdProj?.id === testId, createErr ? createErr.message : `ID: ${testId}`);

  // 3.2 Read back the created record
  const { data: readProj, error: readErr } = await serviceClient
    .from('projects')
    .select('id, name, wage, artist_name')
    .eq('id', testId)
    .single();

  assert('READ: Fetch newly created project', !readErr && readProj?.wage === 9999, `Wage: ${readProj?.wage}`);

  // 3.3 Update the created record
  const { data: updatedProj, error: updateErr } = await serviceClient
    .from('projects')
    .update({ wage: 12500, note: 'Updated by Backend Test Suite' })
    .eq('id', testId)
    .select()
    .single();

  assert('UPDATE: Modify project wage and note', !updateErr && updatedProj?.wage === 12500, `Updated Wage: ${updatedProj?.wage}`);

  // 3.4 Delete the record and record tombstone
  const { error: deleteErr } = await serviceClient
    .from('projects')
    .delete()
    .eq('id', testId);

  assert('DELETE: Remove test project record', !deleteErr, deleteErr ? deleteErr.message : 'Deleted successfully');

  // 3.5 Verify record is completely gone
  const { data: verifyGone } = await serviceClient
    .from('projects')
    .select('id')
    .eq('id', testId)
    .maybeSingle();

  assert('VERIFY: Project record no longer exists in DB', verifyGone === null);

  // -------------------------------------------------------------
  // Test 4: Payload Schema Conformance
  // -------------------------------------------------------------
  console.log('\n📋 TEST SUITE 4: Payload Schema Conformance:');
  const { data: sampleProject } = await serviceClient.from('projects').select('*').limit(1).single();
  if (sampleProject) {
    const requiredKeys = ['id', 'name', 'category', 'raw_delivery_start', 'deal_status', 'transport_status', 'wage', 'delivery_fee', 'deposit_amount', 'total_revenue', 'total_expenses', 'net_profit', 'customer_support_total'];
    const missingKeys = requiredKeys.filter(k => !(k in sampleProject));
    assert('Schema Conformance on projects table', missingKeys.length === 0, missingKeys.length === 0 ? 'All 13 required keys present' : `Missing: ${missingKeys.join(', ')}`);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');
}

runTestSuite();
