import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Share2, X, FileText, User, Truck, Clock, MapPin, ExternalLink, 
  Image as ImageIcon, Wallet, Gift, Link as LinkIcon, Check, Copy, Printer 
} from 'lucide-react';
import { 
  formatDate, 
  generateTrackingToken, 
  processImageUrl, 
  renderDeliveryTime, 
  arabicNumberToText 
} from '../../utils/formatters';

export const SharePreviewModal = ({ data, onClose, shopInfo }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isQuoteLinkCopied, setIsQuoteLinkCopied] = useState(false);

  // คำนวณยอดต่างๆ เพื่อใช้แสดงผล
  const totalSupport = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
  
  // ตรวจสอบว่ามีรายการ Quotation แบบละเอียดหรือไม่
  const hasQuotationItems = data.quotationItems && data.quotationItems.length > 0;
  
  const totalQuotation = hasQuotationItems
    ? data.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) 
    : (parseFloat(data.wage) || 0);

  const netReceivable = totalSupport + totalQuotation;

  const handleCopyText = () => {
    // สร้างข้อความรายละเอียดเงินสนับสนุน (Money Order)
    let moneyOrderDetails = "";
    if (data.customerSupport && data.customerSupport.some(i => parseFloat(i.price) > 0)) {
      moneyOrderDetails += "\n💵 *เงินสนับสนุนศิลปิน (Money Order)*\n";
      data.customerSupport.filter(item => parseFloat(item.price) > 0).forEach(item => {
        const type = item.denomination >= 20 ? 'แบงค์' : 'เหรียญ';
        const unit = item.denomination >= 20 ? 'ใบ' : 'เหรียญ';
        moneyOrderDetails += `- ${type} ${item.denomination} (${item.quantity} ${unit}): ${parseFloat(item.price).toLocaleString()} บ.\n`;
      });
    }

    let quotationDetails = "";
    if (hasQuotationItems) {
      quotationDetails += "\n📄 *รายการเสนอราคา (Quotation)*\n";
      data.quotationItems.forEach(item => {
        quotationDetails += `- ${item.category ? `[${item.category}] ` : ''}${item.detail || '-'}: ${parseFloat(item.price).toLocaleString()} บ.\n`;
      });
    } else {
      if (parseFloat(data.wage) > 0) {
        quotationDetails += `\n📄 *ค่าบริการรวม:* ${parseFloat(data.wage).toLocaleString()} บ.\n`;
      }
    }

    const deliveryElement = renderDeliveryTime(data);
    let deliveryText = '-';
    try {
      if (deliveryElement?.props?.children) {
        const children = deliveryElement.props.children;
        if (Array.isArray(children)) {
          deliveryText = children.map(c => c?.props?.children).filter(Boolean).join(' - ');
        } else {
          deliveryText = children;
        }
      }
    } catch(e) {
      deliveryText = data.deliveryDate || '-';
    }

    const text = `
📋 *รายละเอียดงาน (Job Summary)*
🆔 ${data.id}
📌 ชื่องาน: ${data.name}
📅 วันที่: ${formatDate(data.rawDateTime)}
🎭 ศิลปิน: ${data.artist}
👤 ลูกค้า: ${data.customer}

🚚 *การจัดส่ง & สถานที่*
⏰ กำหนดส่ง: ${deliveryText}
📍 สถานที่: ${data.location || '-'}
🗺️ แผนที่: ${data.mapLink || '-'}
📞 ผู้รับ: ${data.recipient || '-'} (${data.recipientPhone || '-'})
${moneyOrderDetails}${quotationDetails}
💰 *ยอดเรียกเก็บสุทธิ: ฿${netReceivable.toLocaleString()}*
    `.trim();

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
  };

  const handleCopyLink = () => {
    try {
      const urlObj = new URL(window.location.href);
      const secureToken = generateTrackingToken(data.id, data.rawDateTime);
      urlObj.searchParams.set('tracking', secureToken);
      const url = urlObj.toString();
    
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setIsLinkCopied(true);
        setTimeout(() => setIsLinkCopied(false), 2000);
      }
    } catch (err) {
      console.error('Unable to copy link', err);
    }
  };

  const handleCopyQuoteLink = () => {
    try {
      const urlObj = new URL(window.location.href);
      const secureToken = generateTrackingToken(data.id, data.rawDateTime);
      urlObj.searchParams.delete('tracking');
      urlObj.searchParams.set('quotation', secureToken);
      const url = urlObj.toString();
    
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setIsQuoteLinkCopied(true);
        setTimeout(() => setIsQuoteLinkCopied(false), 2000);
      }
    } catch (err) {
      console.error('Unable to copy quotation link', err);
    }
  };

  const handlePrint = () => {
    // 1. Prepare Data & Calculations
    const sName = shopInfo?.shopName || 'ไม่ระบุชื่อร้านค้า';
    const sAddress = shopInfo?.address || '-';
    const sPhone = shopInfo?.phone || '-';
    const sEmail = shopInfo?.email || '-';
    const sTaxId = shopInfo?.taxId || '-'; 
    const sLogo = shopInfo?.logo ? processImageUrl(shopInfo.logo) : null;
    
    // Customer Info
    const cName = data.customer || 'ลูกค้าทั่วไป';
    const cAddress = data.customerInfo?.address || '-'; 
    const cTaxId = data.customerInfo?.taxId || '-'; 
    const cPhone = data.customerInfo?.phone || '-';
    const cEmail = data.customerInfo?.email || '-';

    // Recipient & Delivery Info
    const rName = data.recipient || '-';
    const rPhone = data.recipientPhone || '-';
    const rLocation = data.location || '-';
    
    let rDate = data.deliveryDate;
    if (!rDate || rDate === '-') {
      if (data.rawDeliveryStart || data.rawDeliveryEnd || data.rawDeliveryDateTime) {
        const start = formatDate(data.rawDeliveryStart);
        const end = formatDate(data.rawDeliveryEnd || data.rawDeliveryDateTime);
        if (data.rawDeliveryStart && (data.rawDeliveryEnd || data.rawDeliveryDateTime)) {
          rDate = `${start} - ${end}`;
        } else {
          rDate = end || start;
        }
      } else {
        rDate = '-';
      }
    }

    // Prepare Items List
    const allItems = [];
    if (data.quotationItems) {
      data.quotationItems.forEach(item => {
        allItems.push({ ...item, type: 'quotation' });
      });
    }
    if (allItems.length === 0 && parseFloat(data.wage) > 0) {
      allItems.push({ category: '', detail: 'ค่าบริการรวม', price: data.wage, type: 'quotation' });
    }
    if (data.customerSupport) {
      data.customerSupport.forEach(item => {
        if (parseFloat(item.price) > 0) {
          allItems.push({ ...item, type: 'support' });
        }
      });
    }

    // Totals Calculation
    const totalSupportCalc = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
    const totalQuotationCalc = data.quotationItems ? data.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : (parseFloat(data.wage) || 0);
    const grandTotal = totalSupportCalc + totalQuotationCalc;
    
    const vatableAmount = totalQuotationCalc; 
    const preVatAmount = vatableAmount / 1.07;
    const vatAmount = vatableAmount - preVatAmount;
    const nonVatableAmount = totalSupportCalc;

    const bahtText = arabicNumberToText(grandTotal);
    const dateStr = formatDate(data.paymentDate || data.rawDateTime || new Date().toISOString()).split(' ')[0];
    const docNo = `INV${data.id.replace(/\D/g, '')}`; 

    // Pagination Logic
    const pages = [];
    const ROWS_FIRST_PAGE_MAX = 24;
    const ROWS_FIRST_PAGE_WITH_SUM = 16;
    const ROWS_OTHER_PAGE_MAX = 36;
    const ROWS_OTHER_PAGE_WITH_SUM = 30;
    
    let remainingItems = [...allItems];
    let currentPageIdx = 0;

    if (remainingItems.length === 0) {
      pages.push({ items: [], isLast: true, pageIndex: 0 });
    } else {
      while (remainingItems.length > 0) {
        const isFirstPage = currentPageIdx === 0;
        const capacityFull = isFirstPage ? ROWS_FIRST_PAGE_MAX : ROWS_OTHER_PAGE_MAX;
        const capacityWithSum = isFirstPage ? ROWS_FIRST_PAGE_WITH_SUM : ROWS_OTHER_PAGE_WITH_SUM;

        if (remainingItems.length <= capacityWithSum) {
          pages.push({ items: remainingItems, isLast: true, pageIndex: currentPageIdx });
          remainingItems = [];
        } else if (remainingItems.length <= capacityFull) {
          pages.push({ items: remainingItems, isLast: false, pageIndex: currentPageIdx });
          remainingItems = [];
          currentPageIdx++;
          pages.push({ items: [], isLast: true, pageIndex: currentPageIdx });
        } else {
          pages.push({ items: remainingItems.slice(0, capacityFull), isLast: false, pageIndex: currentPageIdx });
          remainingItems = remainingItems.slice(capacityFull);
        }
        currentPageIdx++;
      }
    }

    // Template Generator (Per Page)
    const generatePageHtml = (pageData, pageIndex, totalPages, type) => {
      let rowsHtml = '';
      let startSeq = 0;
      for (let i = 0; i < pageIndex; i++) {
        startSeq += pages[i].items.length;
      }
      let seq = startSeq + 1;

      pageData.items.forEach(item => {
        const isSupport = item.type === 'support';
        const desc = isSupport 
          ? `<span class="font-semibold text-gray-800">เงินสนับสนุน (${item.denomination >= 20 ? 'แบงค์' : 'เหรียญ'} ${item.denomination})</span> <span class="text-[10px] text-gray-400">* Non-Vat</span>`
          : `<span class="font-semibold text-gray-800">${item.category || '-'}</span> <span class="text-xs text-gray-600 ml-1">${item.detail || ''}</span>`;

        rowsHtml += `
        <tr class="border-b border-gray-200">
          <td class="py-1 px-1.5 text-center align-top">${seq++}</td>
          <td class="py-1 px-1.5 align-top leading-tight">${desc}</td>
          <td class="py-1 px-1.5 text-right align-top">${isSupport ? item.quantity : '1.00'}</td>
          <td class="py-1 px-1.5 text-right align-top">${isSupport 
            ? (parseFloat(item.price)/parseInt(item.quantity || 1)).toLocaleString(undefined, {minimumFractionDigits: 2}) 
            : parseFloat(item.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td class="py-1 px-1.5 text-right align-top">0.00</td>
          <td class="py-1 px-1.5 text-right font-semibold align-top">${parseFloat(item.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        </tr>`;
      });

      const isFirstPage = pageIndex === 0;

      return `
      <div class="receipt-a4-container ${type === 'ต้นฉบับ' ? 'page-break-after' : ''} bg-white px-8 py-6 relative flex flex-col">
        <!-- Header (Only on First Page) -->
        ${isFirstPage ? `
        <div class="flex justify-between items-start mb-2 shrink-0">
          <div class="flex flex-col gap-3 w-[60%] mt-2">
            <div class="flex gap-4">
              ${sLogo ? `<img src="${sLogo}" class="w-20 h-20 object-contain rounded-md" />` : ''}
              <div>
                <h2 class="text-lg font-bold text-gray-800 leading-tight">${sName}</h2>
                <p class="text-xs text-gray-500 mt-0.5 leading-tight">${sAddress}</p>
                <p class="text-[10px] text-gray-500 mt-0.5 font-medium">เลขประจำตัวผู้เสียภาษี: ${sTaxId}</p>
                <div class="flex gap-3 mt-1 text-[10px] text-gray-500">
                  ${sPhone ? `<span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${sPhone}</span>` : ''}
                  ${sEmail ? `<span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> ${sEmail}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col justify-between items-end text-right w-[38%]">
            <div>
              <div class="text-xs text-gray-500 mb-0.5">(${type})</div>
              <h1 class="text-xl font-bold text-green-600 tracking-tight leading-none">ใบเสร็จรับเงิน/ใบกำกับภาษี</h1>
            </div>
            <div class="border border-green-200 bg-green-50 rounded-lg p-2 text-xs text-left shadow-sm force-print-bg w-[65%] mt-2">
              <div class="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5">
                <strong class="text-green-800">เลขที่:</strong> <span class="text-gray-700 font-mono font-bold">${docNo}</span>
                <strong class="text-green-800">วันที่:</strong> <span class="text-gray-700">${dateStr}</span>
                <strong class="text-green-800">อ้างอิง:</strong> <span class="text-gray-700 truncate">${data.id}</span>
              </div>
            </div>
          </div>
        </div>

        <hr class="border-t-2 border-gray-100 my-2 shrink-0" />

        <!-- Info Section & Image (Only on First Page) -->
        <div class="grid grid-cols-12 gap-3 text-xs mb-2 items-stretch min-h-[145px] shrink-0">
          <div class="col-span-7 flex flex-col gap-2">
            <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-100 relative flex-1 flex flex-col justify-center">
              <div class="absolute top-0 right-0 p-1.5 opacity-10 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="flex items-center gap-1.5 mb-1">
                <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ลูกค้า (Customer)</h3>
              </div>
              <div class="grid grid-cols-[80px,1fr] gap-y-0.5 text-xs relative z-10">
                <span class="text-gray-500 font-bold">ชื่อ:</span>
                <div class="text-gray-800 font-bold truncate">${cName}</div>
                ${cPhone !== '-' ? `<span class="text-gray-500 font-bold">เบอร์โทร:</span><div class="text-gray-800 truncate">${cPhone}</div>` : ''}
                ${cEmail !== '-' ? `<span class="text-gray-500 font-bold">อีเมล:</span><div class="text-gray-800 truncate">${cEmail}</div>` : ''}
                <span class="text-gray-500 font-bold">เลขที่ภาษี:</span><div class="text-gray-800 truncate">${cTaxId}</div>
                <span class="text-gray-500 font-bold">ที่อยู่:</span><div class="text-gray-800 leading-tight line-clamp-2">${cAddress}</div>
              </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-100 relative flex-1 flex flex-col justify-center">
              <div class="absolute top-0 right-0 p-1.5 opacity-10 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              </div>
              <div class="flex items-center gap-1.5 mb-1">
                <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">จัดส่ง (Shipping)</h3>
              </div>
              <div class="grid grid-cols-[80px,1fr] gap-y-1 relative z-10">
                <span class="text-gray-500 font-bold">ผู้รับ:</span>
                <div class="text-gray-800 font-bold truncate">${rName} ${rPhone !== '-' ? `<span class="font-normal text-gray-600 text-[10px] ml-1">(${rPhone})</span>` : ''}</div>
                <span class="text-gray-500 font-bold">กำหนดส่ง:</span><div class="text-gray-800 truncate">${rDate}</div>
                <span class="text-gray-500 font-bold">สถานที่:</span><div class="text-gray-800 leading-tight line-clamp-2">${rLocation}</div>
              </div>
            </div>
          </div>
          <div class="col-span-5 relative">
            <div class="absolute inset-0 bg-gray-50 border border-gray-100 rounded-lg flex flex-col overflow-hidden">
              <div class="w-full h-full flex items-center justify-center bg-gray-50">
                ${data.image 
                  ? `<img src="${processImageUrl(data.image)}" class="w-full h-full object-contain" />` 
                  : `<div class="flex flex-col items-center gap-1 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs font-bold">No Image</span></div>`
                }
              </div>
            </div>
          </div>
        </div>
        ` : `
        <!-- Minimal Header for Subsequent Pages -->
        <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 shrink-0">
          <div class="text-xs font-bold text-gray-400">ใบเสร็จรับเงิน (ต่อ)</div>
          <div class="text-xs text-gray-400">อ้างอิง: ${data.id}</div>
        </div>
        `}

        <!-- Table (Paginated) -->
        ${pageData.items.length > 0 ? `
        <div class="mb-6 mt-0">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-green-50 text-green-800 border-y border-green-100 force-print-bg">
                <th class="p-1.5 w-10 text-center font-bold first:rounded-l-lg">ลำดับ</th>
                <th class="p-1.5 text-left font-bold">รายละเอียด</th>
                <th class="p-1.5 w-16 text-right font-bold">จำนวน</th>
                <th class="p-1.5 w-24 text-right font-bold">ราคา/หน่วย</th>
                <th class="p-1.5 w-20 text-right font-bold">ส่วนลด</th>
                <th class="p-1.5 w-28 text-right font-bold last:rounded-r-lg">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Summary & Signature Section (Only on Last Page) -->
        ${pageData.isLast ? `
        <div class="mt-0 break-inside-avoid">
          <div class="flex flex-col sm:flex-row justify-between items-start gap-6 mb-2">
            <div class="flex-1 text-xs">
              <strong class="text-gray-700 mr-1">หมายเหตุ:</strong>
              <span class="text-gray-600 leading-relaxed">${data.note || '-'}</span>
            </div>
            <div class="w-full sm:w-[350px] space-y-1.5 text-xs">
              <div class="flex justify-between text-gray-600"><span>มูลค่าสินค้า (ก่อนภาษี)</span><span>${preVatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              <div class="flex justify-between text-gray-600"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              ${nonVatableAmount > 0 ? `<div class="flex justify-between text-gray-600"><span>เงินสนับสนุน (ยกเว้นภาษี)</span><span>${nonVatableAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>` : ''}
              <div class="flex justify-between text-gray-600 border-b border-gray-200 pb-2"><span>ส่วนลด</span><span>0.00</span></div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row justify-between items-stretch gap-6 mb-4">
            <div class="flex-1 flex flex-col justify-center items-start bg-green-50 p-2 rounded-lg border border-green-200 force-print-bg">
              <span class="text-green-700 text-[10px] font-bold">จำนวนเงินตัวอักษร</span>
              <strong class="text-green-800 text-sm font-bold tracking-tight leading-tight mt-0.5">(${bahtText})</strong>
            </div>
            <div class="w-full sm:w-[350px] flex flex-col justify-center items-end bg-green-50 p-2 rounded-lg border border-green-200 force-print-bg">
              <span class="text-green-700 text-[10px] font-bold">จำนวนเงินทั้งสิ้น</span>
              <strong class="text-green-800 text-xl font-black tracking-tight leading-none mt-0.5">฿${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
            </div>
          </div>
          
          <div class="flex gap-8 justify-between mt-10">
            <div class="text-center w-1/2 px-8">
              <div class="h-8 border-b border-dotted border-gray-800 w-full mb-1"></div>
              <span class="text-xs font-bold text-black">ผู้รับวางบิล</span>
              <div class="mt-1 text-xs font-bold text-black">วันที่ ...../...../..........</div>
            </div>
            <div class="text-center w-1/2 px-8">
              <div class="h-8 border-b border-dotted border-gray-800 w-full mb-1"></div>
              <span class="text-xs font-bold text-black">ผู้รับเงิน</span>
              <div class="mt-1 text-xs font-bold text-black">วันที่ ...../...../..........</div>
            </div>
          </div>
        </div>` : ``}
        
        <!-- Page Number Footer -->
        <div class="absolute bottom-4 right-8 text-[10px] text-gray-400">
          หน้า ${pageIndex + 1} / ${totalPages}
        </div>
      </div>
      `;
    };

    const generateFullDoc = (type) => {
      return pages.map((page, idx) => generatePageHtml(page, idx, pages.length, type)).join('');
    };

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>พิมพ์ใบเสร็จ - ${data.id}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap');
          body { 
            font-family: 'Sarabun', sans-serif; 
            background: #52525b; 
            padding: 20px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-a4-container {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            margin: 0 auto 20px auto;
            background: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            padding: 40px;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
          }
          .keep-together {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          @media print {
            html, body { 
              width: 210mm !important;
              height: 297mm !important;
              background: white !important; 
              margin: 0 !important;
              padding: 0 !important;
            }
            .receipt-a4-container {
              width: 210mm !important; 
              height: 296.5mm !important;
              max-height: 296.5mm !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 40px !important; 
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              color: initial; 
              visibility: visible !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }
            .receipt-a4-container:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .page-break-after {
              page-break-after: always !important;
              break-after: page !important;
            }
            .force-print-bg {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { 
              size: A4 portrait;
              margin: 0mm; 
            }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print hidden sm:flex fixed top-4 right-4 z-50 gap-3 items-center">
          <div class="flex bg-gray-800/80 backdrop-blur-md rounded-lg p-1 border border-white/10">
            <button id="desk-btn-original" onclick="setMode('original')" class="px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all">ต้นฉบับ</button>
            <button id="desk-btn-copy" onclick="setMode('copy')" class="px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all">สำเนา</button>
          </div>
          <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-lg font-bold hover:bg-blue-700 transition flex items-center gap-2 border border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            พิมพ์
          </button>
          <button onclick="window.close()" class="bg-gray-500 text-white px-6 py-2 rounded-lg shadow-lg font-bold hover:bg-gray-600 transition border border-white/20">
            ปิด
          </button>
        </div>

        <div class="no-print flex sm:hidden fixed bottom-8 right-8 z-50 flex-col gap-4 items-end">
          <div class="flex bg-white rounded-full p-1.5 shadow-xl border border-gray-100 mb-2">
            <button id="mob-btn-original" onclick="setMode('original')" class="px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all">ต้นฉบับ</button>
            <button id="mob-btn-copy" onclick="setMode('copy')" class="px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">สำเนา</button>
          </div>
          <button onclick="window.print()" class="w-[125px] h-[125px] bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white/30 backdrop-blur-md active:scale-95 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
        </div>

        <div id="original-container">
          ${generateFullDoc('ต้นฉบับ')}
        </div>
        <div id="copy-container" style="display:none;">
          ${generateFullDoc('สำเนา')}
        </div>
        
        <script>
          function setMode(mode) {
            const orig = document.getElementById('original-container');
            const copy = document.getElementById('copy-container');
            const dOrig = document.getElementById('desk-btn-original');
            const dCopy = document.getElementById('desk-btn-copy');
            const mOrig = document.getElementById('mob-btn-original');
            const mCopy = document.getElementById('mob-btn-copy');

            if (mode === 'original') {
              orig.style.display = 'block';
              copy.style.display = 'none';
              dOrig.className = 'px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all';
              dCopy.className = 'px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all';
              mOrig.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all';
              mCopy.className = 'px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all';
            } else {
              orig.style.display = 'none';
              copy.style.display = 'block';
              dOrig.className = 'px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all';
              dCopy.className = 'px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all';
              mOrig.className = 'px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all';
              mCopy.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all';
            }
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(fullHtml);
      printWindow.document.close();
    } else {
      alert('Pop-up ถูกบล็อก กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 print:p-0">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-none h-full sm:h-auto shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-none print:h-auto print:rounded-none">
        
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center print:hidden shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">สรุปรายละเอียดงาน</h3>
              <p className="text-[10px] text-slate-500 font-medium">สำหรับลูกค้า (Customer View)</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-4 sm:p-6 print:bg-white print:p-0">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-6 print:border-none print:shadow-none">
            
            {/* Project Header */}
            <div>
              <div className="flex justify-between items-start gap-3 mb-2">
                <h2 className="text-xl font-black text-slate-800 leading-tight break-words">{data.name}</h2>
                {data.id && <span className="shrink-0 bg-indigo-50 text-indigo-600 text-[10px] px-2 py-1 rounded-md font-bold border border-indigo-100">{data.id}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] px-2 py-1 rounded-md font-bold border border-emerald-100">
                  <FileText className="w-3 h-3" /> ใบสรุปงาน
                </span>
              </div>
            </div>

            {/* General Info Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> ข้อมูลทั่วไป
              </h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">วันที่</p>
                  <p className="text-sm font-bold text-slate-700">{formatDate(data.rawDateTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">ศิลปิน</p>
                  <p className="text-sm font-bold text-slate-700">{data.artist}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <p className="text-[10px] text-slate-400 mb-0.5">ลูกค้า</p>
                  <p className="text-sm font-bold text-slate-700">{data.customer}</p>
                </div>
              </div>
            </div>

            {/* Delivery Info Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Truck className="w-3.5 h-3.5" /> การจัดส่ง & สถานที่
              </h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5 text-indigo-500"><Clock className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5 font-bold">กำหนดส่ง</p>
                    <div className="text-sm font-bold text-slate-700">{renderDeliveryTime(data)}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5 text-rose-500"><MapPin className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className="text-[10px] text-slate-400 font-bold">สถานที่</p>
                      {data.mapLink && (
                        <a href={data.mapLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                          เปิดแผนที่ <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-snug">{data.location || '-'}</p>
                  </div>
                </div>
                {(data.recipient || data.recipientPhone) && (
                  <div className="flex gap-3 pt-3 mt-1 border-t border-slate-200/60">
                    <div className="shrink-0 mt-0.5 text-emerald-500"><User className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5 font-bold">ผู้รับ</p>
                      <p className="text-sm font-bold text-slate-700">{data.recipient || '-'}</p>
                      {data.recipientPhone && <p className="text-xs text-slate-500 mt-0.5 font-medium">{data.recipientPhone}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Image Section */}
            {data.image && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" /> รูปภาพอ้างอิง
                </h4>
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                  <img 
                    src={processImageUrl(data.image)} 
                    alt="Project Ref" 
                    className="w-full h-auto object-contain max-h-60" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs">ไม่สามารถโหลดรูปภาพได้</div>';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Money Summary Section */}
            <div className="pt-2">
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <Wallet className="w-24 h-24 -rotate-12" />
                </div>
                
                <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-wide mb-5 relative z-10">สรุปยอดเรียกเก็บเงิน</h3>
                
                <div className="space-y-5 relative z-10">
                  {/* 1. Money Order */}
                  {data.customerSupport && data.customerSupport.some(i => parseFloat(i.price) > 0) && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5 mb-1">
                        <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                          <div className="p-1 bg-indigo-100 rounded-md"><Gift className="w-3 h-3" /></div>
                          เงินสนับสนุนศิลปิน
                        </h4>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">฿{totalSupport.toLocaleString()}</span>
                      </div>
                      <div className="space-y-1.5">
                        {data.customerSupport.filter(item => parseFloat(item.price) > 0).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-slate-600 px-1">
                            <span className="flex items-center gap-2">
                              <span className="w-1 h-1 bg-indigo-400 rounded-full shrink-0"></span>
                              {item.denomination >= 20 ? 'แบงค์' : 'เหรียญ'} {item.denomination} x {item.quantity}
                            </span>
                            <span className="font-medium text-slate-900 tabular-nums">{parseFloat(item.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Quotation */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5 mb-1">
                      <h4 className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                        <div className="p-1 bg-emerald-100 rounded-md"><FileText className="w-3 h-3" /></div>
                        รายการเสนอราคา
                      </h4>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">฿{totalQuotation.toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      {hasQuotationItems ? (
                        data.quotationItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start text-xs px-1">
                            <div className="flex flex-col pr-2">
                              <div className="flex flex-wrap items-baseline gap-1">
                                {item.category && (
                                  <span className="font-bold text-slate-700 whitespace-nowrap">{item.category}</span>
                                )}
                                <span className="text-slate-500 font-medium break-all">{item.detail}</span>
                              </div>
                            </div>
                            <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap pt-0.5">
                              {parseFloat(item.price).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center text-xs text-slate-600 px-1">
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                            ค่าบริการรวม
                          </span>
                          <span className="font-bold text-slate-900 tabular-nums">{totalQuotation.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Net Total */}
                  <div className="pt-4 border-t border-slate-200 mt-2">
                    <div className="flex justify-between items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ยอดเรียกเก็บสุทธิ</span>
                      <span className="text-2xl font-black text-indigo-600 leading-none tabular-nums">฿{netReceivable.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Buttons Action Area */}
        <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3 print:hidden shrink-0 safe-area-bottom-modal">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleCopyLink}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isLinkCopied ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {isLinkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              {isLinkCopied ? 'คัดลอกลิงก์' : 'ลิงก์ติดตามงาน'}
            </button>
            <button 
              onClick={handleCopyQuoteLink}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isQuoteLinkCopied ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {isQuoteLinkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              {isQuoteLinkCopied ? 'คัดลอกลิงก์' : 'ลิงก์เสนอราคา'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleCopyText}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isCopied ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {isCopied ? 'คัดลอกข้อความ' : 'คัดลอกข้อความ'}
            </button>
            <button 
              onClick={handlePrint}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              พิมพ์ / บันทึก PDF
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SharePreviewModal;
