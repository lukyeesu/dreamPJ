const { loadProductionComponent } = require('./helpers/productionUiHarness.cjs');
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { render, fireEvent, act, cleanup, within } = require('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '<div id="root"></div>';
});

function setupHeaderPortalTargets() {
  const host = document.createElement('div');
  host.innerHTML = `
    <div id="app-header-center-search-slot"></div>
    <div id="app-header-filter-slot"></div>
    <div id="app-header-mobile-search-trigger-slot"></div>
    <div id="app-header-mobile-search"></div>
    <div id="app-header-filter-drawer"></div>
  `;
  document.body.appendChild(host);
  return {
    centerSearch: document.getElementById('app-header-center-search-slot'),
    filterSlot: document.getElementById('app-header-filter-slot'),
    mobileSearchSlot: document.getElementById('app-header-mobile-search-trigger-slot'),
    mobileSearchOverlay: document.getElementById('app-header-mobile-search'),
    filterDrawer: document.getElementById('app-header-filter-drawer')
  };
}

test('HeaderFilterPortal hides standalone mobile filter icon until magnifying glass is opened and clears search with X', async () => {
  const HeaderFilterPortal = await loadProductionComponent('src/components/common/HeaderFilterPortal.jsx');
  const slots = setupHeaderPortalTargets();

  function Harness() {
    const [q, setQ] = React.useState('');
    const [filterCount, setFilterCount] = React.useState(2);
    return React.createElement(
      HeaderFilterPortal,
      {
        searchValue: q,
        onSearchChange: setQ,
        placeholder: 'ค้นหางาน...',
        activeFilterCount: filterCount,
        onReset: () => {
          setQ('');
          setFilterCount(0);
        }
      },
      React.createElement('div', { 'data-testid': 'filter-content' }, 'ตัวกรองสถานะงาน')
    );
  }

  await act(async () => {
    render(React.createElement(Harness));
  });

  // 1. Standalone mobile filter slot must be empty when search is present (freeing space for AppBar actions)
  assert.equal(slots.filterSlot.children.length, 0, 'Standalone filter icon must not render beside magnifying glass');

  // 2. Magnifying glass trigger renders in mobileSearchSlot with active filter indicator
  const openSearchBtn = within(slots.mobileSearchSlot).getByRole('button', { name: 'เปิดช่องค้นหา' });
  assert.ok(openSearchBtn);
  assert.equal(slots.mobileSearchOverlay.children.length, 0, 'Mobile search overlay starts closed');

  // 3. Tapping magnifying glass reveals overlay with Back button, Search input, and Filter button
  await act(async () => {
    fireEvent.click(openSearchBtn);
  });

  const mobileInput = within(slots.mobileSearchOverlay).getByPlaceholderText('ค้นหางาน...');
  const mobileFilterBtn = within(slots.mobileSearchOverlay).getByRole('button', { name: 'ตัวกรองเพิ่มเติม' });
  assert.ok(mobileInput);
  assert.ok(mobileFilterBtn);
  assert.equal(within(slots.mobileSearchOverlay).queryByRole('button', { name: 'ล้างคำค้นหา' }), null);

  // 4. Typing shows [X] clear button; clicking [X] clears search text
  await act(async () => {
    fireEvent.change(mobileInput, { target: { value: 'Impact' } });
  });
  assert.equal(mobileInput.value, 'Impact');
  const clearBtn = within(slots.mobileSearchOverlay).getByRole('button', { name: 'ล้างคำค้นหา' });
  await act(async () => {
    fireEvent.click(clearBtn);
  });
  assert.equal(mobileInput.value, '');

  // 5. Clicking Filter button inside the expanded search bar opens the filter drawer without the old bottom strip, and provides "รีเซ็ตการกรอง"
  assert.equal(slots.filterDrawer.textContent, '');
  await act(async () => {
    fireEvent.click(mobileFilterBtn);
  });
  assert.ok(slots.filterDrawer.textContent.includes('ตัวกรองสถานะงาน'));
  assert.equal(slots.filterDrawer.textContent.includes('เลือกเงื่อนไขเพื่อกรองข้อมูลในหน้านี้'), false);
  assert.equal(slots.filterDrawer.textContent.includes('เสร็จสิ้น'), false);

  const resetFilterBtn = within(slots.filterDrawer).getByRole('button', { name: 'รีเซ็ตการกรอง' });
  assert.equal(resetFilterBtn.disabled, false);
  await act(async () => {
    fireEvent.click(resetFilterBtn);
  });
  assert.equal(resetFilterBtn.disabled, true);

  // 6. Clicking Back closes both mobile search overlay and filter drawer
  const closeSearchBtn = within(slots.mobileSearchOverlay).getByRole('button', { name: 'ปิดแถบค้นหา' });
  await act(async () => {
    fireEvent.click(closeSearchBtn);
  });
  assert.equal(slots.mobileSearchOverlay.children.length, 0);
  assert.equal(slots.filterDrawer.children.length, 0);
});

