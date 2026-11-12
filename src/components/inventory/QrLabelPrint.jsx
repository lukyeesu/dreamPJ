import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  Sliders,
  Ruler
} from 'lucide-react';
import {
  LABEL_PRESETS,
  LABEL_FORMATS,
  validateBarcodeDimensions,
  generateBarcodeSvgString,
  PRINT_MODES,
  A4_DIMENSIONS_MM,
  MAX_TOTAL_LABELS,
  validateLabelDimensions,
  validateCopyCount,
  calculateSheetLayout,
  calculateRollLayout,
  generateQrSvgString,
  generateQrDataUrl,
  buildPrintHtml,
  encodeQrPayload
} from '../../utils/qrLabels.js';
import Toast from '../common/Toast.jsx';

/**
 * QrLabelPrint Component
 *
 * Dedicated full-screen print workspace for warehouse asset tool labels.
 * Provides preset sizing (scissor-handle 18x24mm, normal 30x40mm, custom mm),
 * A4 sheet sticker grid or thermal roll printing, peeled sticker start offsets,
 * real-time actual-size preview, calibration sheet with 10mm ruler, and
 * completely local, safe printing via an isolated hidden iframe.
 *
 * Props:
 *   - units: Array of asset unit objects ({ unit_code, item_id, status, notes })
 *   - items: Array of catalog item objects ({ id, name, code, color, size, category_id })
 *   - categories: Array of category objects ({ id, name, type })
 *   - onClose: () => void
 *   - initialSelectedUnitCodes: Array<string> (Default selection; does NOT select whole warehouse by default)
 *   - onPrintSuccess: () => void (optional callback after print trigger)
 */
