import React, { useEffect, useState } from 'react';
import Inventory from '../../src/Inventory.jsx';
import { applyThemeVariables } from '../../src/utils/themeManager.js';
import { activities } from './inventory-offline-data.js';

export default function InventoryFullPreview({isActive = true}) {
  const [theme, setTheme] = useState('violet');
  useEffect(() => applyThemeVariables(theme, 'solid'), [theme]);
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="flex flex-wrap items-center gap-3 bg-amber-100 p-3 text-sm">
      <strong>TEST DATA · ตัวอย่างออฟไลน์ ไม่มีการเขียนฐานข้อมูล</strong>
      <select aria-label="ธีมทดสอบ" value={theme} onChange={event=>setTheme(event.target.value)} className="min-h-11 rounded border bg-white px-3">
        {['violet','emerald','rose','amber','slate'].map(color=><option key={color}>{color}</option>)}
      </select>
    </div>
    <main className="p-3 sm:p-5"><Inventory isActive={isActive} activities={activities} userProfile={{id:'preview-user',role:'admin'}} /></main>
  </div>;
}
