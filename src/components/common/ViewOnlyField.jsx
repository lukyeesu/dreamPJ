import React from 'react';
import { Phone, Mail, ExternalLink } from 'lucide-react';

const ViewOnlyField = ({ value, type, icon: Icon }) => {
  if (!value) {
    return (
      <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        <span>-</span>
      </div>
    );
  }

  let content = <span className="text-slate-700 font-medium truncate block">{value}</span>;
  let Wrapper = 'div';
  let wrapperProps = { className: "w-full overflow-hidden" };

  if (type === 'tel') {
    Wrapper = 'a';
    wrapperProps = { 
      href: `tel:${value}`, 
      className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer group overflow-hidden" 
    };
    content = (
      <div className="flex items-center gap-2 text-indigo-700 font-bold group-hover:text-indigo-800 overflow-hidden">
        <Phone className="w-4 h-4 shrink-0" />
        <span className="truncate">{value}</span>
      </div>
    );
  } else if (type === 'email') {
    Wrapper = 'a';
    wrapperProps = { 
      href: `mailto:${value}`, 
      className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer group overflow-hidden" 
    };
    content = (
      <div className="flex items-center gap-2 text-indigo-700 font-bold group-hover:text-indigo-800 overflow-hidden">
        <Mail className="w-4 h-4 shrink-0" />
        <span className="truncate">{value}</span>
      </div>
    );
  } else if (type === 'url') {
    Wrapper = 'a';
    wrapperProps = { 
      href: value, 
      target: "_blank", 
      rel: "noreferrer", 
      className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group overflow-hidden" 
    };
    content = (
      <div className="flex items-center gap-2 text-blue-600 font-bold group-hover:text-blue-700 truncate">
        <ExternalLink className="w-4 h-4 shrink-0" />
        <span className="truncate">{value}</span>
      </div>
    );
  } else {
    return (
      <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-2 overflow-hidden">
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
    );
  }

  return <Wrapper {...wrapperProps}>{content}</Wrapper>;
};

export default ViewOnlyField;
