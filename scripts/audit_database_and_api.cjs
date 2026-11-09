const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
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

async function runAudit() {
  console.log('================================================================');
  console.log('🔍 FLOWER2U DATABASE & BACKEND API AUDIT REPORT');
  console.log('Endpoint:', SUPABASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  // 1. Table Inventory & Row Counts
  const tables = [
    'projects',
    'project_quotation_items',
    'project_customer_support',
    'project_expenses',
    'customers',
    'artists',
    'delivery_locations',
    'inventory_items',
    'inventory_categories',
    'asset_loans',
    'asset_units',
    'project_checklist_items',
    'quotations',
    'material_rates',
    'shop_settings',
    'staff_users',
    'roles',
    'deleted_records'
  ];

  console.log('📊 SECTION 1: TABLES, RECORD COUNTS & LATENCY (SERVICE ROLE):');
  const tableResults = [];
  for (const table of tables) {
    const t0 = Date.now();
    const { count, error } = await serviceClient.from(table).select('*', { count: 'exact', head: true });
    const ms = Date.now() - t0;
    if (error) {
      tableResults.push({ table, status: 'ERROR', count: '-', latency: ms + 'ms', error: error.message });
      console.log(`  [FAIL] ${table.padEnd(26)}: ${error.code} - ${error.message} (${ms}ms)`);
    } else {
      tableResults.push({ table, status: 'OK', count, latency: ms + 'ms', error: null });
      console.log(`  [PASS] ${table.padEnd(26)}: ${String(count).padStart(5)} rows  (${ms}ms)`);
    }
  }

  // 2. RLS & Permission Testing (Anon vs Service Role)
  console.log('\n🛡️ SECTION 2: ROW LEVEL SECURITY (RLS) PERMISSION AUDIT:');
  console.log('Comparing Anon Key (Public) vs Service Role Key (Admin):');
  for (const table of tables) {
    const { data: anonData, error: anonErr } = await anonClient.from(table).select('id').limit(1);
    const anonAllowed = !anonErr;
    const anonStatus = anonAllowed ? `ALLOW (${anonData?.length || 0} row)` : `BLOCK (${anonErr.code})`;
    console.log(`  ${table.padEnd(26)} -> Anon: ${anonStatus.padEnd(18)}`);
  }

  // 3. API Endpoint Verification (REST GET / Headers / Payload / Latency)
  console.log('\n🌐 SECTION 3: REST API ENDPOINTS VERIFICATION & RESPONSE HEADERS:');
  const sampleEndpoints = [
    { name: 'Projects (Filtered Month)', path: '/rest/v1/projects?select=id,name,raw_delivery_start&raw_delivery_start=gte.2026-11-01T00:00:00&raw_delivery_start=lte.2026-11-30T23:59:59&limit=5' },
    { name: 'Shop Settings', path: '/rest/v1/shop_settings?select=shop_name,theme_color,updated_at&limit=1' },
    { name: 'Delivery Locations', path: '/rest/v1/delivery_locations?select=id,name,zone&limit=3' },
    { name: 'Artists', path: '/rest/v1/artists?select=id,name,fandom_name&limit=3' },
    { name: 'Customers', path: '/rest/v1/customers?select=id,name,vip_tier&limit=3' },
    { name: 'Tombstones (Deleted Records)', path: '/rest/v1/deleted_records?select=record_id,table_name,deleted_at&limit=5' }
  ];

  for (const ep of sampleEndpoints) {
    const fullUrl = `${SUPABASE_URL}${ep.path}`;
    const t0 = Date.now();
    try {
      const resp = await fetch(fullUrl, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Accept': 'application/json'
        }
      });
      const ms = Date.now() - t0;
      const data = await resp.json();
      const contentRange = resp.headers.get('content-range') || '-';
      const contentType = resp.headers.get('content-type') || '-';
      console.log(`  Endpoint: ${ep.name}`);
      console.log(`    URL: ${ep.path.slice(0, 70)}...`);
      console.log(`    Status: ${resp.status} ${resp.statusText} (${ms}ms)`);
      console.log(`    Content-Type: ${contentType}`);
      console.log(`    Payload Count: ${Array.isArray(data) ? data.length : 1} items | Payload Size: ${(JSON.stringify(data).length / 1024).toFixed(2)} KB`);
    } catch (err) {
      console.log(`  Endpoint: ${ep.name} -> FAILED: ${err.message}`);
    }
  }

  // 4. RPC Functions Check
  console.log('\n⚙️ SECTION 4: RPC (STORED PROCEDURES) AUDIT:');
  const rpcs = [
    { name: 'get_server_analytics', params: { p_year_month: '2026-11' } },
    { name: 'get_server_project_stats', params: { p_year_month: '2026-11' } },
    { name: 'suspend_staff_user', params: { p_staff_id: '00000000-0000-0000-0000-000000000000', p_banned_until: null, p_is_permanent: false, p_reason: 'test' } }
  ];

  for (const rpc of rpcs) {
    const t0 = Date.now();
    const { data, error } = await serviceClient.rpc(rpc.name, rpc.params);
    const ms = Date.now() - t0;
    if (error) {
      console.log(`  RPC '${rpc.name}': ${error.code === 'PGRST202' ? 'NOT FOUND in schema cache' : 'ERROR: ' + error.message} (${ms}ms)`);
    } else {
      console.log(`  RPC '${rpc.name}': SUCCESS (${ms}ms) -> ${JSON.stringify(data).slice(0, 80)}...`);
    }
  }

  // 5. Query Optimization & Index Recommendations
  console.log('\n⚡ SECTION 5: PERFORMANCE & QUERY OPTIMIZATION AUDIT:');
  console.log('Checking high-frequency queries in production:');
  
  // Test query 1: Projects by month (indexed on raw_delivery_start)
  const tMonth0 = Date.now();
  const qMonth = await serviceClient
    .from('projects')
    .select('id, name, raw_delivery_start, deal_status, transport_status, wage, total_revenue')
    .gte('raw_delivery_start', '2026-11-01T00:00:00')
    .lte('raw_delivery_start', '2026-11-30T23:59:59')
    .order('raw_delivery_start', { ascending: false });
  const msMonth = Date.now() - tMonth0;
  console.log(`  1. Projects by Month Query: ${qMonth.data?.length || 0} rows returned in ${msMonth}ms`);

  // Test query 2: Project child items by project_id in batch
  const sampleProjectIds = (qMonth.data || []).slice(0, 10).map(p => p.id);
  if (sampleProjectIds.length > 0) {
    const tChild0 = Date.now();
    const [qQuot, qSupp, qExp] = await Promise.all([
      serviceClient.from('project_quotation_items').select('id, project_id, price').in('project_id', sampleProjectIds),
      serviceClient.from('project_customer_support').select('id, project_id, price').in('project_id', sampleProjectIds),
      serviceClient.from('project_expenses').select('id, project_id, price').in('project_id', sampleProjectIds)
    ]);
    const msChild = Date.now() - tChild0;
    console.log(`  2. Batch Child Tables Query (10 projects in parallel): returned ${qQuot.data?.length || 0} quotes, ${qSupp.data?.length || 0} support, ${qExp.data?.length || 0} expenses in ${msChild}ms`);
  }

  // Test query 3: Tombstone sync delta
  const tTomb0 = Date.now();
  const qTomb = await serviceClient
    .from('deleted_records')
    .select('table_name, record_id, deleted_at')
    .gt('deleted_at', '2026-11-01T00:00:00Z');
  const msTomb = Date.now() - tTomb0;
  console.log(`  3. Tombstone Sync Delta Query: ${qTomb.data?.length || 0} tombstones returned in ${msTomb}ms`);

  console.log('\n================================================================');
  console.log('🏁 AUDIT COMPLETE');
  console.log('================================================================');
}

runAudit();
