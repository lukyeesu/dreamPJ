import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export const LABEL_FORMATS = Object.freeze({ QR: 'qr', BARCODE: 'code128' });
export const BARCODE_DENSITIES = Object.freeze({
  ULTRA: 'ultra',
  FINE: 'fine',
  NORMAL: 'normal'
});

// JsBarcode supplies the encoding/checksum; render its bits locally with adaptive quiet zone.
export function getBarcodeSymbol(unitCode, quietZoneModules = 10) {
  const decoded = decodeQrPayload(unitCode);
  if (!decoded.success || !decoded.isRawCode || decoded.unitCode !== unitCode) {
    throw new Error('บาร์โค้ดต้องใช้รหัสประจำชิ้น 1-64 ตัวอักษร A-Z, a-z, 0-9, ขีด, จุด หรือ /');
  }
  const qz = Number.isFinite(Number(quietZoneModules)) && Number(quietZoneModules) >= 2 ? Math.floor(Number(quietZoneModules)) : 10;
  const encoded = {};
  JsBarcode(encoded, unitCode, { format: 'CODE128', displayValue: false });
  const data = encoded.encodings.map((part) => part.data).join('');
  return { data, quietZoneModules: qz, totalModules: data.length + qz * 2 };
}

function getBarcodeLayoutMetrics(widthMm, heightMm) {
  const w = Number(widthMm);
  const h = Number(heightMm);
  const isCompactWidth = w <= 30;
  const padXMm = isCompactWidth ? 0.8 : 3;
  const quietZoneModules = isCompactWidth ? 3 : 10;
  const minModuleMm = isCompactWidth ? 0.075 : 0.16;
  const textReserveMm = h <= 6 ? 1.85 : h <= 9 ? 2.1 : h <= 15 ? 2.6 : 3.5;
  const barHeightMm = Number((h - textReserveMm).toFixed(2));
  return { w, h, padXMm, quietZoneModules, minModuleMm, textReserveMm, barHeightMm };
}

export function validateBarcodeDimensions({ widthMm, heightMm, unitCodes = [] }) {
  const { w, h, padXMm, quietZoneModules, minModuleMm, barHeightMm } = getBarcodeLayoutMetrics(widthMm, heightMm);
  const result = { valid: false, blocked: true, error: null, warning: null, moduleSizeMm: 0 };
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 5 || w > 210 || h < 5 || h > 297) {
    return { ...result, error: 'ขนาดฉลากต้องอยู่ในช่วงกว้าง 5-210 และสูง 5-297 มม.' };
  }
  try {
    let minModule = Infinity;
    for (const code of unitCodes) {
      const symbol = getBarcodeSymbol(code, quietZoneModules);
      const moduleMm = (w - padXMm) / symbol.totalModules;
      minModule = Math.min(minModule, moduleMm);
      if (moduleMm < minModuleMm) {
        const neededW = (symbol.totalModules * minModuleMm + padXMm).toFixed(1);
        return {
          ...result,
          error: `รหัส ${code} ยาวเกินฉลาก ${w} มม. ต้องกว้างอย่างน้อย ${neededW} มม. หรือใช้รหัสสั้นลง`,
          moduleSizeMm: moduleMm
        };
      }
    }
    if (barHeightMm < 2.8) {
      return { ...result, error: 'บาร์โค้ดต้องมีความสูงฉลากอย่างน้อย 5 มม. เพื่อให้สแกนติด' };
    }
    const warning =
      w <= 20 || h <= 7
        ? `บาร์โค้ดขนาดจิ๋ว (${w}×${h} มม.) แนะนำให้ใช้เครื่องพิมพ์ความละเอียดสูง (300 DPI ขึ้นไป) และพิมพ์ทดสอบก่อนติดจริง`
        : null;
    return {
      ...result,
      valid: true,
      blocked: false,
      warning,
      moduleSizeMm: Number.isFinite(minModule) ? minModule : 0
    };
  } catch (error) {
    return { ...result, error: error.message };
  }
}

