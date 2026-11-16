import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Printer,
  X,
  Search,
  Check,
  Plus,
  Minus,
  AlertTriangle,
  QrCode,
  Barcode,
  ChevronDown,
  Ruler,
  Package,
  Wrench
} from 'lucide-react';
import {
  LABEL_PRESETS,
  LABEL_FORMATS,
  BARCODE_DENSITIES,
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
  encodeQrPayload,
  decodeQrPayload
} from '../../utils/qrLabels.js';
import Toast from '../common/Toast.jsx';

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * QrLabelPrint — Visual Sticker Studio (16pt uniform spacing)
 *
 * Effortless 2-step sticker printing for serialized tools & material boxes:
 * 1. Tap cards on the left to pick items & set copy counts inline (or generate a tool code in 1 click).
 * 2. Pick QR (30x40mm) vs Narrow Barcode (50x15mm) on the right, preview actual proportions, and print.
 */
export default function QrLabelPrint({
  units = [],
  items = [],
  categories = [],
  onClose,
  initialSelectedUnitCodes = [],
  onPrintSuccess,
  onAddUnitRequest,
  onQuickCreateUnit
}) {
  const [selectedCodes, setSelectedCodes] = useState(() => new Set(initialSelectedUnitCodes));
  const [copiesPerUnit, setCopiesPerUnit] = useState({});
  const [activeSource, setActiveSource] = useState('units'); // 'units' | 'boxes'
  const [searchQuery, setSearchQuery] = useState('');

  // Inline quick unit code generator state (collapsed by default to keep UI clean)
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickToolId, setQuickToolId] = useState('');
  const [quickUnitCode, setQuickUnitCode] = useState('');
  const [isCreatingQuickUnit, setIsCreatingQuickUnit] = useState(false);
  const quickUnitIdemRef = useRef(null);

  // Print format & layout states
  const [labelFormat, setLabelFormat] = useState(LABEL_FORMATS.QR);
  const [barDensity, setBarDensity] = useState(BARCODE_DENSITIES.FINE);
  const [selectedPresetKey, setSelectedPresetKey] = useState('normal');
  const [customWidthMm, setCustomWidthMm] = useState(15);
  const [customHeightMm, setCustomHeightMm] = useState(10);
  const [printMode, setPrintMode] = useState(PRINT_MODES.SHEET_A4);

  const [sheetParams, setSheetParams] = useState({
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    marginRightMm: 10,
    gapRowMm: 2,
    gapColMm: 2,
    startOffset: 0
  });

  const [toastMessage, setToastMessage] = useState(null);
  const [isGeneratingPrint, setIsGeneratingPrint] = useState(false);
  const [previewSvg, setPreviewSvg] = useState('');

  const printIframeRef = useRef(null);
  const blobUrlRef = useRef(null);
  const printCleanupRef = useRef(null);
  const previousFocusRef = useRef(null);
  const isMountedRef = useRef(true);
  const dialogRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    if (typeof document !== 'undefined') {
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
            // Ignore cleanup error
          }
          printIframeRef.current = null;
        }
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      if (e.key === 'Tab') {
        const controls = [
          ...(dialogRef.current?.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
          ) || [])
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const itemMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (item?.id) map.set(item.id, item);
      if (item?.code) map.set(item.code, item);
    });
    return map;
  }, [items]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => {
      if (cat?.id) map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  const toolItems = useMemo(() => {
    return items.filter((it) => {
      if (!it || it.is_active === false) return false;
      const t = String(it.item_type || '').toLowerCase();
      return t === 'asset' || t === 'tool' || t === 'equipment';
    });
  }, [items]);

  useEffect(() => {
    if (!quickToolId && toolItems.length > 0) {
      setQuickToolId(String(toolItems[0].id));
    }
  }, [toolItems, quickToolId]);

  // 1. Serialized tool units
  const enrichedUnits = useMemo(() => {
    return units
      .filter((u) => typeof u?.unit_code === 'string' && u.unit_code.trim())
      .map((u) => {
        const item = itemMap.get(u.item_id);
        const category = item ? categoryMap.get(item.category_id) : null;
        return {
          unit_code: u.unit_code.trim(),
          item_id: u.item_id,
          status: u.status || 'AVAILABLE',
          notes: u.notes || '',
          itemName: item?.name || 'เครื่องมือ',
          color: item?.color || '',
          size: item?.size || '',
          categoryName: category?.name || 'อุปกรณ์',
          categoryId: item?.category_id || '',
          sourceKind: 'unit'
        };
      });
  }, [units, itemMap, categoryMap]);

  // 2. Catalog box/shelf labels (items with valid printable `code`, excluding codes already in enrichedUnits)
  const boxCatalogUnits = useMemo(() => {
    const existingCodes = new Set(enrichedUnits.map((u) => u.unit_code));
    return items
      .filter((it) => {
        if (!it || it.is_active === false) return false;
        const code = typeof it.code === 'string' ? it.code.trim() : '';
        if (!code || existingCodes.has(code)) return false;
        const parsed = decodeQrPayload(code);
        return parsed.success && parsed.unitCode === code;
      })
      .map((it) => {
        const category = categoryMap.get(it.category_id);
        return {
          unit_code: it.code.trim(),
          item_id: it.id,
          status: 'BOX',
          notes: it.storage_location || '',
          itemName: it.name || 'พัสดุคลัง',
          color: it.color || '',
          size: it.size || '',
          categoryName: category?.name || 'ป้ายติดกล่อง',
          categoryId: it.category_id || '',
          sourceKind: 'box'
        };
      });
  }, [items, enrichedUnits, categoryMap]);

  const allPrintableUnits = useMemo(() => {
    return [...enrichedUnits, ...boxCatalogUnits];
  }, [enrichedUnits, boxCatalogUnits]);

  const activeSourceUnits = activeSource === 'boxes' ? boxCatalogUnits : enrichedUnits;

  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return activeSourceUnits;
    const q = searchQuery.toLowerCase().trim();
    return activeSourceUnits.filter((u) => {
      return (
        u.unit_code.toLowerCase().includes(q) ||
        u.itemName.toLowerCase().includes(q) ||
        u.color.toLowerCase().includes(q) ||
        u.categoryName.toLowerCase().includes(q)
      );
    });
  }, [activeSourceUnits, searchQuery]);

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
        showItemName: false
      };
    }
    return LABEL_PRESETS[selectedPresetKey] || LABEL_PRESETS.normal;
  }, [selectedPresetKey, customWidthMm, customHeightMm]);

  const previewSampleUnit = useMemo(() => {
    const firstSelected = allPrintableUnits.find((u) => selectedCodes.has(u.unit_code));
    if (firstSelected) return firstSelected;
    if (activeSource === 'boxes') return boxCatalogUnits[0] || null;
    return enrichedUnits[0] || null;
  }, [allPrintableUnits, selectedCodes, activeSource, boxCatalogUnits, enrichedUnits]);

  const dimensionCheck = useMemo(() => {
    const codes = allPrintableUnits
      .filter((u) => selectedCodes.has(u.unit_code))
      .map((u) => u.unit_code);
    if (!codes.length && previewSampleUnit) codes.push(previewSampleUnit.unit_code);
    if (labelFormat === LABEL_FORMATS.BARCODE) {
      return validateBarcodeDimensions({
        widthMm: activePreset.widthMm,
        heightMm: activePreset.heightMm,
        unitCodes: codes
      });
    }
    const targetPayloads = codes.map((c) => encodeQrPayload(c));
    return validateLabelDimensions({
      widthMm: activePreset.widthMm,
      heightMm: activePreset.heightMm,
      qrGraphicMm: activePreset.qrGraphicMm,
      payloads: targetPayloads
    });
  }, [activePreset, selectedCodes, previewSampleUnit, allPrintableUnits, labelFormat]);

  const totalLabelsCount = useMemo(() => {
    let sum = 0;
    allPrintableUnits
      .filter((u) => selectedCodes.has(u.unit_code))
      .forEach(({ unit_code: code }) => {
        sum += validateCopyCount(copiesPerUnit[code] ?? 1);
      });
    return sum;
  }, [selectedCodes, copiesPerUnit, allPrintableUnits]);

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

  useEffect(() => {
    let isCurrent = true;
    const generatePreview = async () => {
      try {
        if (!previewSampleUnit) {
          if (isCurrent) setPreviewSvg('');
          return;
        }
        const payload = encodeQrPayload(previewSampleUnit.unit_code);
        const svg =
          labelFormat === LABEL_FORMATS.BARCODE
            ? generateBarcodeSvgString(previewSampleUnit.unit_code, { ...activePreset, barDensity })
            : await generateQrSvgString(payload, {
                margin: 0,
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
  }, [previewSampleUnit, labelFormat, activePreset, barDensity]);

  const selectFormatMode = (nextFormat) => {
    setLabelFormat(nextFormat);
    if (nextFormat === LABEL_FORMATS.BARCODE) {
      if (!['micro_barcode', 'small_barcode', 'handle', 'custom'].includes(selectedPresetKey)) {
        setSelectedPresetKey('handle');
      }
    } else if (!['micro_qr', 'scissor', 'normal', 'custom'].includes(selectedPresetKey)) {
      setSelectedPresetKey('normal');
    }
  };

  const toggleUnit = (unitCode) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(unitCode)) next.delete(unitCode);
      else next.add(unitCode);
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
    setCopiesPerUnit((prev) => ({ ...prev, ...updated }));
    setToastMessage({ message: `ตั้งจำนวนพิมพ์ ${valid} ดวงต่อรหัสแล้ว`, type: 'success' });
  };

  const suggestNextCodeForTool = () => {
    const existingNums = enrichedUnits
      .filter((u) => String(u.item_id) === String(quickToolId))
      .map((u) => {
        const match = u.unit_code.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      });
    const nextSeq = Math.max(0, ...existingNums) + 1;
    const padded = String(nextSeq).padStart(3, '0');
    setQuickUnitCode(`EQ-${padded}`);
  };

  const handleQuickGenerateUnit = async (e) => {
    e.preventDefault();
    if (!onQuickCreateUnit || !quickToolId || isCreatingQuickUnit) return;
    const cleanCode = quickUnitCode.trim().toUpperCase();
    if (!cleanCode) {
      setToastMessage({ message: 'กรุณาระบุรหัสประจำชิ้นก่อนสร้าง', type: 'warning' });
      return;
    }
    const check = decodeQrPayload(cleanCode);
    if (!check.success) {
      setToastMessage({
        message: 'รหัสต้องเป็นภาษาอังกฤษ ตัวเลข หรือขีด (-) เท่านั้น เช่น EQ-001',
        type: 'error'
      });
      return;
    }

    setIsCreatingQuickUnit(true);
    try {
      if (!quickUnitIdemRef.current) {
        quickUnitIdemRef.current = makeIdempotencyKey();
      }
      await onQuickCreateUnit({
        itemId: quickToolId,
        unitCode: cleanCode,
        idempotencyKey: quickUnitIdemRef.current
      });
      quickUnitIdemRef.current = null;
      setQuickUnitCode('');
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        next.add(cleanCode);
        return next;
      });
    } catch {
      // Parent handles error toast
    } finally {
      setIsCreatingQuickUnit(false);
    }
  };

  const handlePrint = async (isCalibration = false) => {
    if (!isCalibration && (selectedCodes.size === 0 || totalLabelsCount === 0)) {
      setToastMessage({ message: 'กรุณาแตะเลือกรหัสที่ต้องการพิมพ์อย่างน้อย 1 รายการ', type: 'warning' });
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
      setToastMessage({ message: 'ไม่สามารถพิมพ์ได้เนื่องจากขนาดฉลากไม่พอดีกับรหัส', type: 'error' });
      return;
    }

    setIsGeneratingPrint(true);

    try {
      const labelItems = [];

      const qrPrintOpts = { margin: 0, errorCorrectionLevel: 'M' };

      if (isCalibration && previewSampleUnit && !dimensionCheck.blocked) {
        const sampleCode = previewSampleUnit.unit_code;
        const payload = encodeQrPayload(sampleCode);
        const [svg, dataUrl] =
          labelFormat === LABEL_FORMATS.BARCODE
            ? [generateBarcodeSvgString(sampleCode, { ...activePreset, barDensity }), '']
            : await Promise.all([
                generateQrSvgString(payload, qrPrintOpts),
                generateQrDataUrl(payload, qrPrintOpts)
              ]);
        labelItems.push({
          unitCode: sampleCode,
          itemName: previewSampleUnit.itemName,
          color: previewSampleUnit.color,
          svg,
          dataUrl
        });
      } else if (!isCalibration) {
        for (const unit of allPrintableUnits) {
          if (!isMountedRef.current) return;
          if (!selectedCodes.has(unit.unit_code)) continue;

          const count = validateCopyCount(copiesPerUnit[unit.unit_code] ?? 1);
          const payload = encodeQrPayload(unit.unit_code);
          const [svg, dataUrl] =
            labelFormat === LABEL_FORMATS.BARCODE
              ? [generateBarcodeSvgString(unit.unit_code, { ...activePreset, barDensity }), '']
              : await Promise.all([
                  generateQrSvgString(payload, qrPrintOpts),
                  generateQrDataUrl(payload, qrPrintOpts)
                ]);

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

      const html = buildPrintHtml({
        labels: labelItems,
        preset: activePreset,
        mode: isCalibration ? PRINT_MODES.SHEET_A4 : printMode,
        sheetParams,
        calibration: isCalibration,
        format: labelFormat
      });

      printCleanupRef.current?.();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

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

      const finishPrint = () => {
        iframe.contentWindow?.removeEventListener('afterprint', finishPrint);
        URL.revokeObjectURL(blobUrl);
        if (blobUrlRef.current === blobUrl) blobUrlRef.current = null;
        if (printCleanupRef.current === finishPrint) printCleanupRef.current = null;
        if (isMountedRef.current) setIsGeneratingPrint(false);
      };

      iframe.onload = async () => {
        if (!isMountedRef.current) {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          return;
        }

        try {
          const images = Array.from(iframe.contentDocument?.images || []);
          await Promise.all(
            images.map((img) =>
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
          if (!printWindow || typeof printWindow.print !== 'function') {
            throw new Error('เบราว์เซอร์ไม่รองรับการพิมพ์');
          }
          printWindow.addEventListener('afterprint', finishPrint, { once: true });
          printWindow.focus();
          printWindow.print();
          if (onPrintSuccess && !isCalibration) onPrintSuccess();
          if (isMountedRef.current) setIsGeneratingPrint(false);
        } catch (error) {
          finishPrint();
          if (isMountedRef.current) {
            setToastMessage({ message: `เปิดหน้าต่างพิมพ์ไม่สำเร็จ: ${error.message}`, type: 'error' });
          }
        }
      };

      printCleanupRef.current = finishPrint;
      iframe.onerror = () => {
        finishPrint();
        if (isMountedRef.current) {
          setToastMessage({ message: 'โหลดเอกสารพิมพ์ไม่สำเร็จ กรุณาลองอีกครั้ง', type: 'error' });
        }
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
  const isPrintDisabled =
    isGeneratingPrint ||
    totalLabelsCount === 0 ||
    dimensionCheck.blocked ||
    !sheetLayout.valid ||
    isExcessive;

  const dialogNode = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="พิมพ์ฉลาก QR ครุภัณฑ์"
      className="fixed inset-0 z-[110] h-[100dvh] flex flex-col bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden"
    >
      {/* ===================================================================== */}
      {/* UNIFIED 3-ZONE STUDIO APPBAR (16pt = 16px base padding on all sides)  */}
      {/* ===================================================================== */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/75 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-4 min-h-[calc(72px+env(safe-area-inset-top,0px))] grid grid-cols-[40px_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4 shrink-0">
        {/* Zone 1: Left Navigation Action ([←] Back) */}
        <div className="justify-self-start flex items-center">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -ml-1.5 rounded-full text-slate-900 hover:bg-slate-100 flex items-center justify-center transition active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              title="กลับคลังสินค้า"
              aria-label="ปิดหน้าต่างพิมพ์ฉลาก"
            >
              <ArrowLeft aria-hidden="true" className="w-[21px] h-[21px] stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Zone 2: Center Title & Live Selection Summary */}
        <div className="min-w-0 text-center">
          <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-[-0.02em] truncate">
            พิมพ์สติกเกอร์ QR / Barcode
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate tabular-nums">
            เลือก {selectedCodes.size} รายการ · รวม {totalLabelsCount} ดวง
          </p>
        </div>

        {/* Zone 3: Right Primary Action */}
        <div className="justify-self-end flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isPrintDisabled}
            onClick={() => handlePrint(false)}
            className={`h-10 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-bold transition flex items-center gap-1.5 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
              isPrintDisabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-95 cursor-pointer'
            }`}
          >
            <Printer aria-hidden="true" className="w-4 h-4 shrink-0" />
            <span>{isGeneratingPrint ? 'กำลังเตรียมพิมพ์...' : `พิมพ์ฉลาก (${totalLabelsCount} ดวง)`}</span>
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN 2-STEP WORKSPACE (16pt = p-4 / gap-4)                            */}
      {/* ===================================================================== */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT PANEL: เลือกของที่จะติดสติกเกอร์ */}
        <section className="flex-1 lg:overflow-y-auto p-4 space-y-4">
          {/* Source Switcher (Serialized Units vs Material Box Codes) */}
          {boxCatalogUnits.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSource('units')}
                className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center gap-2 cursor-pointer tabular-nums ${
                  activeSource === 'units'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Wrench className="w-4 h-4 shrink-0" />
                <span>อุปกรณ์รายชิ้น ({enrichedUnits.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSource('boxes')}
                className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center gap-2 cursor-pointer tabular-nums ${
                  activeSource === 'boxes'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span>ป้ายติดกล่องวัสดุ ({boxCatalogUnits.length})</span>
              </button>
            </div>
          )}

          {/* Step 1 Heading + Search + Bulk Select */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">
              1. เลือกรหัสที่ต้องการพิมพ์ ({selectedCodes.size} รายการ)
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeSource === 'units' && onQuickCreateUnit && toolItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowQuickCreate((v) => !v)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    showQuickCreate
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>สร้างรหัสใหม่ด่วน</span>
                </button>
              )}
              {onAddUnitRequest && activeSourceUnits.length > 0 && !onQuickCreateUnit && (
                <button
                  type="button"
                  onClick={onAddUnitRequest}
                  className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>เพิ่มรหัสใหม่</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible 1-Tap Quick Code Generator (only visible when toggled open) */}
          {showQuickCreate && activeSource === 'units' && onQuickCreateUnit && toolItems.length > 0 && (
            <form
              onSubmit={handleQuickGenerateUnit}
              className="bg-white border border-violet-200 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center gap-2.5 shadow-sm"
            >
              <select
                value={quickToolId}
                onChange={(e) => setQuickToolId(e.target.value)}
                aria-label="เลือกอุปกรณ์เพื่อสร้างรหัส"
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-violet-500"
              >
                {toolItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  value={quickUnitCode}
                  onChange={(e) => setQuickUnitCode(e.target.value.toUpperCase())}
                  placeholder="ระบุรหัสสั้นๆ เช่น SC-01, ITEM0001"
                  className="flex-1 min-w-0 h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={suggestNextCodeForTool}
                  className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer shrink-0"
                >
                  รันอัตโนมัติ
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuickUnit}
                  className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shrink-0"
                >
                  {isCreatingQuickUnit ? 'กำลังสร้าง...' : 'บันทึก'}
                </button>
              </div>
            </form>
          )}

          {/* Search + Bulk Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส, ชื่อเครื่องมือ หรือสี..."
                className="w-full h-11 pl-11 pr-9 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                  aria-label="ล้างคำค้นหา"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {filteredUnits.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="h-11 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition cursor-pointer"
                >
                  เลือกทั้งหมด
                </button>
                {selectedCodes.size > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="h-11 px-3.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-xs font-bold text-slate-700 hover:text-rose-700 transition cursor-pointer"
                  >
                    ล้างที่เลือก
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Printable Sticker Card Grid or Empty State */}
          {activeSourceUnits.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ยังไม่มีรหัสประจำชิ้นสำหรับพิมพ์ฉลาก
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  เพิ่มรหัสให้เครื่องมือแต่ละชิ้นก่อน เพื่อให้สแกนหยิบและคืนได้แม่นยำโดยไม่ปนกัน
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {onAddUnitRequest && (
                  <button
                    type="button"
                    onClick={onAddUnitRequest}
                    className="h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มครุภัณฑ์รายชิ้น</span>
                  </button>
                )}
                {boxCatalogUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSource('boxes')}
                    className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>พิมพ์ป้ายติดกล่องวัสดุแทน ({boxCatalogUnits.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              ไม่พบรหัสที่ตรงกับคำค้นหา "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredUnits.map((u) => {
                const isSelected = selectedCodes.has(u.unit_code);
                const copies = copiesPerUnit[u.unit_code] ?? 1;

                return (
                  <div
                    key={u.unit_code}
                    onClick={() => toggleUnit(u.unit_code)}
                    className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 transition select-none cursor-pointer ${
                      isSelected
                        ? 'bg-violet-50/50 border-violet-600 ring-2 ring-violet-600'
                        : 'bg-white border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="font-mono text-sm sm:text-base font-extrabold text-slate-900 truncate">
                          {u.unit_code}
                        </div>
                        <div className="text-xs font-medium text-slate-600 truncate mt-0.5">
                          {u.itemName}
                          {u.color ? ` · สี${u.color}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUnit(u.unit_code);
                        }}
                        aria-label={`เลือก ${u.unit_code}`}
                        aria-pressed={isSelected}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'bg-slate-50 border-slate-300 text-transparent hover:border-violet-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>

                    {isSelected && (
                      <div
                        className="pt-2 border-t border-violet-200/80 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs font-bold text-violet-950">จำนวนดวง</span>
                        <div className="flex items-center gap-1 bg-white border border-violet-300 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => handleCopyChange(u.unit_code, Math.max(1, Number(copies) - 1))}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                            aria-label={`ลดจำนวนพิมพ์ ${u.unit_code}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={copies}
                            onChange={(e) => handleCopyChange(u.unit_code, e.target.value)}
                            aria-label={`จำนวนดวงของ ${u.unit_code}`}
                            className="w-9 text-center text-xs font-extrabold text-violet-950 tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyChange(u.unit_code, Math.min(50, Number(copies) + 1))}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                            aria-label={`เพิ่มจำนวนพิมพ์ ${u.unit_code}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT PANEL: 2. เลือกแบบ ขนาด และดูตัวอย่างสติกเกอร์จริง */}
        <aside className="w-full lg:w-[400px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 lg:overflow-y-auto p-4 space-y-4">
          {/* Accessible combobox kept in sync for keyboard/screen-reader & automated contract */}
          <select
            aria-label="รูปแบบรหัส"
            value={labelFormat}
            onChange={(e) => selectFormatMode(e.target.value)}
            className="sr-only"
          >
            <option value={LABEL_FORMATS.QR}>QR Code</option>
            <option value={LABEL_FORMATS.BARCODE}>Code 128 Barcode</option>
          </select>

          {/* Step 2A: 2-Tab Format Switcher (QR Code vs Barcode) */}
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900">2. เลือกแบบและขนาดสติกเกอร์</h3>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setLabelFormat(LABEL_FORMATS.QR);
                  if (!['micro_qr', 'scissor', 'normal', 'custom'].includes(selectedPresetKey)) {
                    setSelectedPresetKey('normal');
                  }
                }}
                className={`h-10 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                  labelFormat === LABEL_FORMATS.QR
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLabelFormat(LABEL_FORMATS.BARCODE);
                  if (!['micro_barcode', 'small_barcode', 'handle', 'custom'].includes(selectedPresetKey)) {
                    setSelectedPresetKey('micro_barcode');
                  }
                }}
                className={`h-10 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                  labelFormat === LABEL_FORMATS.BARCODE
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Barcode className="w-4 h-4 shrink-0" />
                <span>Barcode แท่ง</span>
              </button>
            </div>
          </div>

          {/* Step 2B: Visible 1-Tap Size Presets (Down to 5mm Micro!) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(labelFormat === LABEL_FORMATS.QR
                ? [
                    { key: 'micro_qr', title: 'จิ๋วติดกรรไกร', sub: 'รูป QR 5×5 มม.' },
                    { key: 'scissor', title: 'เล็ก', sub: '18 × 24 มม.' },
                    { key: 'normal', title: 'มาตรฐาน', sub: '30 × 40 มม.' },
                    { key: 'custom', title: 'กำหนดขนาดเอง', sub: 'ตั้งแต่ 5 มม.' }
                  ]
                : [
                    { key: 'micro_barcode', title: 'จิ๋วติดกรรไกร', sub: '15 × 5 มม.' },
                    { key: 'small_barcode', title: 'เล็กติดด้าม', sub: '30 × 10 มม.' },
                    { key: 'handle', title: 'มาตรฐาน', sub: '50 × 15 มม.' },
                    { key: 'custom', title: 'กำหนดขนาดเอง', sub: 'ตั้งแต่ 5 มม.' }
                  ]
              ).map((opt) => {
                const active = selectedPresetKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedPresetKey(opt.key)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-violet-50/80 border-violet-600 ring-2 ring-violet-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-slate-900">{opt.title}</div>
                    <div className="text-[11px] font-semibold text-slate-500 tabular-nums mt-0.5">
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPresetKey === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    กว้าง (มม. · ขั้นต่ำ 5)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="210"
                    step="0.5"
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(e.target.value)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    สูง (มม. · ขั้นต่ำ 5)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="297"
                    step="0.5"
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(e.target.value)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tabular-nums focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            )}

            {labelFormat === LABEL_FORMATS.BARCODE && (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">ความบางเส้นบาร์โค้ด</span>
                  <span className="text-[10px] font-semibold text-slate-500">ลดเส้นบวมเวลาพิมพ์ขนาดเล็ก</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="ความบางเส้นบาร์โค้ด">
                  {[
                    { key: BARCODE_DENSITIES.ULTRA, label: 'บางพิเศษ' },
                    { key: BARCODE_DENSITIES.FINE, label: 'เส้นบางคมชัด' },
                    { key: BARCODE_DENSITIES.NORMAL, label: 'มาตรฐาน' }
                  ].map((opt) => {
                    const active = barDensity === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setBarDensity(opt.key)}
                        className={`h-8 px-2 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                          active
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Retail-Style Tight Live Sticker Preview (ONLY QR/Bars + Tiny Flush Code, NO Item Name!) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">ตัวอย่างป้ายจริง (พิมพ์เฉพาะรหัสชิดใต้ภาพ)</span>
              <span className="font-bold text-violet-700 tabular-nums">
                {activePreset.widthMm} × {activePreset.heightMm} มม.
              </span>
            </div>

            {dimensionCheck.blocked && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs font-semibold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{dimensionCheck.error}</span>
              </div>
            )}

            {!dimensionCheck.blocked && dimensionCheck.warning && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] font-semibold text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{dimensionCheck.warning}</span>
              </div>
            )}

            <div className="min-h-[116px] flex items-center justify-center py-2">
              {previewSampleUnit && !dimensionCheck.blocked ? (
                <div
                  className="bg-white border border-dashed border-slate-400 rounded-md px-2 py-1.5 inline-flex flex-col items-center justify-center text-center shadow-xs overflow-hidden"
                  style={{
                    width:
                      labelFormat === LABEL_FORMATS.BARCODE
                        ? `${Math.min(230, Math.max(96, activePreset.widthMm * 4.5))}px`
                        : undefined
                  }}
                >
                  {previewSvg && (
                    <div
                      className={
                        labelFormat === LABEL_FORMATS.QR
                          ? `${
                              activePreset.widthMm <= 10
                                ? 'w-14 h-14'
                                : activePreset.widthMm <= 20
                                  ? 'w-20 h-20'
                                  : 'w-24 h-24'
                            } shrink-0 flex items-center justify-center leading-none [&_svg]:w-full [&_svg]:h-full [&_svg]:block`
                          : 'w-full shrink-0 flex items-center justify-center leading-none [&_svg]:w-full [&_svg]:h-9 [&_svg]:block'
                      }
                      dangerouslySetInnerHTML={{ __html: previewSvg }}
                    />
                  )}
                  <div
                    className={`shrink-0 font-mono font-semibold text-black leading-none mt-1 tracking-tight truncate max-w-full ${
                      activePreset.heightMm <= 10 || activePreset.widthMm <= 12
                        ? 'text-[9px]'
                        : 'text-[10px]'
                    }`}
                  >
                    {previewSampleUnit.unit_code}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center">
                  แตะเลือกรหัสฝั่งซ้ายเพื่อดูตัวอย่างสติกเกอร์ก่อนพิมพ์
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Quick Copy Multiplier & Paper Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-900">จำนวนดวงต่อรหัส</h3>
              <span className="text-[11px] text-slate-500">ตั้งพร้อมกันทุกรายการที่เลือก</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={selectedCodes.size === 0}
                  onClick={() => setAllCopies(num)}
                  className="h-9 rounded-xl bg-slate-50 hover:bg-violet-600 hover:text-white disabled:opacity-40 border border-slate-200 text-xs font-extrabold text-slate-800 transition cursor-pointer disabled:cursor-not-allowed tabular-nums"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-900">กระดาษเครื่องพิมพ์</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrintMode(PRINT_MODES.SHEET_A4)}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  printMode === PRINT_MODES.SHEET_A4
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                แผ่น A4
              </button>
              <button
                type="button"
                onClick={() => setPrintMode(PRINT_MODES.ROLL)}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  printMode === PRINT_MODES.ROLL
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ม้วนสติกเกอร์ (Roll)
              </button>
            </div>
            {printMode === PRINT_MODES.SHEET_A4 && sheetLayout.valid && (
              <p className="text-[11px] text-slate-600 tabular-nums">
                เรียงอัตโนมัติ {sheetLayout.cols} × {sheetLayout.rows} ช่อง ({sheetLayout.cols * sheetLayout.rows} ดวง/แผ่น
                {totalLabelsCount > 0 ? ` · ใช้ ${sheetLayout.totalPages} แผ่น` : ''})
              </p>
            )}
          </div>

          {/* Collapsible Printer Offset & Calibration Ruler */}
          <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <summary className="p-3 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer select-none list-none hover:bg-slate-50">
              <span>ตั้งค่าแผ่น A4 เดิม / พิมพ์ใบวัดขนาด</span>
              <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>

            <div className="p-3.5 pt-0 border-t border-slate-100 space-y-3 text-xs">
              {printMode === PRINT_MODES.SHEET_A4 && (
                <div className="pt-3 space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    ข้ามช่องสติกเกอร์ที่ลอกใช้ไปแล้ว (แผ่น A4 เดิม)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="450"
                    value={sheetParams.startOffset}
                    onChange={(e) =>
                      setSheetParams((prev) => ({
                        ...prev,
                        startOffset: Math.max(0, Math.floor(Number(e.target.value) || 0))
                      }))
                    }
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 tabular-nums"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={isGeneratingPrint || !previewSampleUnit || dimensionCheck.blocked}
                onClick={() => handlePrint(true)}
                className="w-full h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed mt-2"
              >
                <Ruler className="w-4 h-4" />
                <span>พิมพ์แผ่นเทียบไม้บรรทัด 10 มม.</span>
              </button>
            </div>
          </details>
        </aside>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialogNode, document.body) : dialogNode;
}
