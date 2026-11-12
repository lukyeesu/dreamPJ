import React, { useState } from 'react';
import StockTable from '../../src/components/inventory/StockTable.jsx';
import IssueCartDrawer from '../../src/components/inventory/IssueCartDrawer.jsx';
import QrScanner from '../../src/components/inventory/QrScanner.jsx';
import QrLabelPrint from '../../src/components/inventory/QrLabelPrint.jsx';

/**
 * Standalone TEST DATA Preview Fixture
 * Pure offline mock environment for Plan C components inspection across viewports.
 * ZERO production writes, ZERO Supabase calls, ZERO live network requests.
 */
export default function InventoryPreview() {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [cartItems, setCartItems] = useState([
    {
      id: 'item-flower-white',
      name: 'ทิวลิปพลาสติก',
      code: 'FL-W-01',
      color: 'ขาว',
      size: 'M',
      quantity: 50,
      item_type: 'reusable'
    },
    {
      id: 'item-scissors-blue',
      name: 'กรรไกรตัดริบบิ้น',
      code: 'SC-BL',
      color: 'ฟ้า',
      size: 'S',
      quantity: 1,
      item_type: 'asset',
      selectedUnits: ['SC-001']
    }
  ]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('violet');
  const [logMessage, setLogMessage] = useState(null);

  const applyTheme = (themeName) => {
    setActiveTheme(themeName);
    const root = document.documentElement;
    if (themeName === 'violet') {
      root.style.setProperty('--theme-main', '#8b5cf6');
      root.style.setProperty('--theme-hover', '#7c3aed');
      root.style.setProperty('--theme-light', '#f5f3ff');
      root.style.setProperty('--theme-text-light', '#8b5cf6');
      root.style.setProperty('--theme-shadow', 'rgba(139, 92, 246, 0.35)');
    } else if (themeName === 'emerald') {
      root.style.setProperty('--theme-main', '#10b981');
      root.style.setProperty('--theme-hover', '#059669');
      root.style.setProperty('--theme-light', '#ecfdf5');
      root.style.setProperty('--theme-text-light', '#10b981');
      root.style.setProperty('--theme-shadow', 'rgba(16, 185, 129, 0.35)');
    } else if (themeName === 'rose') {
      root.style.setProperty('--theme-main', '#f43f5e');
      root.style.setProperty('--theme-hover', '#e11d48');
      root.style.setProperty('--theme-light', '#fff1f2');
      root.style.setProperty('--theme-text-light', '#f43f5e');
      root.style.setProperty('--theme-shadow', 'rgba(244, 63, 94, 0.35)');
    }
  };

  const mockCategories = [
    { id: 'cat-flowers', name: 'ดอกไม้พลาสติก', type: 'reusable' },
    { id: 'cat-scissors', name: 'กรรไกร', type: 'asset' }
  ];

  const mockItems = [
    {
      id: 'item-flower-white',
      name: 'ทิวลิปพลาสติก',
      code: 'FL-W-01',
      item_type: 'reusable',
      category_id: 'cat-flowers',
      color: 'ขาว',
      size: 'M',
      storage_location: 'โซน A',
      status: 'in_service',
      quantity_on_hand: 200
    },
    {
      id: 'item-flower-pink',
      name: 'ทิวลิปพลาสติก',
      code: 'FL-P-02',
      item_type: 'reusable',
      category_id: 'cat-flowers',
      color: 'ชมพู',
      size: 'L',
      storage_location: 'โซน A',
      status: 'in_service',
      quantity_on_hand: 150
    },
    {
      id: 'item-scissors-blue',
      name: 'กรรไกรตัดริบบิ้น',
      code: 'SC-BL',
      item_type: 'asset',
      category_id: 'cat-scissors',
      color: 'ฟ้า',
      size: 'S',
      storage_location: 'ตู้ B',
      status: 'in_service',
      quantity_on_hand: 0
    }
  ];

  const mockAssetUnits = [
    {
      id: 'u-001',
      unit_code: 'SC-001',
      item_id: 'item-scissors-blue',
      status: 'AVAILABLE',
      borrowed_by: null
    },
    {
      id: 'u-002',
      unit_code: 'SC-002',
      item_id: 'item-scissors-blue',
      status: 'BORROWED',
      borrowed_by: 'ป้านิด'
    }
  ];

  const mockRecipients = [
    { id: 'rec-staff-1', name: 'คุณสมศักดิ์', recipient_type: 'staff', is_active: true },
    { id: 'rec-helper-1', name: 'ป้านิด (คนช่วยงาน)', recipient_type: 'casual_helper', is_active: true }
  ];

  const mockActivities = Array.from({ length: 15 }, (_, i) => ({
    id: `job-${i + 1}`,
    title: `จุดติดตั้งที่ ${i + 1}`,
    customer_name: `ลูกค้า ${i + 1}`
  }));

  const handleToggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      {/* Banner */}
      <div className="mb-4 p-3 bg-amber-500 text-slate-900 rounded-xl font-bold text-center text-xs shadow-xs">
        ⚠️ TEST DATA FIXTURE ONLY — Pure Offline Inspection Mode (No DB Writes / No Live Network)
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Plan C Component Inspection Preview</h1>
          <p className="text-xs text-slate-500">
            StockTable · IssueCartDrawer · QrScanner · QrLabelPrint (Theme-Reactive)
          </p>
        </div>

        {/* Theme Picker */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <span className="text-slate-500 px-2">Theme:</span>
          <button
            type="button"
            onClick={() => applyTheme('violet')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeTheme === 'violet' ? 'bg-[#8b5cf6] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            Violet
          </button>
          <button
            type="button"
            onClick={() => applyTheme('emerald')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeTheme === 'emerald' ? 'bg-[#10b981] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            Emerald
          </button>
          <button
            type="button"
            onClick={() => applyTheme('rose')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeTheme === 'rose' ? 'bg-[#f43f5e] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            Rose
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            style={{ backgroundColor: 'var(--theme-main, #8b5cf6)' }}
            className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            เปิด QrScanner
          </button>
          <button
            type="button"
            onClick={() => setIsPrintOpen(true)}
            className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            เปิด QrLabelPrint
          </button>
          <button
            type="button"
            onClick={() => setIsCartOpen(!isCartOpen)}
            style={{
              backgroundColor: 'var(--theme-light, #f5f3ff)',
              color: 'var(--theme-main, #8b5cf6)'
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
          >
            {isCartOpen ? 'ซ่อน Cart' : 'แสดง Cart'} ({cartItems.length})
          </button>
        </div>
      </header>

      {logMessage && (
        <div className="mb-4 p-3 bg-slate-900 text-white rounded-xl text-xs flex justify-between items-center">
          <span>{logMessage}</span>
          <button type="button" onClick={() => setLogMessage(null)} className="text-slate-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <StockTable
            items={mockItems}
            categories={mockCategories}
            assetUnits={mockAssetUnits}
            selectedItemIds={selectedItemIds}
            onToggleSelectItem={handleToggleSelectItem}
            onOpenSinglePrint={(unitCode) => setLogMessage(`Single print requested for unit: ${unitCode}`)}
            pendingRecoveryCount={90}
            onNavigateToRecovery={() => setLogMessage('Navigated to Material Recovery modal')}
          />
        </section>

        {isCartOpen && (
          <aside className="lg:col-span-1">
            <IssueCartDrawer
              isOpen={true}
              onClose={() => setIsCartOpen(false)}
              cartItems={cartItems}
              activities={mockActivities}
              recipients={mockRecipients}
              assetUnits={mockAssetUnits}
              onSubmitIssue={(payload) => {
                setLogMessage(`Submit issue in-memory: mode=${payload.issueMode}, items=${payload.items?.length}`);
              }}
            />
          </aside>
        )}
      </main>

      {/* QrScanner Modal */}
      {isScannerOpen && (
        <QrScanner
          isOpen={true}
          onClose={() => setIsScannerOpen(false)}
          onScan={(code) => {
            setLogMessage(`Scanned unit: ${code}`);
            setIsScannerOpen(false);
          }}
        />
      )}

      {/* QrLabelPrint Modal */}
      {isPrintOpen && (
        <QrLabelPrint
          units={mockAssetUnits}
          items={mockItems}
          categories={mockCategories}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
}
