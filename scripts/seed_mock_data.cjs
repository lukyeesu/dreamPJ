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
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const isDryRun = process.argv.includes('--dry-run');
const countArg = process.argv.find(arg => arg.startsWith('--count='));
const recordCount = countArg ? parseInt(countArg.split('=')[1], 10) : 3;

const MOCK_ARTISTS = ['LingOrm', 'Freen', 'Pavel', 'Nunew DMD', 'AuauSave Dmd', 'Becky', 'Zee Pruk'];
const MOCK_CUSTOMERS = ['Fanclub Bangkok', 'Inter Fans Global', 'China Official FC', 'Inter Support Team', 'Local Sponsor'];
const MOCK_CATEGORIES = ['Backdrop', 'Floral Stand', 'Bouquet', 'Money Flower Box', 'Balloon Garland'];
const MOCK_LOCATIONS = ['อิมแพ็ค เมืองทองธานี', 'เซ็นทรัลเวิลด์ (CTW)', 'พารากอน ฮอลล์', 'ไอคอนสยาม', 'ไบเทค บางนา'];

async function seed() {
  console.log('================================================================');
  console.log(`🌱 FLOWER2U MOCK DATA SEEDER (Count: ${recordCount}, DryRun: ${isDryRun})`);
  console.log('================================================================\n');

  const createdProjects = [];
  const createdSupport = [];
  const createdExpenses = [];

  for (let i = 1; i <= recordCount; i++) {
    const id = `MOCK-${Date.now().toString().slice(-4)}-${i}`;
    const artist = MOCK_ARTISTS[Math.floor(Math.random() * MOCK_ARTISTS.length)];
    const customer = MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)];
    const category = MOCK_CATEGORIES[Math.floor(Math.random() * MOCK_CATEGORIES.length)];
    const location = MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)];
    const wage = Math.floor(Math.random() * 20 + 5) * 1000;
    const supportTotal = Math.floor(Math.random() * 50 + 10) * 1000;
    const expensesTotal = Math.floor(wage * 0.4);

    const project = {
      id,
      name: `${category} งานซัพพอร์ต ${artist}`,
      category,
      artist_name: artist,
      customer_name: customer,
      location_name: location,
      wage,
      delivery_fee: 500,
      deposit_amount: Math.floor(wage / 2),
      total_revenue: wage + 500,
      total_expenses: expensesTotal,
      net_profit: wage + 500 - expensesTotal,
      customer_support_total: supportTotal,
      raw_delivery_start: new Date(Date.now() + i * 86400000).toISOString().slice(0, 16),
      deal_status: 'custom-1771415025673',
      transport_status: 'custom-1771415299552',
      payment_status: 'paid',
      note: 'สร้างโดย Automated Mock Data Seeder'
    };

    createdProjects.push(project);

    // Mock Customer Support Banknotes
    createdSupport.push({
      id: `MCS-${id}-1`,
      project_id: id,
      denomination: 1000,
      quantity: Math.floor(supportTotal / 1000),
      price: supportTotal,
      item_date: new Date().toISOString().slice(0, 10)
    });

    // Mock Expenses
    createdExpenses.push({
      id: `MEX-${id}-1`,
      project_id: id,
      category: 'ค่าดอกไม้สด',
      detail: 'สั่งดอกไม้ปากคลองตลาด',
      quantity: 1,
      unit_price: expensesTotal,
      price: expensesTotal,
      item_date: new Date().toISOString().slice(0, 10)
    });
  }

  if (isDryRun) {
    console.log('DRY RUN: Sample Project to be created:');
    console.log(createdProjects[0]);
    console.log(`\nWill insert ${createdProjects.length} projects, ${createdSupport.length} support envelopes, and ${createdExpenses.length} expenses.`);
    return;
  }

  console.log(`Inserting ${createdProjects.length} projects to Supabase...`);
  const { error: pErr } = await supabase.from('projects').insert(createdProjects);
  if (pErr) throw pErr;

  console.log(`Inserting ${createdSupport.length} customer support items...`);
  const { error: sErr } = await supabase.from('project_customer_support').insert(createdSupport);
  if (sErr) throw sErr;

  console.log(`Inserting ${createdExpenses.length} expense items...`);
  const { error: eErr } = await supabase.from('project_expenses').insert(createdExpenses);
  if (eErr) throw eErr;

  console.log('\n✅ Mock data seeded successfully!');
  console.log(`Project IDs: ${createdProjects.map(p => p.id).join(', ')}`);
}

seed().catch(err => {
  console.error('❌ Seeder Error:', err);
  process.exit(1);
});
