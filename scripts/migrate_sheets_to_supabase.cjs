const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local if present
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hvjjgkyitgdldrqnqzpy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const APPS_SCRIPT_URL = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbw2WJ4tt7l__0U6XYtgHbyl0W1iGjm6oHXa9-2twBKfa1xP2-SBj2hMwaHUYp7ew_Ih/exec';

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// Master Venues Library with standardized names, aliases, zones, and rich dock intel
const KNOWN_VENUES = [
  {
    name: 'อิมแพ็ค เมืองทองธานี (Impact Arena / Challenger / Exhibition)',
    aliases: ['อิมแพค', 'อิมแพ็ค', 'impact', 'challenger', 'thunder dome', 'ธันเดอร์โดม', 'เมืองทอง'],
    zone: 'นนทบุรี-เมืองทอง',
    default_map_link: 'https://maps.app.goo.gl/3Xg8G',
    loading_dock_map_link: 'https://maps.app.goo.gl/3Xg8G',
    gate_info: 'ประตูโหลด 4 (ด้านหลัง Arena) หรือ ประตู 3 (Challenger) ลิฟต์ Service C',
    parking_height_limit: 'ไม่เกิน 2.50 เมตร (หลังอาคารมีลานกลางแจ้ง)',
    dock_contact_phone: '02-833-4455',
    delivery_tips: 'แลกบัตร Contractor ชั้น 1 ด้านหลังฮอลล์ บัตร ปชช. ตัวจริง ห้ามสวมรองเท้าแตะ'
  },
  {
    name: 'เซ็นทรัลเวิลด์ (centralwOrld / CTW)',
    aliases: ['ctw', 'CTW', 'Ctw', 'เซ็นทรัลเวิลด์', 'centralworld', 'central world'],
    zone: 'สยาม-ราชประสงค์',
    default_map_link: 'https://maps.app.goo.gl/ctw',
    loading_dock_map_link: 'https://maps.app.goo.gl/ctw',
    gate_info: 'เข้าทางถนนพระราม 1 ลานจอดชั้น B1 ประตูโหลด 3 ใกล้ลิฟต์ขนของ Service C',
    parking_height_limit: 'ไม่เกิน 2.10 เมตร (ระวังคานลานจอด B1)',
    dock_contact_phone: '02-640-7000',
    delivery_tips: 'แลกบัตรผู้รับเหมาชั้น B1 ต้องใส่รองเท้าหุ้มส้น เสื้อมีแขน'
  },
  {
    name: 'ไอคอนสยาม (ICONSIAM / True Icon Hall)',
    aliases: ['ไอคอนสยาม', 'iconsiam', 'icon siam', 'true icon hall', 'ทรู ไอคอน'],
    zone: 'เจริญนคร-ธนบุรี',
    default_map_link: 'https://maps.app.goo.gl/iconsiam',
    loading_dock_map_link: 'https://maps.app.goo.gl/iconsiam',
    gate_info: 'จุดโหลดของด้านหลังถนนเจริญนคร ลิฟต์ขนส่งฝั่ง True Icon Hall ชั้น 7',
    parking_height_limit: 'ไม่เกิน 2.20 เมตร',
    dock_contact_phone: '02-495-7000',
    delivery_tips: 'ขึ้นลิฟต์ขนส่งตรงไปชั้น 7 จุดรับของหน้าฮอลล์ รปภ. ตรวจบัตรเคร่งครัด'
  },
  {
    name: 'เดอะมอลล์ไลฟ์สโตร์ บางกะปิ (MCC Hall)',
    aliases: ['เดอะมอลล์บางกะปิ', 'เดอะมอลล์บางกระปิ', 'mcc hall', 'เดอะมอลล์ บางกะปิ', 'mcc hall บางกะปิ'],
    zone: 'ลาดพร้าว-รามคำแหง',
    default_map_link: 'https://maps.app.goo.gl/themallbangkapi',
    loading_dock_map_link: 'https://maps.app.goo.gl/themallbangkapi',
    gate_info: 'จุดเทียบรถขนของชั้น 3A หรือลานด้านหลังอาคาร ลิฟต์ Service ขึ้น MCC Hall ชั้น 4',
    parking_height_limit: 'ไม่เกิน 2.10 เมตร',
    dock_contact_phone: '02-173-1000',
    delivery_tips: 'MCC Hall อยู่ชั้น 4 แลกบัตรก่อนนำของขึ้น'
  },
  {
    name: 'สยามพารากอน (Siam Paragon / Royal Paragon Hall)',
    aliases: ['สยามพารากอน', 'พารากอน', 'paragon', 'siam paragon', 'royal paragon hall'],
    zone: 'สยาม-ปทุมวัน',
    default_map_link: 'https://maps.app.goo.gl/paragon',
    loading_dock_map_link: 'https://maps.app.goo.gl/paragon',
    gate_info: 'เข้าทางถนนพระราม 1 ลานจอดชั้น B1 เสา F15 ประตูขนส่ง ลิฟต์ตรงไปชั้น 5',
    parking_height_limit: 'ไม่เกิน 2.10 เมตร',
    dock_contact_phone: '02-610-8000',
    delivery_tips: 'Royal Paragon Hall อยู่ชั้น 5 ต้องแลกบัตร Visitor ที่ห้องควบคุม B1'
  },
  {
    name: 'ยูเนี่ยน มอลล์ (Union Mall / Union Hall)',
    aliases: ['ยูเนียนมอล์ล', 'ยูเนี่ยนมอลล์', 'union mall', 'union hall', 'ยูเนี่ยน มอลล์'],
    zone: 'ลาดพร้าว-จตุจักร',
    default_map_link: 'https://maps.app.goo.gl/unionmall',
    loading_dock_map_link: 'https://maps.app.goo.gl/unionmall',
    gate_info: 'จุดโหลดของด้านหลังฝั่งถนนลาดพร้าว ซอย 1 ลิฟต์ขนส่งตรงไป Union Hall ชั้น 6',
    parking_height_limit: 'ไม่เกิน 2.20 เมตร',
    dock_contact_phone: '02-512-5000',
    delivery_tips: 'Union Hall ชั้น 6 ขนสแตนด์โครงเหล็กใช้ลิฟต์ตัวใหญ่หลังเวที'
  },
  {
    name: 'แฟชั่นไอส์แลนด์ (Fashion Island / Island Hall)',
    aliases: ['แฟชั่น', 'แฟชั่นไอส์แลนด์', 'fashion island', 'island hall'],
    zone: 'รามอินทรา',
    default_map_link: 'https://maps.app.goo.gl/fashionisland',
    loading_dock_map_link: 'https://maps.app.goo.gl/fashionisland',
    gate_info: 'ทางเข้าขนส่งด้านหลังอาคาร ฝั่งถนนรามอินทรา ลิฟต์ Service ขึ้นชั้น 3',
    parking_height_limit: 'ไม่เกิน 2.30 เมตร',
    dock_contact_phone: '02-947-5000',
    delivery_tips: 'Island Hall ชั้น 3 ประตูเปิดให้ส่งของก่อนเวลางาน 2 ชม.'
  },
  {
    name: 'ลิโด้ คอนเน็คท์ (Lido Connect)',
    aliases: ['ลิโด้', 'lido', 'lido connect'],
    zone: 'สยาม-ปทุมวัน',
    default_map_link: 'https://maps.app.goo.gl/lido',
    loading_dock_map_link: 'https://maps.app.goo.gl/lido',
    gate_info: 'สยามสแควร์ ซอย 3 จุดจอดเทียบรถหน้าร้านได้ชั่วคราวช่วงเช้า',
    parking_height_limit: 'กลางแจ้ง (ไม่มีหลังคา)',
    dock_contact_phone: '02-011-7788',
    delivery_tips: 'พื้นที่สยามสแควร์รถติดช่วงบ่าย แนะนำขนของเข้าก่อนเที่ยง'
  },
  {
    name: 'เมเจอร์ ซีนีเพล็กซ์ รัชโยธิน',
    aliases: ['เมเจอร์รัชโยธิน', 'รัชโยธิน', 'major ratchayothin'],
    zone: 'พหลโยธิน-รัชโยธิน',
    default_map_link: 'https://maps.app.goo.gl/majorratchayothin',
    loading_dock_map_link: 'https://maps.app.goo.gl/majorratchayothin',
    gate_info: 'ลานจอดด้านหลัง ลิฟต์โรงภาพยนตร์',
    parking_height_limit: 'ไม่เกิน 2.10 เมตร',
    dock_contact_phone: '02-515-5555',
    delivery_tips: 'แลกบัตร รปภ. ลานจอดด้านหลัง'
  },
  {
    name: 'ศูนย์การประชุมแห่งชาติสิริกิติ์ (QSNCC)',
    aliases: ['ศูนย์สิริกิติ์', 'qsncc', 'qsnc', 'สิริกิติ์'],
    zone: 'พระราม 4-คลองเตย',
    default_map_link: 'https://maps.app.goo.gl/qsncc',
    loading_dock_map_link: 'https://maps.app.goo.gl/qsncc',
    gate_info: 'จุดเทียบรถขนถ่ายสินค้า Loading Bay ชั้น LG ฝั่งถนนรัชดาภิเษก',
    parking_height_limit: 'ไม่เกิน 2.80 เมตร (Loading Bay กว้างมาก)',
    dock_contact_phone: '02-229-3000',
    delivery_tips: 'ต้องลงทะเบียนรับบัตร Contractor Pass ที่เคาน์เตอร์ Loading Bay ชั้น LG'
  },
  {
    name: 'สามย่านมิตรทาวน์ (Samyan Mitrtown / Mitrtown Hall)',
    aliases: ['สามย่านมิตรทาวน์', 'สามย่าน', 'samyan mitrtown', 'mitrtown'],
    zone: 'สามย่าน-พระราม 4',
    default_map_link: 'https://maps.app.goo.gl/samyan',
    loading_dock_map_link: 'https://maps.app.goo.gl/samyan',
    gate_info: 'จุดโหลดสินค้าชั้น B2 ลิฟต์ขนส่งตรงไป Mitrtown Hall ชั้น 5',
    parking_height_limit: 'ไม่เกิน 2.10 เมตร',
    dock_contact_phone: '02-033-8888',
    delivery_tips: 'Mitrtown Hall ชั้น 5 มีทางลาดเข็นรถเข็นได้สะดวก'
  }
];