test('DbCombobox searches venue aliases/zones, clears with X, and locks cleanly when modal is in view-only mode', async () => {
  const DbCombobox = await loadProductionComponent('src/components/common/DbCombobox.jsx');
  const venues = [
    { id: 'v1', name: 'CentralWorld Live', zone: 'สยาม-ราชประสงค์', aliases: ['ctw', 'เซ็นทรัลเวิลด์'], google_maps_url: 'https://maps.example/ctw' },
    { id: 'v2', name: 'IMPACT Arena เมืองทองธานี', zone: 'แจ้งวัฒนะ-นนทบุรี', aliases: ['อิมแพ็ค'], google_maps_url: 'https://maps.example/impact' }
  ];

  let selectedItem = null;
  function ComboHarness({ disabled = false }) {
    const [val, setVal] = React.useState('CentralWorld Live');
    return React.createElement(DbCombobox, {
      dbTable: 'delivery_locations',
      value: val,
      onChange: setVal,
      onSelectOption: (item) => { selectedItem = item; },
      options: venues,
      disabled,
      placeholder: 'ค้นหาสถานที่จัดส่ง...'
    });
  }

  const ui = render(React.createElement(ComboHarness, { disabled: true }));
  const input = ui.getByPlaceholderText('ค้นหาสถานที่จัดส่ง...');

  // Locked state: input disabled, no clear button, clicking does not open listbox
  assert.equal(input.disabled, true);
  assert.equal(ui.queryByRole('button', { name: 'ล้างคำค้นหา' }), null);
  await act(async () => {
    fireEvent.focus(input);
  });
  assert.equal(ui.queryByRole('listbox'), null);

  // Unlocked state: clear button appears, searching alias filters DB options, selecting fires onSelect
  ui.rerender(React.createElement(ComboHarness, { disabled: false }));
  assert.equal(input.disabled, false);
  const clearBtn = ui.getByRole('button', { name: 'ล้างคำค้นหา' });
  await act(async () => {
    fireEvent.click(clearBtn);
  });
  assert.equal(input.value, '');

  await act(async () => {
    fireEvent.change(input, { target: { value: 'อิมแพ็ค' } });
  });
  const listbox = ui.getByRole('listbox');
  assert.ok(listbox.textContent.includes('IMPACT Arena เมืองทองธานี'));
  assert.ok(!listbox.textContent.includes('CentralWorld Live'));

  await act(async () => {
    fireEvent.click(within(listbox).getByRole('option'));
  });
  assert.equal(input.value, 'IMPACT Arena เมืองทองธานี');
  assert.equal(selectedItem.raw.google_maps_url, 'https://maps.example/impact');
});

test('Zero native <datalist> remain in src/ and DbCombobox enforces explicit Zero-Egress projections', () => {
  const srcDir = path.resolve(__dirname, '../src');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files = files.concat(walk(full));
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
    return files;
  };

  for (const file of walk(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/<datalist\b/i.test(src), `Found forbidden <datalist> in ${path.relative(srcDir, file)}`);
  }

  const comboboxSrc = fs.readFileSync(path.join(srcDir, 'components/common/DbCombobox.jsx'), 'utf8');
  assert.ok(!comboboxSrc.includes(".select('*')") && !comboboxSrc.includes('.select("*")'), 'DbCombobox must never use SELECT *');
});

test('Saved UserProfileModal starts locked (view-only) until user clicks แก้ไข', async () => {
  const UserProfileModal = await loadProductionComponent('src/components/modals/UserProfileModal.jsx');
  const ui = render(
    React.createElement(UserProfileModal, {
      isOpen: true,
      onClose: () => {},
      userProfile: { username: 'admin', name: 'สมชาย ใจดี', nickname: 'ชาย', role: 'Admin' }
    })
  );

  const fieldset = document.querySelector('fieldset');
  assert.ok(fieldset, 'Modal form must be wrapped in fieldset for clean view-only lock');
  assert.equal(fieldset.disabled, true, 'Saved profile modal must start locked');
  assert.equal(ui.queryByRole('button', { name: /บันทึกข้อมูลโปรไฟล์/ }), null);

  const editBtn = ui.getByRole('button', { name: /แก้ไข/ });
  await act(async () => {
    fireEvent.click(editBtn);
  });

  assert.equal(fieldset.disabled, false, 'Clicking แก้ไข unlocks fieldset');
  assert.ok(ui.getByRole('button', { name: /บันทึกข้อมูลโปรไฟล์/ }));
});

