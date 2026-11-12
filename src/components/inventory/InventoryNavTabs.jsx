import React from 'react';
import {
  Boxes,
  ArrowRightLeft,
  Banknote,
  Clock,
  Lock,
  Factory
} from 'lucide-react';

/**
 * InventoryNavTabs Component
 * Primary view switcher for Plan C Inventory:
 * 1. ของในคลัง (Stock)
 * 2. เบิก–คืน (Custody & Flow)
 * 3. เงินสด (Petty Cash Vault - RBAC Gated)
 * 4. ประวัติ (History & Legacy Audit)
 */
export default function InventoryNavTabs({
  activeTab = 'stock',
  onChangeTab,
  activeBorrowCount = 0,
  activeRecoveryPendingCount = 0
}) {
  const tabs = [
    {
      id: 'stock',
      label: 'ของในคลัง',
      icon: Boxes,
      badge: null
    },
    {
      id: 'flows',
      label: 'เบิก–คืน',
      icon: ArrowRightLeft,
      badge: activeBorrowCount > 0
        ? `${activeBorrowCount} ยืมอยู่`
        : (activeRecoveryPendingCount > 0 ? `${activeRecoveryPendingCount} รอตรวจ` : null),
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'production',
      label: 'งานผลิต',
      icon: Factory,
      badge: null
    },
    {
      id: 'cash',
      label: 'เงินสด',
      icon: Banknote,
      subIcon: Lock,
      badge: null
    },
    {
      id: 'history',
      label: 'ประวัติ',
      icon: Clock,
      badge: null
    }
  ];

  return (
    <nav
      role="tablist"
      aria-label="เมนูคลังสินค้าหลัก"
      className="grid grid-cols-5 gap-1 border-b border-slate-200 mb-4 select-none"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const SubIcon = tab.subIcon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            aria-label={tab.badge ? `${tab.label} ${tab.badge}` : tab.label}
            onClick={() => onChangeTab(tab.id)}
            onKeyDown={event => {
              const index = tabs.findIndex(item => item.id === tab.id);
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
              onChangeTab(tabs[next].id);
            }}
            className={`min-h-[64px] sm:min-h-[48px] py-2 px-1 min-w-0 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 text-sm font-semibold relative border-b-2 cursor-pointer ${
              isActive
                ? 'text-[var(--theme-ink)] border-[var(--theme-main)] bg-[var(--theme-light)]'
                : 'text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-300'
            }`}
          >
            <div className="relative flex items-center">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              {SubIcon && (
                <SubIcon className="w-2.5 h-2.5 absolute -top-1 -right-1 text-slate-400" />
              )}
            </div>

            <span className="leading-snug text-center">{tab.label}</span>

            {tab.badge && (
              <span className={`hidden lg:inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${tab.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