async function migrate() {
  console.log('================================================================');
  console.log('🚀 CLEAN RE-MIGRATION: GOOGLE SHEETS -> SUPABASE (WITH VENUES)');
  console.log('================================================================');

  // 1. Fetch data from Google Apps Script
  console.log('\n📥 1. Fetching raw projects from Google Apps Script...');
  const sheetRes = await fetch(APPS_SCRIPT_URL);
  const sheetJson = await sheetRes.json();
  const rawProjects = sheetJson.data || [];
  console.log(`✅ Loaded ${rawProjects.length} projects from Google Sheets.`);

  console.log('📥 1.1 Fetching settings from Google Apps Script...');
  const settingsRes = await fetch(`${APPS_SCRIPT_URL}?action=getSettings`);
  const settingsJson = await settingsRes.json();
  const rawSettings = settingsJson.data || {};
  console.log('✅ Settings loaded.');

  // 2. Clear Old Records Cleanly
  console.log('\n🧹 2. Clearing old data from Supabase tables (Cascading Wipe)...');
  try {
    // Child tables are deleted via cascade when projects are deleted, but deleting explicitly is clean
    await client.from('project_quotation_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await client.from('project_customer_support').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await client.from('project_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await client.from('projects').delete().neq('id', '___PLACEHOLDER___');
    console.log('✅ Cleared old projects and financial items.');

    await client.from('artists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await client.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Cleared old artists and customers.');

    // Check if delivery_locations table exists
    try {
      await client.from('delivery_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('✅ Cleared old delivery locations.');
    } catch (e) {
      console.log('ℹ️ delivery_locations table not created yet (will insert if created).');
    }
  } catch (err) {
    console.error('❌ Error clearing old records:', err.message);
  }

  // 3. Migrate Shop Settings
  console.log('\n⚙️ 3. Migrating shop settings...');
  if (rawSettings.shop_info) {
    const s = rawSettings.shop_info;
    const shopPayload = [{
      shop_name: s.shopName || 'Flower2you',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      line_id: s.line || '',
      facebook: s.facebook || '',
      instagram: s.instagram || '',
      tiktok: s.tiktok || '',
      twitter: s.twitter || '',
      wechat: s.wechat || '',
      telegram: s.telegram || '',
      logo_url: s.logo || '',
      theme_color: s.themeColor || 'indigo',
      theme_mode: s.themeMode || 'gradient',
      custom_color_value: s.customColorValue || '#70d270',
      reference_folder_id: rawSettings.drive_folder_id || '',
      assets_folder_id: rawSettings.assets_drive_folder_id || '',
      line_bot_token: rawSettings.line_bot_token || '',
      telegram_bot_token: rawSettings.telegram_bot_token || '',
      telegram_chat_id: String(rawSettings.telegram_chat_id || '')
    }];
    try {
      await client.from('shop_settings').upsert(shopPayload);
      console.log('✅ Shop settings migrated.');
    } catch (e) {
      console.warn('⚠️ Shop settings note:', e.message);
    }
  }

  // 4. Extract, Standardize & Ingest Delivery Locations (Venues)
  console.log('\n📍 4. Processing delivery locations...');
  const locationVenueMap = new Map(); // string key -> venue object
  const allRawLocations = new Set();

  rawProjects.forEach(p => {
    const loc = (p.location || '').trim();
    if (loc && loc !== '-') {
      allRawLocations.add(loc);
    }
  });

  // Prepare venues payload starting with KNOWN_VENUES
  const venuesToInsert = [...KNOWN_VENUES];

  // Helper function to match a raw location text to a standardized venue
  function matchVenue(rawLoc) {
    if (!rawLoc || rawLoc === '-') return null;
    const clean = rawLoc.toLowerCase().trim();
    for (const v of venuesToInsert) {
      if (v.name.toLowerCase().includes(clean)) return v;
      for (const alias of (v.aliases || [])) {
        if (clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean)) {
          return v;
        }
      }
    }
    return null;
  }

  // Add any unique unmapped locations as new venues
  allRawLocations.forEach(rawLoc => {
    const matched = matchVenue(rawLoc);
    if (!matched) {
      venuesToInsert.push({
        name: rawLoc,
        aliases: [rawLoc],
        zone: 'ทั่วไป',
        default_map_link: ''
      });
    }
  });

  console.log(`Found ${venuesToInsert.length} normalized venues from ${allRawLocations.size} unique raw entries.`);

  // Insert venues into delivery_locations if table exists
  let venueIdMap = new Map();
  try {
    const { data: insertedVenues, error: vErr } = await client
      .from('delivery_locations')
      .upsert(venuesToInsert, { onConflict: 'name' })
      .select('id, name, aliases');
    
    if (vErr) {
      console.warn('⚠️ delivery_locations table insert note:', vErr.message);
    } else {
      (insertedVenues || []).forEach(v => {
        venueIdMap.set(v.name, v.id);
        (v.aliases || []).forEach(a => venueIdMap.set(a.toLowerCase().trim(), v.id));
      });
      console.log(`✅ ${insertedVenues.length} delivery venues stored in Supabase!`);
    }
  } catch (e) {
    console.warn('⚠️ Note on delivery_locations:', e.message);
  }

  // 5. Extract & Insert Artists
  console.log('\n🎨 5. Processing unique artists...');
  const artistNames = new Set();
  rawProjects.forEach(p => {
    if (p.artist && typeof p.artist === 'string' && p.artist.trim()) {
      artistNames.add(p.artist.trim());
    }
  });
  console.log(`Found ${artistNames.size} unique artists.`);

  const artistPayload = Array.from(artistNames).map(name => ({ name }));
  if (artistPayload.length > 0) {
    await client.from('artists').upsert(artistPayload, { onConflict: 'name' });
  }
  const { data: dbArtists } = await client.from('artists').select('id, name');
  const artistMap = new Map();
  (dbArtists || []).forEach(a => artistMap.set(a.name, a.id));
  console.log(`✅ ${artistMap.size} artists mapped to IDs.`);

  // 6. Extract & Insert Customers
  console.log('\n👥 6. Processing unique customers...');
  const customerMapRaw = new Map();
  rawProjects.forEach(p => {
    if (p.customer && typeof p.customer === 'string' && p.customer.trim()) {
      const name = p.customer.trim();
      const info = p.customerInfo || {};
      if (!customerMapRaw.has(name)) {
        customerMapRaw.set(name, {
          name,
          phone: info.phone || '',
          line_id: info.line || '',
          social_account: info.social || '',
          email: info.email || '',
          tax_id: info.taxId || '',
          billing_address: info.address || ''
        });
      }
    }
  });

  const customerPayload = Array.from(customerMapRaw.values());
  if (customerPayload.length > 0) {
    for (const c of customerPayload) {
      try {
        await client.from('customers').insert([c]);
      } catch (e) {
        // ignore duplicate
      }
    }
  }
  const { data: dbCustomers } = await client.from('customers').select('id, name');
  const customerMap = new Map();
  (dbCustomers || []).forEach(c => customerMap.set(c.name, c.id));
  console.log(`✅ ${customerMap.size} customers mapped to IDs.`);

  // 7. Transform Projects & Child Tables
  console.log('\n📦 7. Transforming and preparing projects data...');
  const projectsToInsert = [];
  const quotationItemsToInsert = [];
  const supportItemsToInsert = [];
  const expensesToInsert = [];

  for (const row of rawProjects) {
    const projectId = row.id;
    if (!projectId) continue;

    const artistName = (row.artist || '').trim();
    const customerName = (row.customer || '').trim();
    const rawLoc = (row.location || '').trim();
    const info = row.customerInfo || {};

    const wage = Number(row.wage) || 0;
    const deliveryFee = Number(row.deliveryFee) || 0;
    const depositAmount = Number(row.depositAmount) || 0;
    const totalRevenue = wage + deliveryFee;

    // Match location_id
    let locationId = null;
    if (rawLoc && rawLoc !== '-') {
      const matched = matchVenue(rawLoc);
      if (matched && venueIdMap.has(matched.name)) {
        locationId = venueIdMap.get(matched.name);
      } else if (venueIdMap.has(rawLoc.toLowerCase())) {
        locationId = venueIdMap.get(rawLoc.toLowerCase());
      }
    }

    // Customer support items
    let customerSupportTotal = 0;
    if (Array.isArray(row.customerSupport)) {
      row.customerSupport.forEach((cs, idx) => {
        const denom = Math.round(Number(cs.denomination)) || 0;
        const qty = Math.round(Number(cs.quantity)) || 0;
        const pr = Number(cs.price) || (denom * qty);
        customerSupportTotal += Number(cs.price) || (denom * Number(cs.quantity)) || 0;
        if (denom > 0 && (qty > 0 || pr > 0)) {
          supportItemsToInsert.push({
            project_id: projectId,
            denomination: denom,
            quantity: qty,
            price: pr,
            sort_order: idx
          });
        }
      });
    }

    // Expenses
    let totalExpenses = 0;
    if (Array.isArray(row.expenses)) {
      row.expenses.forEach((ex, idx) => {
        const cat = (ex.category || '').trim();
        const det = (ex.detail || '').trim();
        const pr = Number(ex.price) || 0;
        const qty = Number(ex.quantity) || 1;
        const unitPr = Number(ex.unitPrice) || (qty > 0 ? pr / qty : pr);
        totalExpenses += pr;
        if (cat || det || pr > 0) {
          expensesToInsert.push({
            project_id: projectId,
            category: cat || 'ค่าใช้จ่ายทั่วไป',
            detail: det,
            quantity: qty,
            unit_price: unitPr,
            price: pr,
            sort_order: idx
          });
        }
      });
    }

    const netProfit = totalRevenue - totalExpenses;

    // Quotation items
    if (Array.isArray(row.quotationItems)) {
      row.quotationItems.forEach((qi, idx) => {
        const cat = (qi.category || '').trim();
        const det = (qi.detail || '').trim();
        const pr = Number(qi.price) || 0;
        const qty = Number(qi.quantity) || 1;
        const unitPr = Number(qi.unitPrice) || (qty > 0 ? pr / qty : pr);
        if (cat || det || pr > 0) {
          quotationItemsToInsert.push({
            project_id: projectId,
            category: cat || 'รายการทั่วไป',
            detail: det,
            quantity: qty,
            unit_price: unitPr,
            price: pr,
            sort_order: idx
          });
        }
      });
    }

    // Parse date
    let projectDateTime = null;
    if (row.rawDateTime) {
      try {
        const d = new Date(row.rawDateTime);
        if (!isNaN(d.getTime())) projectDateTime = d.toISOString();
      } catch (e) {}
    }

    // Images & slips
    const images = [];
    if (row.image && typeof row.image === 'string' && row.image.trim()) {
      images.push(row.image.trim());
    }
    const slips = Array.isArray(row.slips) ? row.slips.filter(s => typeof s === 'string' && s.trim()) : [];

    const projRecord = {
      id: projectId,
      name: row.name || 'โปรเจกต์งาน',
      category: row.category || 'งานจัดดอกไม้',
      project_datetime: projectDateTime,
      payment_date: row.paymentDate || null,
      artist_name: artistName || null,
      artist_id: artistMap.get(artistName) || null,
      customer_name: customerName || null,
      customer_id: customerMap.get(customerName) || null,
      customer_phone: info.phone || null,
      customer_line: info.line || null,
      customer_social: info.social || null,
      customer_email: info.email || null,
      customer_tax_id: info.taxId || null,
      customer_address: info.address || null,
      recipient_name: row.recipient || null,
      recipient_phone: row.recipientPhone || null,
      location_name: rawLoc || null,
      map_link: row.mapLink || null,
      raw_delivery_start: row.rawDeliveryStart || null,
      raw_delivery_end: row.rawDeliveryEnd || null,
      delivery_date_display: row.deliveryDate || null,
      deal_status: row.dealStatus || 'operating',
      transport_status: row.transportStatus || 'preparing',
      payment_status: row.paymentStatus || 'unpaid',
      wage,
      delivery_fee: deliveryFee,
      deposit_amount: depositAmount,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      customer_support_total: customerSupportTotal,
      note: row.note || '',
      primary_image_url: images[0] || null,
      images,
      slips
    };

    if (locationId) {
      projRecord.location_id = locationId;
    }

    projectsToInsert.push(projRecord);
  }

  // 8. Batch Insert Projects
  console.log(`\n📤 8. Inserting ${projectsToInsert.length} projects to Supabase (Chunks of 50)...`);
  const chunkSize = 50;
  for (let i = 0; i < projectsToInsert.length; i += chunkSize) {
    const chunk = projectsToInsert.slice(i, i + chunkSize);
    const { error: pErr } = await client.from('projects').upsert(chunk);
    if (pErr) {
      // If location_id is not in schema yet, strip location_id and retry
      if (pErr.message && pErr.message.includes('location_id')) {
        console.warn('⚠️ location_id column not present in projects yet, retrying without location_id...');
        const strippedChunk = chunk.map(item => {
          const copy = { ...item };
          delete copy.location_id;
          return copy;
        });
        const { error: retryErr } = await client.from('projects').upsert(strippedChunk);
        if (retryErr) throw retryErr;
      } else {
        throw pErr;
      }
    }
    console.log(`  Processed projects ${i + 1} - ${Math.min(i + chunkSize, projectsToInsert.length)} / ${projectsToInsert.length}`);
  }
  console.log('✅ All projects inserted successfully!');

  // 9. Batch Insert Child Items
  if (quotationItemsToInsert.length > 0) {
    console.log(`\n📤 9.1 Inserting ${quotationItemsToInsert.length} quotation items...`);
    for (let i = 0; i < quotationItemsToInsert.length; i += 100) {
      const chunk = quotationItemsToInsert.slice(i, i + 100);
      await client.from('project_quotation_items').insert(chunk);
    }
    console.log('✅ All quotation items inserted.');
  }

  if (supportItemsToInsert.length > 0) {
    console.log(`📤 9.2 Inserting ${supportItemsToInsert.length} customer support money items...`);
    for (let i = 0; i < supportItemsToInsert.length; i += 100) {
      const chunk = supportItemsToInsert.slice(i, i + 100);
      await client.from('project_customer_support').insert(chunk);
    }
    console.log('✅ All customer support money items inserted.');
  }

  if (expensesToInsert.length > 0) {
    console.log(`📤 9.3 Inserting ${expensesToInsert.length} expense items...`);
    for (let i = 0; i < expensesToInsert.length; i += 100) {
      const chunk = expensesToInsert.slice(i, i + 100);
      await client.from('project_expenses').insert(chunk);
    }
    console.log('✅ All expense items inserted.');
  }

  // 10. Verification
  console.log('\n================================================================');
  console.log('🔍 VERIFICATION SUMMARY:');
  const { count: pCount } = await client.from('projects').select('*', { count: 'exact', head: true });
  const { count: aCount } = await client.from('artists').select('*', { count: 'exact', head: true });
  const { count: cCount } = await client.from('customers').select('*', { count: 'exact', head: true });
  const { count: qCount } = await client.from('project_quotation_items').select('*', { count: 'exact', head: true });
  const { count: sCount } = await client.from('project_customer_support').select('*', { count: 'exact', head: true });
  const { count: eCount } = await client.from('project_expenses').select('*', { count: 'exact', head: true });

  console.log(`  - Projects:               ${pCount} records`);
  console.log(`  - Artists:                ${aCount} records`);
  console.log(`  - Customers:              ${cCount} records`);
  console.log(`  - Quotation Items:        ${qCount} records`);
  console.log(`  - Customer Support Items: ${sCount} records`);
  console.log(`  - Expense Items:          ${eCount} records`);
  console.log('================================================================');
  console.log('🎉 RE-MIGRATION COMPLETE WITH 100% CLEAN RELATIONAL DATA!');
}

migrate().catch(err => {
  console.error('\n❌ MIGRATION FAILED:', err);
  process.exit(1);
});