export default function QrLabelPrint({
  units = [],
  items = [],
  categories = [],
  onClose,
  initialSelectedUnitCodes = [],
  onPrintSuccess,
  onAddUnitRequest
}) {
  // Selection state (empty by default unless explicitly provided via initialSelectedUnitCodes)
  const [selectedCodes, setSelectedCodes] = useState(() => new Set(initialSelectedUnitCodes));
  const [copiesPerUnit, setCopiesPerUnit] = useState({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterColor, setFilterColor] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Print format & layout states
  const [labelFormat, setLabelFormat] = useState(LABEL_FORMATS.QR);
  const [selectedPresetKey, setSelectedPresetKey] = useState('normal'); // 'scissor' | 'normal' | 'custom'
  const [customWidthMm, setCustomWidthMm] = useState(35);
  const [customHeightMm, setCustomHeightMm] = useState(35);
  const [printMode, setPrintMode] = useState(PRINT_MODES.SHEET_A4); // 'sheet_a4' | 'roll'

  // A4 sheet parameters
  const [sheetParams, setSheetParams] = useState({
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    marginRightMm: 10,
    gapRowMm: 2,
    gapColMm: 2,
    startOffset: 0
  });

  // UI feedback states
  const [toastMessage, setToastMessage] = useState(null);
  const [isGeneratingPrint, setIsGeneratingPrint] = useState(false);
  const [previewSvg, setPreviewSvg] = useState('');

  const printIframeRef = useRef(null);
  const blobUrlRef = useRef(null);
  const printCleanupRef = useRef(null);
  const previousFocusRef = useRef(null);
  const isMountedRef = useRef(true);
  const dialogRef = useRef(null);

  // Restore focus on close and cleanup iframe/blobs
  useEffect(() => {
    isMountedRef.current = true;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      isMountedRef.current = false;
      printCleanupRef.current?.();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (printIframeRef.current) {
        try {
          printIframeRef.current.remove();
        } catch {
          // Ignore
        }
        printIframeRef.current = null;
      }
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      if (e.key === 'Tab') {
        const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])];
        const first = controls[0];
        const last = controls.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault(); last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lookup maps for fast item and category resolving
  const itemMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (item.id) map.set(item.id, item);
      if (item.code) map.set(item.code, item);
    });
    return map;
  }, [items]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => {
      if (cat.id) map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  // Enriched unit list
  const enrichedUnits = useMemo(() => {
    return units.filter((u) => typeof u.unit_code === 'string' && u.unit_code.trim()).map((u) => {
      const item = itemMap.get(u.item_id);
      const category = item ? categoryMap.get(item.category_id) : null;
      return {
        unit_code: u.unit_code,
        item_id: u.item_id,
        status: u.status || 'AVAILABLE',
        notes: u.notes || '',
        itemName: item?.name || 'เครื่องมือ',
        color: item?.color || '',
        size: item?.size || '',
        categoryName: category?.name || 'ทั่วไป',
        categoryId: item?.category_id || ''
      };
    });
  }, [units, itemMap, categoryMap]);

  // Unique colors for filter dropdown
  const availableColors = useMemo(() => {
    const colors = new Set();
    enrichedUnits.forEach((u) => {
      if (u.color) colors.add(u.color);
    });
    return Array.from(colors);
  }, [enrichedUnits]);

  // Filtered unit list
  const filteredUnits = useMemo(() => {
    return enrichedUnits.filter((u) => {
      if (filterCategory !== 'ALL' && u.categoryId !== filterCategory) {
        return false;
      }
      if (filterColor !== 'ALL' && u.color !== filterColor) {
        return false;
      }
      if (filterStatus !== 'ALL' && u.status !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = u.unit_code.toLowerCase().includes(q);
        const nameMatch = u.itemName.toLowerCase().includes(q);
        const colorMatch = u.color.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !colorMatch) return false;
      }
      return true;
    });
  }, [enrichedUnits, filterCategory, filterColor, filterStatus, searchQuery]);

  // Current active label dimensions
  const activePreset = useMemo(() => {
    if (selectedPresetKey === 'custom') {
      const w = Number(customWidthMm);
      const h = Number(customHeightMm);
      return {
        id: 'custom',
        name: 'กำหนดขนาดเอง',
        widthMm: w,
        heightMm: h,
        description: 'ขนาดกำหนดเองโดยผู้ใช้',
        experimental: false,
        showItemName: h >= 26
      };
    }
    return LABEL_PRESETS[selectedPresetKey] || LABEL_PRESETS.normal;
  }, [selectedPresetKey, customWidthMm, customHeightMm]);

  // Live preview sample unit
  const previewSampleUnit = useMemo(() => {
    const firstSelected = enrichedUnits.find((u) => selectedCodes.has(u.unit_code));
    return firstSelected || enrichedUnits[0] || null;
  }, [enrichedUnits, selectedCodes]);

  // Dimension validation across ACTUAL selected payloads (worst-case evaluated)
  const dimensionCheck = useMemo(() => {
    const codes = enrichedUnits.filter((u) => selectedCodes.has(u.unit_code)).map((u) => u.unit_code);
    if (!codes.length && previewSampleUnit) codes.push(previewSampleUnit.unit_code);
    if (labelFormat === LABEL_FORMATS.BARCODE) return validateBarcodeDimensions({ widthMm: activePreset.widthMm, heightMm: activePreset.heightMm, unitCodes: codes });
    const targetPayloads = codes.map((c) => encodeQrPayload(c));

    return validateLabelDimensions({
      widthMm: activePreset.widthMm,
      heightMm: activePreset.heightMm,
      payloads: targetPayloads
    });
  }, [activePreset, selectedCodes, previewSampleUnit, enrichedUnits, labelFormat]);

  // Total label copies to print
  const totalLabelsCount = useMemo(() => {
    let sum = 0;
    enrichedUnits.filter((u) => selectedCodes.has(u.unit_code)).forEach(({ unit_code: code }) => {
      const copies = validateCopyCount(copiesPerUnit[code] ?? 1);
      sum += copies;
    });
    return sum;
  }, [selectedCodes, copiesPerUnit, enrichedUnits]);

  // Calculated Sheet layout
  const sheetLayout = useMemo(() => {
    if (printMode === PRINT_MODES.ROLL) {
      return calculateRollLayout({
        labelWidthMm: activePreset.widthMm,
        labelHeightMm: activePreset.heightMm,
        totalLabels: totalLabelsCount
      });
    }
    return calculateSheetLayout({
      pageWidthMm: A4_DIMENSIONS_MM.width,
      pageHeightMm: A4_DIMENSIONS_MM.height,
      marginTopMm: sheetParams.marginTopMm,
      marginBottomMm: sheetParams.marginBottomMm,
      marginLeftMm: sheetParams.marginLeftMm,
      marginRightMm: sheetParams.marginRightMm,
      labelWidthMm: activePreset.widthMm,
      labelHeightMm: activePreset.heightMm,
      gapRowMm: sheetParams.gapRowMm,
      gapColMm: sheetParams.gapColMm,
      startOffset: sheetParams.startOffset,
      totalLabels: totalLabelsCount
    });
  }, [printMode, activePreset, sheetParams, totalLabelsCount]);

  // Generate live preview QR code
  useEffect(() => {
    let isCurrent = true;
    const generatePreview = async () => {
      try {
        if (!previewSampleUnit) { if (isCurrent) setPreviewSvg(''); return; }
        const payload = encodeQrPayload(previewSampleUnit.unit_code);
        const svg = labelFormat === LABEL_FORMATS.BARCODE ? generateBarcodeSvgString(previewSampleUnit.unit_code, activePreset) : await generateQrSvgString(payload, {
          margin: 4,
          errorCorrectionLevel: 'M'
        });
        if (isCurrent) setPreviewSvg(svg);
      } catch {
        if (isCurrent) setPreviewSvg('');
      }
    };
    generatePreview();
    return () => {
      isCurrent = false;
    };
  }, [previewSampleUnit, labelFormat, activePreset]);

  // Selection handlers
  const toggleUnit = (unitCode) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(unitCode)) {
        next.delete(unitCode);
      } else {
        next.add(unitCode);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      filteredUnits.forEach((u) => next.add(u.unit_code));
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedCodes(new Set());
  };

  const handleCopyChange = (unitCode, val) => {
    const valid = validateCopyCount(val);
    setCopiesPerUnit((prev) => ({ ...prev, [unitCode]: valid }));
  };

  const setAllCopies = (val) => {
    const valid = validateCopyCount(val);
    const updated = {};
    selectedCodes.forEach((code) => {
      updated[code] = valid;
    });
    setCopiesPerUnit(updated);
    setToastMessage({ message: `ปรับจำนวนพิมพ์เป็น ${valid} ชุดทุกรายการ`, type: 'success' });
  };

  // Print execution via isolated hidden iframe with lifecycle cleanup
  const handlePrint = async (isCalibration = false) => {
    if (!isCalibration && (selectedCodes.size === 0 || totalLabelsCount === 0)) {
      setToastMessage({ message: 'กรุณาเลือกครุภัณฑ์ที่ต้องการพิมพ์อย่างน้อย 1 รายการ', type: 'warning' });
      return;
    }

    if (!isCalibration && totalLabelsCount > MAX_TOTAL_LABELS) {
      setToastMessage({
        message: `จำนวนฉลาก (${totalLabelsCount} ดวง) เกินขีดจำกัดสูงสุด ${MAX_TOTAL_LABELS} ดวง กรุณาแบ่งพิมพ์ทีละชุด`,
        type: 'error'
      });
      return;
    }

    if (!isCalibration && (dimensionCheck.blocked || !sheetLayout.valid)) {
      setToastMessage({ message: 'ไม่สามารถพิมพ์ได้เนื่องจากขนาดฉลากเล็กเกินไป', type: 'error' });
      return;
    }

    setIsGeneratingPrint(true);

    try {
      const labelItems = [];

      if (isCalibration && previewSampleUnit && !dimensionCheck.blocked) {
        const sampleCode = previewSampleUnit.unit_code;
        const payload = encodeQrPayload(sampleCode);
        const [svg, dataUrl] = labelFormat === LABEL_FORMATS.BARCODE
          ? [generateBarcodeSvgString(sampleCode, activePreset), '']
          : await Promise.all([generateQrSvgString(payload), generateQrDataUrl(payload)]);
        labelItems.push({
          unitCode: sampleCode,
          itemName: previewSampleUnit.itemName,
          color: previewSampleUnit.color,
          svg,
          dataUrl
        });
      } else if (!isCalibration) {
        // Collect all selected units according to copies
        for (const unit of enrichedUnits) {
          if (!isMountedRef.current) return;
          if (!selectedCodes.has(unit.unit_code)) continue;

          const count = validateCopyCount(copiesPerUnit[unit.unit_code] ?? 1);
          const payload = encodeQrPayload(unit.unit_code);
          const [svg, dataUrl] = labelFormat === LABEL_FORMATS.BARCODE
            ? [generateBarcodeSvgString(unit.unit_code, activePreset), '']
            : await Promise.all([generateQrSvgString(payload), generateQrDataUrl(payload)]);

          for (let i = 0; i < count; i++) {
            labelItems.push({
              unitCode: unit.unit_code,
              itemName: unit.itemName,
              color: unit.color,
              svg,
              dataUrl
            });
          }
        }
      }

      if (!isMountedRef.current) return;

      // Generate secure isolated HTML
      const html = buildPrintHtml({
        labels: labelItems,
        preset: activePreset,
        mode: isCalibration ? PRINT_MODES.SHEET_A4 : printMode,
        sheetParams,
        calibration: isCalibration,
        format: labelFormat
      });

      printCleanupRef.current?.();
      // Cleanup prior Blob URL if any
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Write to hidden print iframe via Blob URL to avoid document.write and injection
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      let iframe = printIframeRef.current;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.title = 'เอกสารพิมพ์ฉลาก';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        printIframeRef.current = iframe;
      }

      iframe.onload = async () => {
        if (!isMountedRef.current) {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          return;
        }

        try {
          // Ensure any images inside the iframe are fully decoded/loaded before print dialog
          const images = Array.from(iframe.contentDocument?.images || []);
          await Promise.all(
            images.map(
              (img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise((r) => {
                      img.onload = img.onerror = r;
                    })
            )
          );

          if (iframe.contentDocument?.fonts?.ready) {
            await iframe.contentDocument.fonts.ready;
          }

          if (!isMountedRef.current || blobUrlRef.current !== blobUrl) return;
          const printWindow = iframe.contentWindow;
          if (!printWindow || typeof printWindow.print !== 'function') throw new Error('เบราว์เซอร์ไม่รองรับการพิมพ์');
          printWindow.addEventListener('afterprint', finishPrint, { once: true });
          printWindow.focus();
          printWindow.print();
          if (onPrintSuccess && !isCalibration) onPrintSuccess();
          // Some mobile browsers omit afterprint; release the busy state after the dialog starts.
          if (isMountedRef.current) setIsGeneratingPrint(false);
        } catch (error) {
          finishPrint();
          if (isMountedRef.current) setToastMessage({ message: `เปิดหน้าต่างพิมพ์ไม่สำเร็จ: ${error.message}`, type: 'error' });
        }
      };

      // Cleanup belongs to this job so old events cannot revoke the next job's URL.
      const finishPrint = () => {
        iframe.contentWindow?.removeEventListener('afterprint', finishPrint);
        URL.revokeObjectURL(blobUrl);
        if (blobUrlRef.current === blobUrl) blobUrlRef.current = null;
        if (printCleanupRef.current === finishPrint) printCleanupRef.current = null;
        if (isMountedRef.current) setIsGeneratingPrint(false);
      };
      printCleanupRef.current = finishPrint;
      iframe.onerror = () => {
        finishPrint();
        if (isMountedRef.current) setToastMessage({ message: 'โหลดเอกสารพิมพ์ไม่สำเร็จ กรุณาลองอีกครั้ง', type: 'error' });
      };

      iframe.src = blobUrl;
    } catch (err) {
      if (isMountedRef.current) {
        setIsGeneratingPrint(false);
        setToastMessage({ message: `เกิดข้อผิดพลาดในการสร้างฉลาก: ${err.message}`, type: 'error' });
      }
    }
  };

  const isExcessive = totalLabelsCount > MAX_TOTAL_LABELS;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[110] h-[100dvh] flex flex-col bg-[#f7f8fa] text-[#26374a] font-sans overflow-hidden animate-in fade-in duration-200 [&_button]:min-h-11 [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:text-sm [&_input]:text-sm [&_select]:text-sm"
      role="dialog"
      aria-modal="true"
      aria-label="พิมพ์ฉลาก QR ครุภัณฑ์"
    >
      {/* Top Navigation Bar */}
      <header className="px-3 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-white border-b border-[#e0e6ee] grid grid-cols-[minmax(0,1fr)_auto] gap-2 shrink-0 lg:flex lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0 pr-12 lg:pr-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-colors"
            style={{
              backgroundColor: 'var(--theme-light, #f5f3ff)',
              color: 'var(--theme-ink, #4c1d95)'
            }}
          >
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#2e445d] leading-snug">พิมพ์ฉลาก QR / บาร์โค้ด</h1>
            <p className="hidden lg:block text-sm text-[#5a7087] mt-0.5">
              จัดหน้าและพิมพ์ฉลากมาตรฐานสำหรับติดเครื่องมือและอุปกรณ์
            </p>
          </div>
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-auto">
          {/* 10mm Calibration Print Button */}
          <button
            type="button"
            onClick={() => handlePrint(true)}
            disabled={isGeneratingPrint}
            className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#d8e1ea] rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
            title="พิมพ์แผ่นเทียบขนาด 10 มม. เพื่อตรวจว่าเครื่องพิมพ์พิมพ์ขนาด 100% ตรงตามจริงหรือไม่"
          >
            <Ruler className="w-4 h-4" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
            <span>เทียบขนาด 10 มม.</span>
          </button>

          {/* Main Print Button with Theme Accents */}
          <button
            type="button"
            onClick={() => handlePrint(false)}
            disabled={isGeneratingPrint || totalLabelsCount === 0 || dimensionCheck.blocked || !sheetLayout.valid || isExcessive}
            style={{
              backgroundColor:
                isGeneratingPrint || totalLabelsCount === 0 || dimensionCheck.blocked || !sheetLayout.valid || isExcessive
                  ? undefined
                  : 'var(--theme-main, #8b5cf6)',
              color: 'var(--theme-on-main, #ffffff)',
              boxShadow: '0 8px 16px -2px var(--theme-shadow, rgba(139, 92, 246, 0.35))'
            }}
            className="min-h-[44px] px-3 sm:px-5 py-2 text-sm font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-sm transition flex flex-1 lg:flex-none items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            {isGeneratingPrint
              ? 'กำลังเตรียมพิมพ์...'
              : `พิมพ์ฉลาก (${totalLabelsCount} ดวง)`}
          </button>

          {/* Close Workspace Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างพิมพ์ฉลาก"
            className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-3 lg:static min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition ml-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Workspace (Responsive Split Columns: Stacks on mobile, Side-by-side on desktop) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {/* Left Column: Preset, Options & Unit Selection Table */}
        <section className="shrink-0 lg:flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-[#e0e6ee] bg-white lg:overflow-y-auto min-h-0 min-w-0">
          {/* Preset & Mode Selection Tabs */}
          <div className="p-4 border-b border-[#e4eaf1] bg-slate-50/50 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
                รูปแบบและขนาดฉลาก
              </span>
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPrintMode(PRINT_MODES.SHEET_A4)}
                  style={
                    printMode === PRINT_MODES.SHEET_A4
                      ? { color: 'var(--theme-ink, #4c1d95)' }
                      : {}
                  }
                  className={`min-h-[44px] px-3.5 py-1 rounded-lg transition cursor-pointer ${
                    printMode === PRINT_MODES.SHEET_A4
                      ? 'bg-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  สติ๊กเกอร์แผ่น A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode(PRINT_MODES.ROLL)}
                  style={
                    printMode === PRINT_MODES.ROLL
                      ? { color: 'var(--theme-ink, #4c1d95)' }
                      : {}
                  }
                  className={`min-h-[44px] px-3.5 py-1 rounded-lg transition cursor-pointer ${
                    printMode === PRINT_MODES.ROLL
                      ? 'bg-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เครื่องพิมพ์ม้วน (Roll)
                </button>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Scissor Preset */}
              <button
                type="button"
                onClick={() => setSelectedPresetKey('scissor')}
                style={
                  selectedPresetKey === 'scissor'
                    ? {
                        borderColor: 'var(--theme-main, #8b5cf6)',
                        backgroundColor: 'var(--theme-light, #f5f3ff)',
                        boxShadow: '0 0 0 1px var(--theme-main, #8b5cf6)'
                      }
                    : {}
                }
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedPresetKey === 'scissor'
                    ? ''
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-800">
                    {LABEL_PRESETS.scissor.name}
                  </span>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--theme-light, #f5f3ff)',
                      color: 'var(--theme-ink, #4c1d95)'
                    }}
                  >
                    18 × 24 มม.
                  </span>
                </div>
                <p className="text-xs text-slate-500">สำหรับด้ามกรรไกร / คีม (ขนาดทดลอง)</p>
              </button>

              {/* Normal Preset */}
              <button
                type="button"
                onClick={() => setSelectedPresetKey('normal')}
                style={
                  selectedPresetKey === 'normal'
                    ? {
                        borderColor: 'var(--theme-main, #8b5cf6)',
                        backgroundColor: 'var(--theme-light, #f5f3ff)',
                        boxShadow: '0 0 0 1px var(--theme-main, #8b5cf6)'
                      }
                    : {}
                }
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedPresetKey === 'normal'
                    ? ''
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-800">
                    {LABEL_PRESETS.normal.name}
                  </span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    30 × 40 มม.
                  </span>
                </div>
                <p className="text-xs text-slate-500">สว่าน, แท่นตัดเทป, กล่องเครื่องมือ</p>
              </button>

              {/* Custom Preset */}
              <button
                type="button"
                onClick={() => setSelectedPresetKey('custom')}
                style={
                  selectedPresetKey === 'custom'
                    ? {
                        borderColor: 'var(--theme-main, #8b5cf6)',
                        backgroundColor: 'var(--theme-light, #f5f3ff)',
                        boxShadow: '0 0 0 1px var(--theme-main, #8b5cf6)'
                      }
                    : {}
                }
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedPresetKey === 'custom'
                    ? ''
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-800">กำหนดขนาดเอง</span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {customWidthMm} × {customHeightMm} มม.
                  </span>
                </div>
                <p className="text-xs text-slate-500">ระบุความกว้างและความสูงอิสระ</p>
              </button>
            </div>

            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
              รูปแบบรหัส
              <select aria-label="รูปแบบรหัส" value={labelFormat} onChange={(e) => {
                setLabelFormat(e.target.value);
                if (e.target.value === LABEL_FORMATS.BARCODE) setSelectedPresetKey('handle');
                else if (selectedPresetKey === 'handle') setSelectedPresetKey('normal');
              }} className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3">
                <option value={LABEL_FORMATS.QR}>QR Code</option>
                <option value={LABEL_FORMATS.BARCODE}>บาร์โค้ดแนวนอน (Code 128)</option>
              </select>
            </label>
            <button type="button" onClick={() => setSelectedPresetKey('handle')} aria-pressed={selectedPresetKey === 'handle'} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700">
              ด้ามเครื่องมือแนวยาว 50 × 15 มม.
            </button>
            {/* Custom Inputs */}
            {selectedPresetKey === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">กว้าง (มม.):</span>
                  <input
                    type="number"
                    min="12"
                    max="200"
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm font-semibold"
                  />
                </div>
                <span className="text-slate-400">×</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">สูง (มม.):</span>
                  <input
                    type="number"
                    min="14"
                    max="200"
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm font-semibold"
                  />
                </div>
              </div>
            )}

            {/* A4 Sheet Start Offset Controls */}
            {printMode === PRINT_MODES.SHEET_A4 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 text-xs">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-slate-600 font-medium">
                    ข้ามฉลากที่ลอกไปแล้ว (เริ่มพิมพ์ช่องที่):
                  </span>
                  <select
                    value={sheetParams.startOffset}
                    onChange={(e) =>
                      setSheetParams((prev) => ({
                        ...prev,
                        startOffset: Math.floor(Number(e.target.value)) || 0
                      }))
                    }
                    className="border border-slate-300 rounded px-2 py-1 bg-white font-semibold min-h-[44px]"
                  >
                    {Array.from({ length: Math.min(30, sheetLayout.labelsPerPage || 20) }).map(
                      (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? 'ตำแหน่งที่ 1 (เริ่มจากบนซ้าย)' : `เว้นว่าง ${i} ดวงแรก`}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <span className="text-slate-500">
                  {sheetLayout.labelsPerPage} ดวง/หน้า · ต้องการพิมพ์{' '}
                  <strong className="text-slate-800">{sheetLayout.totalPages}</strong> หน้า A4
                </span>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="p-3 border-b border-[#e4eaf1] flex flex-wrap items-center gap-2 bg-white shrink-0">
            {/* Search Input */}
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัส, ชื่อเครื่องมือ หรือสี..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--theme-main)] min-h-[44px]"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="กรองตามหมวดหมู่"
              className="text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white min-h-[44px]"
            >
              <option value="ALL">ทุกหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Color Filter */}
            {availableColors.length > 0 && (
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                aria-label="กรองตามสี"
                className="text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white min-h-[44px]"
              >
                <option value="ALL">ทุกสี</option>
                {availableColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="กรองตามสถานะ"
              className="text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white min-h-[44px]"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="AVAILABLE">พร้อมใช้</option>
              <option value="BORROWED">ยืมอยู่</option>
              <option value="BROKEN">ชำรุด</option>
              <option value="LOST">สูญหาย</option>
            </select>
          </div>

          {/* Batch Actions Bar */}
          <div className="px-3 py-2 border-b border-[#e4eaf1] bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-sm shrink-0">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-slate-700 font-semibold flex items-center gap-1.5 min-h-[44px] px-2 rounded hover:bg-slate-200/50 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
                <span>เลือกที่แสดงทั้งหมด ({filteredUnits.length})</span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-slate-500 hover:text-rose-600 font-medium min-h-[44px] px-2 rounded hover:bg-slate-200/50 cursor-pointer"
              >
                ล้างการเลือก
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 hidden sm:inline">ตั้งจำนวนพิมพ์ทั้งหมด:</span>
              <button
                type="button"
                onClick={() => setAllCopies(1)}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 font-medium cursor-pointer"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setAllCopies(2)}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 font-medium cursor-pointer"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => setAllCopies(3)}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 font-medium cursor-pointer"
              >
                3
              </button>
            </div>
          </div>

          {/* Unit List Table */}
          <div className="shrink-0 overflow-x-auto lg:min-h-[200px]">
            {filteredUnits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {enrichedUnits.length === 0 ? (
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold text-slate-700">ยังไม่มีรหัสประจำชิ้นสำหรับพิมพ์ฉลาก</p>
                    <p>จำนวนคงคลังรวมยังใช้พิมพ์ฉลากรายชิ้นไม่ได้ กรุณาเพิ่มครุภัณฑ์รายชิ้นพร้อมรหัสก่อน</p>
                    {onAddUnitRequest && <button type="button" onClick={onAddUnitRequest} className="min-h-[44px] rounded-xl px-4 py-2 font-semibold" style={{ backgroundColor: 'var(--theme-main)', color: 'var(--theme-on-main, #fff)' }}>เพิ่มครุภัณฑ์รายชิ้น</button>}
                  </div>
                ) : 'ไม่พบรายการครุภัณฑ์ตรงตามตัวกรอง'}
              </div>
            ) : (
              <table className="w-full min-w-[600px] text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 font-semibold border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">เลือก</th>
                    <th className="py-2 px-3">รหัสครุภัณฑ์</th>
                    <th className="py-2 px-3">รายการ / หมวด</th>
                    <th className="py-2 px-3">สี / ขนาด</th>
                    <th className="py-2 px-3 text-center">สถานะ</th>
                    <th className="py-2 px-3 w-24 text-center">จำนวนชุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnits.map((u) => {
                    const isSelected = selectedCodes.has(u.unit_code);
                    const copies = copiesPerUnit[u.unit_code] ?? 1;

                    return (
                      <tr
                        key={u.unit_code}
                        onClick={() => toggleUnit(u.unit_code)}
                        style={
                          isSelected
                            ? { backgroundColor: 'var(--theme-light, rgba(139, 92, 246, 0.08))' }
                            : {}
                        }
                        className={`cursor-pointer transition ${
                          isSelected ? '' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleUnit(u.unit_code)}
                            aria-label={`เลือก ${u.unit_code}`}
                            aria-pressed={isSelected}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            style={{ color: 'var(--theme-ink, #4c1d95)' }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800 tracking-wide">
                          {u.unit_code}
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-semibold text-slate-800">{u.itemName}</p>
                          <p className="text-[11px] text-slate-400">{u.categoryName}</p>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {u.color || '-'} {u.size ? `(${u.size})` : ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.status === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.status === 'BORROWED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.status === 'AVAILABLE'
                              ? 'พร้อมใช้'
                              : u.status === 'BORROWED'
                              ? 'ยืมอยู่'
                              : u.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={copies}
                            disabled={!isSelected}
                            onChange={(e) => handleCopyChange(u.unit_code, e.target.value)}
                            className="w-14 px-1.5 py-1 text-center font-semibold border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-400 min-h-[44px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Selection Summary */}
          <footer className="px-4 py-2.5 border-t border-[#e4eaf1] bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <span>
              เลือกแล้ว{' '}
              <strong className="font-bold" style={{ color: 'var(--theme-ink, #4c1d95)' }}>
                {selectedCodes.size}
              </strong>{' '}
              รายการ (รวมทั้งสิ้น <strong className="text-slate-800">{totalLabelsCount}</strong> ดวง)
            </span>
            <span className="text-slate-400 hidden sm:inline">
              * ไม่เลือกทั้งคลังโดยอัตโนมัติ เพื่อป้องกันการพิมพ์เปลืองกระดาษ
            </span>
          </footer>
        </section>

        {/* Right Column: Live Scale Preview & Calibration Guidance */}
        <aside className="w-full lg:w-[360px] xl:w-[420px] bg-[#f8fafc] flex flex-col lg:overflow-y-auto shrink-0 min-w-0 p-3 sm:p-5 space-y-4 border-t lg:border-t-0 lg:border-l border-[#e0e6ee]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
              ตัวอย่างฉลาก
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              ขนาด {activePreset.widthMm} × {activePreset.heightMm} มม.
            </span>
          </div>

          {/* Live Label Card Preview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center justify-center">
            {/* Visual Label Box in scale */}
            <div
              className="border-2 border-dashed border-slate-300 bg-white rounded flex flex-col items-center justify-center p-2 text-center transition-all shadow-xs"
              style={{
                width: `${Math.min(260, Math.max(90, activePreset.widthMm * 3.78))}px`,
                height: `${Math.min(320, Math.max(110, activePreset.heightMm * 3.78))}px`
              }}
            >
              {previewSvg ? (
                <div
                  className="w-full flex-1 flex items-center justify-center overflow-hidden min-h-0 [&_svg]:max-w-full [&_svg]:max-h-full"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center text-slate-300">
                  {labelFormat === LABEL_FORMATS.QR ? 'QR' : 'Code 128'}
                </div>
              )}
              <div className="mt-1 font-bold text-slate-900 tracking-wider text-xs truncate max-w-full">
                {previewSampleUnit?.unit_code || 'ยังไม่มีรหัสประจำชิ้น'}
              </div>
              {activePreset.showItemName && previewSampleUnit && (
                <div className="text-[10px] text-slate-500 truncate max-w-full leading-tight">
                  {previewSampleUnit?.itemName}
                  {previewSampleUnit.color ? ` · ${previewSampleUnit.color}` : ''}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-3 text-center">
              ตัวอย่างบนจอปรับตามพื้นที่ ขนาดจริงขึ้นกับการตั้งค่าพิมพ์ 100% และแผ่นเทียบขนาด 10 มม.
            </p>
          </div>

          {/* Excessive Limit Warning */}
          {isExcessive && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">จำนวนฉลากเกินขีดจำกัดสูงสุด</p>
                <p className="mt-0.5">
                  เลือกพิมพ์ทั้งหมด {totalLabelsCount} ดวง ซึ่งเกินขีดจำกัดสูงสุด {MAX_TOTAL_LABELS} ดวง
                  กรุณาลดจำนวนชุดหรือแบ่งพิมพ์ทีละชุด
                </p>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {dimensionCheck.blocked && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ขนาดฉลากเล็กเกินไป</p>
                <p className="mt-0.5">{dimensionCheck.error}</p>
              </div>
            </div>
          )}

          {!dimensionCheck.blocked && dimensionCheck.warning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ข้อควรระวัง</p>
                <p className="mt-0.5">{dimensionCheck.warning}</p>
              </div>
            </div>
          )}

          {/* Technical Specs & Calibration Advice Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2.5">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Ruler className="w-4 h-4" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
              คำแนะนำการพิมพ์และการตั้งค่า (สำคัญมาก)
            </h3>
            <div className="space-y-1.5 text-slate-600 leading-relaxed">
              <p>
                <strong>1. ตั้งค่า Scale เป็น 100%:</strong> ในหน้าต่างพิมพ์ของเบราว์เซอร์ ให้เลือก
                ขนาดจริง (Actual size / 100%) เสมอ <u>ห้ามเลือก Fit to page</u> เพื่อให้ช่องไฟและขนาดฉลากตรงตามสติ๊กเกอร์จริง
              </p>
              <p>
                <strong>2. ทดสอบเทียบขนาด:</strong> หากเริ่มใช้กระดาษสติ๊กเกอร์หรืองานติดตั้งใหม่ แนะนำกด{' '}
                <button
                  type="button"
                  onClick={() => handlePrint(true)}
                  className="font-bold underline cursor-pointer"
                  style={{ color: 'var(--theme-ink, #4c1d95)' }}
                >
                  พิมพ์แผ่นเทียบขนาด 10 มม.
                </button>{' '}
                เพื่อนำไม้บรรทัดวัดตรวจสอบก่อนพิมพ์จริง
              </p>
              <p>
                <strong>3. เครื่องพิมพ์สติ๊กเกอร์ม้วน:</strong> หากใช้เครื่องพิมพ์ฉลากความร้อน ให้เลือกโหมด{' '}
                <span className="font-semibold text-slate-800">เครื่องพิมพ์ม้วน (Roll)</span>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>, document.body
  );
}
