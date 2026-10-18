import React from 'react';
import { Plus } from 'lucide-react';

const PlansView = ({
  renderFilterCard,
  renderTable,
  filteredAndSortedActivities = [],
  onOpenModal
}) => {
  return (
    <div className="space-y-8 flex flex-col min-h-full pb-24 md:pb-6">
      {renderFilterCard && renderFilterCard()}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2 mx-4 sm:mx-8 lg:mx-10 mb-10">
        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
          <h3 className="text-xl font-bold text-slate-900">แผนงานทั้งหมด</h3>
          <div className="flex gap-2">
            <button
              onClick={onOpenModal} 
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
              title="เพิ่มแผนงานใหม่"
            >
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
        {renderTable && renderTable(0, filteredAndSortedActivities)}
      </div>
    </div>
  );
};

export default PlansView;
