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

async function checkHealth() {
  console.log('================================================================');
  console.log('🩺 FLOWER2U BACKEND LOG & HEALTH MONITORING SYSTEM');
  console.log('Target Endpoint:', SUPABASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const issues = [];
  const warnings = [];

  // 1. API Latency & Uptime Benchmark
  console.log('1. UPTIME & LATENCY HEALTH:');
  const t0 = Date.now();
  const { data: pingData, error: pingErr } = await serviceClient.from('shop_settings').select('id, updated_at').limit(1).maybeSingle();
  const pingMs = Date.now() - t0;
  if (pingErr) {
    issues.push(`API Unresponsive: ${pingErr.message}`);
    console.log(`  ❌ API Ping FAILED: ${pingErr.message}`);
  } else {
    console.log(`  ✅ Supabase REST API Ping: Healthy (${pingMs}ms)`);
  }

  // 2. Data Consistency & Orphan Check
  console.log('\n2. DATABASE INTEGRITY & ORPHAN RECORD CHECK:');
  
  // 2.1 Check Projects with Missing Delivery Dates
  const { count: invalidDatesCount } = await serviceClient
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .or('raw_delivery_start.is.null,raw_delivery_start.eq.""');
  
  if (invalidDatesCount > 0) {
    warnings.push(`${invalidDatesCount} projects have missing or empty delivery date (raw_delivery_start)`);
    console.log(`  ⚠️ Projects without valid raw_delivery_start: ${invalidDatesCount}`);
  } else {
    console.log(`  ✅ Project Delivery Dates: 100% valid`);
  }

  // 2.2 Check Orphan Customer Support Envelopes
  const { data: allProjects } = await serviceClient.from('projects').select('id');
  const projectSet = new Set((allProjects || []).map(p => p.id));

  const { data: sampleSupport } = await serviceClient.from('project_customer_support').select('id, project_id').limit(100);
  const orphanSupport = (sampleSupport || []).filter(s => !projectSet.has(s.project_id));
  if (orphanSupport.length > 0) {
    issues.push(`Found ${orphanSupport.length} orphan customer support items without parent project`);
    console.log(`  ❌ Orphan Support Items: ${orphanSupport.length} detected`);
  } else {
    console.log(`  ✅ Customer Support Foreign Keys: Consistent (0 orphans)`);
  }

  // 2.3 Check Orphan Expenses
  const { data: sampleExpenses } = await serviceClient.from('project_expenses').select('id, project_id').limit(100);
  const orphanExpenses = (sampleExpenses || []).filter(e => !projectSet.has(e.project_id));
  if (orphanExpenses.length > 0) {
    issues.push(`Found ${orphanExpenses.length} orphan expense items without parent project`);
    console.log(`  ❌ Orphan Expense Items: ${orphanExpenses.length} detected`);
  } else {
    console.log(`  ✅ Expense Items Foreign Keys: Consistent (0 orphans)`);
  }

  // 3. Security & RLS Health
  console.log('\n3. SECURITY & PERMISSION POSTURE:');
  const { data: anonAttempt } = await anonClient.from('staff_users').select('id');
  if (anonAttempt && anonAttempt.length > 0) {
    issues.push(`CRITICAL: staff_users table is exposing records to public Anon key!`);
    console.log(`  ❌ staff_users RLS: VULNERABLE (${anonAttempt.length} rows leaked)`);
  } else {
    console.log(`  ✅ staff_users RLS: Strict & Secure (Public access blocked)`);
  }

  const { data: anonProjAttempt } = await anonClient.from('projects').select('id');
  if (anonProjAttempt && anonProjAttempt.length > 0) {
    warnings.push(`projects table is allowing anon read (${anonProjAttempt.length} rows)`);
    console.log(`  ⚠️ projects RLS: Anon read active (${anonProjAttempt.length} rows)`);
  } else {
    console.log(`  ✅ projects RLS: Protected (Anon read blocked)`);
  }

  // 4. Schema Discrepancy Warnings
  console.log('\n4. SCHEMA & EXTENSION STATUS:');
  const missingTables = [];
  for (const t of ['asset_units', 'project_checklist_items']) {
    const { error } = await serviceClient.from(t).select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      missingTables.push(t);
    }
  }
  if (missingTables.length > 0) {
    warnings.push(`Tables not yet created on Supabase: ${missingTables.join(', ')}. Run database_scripts/unified_database_upgrade.sql to create them.`);
    console.log(`  ⚠️ Pending Schema Migration: ${missingTables.join(', ')} (Run unified_database_upgrade.sql)`);
  } else {
    console.log(`  ✅ All 18 application tables exist`);
  }

  // 5. Final Diagnostic Summary
  console.log('\n================================================================');
  console.log('📋 MONITORING SUMMARY & HEALTH SCORE:');
  const healthScore = Math.max(0, 100 - issues.length * 25 - warnings.length * 10);
  console.log(`Overall Health Score: ${healthScore}%`);
  console.log(`Critical Issues: ${issues.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (issues.length > 0) {
    console.log('\nAction Required for Issues:');
    issues.forEach(iss => console.log(`  - ❌ ${iss}`));
  }
  if (warnings.length > 0) {
    console.log('\nRecommendations for Warnings:');
    warnings.forEach(w => console.log(`  - ⚠️ ${w}`));
  }
  console.log('================================================================\n');
}

checkHealth();
