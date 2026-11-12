import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { inventoryImageUrl } from '../../services/inventoryImageService.js';

export default function InventoryItemImage({ item, className = 'w-12 h-12' }) {
  const src = inventoryImageUrl(item?.image_url);
  const [failedSrc, setFailedSrc] = useState(null);
  return <span className={`${className} shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 inline-flex items-center justify-center`}>
    {src && src !== failedSrc
      ? <img src={src} alt={item?.name || 'รูปสินค้า'} width="96" height="96" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className="w-full h-full object-contain" />
      : <Package className="w-5 h-5 text-slate-400" aria-hidden="true" />}
  </span>;
}
