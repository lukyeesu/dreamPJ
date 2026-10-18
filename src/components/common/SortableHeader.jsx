import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export const SortableHeader = ({ label, sortKey, sortConfig, handleSort, alignRight = false, className = '' }) => (
  <th
    className={`px-4 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors group select-none ${alignRight ? 'text-right' : 'text-left'} ${className}`}
    onClick={() => handleSort(sortKey)}
  >
    <div className={`flex items-center gap-1 ${alignRight ? 'justify-end' : ''}`}>
      {label}
      <span className="text-slate-300 group-hover:text-indigo-500 transition-colors">
        {sortConfig?.key === sortKey ? (
          sortConfig?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </div>
  </th>
);

export default SortableHeader;