test('DbCombobox portals dropdown to document.body (never clipped) and App.jsx maps Quotation to projectCategories and Expenses to expenseCategories', async () => {
  const DbCombobox = await loadProductionComponent('src/components/common/DbCombobox.jsx');

  function ClippedHarness() {
    const [val, setVal] = React.useState('');
    return React.createElement(
      'div',
      { 'data-testid': 'clipped-parent', style: { overflow: 'hidden', height: '36px' } },
      React.createElement(DbCombobox, {
        options: ['Backdrop', 'ช่อถือ', 'ช่อขาตั้ง'],
        value: val,
        onChange: setVal,
        placeholder: 'ระบุหมวดหมู่...'
      })
    );
  }

  const ui = render(React.createElement(ClippedHarness));
  const input = ui.getByPlaceholderText('ระบุหมวดหมู่...');
  await act(async () => {
    fireEvent.focus(input);
  });

  const listbox = ui.getByRole('listbox');
  assert.equal(listbox.parentElement, document.body, 'DbCombobox listbox must portal to document.body so overflow-hidden never clips it');
  assert.ok(listbox.textContent.includes('Backdrop'));
  assert.ok(listbox.textContent.includes('ช่อถือ'));

  await act(async () => {
    fireEvent.click(within(listbox).getByText('ช่อถือ'));
  });
  assert.equal(input.value, 'ช่อถือ');
  assert.equal(ui.queryByRole('listbox'), null);

  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  assert.match(
    appSrc,
    /<DbCombobox[\s\S]{0,120}options=\{projectCategories\}[\s\S]{0,120}placeholder="ระบุหมวดหมู่\.\.\."/,
    'Quotation category combobox must pull from projectCategories (หมวดหมู่งาน)'
  );
  assert.match(
    appSrc,
    /<DbCombobox[\s\S]{0,120}options=\{expenseCategories\}[\s\S]{0,120}placeholder="หมวดหมู่\.\.\."/,
    'Expense category combobox must pull from expenseCategories (หมวดหมู่ค่าใช้จ่าย)'
  );
});

test('StatusDropdown portals cleanly with zero flying, supports settings-driven Deal/Payment/Transport statuses, and banknote selector excludes coins', async () => {
  const StatusDropdown = await loadProductionComponent('src/components/common/StatusDropdown.jsx');
  const options = [
    { value: 'unpaid', label: 'รอชำระเงิน (Unpaid)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'paid', label: 'ชำระครบถ้วนแล้ว (Paid)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'custom_cod', label: 'เก็บเงินปลายทาง', color: 'bg-violet-50 text-violet-700 border-violet-200' }
  ];

  function StatusHarness() {
    const [val, setVal] = React.useState('unpaid');
    return React.createElement(StatusDropdown, {
      value: val,
      onChange: setVal,
      options,
      ariaLabel: 'สถานะการชำระเงิน'
    });
  }

  const ui = render(React.createElement(StatusHarness));
  const trigger = ui.getByRole('button', { name: 'สถานะการชำระเงิน' });
  assert.ok(trigger.textContent.includes('รอชำระเงิน (Unpaid)'));

  await act(async () => {
    fireEvent.click(trigger);
  });

  const listbox = ui.getByRole('listbox');
  assert.equal(listbox.parentElement, document.body, 'StatusDropdown must portal to document.body');
  assert.ok(listbox.textContent.includes('เก็บเงินปลายทาง'));

  await act(async () => {
    fireEvent.click(within(listbox).getByText('เก็บเงินปลายทาง'));
  });
  assert.ok(trigger.textContent.includes('เก็บเงินปลายทาง'));
  assert.equal(ui.queryByRole('listbox'), null);

  // Verify App.jsx uses StatusDropdown for Deal, Payment, Transport, Category, and Banknotes (no coins!)
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  assert.match(appSrc, /ariaLabel="สถานะ \(ดีล\)"/, 'Deal status must use StatusDropdown');
  assert.match(appSrc, /ariaLabel="สถานะการชำระเงิน"/, 'Payment status must use StatusDropdown');
  assert.match(appSrc, /ariaLabel="สถานะงาน \(ขนส่ง\)"/, 'Transport status must use StatusDropdown');
  assert.match(appSrc, /ariaLabel="ประเภทแบงค์"/, 'Banknote selector must use StatusDropdown');
  assert.equal(appSrc.includes('เหรียญ'), false, 'Coin options must be removed from banknote dropdown');

  // Verify Settings.jsx includes Payment Status manager
  const settingsSrc = fs.readFileSync(path.join(process.cwd(), 'src/Settings.jsx'), 'utf8');
  assert.ok(settingsSrc.includes('สถานะการชำระเงิน (Payment Status)'), 'Settings must expose Payment Status configuration');
});