export function generateBarcodeSvgString(unitCode, { widthMm, heightMm, barDensity = BARCODE_DENSITIES.FINE }) {
  const check = validateBarcodeDimensions({ widthMm, heightMm, unitCodes: [unitCode] });
  if (check.blocked) throw new Error(check.error);
  const { w, padXMm, quietZoneModules, barHeightMm } = getBarcodeLayoutMetrics(widthMm, heightMm);
  const { data, totalModules } = getBarcodeSymbol(unitCode, quietZoneModules);
  const svgWidthMm = Number((w - padXMm).toFixed(2));

  const maxModuleMm =
    barDensity === BARCODE_DENSITIES.ULTRA
      ? w <= 20 ? 0.08 : w <= 35 ? 0.11 : 0.145
      : barDensity === BARCODE_DENSITIES.NORMAL
        ? w <= 20 ? 0.125 : w <= 35 ? 0.19 : 0.26
        : w <= 20 ? 0.095 : w <= 35 ? 0.135 : 0.18;

  const minViewModules = Math.ceil(svgWidthMm / maxModuleMm);
  const effectiveTotalModules = Math.max(totalModules, minViewModules);
  const effectiveModuleMm = svgWidthMm / effectiveTotalModules;
  const viewHeight = Math.max(10, Number((barHeightMm / effectiveModuleMm).toFixed(2)));
  const offsetX = Number(((effectiveTotalModules - data.length) / 2).toFixed(3));
  const trim =
    barDensity === BARCODE_DENSITIES.ULTRA
      ? 0.16
      : barDensity === BARCODE_DENSITIES.NORMAL
        ? 0.04
        : 0.12;

  const bars = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] === '1') {
      let run = 1;
      while (i + run < data.length && data[i + run] === '1') run++;
      const barW = Number(Math.max(0.55, run - trim).toFixed(3));
      const barX = Number((offsetX + i + (run - barW) / 2).toFixed(3));
      bars.push(`<rect x="${barX}" y="0" width="${barW}" height="${viewHeight}"/>`);
      i += run;
    } else {
      i++;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidthMm}mm" height="${barHeightMm}mm" viewBox="0 0 ${effectiveTotalModules} ${viewHeight}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars.join('')}</g></svg>`;
}

/**
 * QR and Label Constants
 */
export const QR_PAYLOAD_PREFIX = 'F2U:T:';
export const DEFAULT_QUIET_ZONE_MODULES = 4;
export const MAX_COPIES_PER_UNIT = 50;
export const MAX_TOTAL_LABELS = 500;

export const A4_DIMENSIONS_MM = Object.freeze({
  width: 210,
  height: 297
});

export const PRINT_MODES = Object.freeze({
  SHEET_A4: 'sheet_a4',
  ROLL: 'roll'
});

export const LABEL_PRESETS = Object.freeze({
  micro_qr: {
    id: 'micro_qr',
    name: 'QR จิ๋วติดกรรไกร (QR 5×5 มม.)',
    widthMm: 7,
    heightMm: 8.5,
    qrGraphicMm: 5,
    description: 'รูป QR ขนาด 5×5 มม. พร้อมรหัสตัวเล็กชิดใต้ภาพสำหรับด้ามกรรไกร',
    experimental: true,
    showItemName: false
  },
  scissor: {
    id: 'scissor',
    name: 'QR เล็ก (18×24 มม.)',
    widthMm: 18,
    heightMm: 24,
    description: 'สำหรับเครื่องมือขนาดเล็ก เช่น ด้ามกรรไกร (ขนาดทดลอง)',
    experimental: true,
    showItemName: false
  },
  normal: {
    id: 'normal',
    name: 'QR มาตรฐาน (30×40 มม.)',
    widthMm: 30,
    heightMm: 40,
    description: 'ขนาดมาตรฐาน อ่านง่าย ชัดเจนสำหรับอุปกรณ์และกล่องวัสดุ',
    experimental: false,
    showItemName: false
  },
  micro_barcode: {
    id: 'micro_barcode',
    name: 'บาร์โค้ดจิ๋วติดกรรไกร (15×5 มม.)',
    widthMm: 15,
    heightMm: 5,
    description: 'ขนาดจิ๋ว 1.5×0.5 ซม. แปะด้ามกรรไกรไม่เสียพื้นที่จับ',
    experimental: true,
    showItemName: false
  },
  small_barcode: {
    id: 'small_barcode',
    name: 'บาร์โค้ดเล็ก (30×10 มม.)',
    widthMm: 30,
    heightMm: 10,
    description: 'ฉลากแนวนอนกะทัดรัดสำหรับด้ามเครื่องมือ',
    experimental: false,
    showItemName: false
  },
  handle: {
    id: 'handle',
    name: 'บาร์โค้ดมาตรฐาน (50×15 มม.)',
    widthMm: 50,
    heightMm: 15,
    description: 'ฉลากแนวนอนมาตรฐานสำหรับด้ามเครื่องมือและกล่อง',
    experimental: false,
    showItemName: false
  },
  custom: {
    id: 'custom',
    name: 'กำหนดขนาดเอง (มม.)',
    widthMm: 20,
    heightMm: 20,
    description: 'กำหนดความกว้างและความสูงอิสระตั้งแต่ 5 มม. ขึ้นไป',
    experimental: false,
    showItemName: false
  }
});

/**
 * Helper to check if a value is a finite number >= 0.
 */
function isFiniteNonNegative(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/**
 * Helper to check if a value is a finite number > 0.
 */
function isFinitePositive(val) {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

/**
 * Encodes a tool unit_code into stable short Flower2U payload: 'F2U:T:<unit_code>'
 * Preserves exact code casing.
 * Rejects empty or invalid inputs.
 */
export function encodeQrPayload(unitCode) {
  if (typeof unitCode !== 'string') {
    throw new Error('รหัสครุภัณฑ์ต้องเป็นข้อความ (String)');
  }
  const trimmed = unitCode.trim();
  if (!trimmed) {
    throw new Error('รหัสครุภัณฑ์ต้องไม่ว่างเปล่า (Empty unit_code)');
  }
  if (/[<>]|javascript:|script/i.test(trimmed)) {
    throw new Error('รหัสครุภัณฑ์มีอักขระต้องห้าม');
  }
  return `${QR_PAYLOAD_PREFIX}${trimmed}`;
}

/**
 * Decodes scanned/entered payload.
 * Accepts:
 *   - 'F2U:T:<exact unit_code>' from Flower2U QR labels
 *   - Raw unit codes (e.g. from 1D/2D hardware barcode scanners or manual typing)
 * Rejects:
 *   - URLs (http://, https://, www., etc.)
 *   - Foreign namespaces (e.g. 'OTHER:123', 'INV:456')
 *   - HTML / script injection
 *   - Empty/whitespace payloads
 * Preserves exact code casing.
 */
export function decodeQrPayload(payload) {
  if (!payload || typeof payload !== 'string') {
    return {
      success: false,
      unitCode: null,
      error: 'ไม่พบข้อมูลรหัส QR หรือข้อมูลว่างเปล่า',
      raw: payload || ''
    };
  }

  const raw = payload.trim();
  if (!raw) {
    return {
      success: false,
      unitCode: null,
      error: 'ข้อมูลรหัสที่สแกนว่างเปล่า',
      raw
    };
  }

  // Reject URLs
  if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.)/i.test(raw) || /:\/\//.test(raw)) {
    return {
      success: false,
      unitCode: null,
      error: 'รหัสที่สแกนเป็น URL เว็บไซต์ ไม่ใช่รหัสครุภัณฑ์ของ Flower2U',
      raw
    };
  }

  // Reject script / HTML injection
  if (/[<>]|javascript:|script/i.test(raw)) {
    return {
      success: false,
      unitCode: null,
      error: 'รหัสที่สแกนมีอักขระที่ไม่ปลอดภัย',
      raw
    };
  }

  // Handle Flower2U standard namespace
  if (raw.startsWith(QR_PAYLOAD_PREFIX)) {
    const code = raw.slice(QR_PAYLOAD_PREFIX.length).trim();
    if (!code) {
      return {
        success: false,
        unitCode: null,
        error: 'รหัสครุภัณฑ์ใน QR ว่างเปล่า',
        raw
      };
    }
    return {
      success: true,
      unitCode: code,
      error: null,
      raw,
      isRawCode: false
    };
  }

  // Reject unrecognized namespaces containing colons
  if (raw.includes(':')) {
    return {
      success: false,
      unitCode: null,
      error: 'รหัส QR ไม่ได้อยู่ในระบบ Flower2U (Namespace ไม่ถูกต้อง)',
      raw
    };
  }

  // Raw code validation (from hardware scanner or manual typing)
  // Allowed characters: alphanumeric, hyphens, underscores, dots, slashes
  if (!/^[A-Za-z0-9_./-]{1,64}$/.test(raw)) {
    return {
      success: false,
      unitCode: null,
      error: 'รูปแบบรหัสครุภัณฑ์ไม่ถูกต้อง (รองรับตัวอักษร, ตัวเลข, ขีด, จุด ความยาว 1-64 ตัวอักษร)',
      raw
    };
  }

  return {
    success: true,
    unitCode: raw,
    error: null,
    raw,
    isRawCode: true
  };
}

/**
 * Escapes unsafe HTML characters to prevent XSS in print iframes.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns raw QRCode symbol object using local `qrcode` library.
 */
export function getQrSymbol(payload, errorCorrectionLevel = 'M') {
  return QRCode.create(payload, { errorCorrectionLevel });
}

/**
 * Returns symbol information (version, module count, quiet zone).
 */
export function getQrSymbolInfo(payload, errorCorrectionLevel = 'M') {
  const symbol = getQrSymbol(payload, errorCorrectionLevel);
  const size = symbol.modules.size;
  const totalModules = size + 2 * DEFAULT_QUIET_ZONE_MODULES;
  return {
    version: symbol.version,
    moduleSize: size,
    totalModules,
    quietZoneModules: DEFAULT_QUIET_ZONE_MODULES,
    errorCorrectionLevel
  };
}

/**
 * Validates that an SVG string contains only safe vector elements and no active scripts or foreign objects.
 */
export function isSafeSvgMarkup(svgStr) {
  if (typeof svgStr !== 'string' || !svgStr.includes('<svg')) return false;
  // Disallow active content, foreign objects, and external link attributes
  if (/<script/i.test(svgStr)) return false;
  if (/on\w+\s*=/i.test(svgStr)) return false;
  if (/javascript:/i.test(svgStr)) return false;
  if (/<foreignObject/i.test(svgStr)) return false;
  if (/<iframe|<object|<embed|<link|<meta/i.test(svgStr)) return false;
  if (/<image|<animate|<set|<use/i.test(svgStr)) return false;
  if (/data:\s*text\/html/i.test(svgStr)) return false;
  if (/href\s*=\s*['"]?(?!#)https?:/i.test(svgStr)) return false;
  if (/xlink:href\s*=\s*['"]?(?!#)https?:/i.test(svgStr)) return false;
  return true;
}

/**
 * Generates local SVG string representation of the QR code.
 */
export async function generateQrSvgString(payload, options = {}) {
  const mergedOptions = {
    type: 'svg',
    margin: DEFAULT_QUIET_ZONE_MODULES,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    ...options
  };
  return QRCode.toString(payload, mergedOptions);
}

/**
 * Generates local DataURL (PNG base64) of the QR code.
 */
export async function generateQrDataUrl(payload, options = {}) {
  const mergedOptions = {
    margin: DEFAULT_QUIET_ZONE_MODULES,
    scale: 8,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    ...options
  };
  return QRCode.toDataURL(payload, mergedOptions);
}

/**
 * Validates label dimensions (in millimeters) against QR module requirements.
 * Evaluates the ACTUAL worst-case payload across selected items (highest QR version & module count).
 * Validates that physical module size is >= 0.25mm for thermal/standard printing.
 */
export function validateLabelDimensions({
  widthMm,
  heightMm,
  payload,
  payloads,
  qrGraphicMm,
  errorCorrectionLevel = 'M'
}) {
  const w = Number(widthMm);
  const h = Number(heightMm);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return {
      valid: false,
      blocked: true,
      error: 'ความกว้างและความสูงต้องเป็นตัวเลขที่ถูกต้องและมากกว่า 0',
      warning: null,
      widthMm: w,
      heightMm: h,
      moduleSizeMm: 0,
      totalModules: 0,
      qrVersion: 0,
      qrSizeMm: 0
    };
  }

  // Sensible mm range check (5mm to 300mm; height >= 6mm to fit 5mm QR + tight code text)
  if (w < 5 || w > 300 || h < 6 || h > 300) {
    return {
      valid: false,
      blocked: true,
      error: `ขนาดฉลาก (${w}×${h} มม.) อยู่นอกช่วงขนาดที่รองรับ (กว้าง 5-300 มม. สูง 6-300 มม.)`,
      warning: null,
      widthMm: w,
      heightMm: h,
      moduleSizeMm: 0,
      totalModules: 0,
      qrVersion: 0,
      qrSizeMm: 0
    };
  }

  // Determine actual payloads to test
  let targetPayloads = [];
  if (Array.isArray(payloads) && payloads.length > 0) {
    targetPayloads = payloads;
  } else if (typeof payload === 'string' && payload.trim()) {
    targetPayloads = [payload];
  } else {
    targetPayloads = [encodeQrPayload('SC-001')];
  }

  // Find worst-case QR symbol across all selected payloads
  let worstSymbolInfo = null;
  let worstUnitCode = '';
  for (const p of targetPayloads) {
    try {
      const formatted = p.startsWith(QR_PAYLOAD_PREFIX) ? p : encodeQrPayload(p);
      const info = getQrSymbolInfo(formatted, errorCorrectionLevel);
      if (!worstSymbolInfo || info.totalModules > worstSymbolInfo.totalModules) {
        worstSymbolInfo = info;
        worstUnitCode = formatted.slice(QR_PAYLOAD_PREFIX.length);
      }
    } catch (e) {
      return {
        valid: false,
        blocked: true,
        error: `ข้อมูลรหัสไม่ถูกต้อง: ${e.message}`,
        warning: null,
        widthMm: w,
        heightMm: h,
        moduleSizeMm: 0,
        totalModules: 0,
        qrVersion: 0,
        qrSizeMm: 0
      };
    }
  }

  const totalModules = worstSymbolInfo.totalModules;
  const activeModules = worstSymbolInfo.moduleSize; // Rendered with margin: 0 inside padded sticker
  const isMicro = w <= 12 || h <= 12;
  const paddingMm = isMicro ? 0.5 : w <= 22 ? 1.0 : 1.5;
  const textReserveMm = isMicro ? 1.5 : h <= 25 ? 2.5 : 4.0;
  const availableWidth = Math.max(0, w - 2 * paddingMm);
  const availableHeight = Math.max(0, h - 2 * paddingMm - textReserveMm);
  const maxBoxMm = Math.min(availableWidth, availableHeight);
  const requestedQrMm = Number(qrGraphicMm);
  const qrBoxMm =
    Number.isFinite(requestedQrMm) && requestedQrMm > 0
      ? Math.min(maxBoxMm, requestedQrMm)
      : maxBoxMm;
  const moduleSizeMm = qrBoxMm > 0 ? qrBoxMm / activeModules : 0;

  // Check code length against horizontal width for human legibility
  let codeLengthWarning = null;
  if (w <= 10 && worstUnitCode.length > 10) {
    codeLengthWarning = `รหัส "${worstUnitCode}" ยาว ${worstUnitCode.length} ตัวอักษร แนะนำให้ใช้รหัสสั้นไม่เกิน 8-10 ตัวสำหรับป้ายจิ๋ว`;
  } else if (w <= 20 && worstUnitCode.length > 14) {
    codeLengthWarning = `รหัส "${worstUnitCode}" มีความยาว ${worstUnitCode.length} ตัวอักษร อาจยาวเกินความกว้างฉลาก ${w} มม.`;
  } else if (w <= 30 && worstUnitCode.length > 24) {
    codeLengthWarning = `รหัส "${worstUnitCode}" มีความยาว ${worstUnitCode.length} ตัวอักษร อาจยาวเกินความกว้างฉลาก ${w} มม.`;
  }

  // Minimum QR graphic 4.5mm and module >= 0.18mm (supports 5x5mm QR V1/V2 cleanly while blocking unreadable payloads)
  if (qrBoxMm < 4.5 || moduleSizeMm < 0.18) {
    return {
      valid: false,
      blocked: true,
      error: `ขนาดฉลากเล็กเกินไป (${w}×${h} มม.) สำหรับ QR Version ${worstSymbolInfo.version} (${worstSymbolInfo.moduleSize}×${worstSymbolInfo.moduleSize} ช่อง) รูป QR ต้องได้อย่างน้อย 5×5 มม.`,
      warning: codeLengthWarning,
      widthMm: w,
      heightMm: h,
      moduleSizeMm,
      totalModules,
      qrVersion: worstSymbolInfo.version,
      qrSizeMm: qrBoxMm
    };
  }

  // Small / micro experimental label warning (e.g. 5x5mm QR or 18x24mm scissor)
  if (w < 20 || h < 26 || qrBoxMm < 14) {
    const combinedWarning = [
      `ขนาดฉลากด้ามกรรไกร (${w}×${h} มม. · รูป QR ${Number(qrBoxMm.toFixed(1))}×${Number(qrBoxMm.toFixed(1))} มม.) เป็นขนาดทดลอง แนะนำเครื่องพิมพ์คมชัดสูงและทดสอบสแกนก่อนติดจริง`,
      codeLengthWarning
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      valid: true,
      blocked: false,
      error: null,
      warning: combinedWarning,
      widthMm: w,
      heightMm: h,
      moduleSizeMm,
      totalModules,
      qrVersion: worstSymbolInfo.version,
      qrSizeMm: qrBoxMm
    };
  }

  return {
    valid: true,
    blocked: false,
    error: null,
    warning: codeLengthWarning,
    widthMm: w,
    heightMm: h,
    moduleSizeMm,
    totalModules,
    qrVersion: worstSymbolInfo.version,
    qrSizeMm: qrBoxMm
  };
}

/**
 * Validates copy count to prevent layout crash / infinite loops.
 */
export function validateCopyCount(count) {
  const num = Number(count);
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(MAX_COPIES_PER_UNIT, Math.floor(num));
}

/**
 * Calculates A4 sheet layout, grid, offsets, and pagination with strict finite and bounded checks.
 */
export function calculateSheetLayout({
  pageWidthMm = A4_DIMENSIONS_MM.width,
  pageHeightMm = A4_DIMENSIONS_MM.height,
  marginTopMm = 10,
  marginBottomMm = 10,
  marginLeftMm = 10,
  marginRightMm = 10,
  labelWidthMm,
  labelHeightMm,
  gapRowMm = 2,
  gapColMm = 2,
  startOffset = 0,
  totalLabels = 0
}) {
  const pw = Number(pageWidthMm);
  const ph = Number(pageHeightMm);
  const lw = Number(labelWidthMm);
  const lh = Number(labelHeightMm);
  const mt = Number(marginTopMm);
  const mb = Number(marginBottomMm);
  const ml = Number(marginLeftMm);
  const mr = Number(marginRightMm);
  const gr = Number(gapRowMm);
  const gc = Number(gapColMm);

  // Validate non-negative finite margins and gaps
  if (
    !isFiniteNonNegative(mt) ||
    !isFiniteNonNegative(mb) ||
    !isFiniteNonNegative(ml) ||
    !isFiniteNonNegative(mr) ||
    !isFiniteNonNegative(gr) ||
    !isFiniteNonNegative(gc)
  ) {
    return {
      valid: false,
      error: 'ระยะขอบและช่องว่างต้องเป็นตัวเลขจำนวนจริงที่มากกว่าหรือเท่ากับ 0',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      startOffset: 0
    };
  }

  // Validate positive finite dimensions
  if (!isFinitePositive(pw) || !isFinitePositive(ph) || !isFinitePositive(lw) || !isFinitePositive(lh)) {
    return {
      valid: false,
      error: 'ขนาดหน้ากระดาษและขนาดฉลากต้องเป็นตัวเลขจำนวนจริงบวก',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      startOffset: 0
    };
  }

  // Sensible mm range boundaries (down to 5mm micro stickers)
  if (pw < 50 || pw > 500 || ph < 50 || ph > 500 || lw < 5 || lw > pw || lh < 5 || lh > ph) {
    return {
      valid: false,
      error: 'ขนาดหน้ากระดาษหรือขนาดฉลากอยู่นอกช่วงที่รองรับ',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      startOffset: 0
    };
  }

  const printableWidth = pw - ml - mr;
  const printableHeight = ph - mt - mb;

  if (printableWidth <= 0 || printableHeight <= 0) {
    return {
      valid: false,
      error: 'ระยะขอบมีขนาดใหญ่กว่าขนาดหน้ากระดาษ ทำให้ไม่มีพื้นที่สำหรับพิมพ์',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      startOffset: 0
    };
  }

  const cols = Math.floor((printableWidth + gc) / (lw + gc));
  const rows = Math.floor((printableHeight + gr) / (lh + gr));

  if (cols < 1 || rows < 1) {
    return {
      valid: false,
      error: 'ขนาดฉลากใหญ่เกินกว่าพื้นที่พิมพ์ของหน้ากระดาษ',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      startOffset: 0
    };
  }

  const labelsPerPage = cols * rows;

  // Validate integer startOffset
  const parsedOffset = Number(startOffset);
  if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
    return {
      valid: false,
      error: 'ตำแหน่งเริ่มพิมพ์ต้องเป็นตัวเลขจำนวนเต็มบวกหรือศูนย์',
      cols,
      rows,
      labelsPerPage,
      totalPages: 0,
      startOffset: 0
    };
  }
  const integerOffset = Math.floor(parsedOffset);
  if (integerOffset >= labelsPerPage) {
    return {
      valid: false,
      error: `ตำแหน่งเริ่มพิมพ์ (${integerOffset}) ต้องน้อยกว่าจำนวนฉลากต่อหน้า (${labelsPerPage} ดวง)`,
      cols,
      rows,
      labelsPerPage,
      totalPages: 0,
      startOffset: 0
    };
  }

  // Validate totalLabels
  const parsedTotal = Number(totalLabels);
  if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
    return {
      valid: false,
      error: 'จำนวนฉลากต้องเป็นตัวเลขจำนวนเต็มบวกหรือศูนย์',
      cols,
      rows,
      labelsPerPage,
      totalPages: 0,
      startOffset: integerOffset
    };
  }
  const total = Math.floor(parsedTotal);

  // Check 500 limit: Block excessive total with clear error
  if (total > MAX_TOTAL_LABELS) {
    return {
      valid: false,
      error: `จำนวนฉลากที่สั่งพิมพ์ (${total} ดวง) เกินขีดจำกัดสูงสุด ${MAX_TOTAL_LABELS} ดวง กรุณาแบ่งพิมพ์ทีละชุด`,
      cols,
      rows,
      labelsPerPage,
      totalPages: 0,
      startOffset: integerOffset
    };
  }

  if (total === 0) {
    return {
      valid: true,
      cols,
      rows,
      labelsPerPage,
      totalPages: 0,
      startOffset: integerOffset,
      printableWidth,
      printableHeight
    };
  }

  const firstPageCapacity = labelsPerPage - integerOffset;
  let totalPages = 1;
  if (total > firstPageCapacity) {
    const remaining = total - firstPageCapacity;
    totalPages = 1 + Math.ceil(remaining / labelsPerPage);
  }

  return {
    valid: true,
    cols,
    rows,
    labelsPerPage,
    totalPages,
    startOffset: integerOffset,
    printableWidth,
    printableHeight
  };
}

/**
 * Calculates continuous Roll printer layout with strict finite and bounded checks.
 */
export function calculateRollLayout({ labelWidthMm, labelHeightMm, totalLabels = 0 }) {
  const lw = Number(labelWidthMm);
  const lh = Number(labelHeightMm);

  if (!isFinitePositive(lw) || !isFinitePositive(lh) || lw < 5 || lw > 300 || lh < 5 || lh > 300) {
    return {
      valid: false,
      error: 'ขนาดฉลากสำหรับเครื่องพิมพ์ม้วนต้องเป็นตัวเลขจำนวนจริงบวก (5 - 300 มม.)',
      cols: 0,
      rows: 0,
      labelsPerPage: 0,
      totalPages: 0,
      labelWidthMm: 0,
      labelHeightMm: 0
    };
  }

  const parsedTotal = Number(totalLabels);
  if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
    return {
      valid: false,
      error: 'จำนวนฉลากต้องเป็นตัวเลขจำนวนเต็มบวกหรือศูนย์',
      cols: 1,
      rows: 1,
      labelsPerPage: 1,
      totalPages: 0,
      labelWidthMm: lw,
      labelHeightMm: lh
    };
  }
  const total = Math.floor(parsedTotal);

  if (total > MAX_TOTAL_LABELS) {
    return {
      valid: false,
      error: `จำนวนฉลากที่สั่งพิมพ์ (${total} ดวง) เกินขีดจำกัดสูงสุด ${MAX_TOTAL_LABELS} ดวง กรุณาแบ่งพิมพ์ทีละชุด`,
      cols: 1,
      rows: 1,
      labelsPerPage: 1,
      totalPages: 0,
      labelWidthMm: lw,
      labelHeightMm: lh
    };
  }

  return {
    valid: true,
    cols: 1,
    rows: 1,
    labelsPerPage: 1,
    totalPages: total,
    labelWidthMm: lw,
    labelHeightMm: lh
  };
}

/**
 * Builds complete, isolated HTML string for printing via hidden iframe.
 * Uses strict HTML escaping, validated finite CSS dimensions, and 100% local assets.
 */
export function buildPrintHtml({
  labels = [],
  preset,
  mode = PRINT_MODES.SHEET_A4,
  sheetParams = {},
  calibration = false,
  format = LABEL_FORMATS.QR
}) {
  if (!Array.isArray(labels)) {
    throw new Error('รายการฉลากต้องเป็น Array');
  }

  // Block excessive total count (no silent truncation)
  if (labels.length > MAX_TOTAL_LABELS) {
    throw new Error(`จำนวนฉลาก (${labels.length} ดวง) เกินขีดจำกัดสูงสุด ${MAX_TOTAL_LABELS} ดวง`);
  }

  // Sanitize and validate physical dimensions (down to 5mm micro labels)
  const rawLw = Number(preset?.widthMm);
  const rawLh = Number(preset?.heightMm);
  const lw = isFinitePositive(rawLw) ? Math.min(210, Math.max(5, rawLw)) : 30;
  const lh = isFinitePositive(rawLh) ? Math.min(297, Math.max(5, rawLh)) : 40;
  // Stickers print ONLY QR/Barcode + tight unit code (never item name like "กรรไกร")
  const showItemName = Boolean(preset?.forceShowItemName);
  const isMicroLabel = lw <= 12 || lh <= 10;
  const boxPadMm = lh <= 6 ? 0.2 : isMicroLabel ? 0.35 : lw <= 22 || lh <= 18 ? 0.6 : 1.0;
  const codeGapMm = lh <= 6 ? 0.16 : lh <= 10 || lw <= 12 ? 0.32 : 0.25;
  const codeGapTopCss = `${codeGapMm}mm`;
  const codeSlotHeightMm =
    lh <= 6
      ? 1.12
      : lh <= 10 || lw <= 12
        ? 1.25
        : lh <= 18 || lw <= 20
          ? 1.65
          : lh <= 26
            ? 1.95
            : 2.25;
  // Render code at 10px (= 2.6458mm) so Chrome never applies min-font-size clamping, then scale cleanly
  const baseCodeScale = Number((codeSlotHeightMm / 2.65).toFixed(3));
  const maxInnerWidthMm = Math.max(2, lw - 2 * boxPadMm);

  const barcodeMetrics = getBarcodeLayoutMetrics(lw, lh);
  const maxQrSideMm = Math.max(
    0,
    Math.min(lw - 2 * boxPadMm, lh - 2 * boxPadMm - codeGapMm - codeSlotHeightMm)
  );
  const requestedQrMm = Number(preset?.qrGraphicMm);
  const qrVisualMm =
    Number.isFinite(requestedQrMm) && requestedQrMm > 0
      ? Number(Math.min(maxQrSideMm, requestedQrMm).toFixed(2))
      : Number(maxQrSideMm.toFixed(2));
  const visualWidthMm =
    format === LABEL_FORMATS.BARCODE ? Number((lw - barcodeMetrics.padXMm).toFixed(2)) : qrVisualMm;
  const visualHeightMm =
    format === LABEL_FORMATS.BARCODE ? barcodeMetrics.barHeightMm : qrVisualMm;
  if (format === LABEL_FORMATS.BARCODE && labels.length) {
    const check = validateBarcodeDimensions({ widthMm: lw, heightMm: lh, unitCodes: labels.map((item) => item.unitCode || item.unit_code) });
    if (check.blocked) throw new Error(check.error);
  }

  // Calibration page is ALWAYS A4 portrait regardless of printer mode
  let pageCss = '';
  if (calibration) {
    pageCss = '@page { size: A4 portrait; margin: 0; }';
  } else if (mode === PRINT_MODES.ROLL) {
    pageCss = `@page { size: ${lw}mm ${lh}mm; margin: 0; }`;
  } else {
    pageCss = '@page { size: A4 portrait; margin: 0; }';
  }

  // Sanitize sheet parameters to clean numbers (reject style injection)
  const mt = isFiniteNonNegative(Number(sheetParams?.marginTopMm)) ? Math.min(50, Number(sheetParams.marginTopMm)) : 10;
  const mb = isFiniteNonNegative(Number(sheetParams?.marginBottomMm)) ? Math.min(50, Number(sheetParams.marginBottomMm)) : 10;
  const ml = isFiniteNonNegative(Number(sheetParams?.marginLeftMm)) ? Math.min(50, Number(sheetParams.marginLeftMm)) : 10;
  const mr = isFiniteNonNegative(Number(sheetParams?.marginRightMm)) ? Math.min(50, Number(sheetParams.marginRightMm)) : 10;
  const gr = isFiniteNonNegative(Number(sheetParams?.gapRowMm)) ? Math.min(25, Number(sheetParams.gapRowMm)) : 2;
  const gc = isFiniteNonNegative(Number(sheetParams?.gapColMm)) ? Math.min(25, Number(sheetParams.gapColMm)) : 2;
  const startOffset = isFiniteNonNegative(Number(sheetParams?.startOffset)) ? Math.floor(Number(sheetParams.startOffset)) : 0;

  // Escape metadata and validate QR graphics
  const safeLabels = labels.map((item) => {
    const rawSvg = typeof item.svg === 'string' ? item.svg : '';
    const safeSvg = isSafeSvgMarkup(rawSvg) ? rawSvg : '';
    const dataUrl = typeof item.dataUrl === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.dataUrl) ? item.dataUrl : '';
    const rawCodeStr = String(item.unitCode || item.unit_code || '');
    const fitWidthScale = maxInnerWidthMm / Math.max(1, rawCodeStr.length * 1.62);
    const codeScale = Number(Math.max(0.22, Math.min(baseCodeScale, fitWidthScale)).toFixed(3));

    return {
      unitCode: escapeHtml(rawCodeStr),
      codeScale,
      itemName: escapeHtml(item.itemName || item.item_name || ''),
      color: escapeHtml(item.color || ''),
      svg: safeSvg,
      dataUrl
    };
  });

  const renderCodeSlot = (lbl) =>
    `<div class="label-code-slot"><div class="label-code" style="transform: scale(${lbl.codeScale ?? baseCodeScale});">${lbl.unitCode}</div></div>`;

  const renderQrVisual = (lbl) => {
    if (lbl.dataUrl) {
      return `<img src="${lbl.dataUrl}" alt="QR" class="qr-img" />`;
    }
    if (lbl.svg) {
      return `<div class="qr-svg-wrap">${lbl.svg}</div>`;
    }
    return '<div class="qr-placeholder">QR</div>';
  };

  let contentHtml = '';

  if (calibration) {
    const sample = safeLabels[0] || {
      unitCode: '',
      itemName: 'ยังไม่มีรหัสประจำชิ้น',
      color: '',
      svg: '',
      dataUrl: ''
    };

    contentHtml = `
      <div class="page calibration-page">
        <div class="calib-header">
          <h2>แผ่นทดสอบการพิมพ์และเทียบขนาด Flower2U (Calibration Sheet)</h2>
          <p>สำคัญ: ในหน้าต่างพิมพ์ ให้ตั้งค่า <strong>Scale: 100% (Actual size)</strong> ห้ามเลือก "Fit to page" หรือ "ย่อให้พอดี"</p>
        </div>
        <div class="calib-ruler-section">
          <h3>แถบวัดขนาดมาตรฐาน 10 มม. และ 50 มม.</h3>
          <p>ใช้ไม้บรรทัดวัดแถบด้านล่างนี้ หากได้ 10 มม. และ 50 มม. พอดี แสดงว่าเครื่องพิมพ์พิมพ์ตรงขนาดจริง 100%</p>
          <div class="ruler-bar-container">
            <div class="ruler-bar-10mm">
              <span class="ruler-label">10 มม. (1 ซม.)</span>
            </div>
            <div class="ruler-bar-50mm">
              <span class="ruler-label">50 มม. (5 ซม.)</span>
            </div>
          </div>
        </div>
        <div class="calib-sample-section">
          <h3>ตัวอย่างฉลากขนาดจริง (${lw} × ${lh} มม.)</h3>
          <div class="sample-grid">
            <div class="label-box" style="width: ${lw}mm; height: ${lh}mm;">
              ${renderQrVisual(sample)}
              ${renderCodeSlot(sample)}
              ${showItemName && sample.itemName ? `<div class="label-name">${sample.itemName}</div>` : ''}
            </div>
          </div>
          <div class="calib-notes">
            <p><strong>คำแนะนำการสแกน:</strong></p>
            <ul>
              <li>ใช้มือถือหรือกล้องสแกน QR ด้านบน หากสแกนติดง่ายและขึ้นรหัสถูกต้อง แสดงว่าสามารถใช้งานได้</li>
              <li>หากฉลากด้ามกรรไกร (18×24 มม.) สแกนติดยาก ให้พิจารณาใช้ขนาดปกติ (30×40 มม.) หรือพิมพ์ลงบนป้ายห้อย</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  } else if (mode === PRINT_MODES.ROLL) {
    contentHtml = safeLabels
      .map(
        (lbl) => `
        <div class="roll-label" style="width: ${lw}mm; height: ${lh}mm;">
          ${renderQrVisual(lbl)}
          ${renderCodeSlot(lbl)}
          ${showItemName && lbl.itemName ? `<div class="label-name">${lbl.itemName}${lbl.color ? ` · ${lbl.color}` : ''}</div>` : ''}
        </div>
      `
      )
      .join('\n');
  } else {
    // A4 Sheet mode
    const layout = calculateSheetLayout({
      pageWidthMm: A4_DIMENSIONS_MM.width,
      pageHeightMm: A4_DIMENSIONS_MM.height,
      marginTopMm: mt,
      marginBottomMm: mb,
      marginLeftMm: ml,
      marginRightMm: mr,
      labelWidthMm: lw,
      labelHeightMm: lh,
      gapRowMm: gr,
      gapColMm: gc,
      startOffset,
      totalLabels: safeLabels.length
    });

    if (!layout.valid) {
      throw new Error(layout.error || 'การจัดเลย์เอาต์แผ่น A4 ไม่ถูกต้อง');
    }

    const pages = [];
    let currentLabelIdx = 0;

    for (let p = 0; p < layout.totalPages; p++) {
      const pageSlots = [];
      const offsetOnThisPage = p === 0 ? layout.startOffset : 0;

      // Peeled sticker placeholders on first page
      for (let s = 0; s < offsetOnThisPage; s++) {
        pageSlots.push(`<div class="label-slot empty-slot" style="width: ${lw}mm; height: ${lh}mm;"></div>`);
      }

      // Fill labels for current sheet
      while (pageSlots.length < layout.labelsPerPage && currentLabelIdx < safeLabels.length) {
        const lbl = safeLabels[currentLabelIdx++];
        pageSlots.push(`
          <div class="label-slot label-box" style="width: ${lw}mm; height: ${lh}mm;">
            ${renderQrVisual(lbl)}
            ${renderCodeSlot(lbl)}
            ${showItemName && lbl.itemName ? `<div class="label-name">${lbl.itemName}${lbl.color ? ` · ${lbl.color}` : ''}</div>` : ''}
          </div>
        `);
      }

      pages.push(`
        <div class="a4-sheet" style="padding-top: ${mt}mm; padding-left: ${ml}mm;">
          <div class="grid-container" style="display: grid; grid-template-columns: repeat(${layout.cols}, ${lw}mm); gap: ${gr}mm ${gc}mm;">
            ${pageSlots.join('\n')}
          </div>
        </div>
      `);
    }

    contentHtml = pages.join('\n');
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>พิมพ์ฉลาก QR ครุภัณฑ์ - Flower2U</title>
<style>
  ${pageCss}
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    background: #ffffff;
    color: #000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Leelawadee UI', Tahoma, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .a4-sheet {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    break-after: page;
    box-sizing: border-box;
    overflow: hidden;
  }
  .a4-sheet:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .roll-label {
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: ${boxPadMm}mm;
  }
  .roll-label:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .label-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: ${boxPadMm}mm;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    background: #ffffff;
    border: 0.2mm dashed #e2e8f0;
  }
  @media print {
    .label-box {
      border: none;
    }
    .empty-slot {
      visibility: hidden;
    }
  }
  .empty-slot {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .qr-svg-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    min-height: 0;
    width: ${visualWidthMm}mm;
    height: ${visualHeightMm}mm;
  }
  .qr-svg-wrap svg {
    ${format === LABEL_FORMATS.BARCODE ? 'flex-shrink: 0;' : ''}
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
  }
  .qr-img {
    width: ${visualWidthMm}mm;
    height: ${visualHeightMm}mm;
    flex: none;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    display: block;
  }
  .label-code-slot {
    flex: none;
    width: 100%;
    height: ${codeSlotHeightMm}mm;
    margin-top: ${codeGapTopCss};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  .label-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-weight: 600;
    font-size: 10px;
    line-height: 1;
    color: #000000;
    letter-spacing: 0.1px;
    white-space: nowrap;
    transform-origin: center center;
    flex: none;
  }
  .label-name {
    font-size: 6.5pt;
    line-height: 1.1;
    color: #333333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    margin-top: 0.3mm;
  }
  .calibration-page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm;
    box-sizing: border-box;
  }
  .calib-header h2 { font-size: 16pt; margin-bottom: 3mm; color: #1e293b; }
  .calib-header p { font-size: 10pt; color: #b91c1c; margin-bottom: 8mm; font-weight: 600; }
  .calib-ruler-section { margin-bottom: 8mm; padding: 5mm; border: 1px solid #cbd5e1; border-radius: 4mm; }
  .calib-ruler-section h3 { font-size: 12pt; margin-bottom: 2mm; }
  .calib-ruler-section p { font-size: 9pt; color: #475569; margin-bottom: 4mm; }
  .ruler-bar-container { display: flex; gap: 6mm; align-items: flex-end; }
  .ruler-bar-10mm { width: 10mm; height: 10mm; background: #000000; position: relative; }
  .ruler-bar-50mm { width: 50mm; height: 10mm; background: #000000; position: relative; }
  .ruler-label { position: absolute; top: -5mm; left: 0; font-size: 8pt; white-space: nowrap; color: #334155; }
  .calib-sample-section { margin-top: 6mm; padding: 5mm; border: 1px solid #cbd5e1; border-radius: 4mm; }
  .calib-sample-section h3 { font-size: 12pt; margin-bottom: 4mm; }
  .sample-grid { margin-bottom: 6mm; }
  .calib-notes { font-size: 9pt; color: #334155; line-height: 1.5; }
</style>
</head>
<body>
${contentHtml}
</body>
</html>`;
}
