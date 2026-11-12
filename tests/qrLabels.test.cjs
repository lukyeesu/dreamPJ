const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
  QRCodeReader
} = require('@zxing/library');

// Helper to decode a 2D monochrome module matrix using ZXing
function decodeModuleMatrixWithZxing(symbol, margin = 4, scale = 4) {
  const modSize = symbol.modules.size;
  const totalMod = modSize + 2 * margin;
  const pixelWidth = totalMod * scale;
  const pixelHeight = totalMod * scale;
  const luminances = new Uint8ClampedArray(pixelWidth * pixelHeight);

  // Initialize with pure white (255)
  luminances.fill(255);

  // Fill in dark modules from the QR symbol
  for (let r = 0; r < modSize; r++) {
    for (let c = 0; c < modSize; c++) {
      const isDark = symbol.modules.get(r, c);
      if (isDark) {
        const startY = (r + margin) * scale;
        const startX = (c + margin) * scale;
        for (let py = 0; py < scale; py++) {
          const rowOffset = (startY + py) * pixelWidth;
          for (let px = 0; px < scale; px++) {
            luminances[rowOffset + startX + px] = 0; // Black
          }
        }
      }
    }
  }

  const lumSource = new RGBLuminanceSource(luminances, pixelWidth, pixelHeight);
  const binarizer = new HybridBinarizer(lumSource);
  const bitmap = new BinaryBitmap(binarizer);
  const reader = new QRCodeReader();
  const result = reader.decode(bitmap);
  return result.getText();
}

test('QR Labels - Unit & Integration Test Suite', async (t) => {
  const qrUtils = await import('../src/utils/qrLabels.js');

  await t.test('1. Payload encoding: F2U:T:<exact unit_code> preserving exact casing', () => {
    assert.equal(qrUtils.encodeQrPayload('SC-001'), 'F2U:T:SC-001');
    assert.equal(qrUtils.encodeQrPayload('sc-002_a'), 'F2U:T:sc-002_a');
    assert.equal(qrUtils.encodeQrPayload('DR-999-XYZ'), 'F2U:T:DR-999-XYZ');
    assert.equal(qrUtils.encodeQrPayload('  TRIM-ME  '), 'F2U:T:TRIM-ME');

    // Invalid inputs throw
    assert.throws(() => qrUtils.encodeQrPayload(''), /empty|ว่าง/i);
    assert.throws(() => qrUtils.encodeQrPayload('   '), /empty|ว่าง/i);
    assert.throws(() => qrUtils.encodeQrPayload(null), /string|ข้อความ/i);
    assert.throws(() => qrUtils.encodeQrPayload(undefined), /string|ข้อความ/i);
    assert.throws(() => qrUtils.encodeQrPayload('<script>alert(1)</script>'), /invalid|ห้าม/i);
  });

  await t.test('2. Payload decoding: valid F2U namespace and exact raw codes', () => {
    // Valid F2U:T: format
    const res1 = qrUtils.decodeQrPayload('F2U:T:SC-001');
    assert.equal(res1.success, true);
    assert.equal(res1.unitCode, 'SC-001');
    assert.equal(res1.isRawCode, false);

    // Exact casing preserved
    const res2 = qrUtils.decodeQrPayload('F2U:T:sc-003-beta');
    assert.equal(res2.success, true);
    assert.equal(res2.unitCode, 'sc-003-beta');

    // Hardware scanner / manual raw code
    const resRaw = qrUtils.decodeQrPayload('SC-001');
    assert.equal(resRaw.success, true);
    assert.equal(resRaw.unitCode, 'SC-001');
    assert.equal(resRaw.isRawCode, true);

    const resRaw2 = qrUtils.decodeQrPayload('DR-002');
    assert.equal(resRaw2.success, true);
    assert.equal(resRaw2.unitCode, 'DR-002');
  });

  await t.test('3. Payload decoding: rejects URLs, unrecognized namespaces, scripts, empty data', () => {
    // Rejects URLs
    const url1 = qrUtils.decodeQrPayload('https://flower2u.com/inventory/SC-001');
    assert.equal(url1.success, false);
    assert.match(url1.error, /URL/i);

    const url2 = qrUtils.decodeQrPayload('http://192.168.1.1/tool');
    assert.equal(url2.success, false);

    const url3 = qrUtils.decodeQrPayload('www.example.com');
    assert.equal(url3.success, false);

    // Rejects foreign namespaces
    const foreign1 = qrUtils.decodeQrPayload('OTHER:SC-001');
    assert.equal(foreign1.success, false);
    assert.match(foreign1.error, /namespace|ระบบ/i);

    const foreign2 = qrUtils.decodeQrPayload('INV:ITEM:999');
    assert.equal(foreign2.success, false);

    // Rejects scripts and tags
    const scriptTag = qrUtils.decodeQrPayload('<script>alert("xss")</script>');
    assert.equal(scriptTag.success, false);

    // Rejects empty / whitespace
    const empty1 = qrUtils.decodeQrPayload('');
    assert.equal(empty1.success, false);

    const empty2 = qrUtils.decodeQrPayload('F2U:T:');
    assert.equal(empty2.success, false);
  });

  await t.test('4. HTML escaping and SVG safety verification', () => {
    const raw = '<img src=x onerror=alert(1)> & "quotes" \'single\'';
    const escaped = qrUtils.escapeHtml(raw);
    assert.equal(escaped.includes('<img'), false);
    assert.equal(escaped.includes('&lt;img'), true);
    assert.equal(escaped.includes('&quot;'), true);
    assert.equal(escaped.includes('&#39;'), true);
    assert.equal(escaped.includes('&amp;'), true);

    // SVG safety validator
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><path d="M0 0h1v1H0z"/></svg>';
    assert.equal(qrUtils.isSafeSvgMarkup(safeSvg), true);

    const dangerousSvg1 = '<svg><script>alert(1)</script></svg>';
    assert.equal(qrUtils.isSafeSvgMarkup(dangerousSvg1), false);

    const dangerousSvg2 = '<svg onload="alert(1)"><rect /></svg>';
    assert.equal(qrUtils.isSafeSvgMarkup(dangerousSvg2), false);

    const dangerousSvg3 = '<svg><foreignObject><iframe src="evil.com"></iframe></foreignObject></svg>';
    assert.equal(qrUtils.isSafeSvgMarkup(dangerousSvg3), false);
  });

  await t.test('5. Label presets & actual worst-case payload geometry validation', () => {
    assert.ok(qrUtils.LABEL_PRESETS.scissor);
    assert.equal(qrUtils.LABEL_PRESETS.scissor.widthMm, 18);
    assert.equal(qrUtils.LABEL_PRESETS.scissor.heightMm, 24);

    assert.ok(qrUtils.LABEL_PRESETS.normal);
    assert.equal(qrUtils.LABEL_PRESETS.normal.widthMm, 30);
    assert.equal(qrUtils.LABEL_PRESETS.normal.heightMm, 40);

    // Standard short payload on Normal 30x40mm preset
    const normalVal = qrUtils.validateLabelDimensions({
      widthMm: 30,
      heightMm: 40,
      payload: 'F2U:T:SC-001'
    });
    assert.equal(normalVal.valid, true);
    assert.equal(normalVal.blocked, false);
    assert.equal(normalVal.warning, null);
    assert.ok(normalVal.moduleSizeMm >= 0.5);

    // Evaluation across multiple actual payloads: worst-case selected
    const multiVal = qrUtils.validateLabelDimensions({
      widthMm: 30,
      heightMm: 40,
      payloads: [
        'F2U:T:SC-001',
        'F2U:T:DRILL-HEAVY-DUTY-SERIES-2026-EXTENDED-MODEL'
      ]
    });
    assert.equal(multiVal.valid, true);
    // Worst-case QR version must be > 1
    assert.ok(multiVal.qrVersion > 1);

    // Scissor preset (18x24mm): valid but emits Thai experimental calibration warning
    const scissorVal = qrUtils.validateLabelDimensions({
      widthMm: 18,
      heightMm: 24,
      payload: 'F2U:T:SC-001'
    });
    assert.equal(scissorVal.valid, true);
    assert.equal(scissorVal.blocked, false);
    assert.ok(scissorVal.warning != null);
    assert.match(scissorVal.warning, /ทดลอง|ด้ามกรรไกร/);

    // Impossible tiny dimensions (e.g. 8x8mm): must be BLOCKED
    const tinyVal = qrUtils.validateLabelDimensions({
      widthMm: 8,
      heightMm: 8,
      payload: 'F2U:T:SC-001'
    });
    assert.equal(tinyVal.blocked, true);
    assert.equal(tinyVal.valid, false);
    assert.ok(tinyVal.error != null);
  });

  await t.test('6. Copy counts validation: finite, clamped bounds [1..50]', () => {
    assert.equal(qrUtils.validateCopyCount(1), 1);
    assert.equal(qrUtils.validateCopyCount(5), 5);
    assert.equal(qrUtils.validateCopyCount(0), 1);
    assert.equal(qrUtils.validateCopyCount(-5), 1);
    assert.equal(qrUtils.validateCopyCount(999), 50);
    assert.equal(qrUtils.validateCopyCount(NaN), 1);
    assert.equal(qrUtils.validateCopyCount(Infinity), 1);
    assert.equal(qrUtils.validateCopyCount('10'), 10);
  });

  await t.test('7. Sheet A4 layout calculation: finite validation, integer startOffset, 500 limit', () => {
    // Standard valid A4 layout
    const sheet = qrUtils.calculateSheetLayout({
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginTopMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      marginRightMm: 10,
      labelWidthMm: 30,
      labelHeightMm: 40,
      gapRowMm: 2,
      gapColMm: 2,
      startOffset: 0,
      totalLabels: 50
    });

    assert.equal(sheet.valid, true);
    assert.equal(sheet.cols, 6);
    assert.equal(sheet.rows, 6);
    assert.equal(sheet.labelsPerPage, 36);
    assert.equal(sheet.totalPages, 2);

    // Start offset integer arithmetic: with startOffset = 30
    const sheetOffset = qrUtils.calculateSheetLayout({
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginTopMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      marginRightMm: 10,
      labelWidthMm: 30,
      labelHeightMm: 40,
      gapRowMm: 2,
      gapColMm: 2,
      startOffset: 30,
      totalLabels: 50
    });
    assert.equal(sheetOffset.valid, true);
    assert.equal(sheetOffset.totalPages, 3);

    // Reject non-finite or negative margins/gaps
    const badMargin = qrUtils.calculateSheetLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      marginTopMm: -5
    });
    assert.equal(badMargin.valid, false);

    const nanGap = qrUtils.calculateSheetLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      gapRowMm: NaN
    });
    assert.equal(nanGap.valid, false);

    // Reject startOffset >= labelsPerPage
    const overflowOffset = qrUtils.calculateSheetLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      startOffset: 999,
      totalLabels: 10
    });
    assert.equal(overflowOffset.valid, false);

    // Reject totalLabels > 500 (MAX_TOTAL_LABELS) - no silent truncation
    const excessiveTotal = qrUtils.calculateSheetLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      totalLabels: 501
    });
    assert.equal(excessiveTotal.valid, false);
    assert.match(excessiveTotal.error, /เกินขีดจำกัด/);
  });

  await t.test('8. Roll layout calculation: finite bounds and 500 limit', () => {
    const roll = qrUtils.calculateRollLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      totalLabels: 15
    });
    assert.equal(roll.valid, true);
    assert.equal(roll.totalPages, 15);

    // Reject invalid dimensions
    const badRoll = qrUtils.calculateRollLayout({
      labelWidthMm: -10,
      labelHeightMm: 40
    });
    assert.equal(badRoll.valid, false);

    // Reject excessive total > 500
    const excessiveRoll = qrUtils.calculateRollLayout({
      labelWidthMm: 30,
      labelHeightMm: 40,
      totalLabels: 505
    });
    assert.equal(excessiveRoll.valid, false);
  });

  await t.test('9. buildPrintHtml: calibration page is always A4, CSS injection blocked, total limit enforced', () => {
    // Calibration sheet is ALWAYS A4 portrait even if printMode is ROLL
    const calibHtml = qrUtils.buildPrintHtml({
      labels: [{ unitCode: 'SC-001', itemName: 'กรรไกร' }],
      preset: qrUtils.LABEL_PRESETS.scissor,
      mode: qrUtils.PRINT_MODES.ROLL,
      calibration: true
    });
    assert.ok(calibHtml.includes('@page { size: A4 portrait; margin: 0; }'));
    assert.ok(calibHtml.includes('แผ่นทดสอบการพิมพ์และเทียบขนาด Flower2U'));

    // Malicious style strings in sheetParams sanitized to safe numbers
    const injectionHtml = qrUtils.buildPrintHtml({
      labels: [{ unitCode: 'SC-001', itemName: 'กรรไกร' }],
      preset: qrUtils.LABEL_PRESETS.normal,
      mode: qrUtils.PRINT_MODES.SHEET_A4,
      sheetParams: {
        marginTopMm: '10; } body { background: red; } /*'
      }
    });
    assert.equal(injectionHtml.includes('body { background: red; }'), false);

    // Enforce MAX_TOTAL_LABELS limit (no silent truncation)
    const tooManyLabels = new Array(501).fill({ unitCode: 'SC-001' });
    assert.throws(
      () => qrUtils.buildPrintHtml({ labels: tooManyLabels, preset: qrUtils.LABEL_PRESETS.normal }),
      /เกินขีดจำกัด/
    );
  });

  await t.test('10. Real QR generation & round-trip ZXing decode test', async () => {
    const unitCode = 'SC-001';
    const payload = qrUtils.encodeQrPayload(unitCode);
    assert.equal(payload, 'F2U:T:SC-001');

    // Generate symbol using local qrcode library
    const symbol = qrUtils.getQrSymbol(payload);
    assert.ok(symbol.modules);
    assert.equal(symbol.modules.size >= 21, true);

    // Verify 4-module quiet zone calculation
    const quietZoneModules = qrUtils.DEFAULT_QUIET_ZONE_MODULES;
    assert.equal(quietZoneModules, 4);
    const totalModulesWithQuietZone = symbol.modules.size + 2 * quietZoneModules;
    assert.equal(totalModulesWithQuietZone, 29);

    // Perform actual round-trip decode using ZXing
    const decodedRaw = decodeModuleMatrixWithZxing(symbol, quietZoneModules, 4);
    assert.equal(decodedRaw, payload);

    // Pass through decoder
    const decodeResult = qrUtils.decodeQrPayload(decodedRaw);
    assert.equal(decodeResult.success, true);
    assert.equal(decodeResult.unitCode, unitCode);
  });

  await t.test('11. Local SVG generation produces valid vector with inert namespace and no external requests', async () => {
    const svgStr = await qrUtils.generateQrSvgString('F2U:T:DR-002');
    assert.ok(svgStr.includes('<svg'));
    assert.ok(svgStr.includes('</svg>'));
    // Valid SVG must declare inert XML namespace
    assert.ok(svgStr.includes('xmlns="http://www.w3.org/2000/svg"'));
    // Must NOT contain external request URLs or scripts
    assert.equal(/href\s*=\s*['"]?https?:/i.test(svgStr), false);
    assert.equal(/src\s*=\s*['"]?https?:/i.test(svgStr), false);
    assert.equal(/<script/i.test(svgStr), false);
  });

  await t.test('12. Raw code regex pattern and character boundary verification ([A-Za-z0-9_./-])', () => {
    // Valid characters: alphanumeric, dot, slash, underscore, hyphen
    const validCodes = ['SC-001', 'TOOL_99', 'A.B.C', 'DEPT/SEC/01', 'item-123_45.67/89'];
    for (const code of validCodes) {
      const res = qrUtils.decodeQrPayload(code);
      assert.equal(res.success, true, `Expected valid code: ${code}`);
      assert.equal(res.unitCode, code);
      assert.equal(res.isRawCode, true);
    }

    // Invalid characters: colon without F2U prefix, special chars, whitespace
    const invalidCodes = ['SC:001', 'CODE WITH SPACE', 'TOOL#1', 'A*B', 'ITEM@WAREHOUSE'];
    for (const code of invalidCodes) {
      const res = qrUtils.decodeQrPayload(code);
      assert.equal(res.success, false, `Expected rejected code: ${code}`);
    }
  });

  await t.test('13. SVG markup security validator blocks active vectors, event handlers, and javascript URIs', () => {
    // Allowed safe vector SVG
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><path d="M0 0h1v1H0z"/></svg>';
    assert.equal(qrUtils.isSafeSvgMarkup(safeSvg), true);

    // Blocked active content / XSS vectors
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><script>alert(1)</script></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg onload="alert(1)"><path /></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><foreignObject><div>bad</div></foreignObject></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><iframe src="evil.com"></iframe></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><image href="http://evil.com/leak.png" /></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><a href="javascript:alert(1)">click</a></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><animate attributeName="x" from="0" to="10" /></svg>'), false);
    assert.equal(qrUtils.isSafeSvgMarkup('<svg><use xlink:href="http://remote.com/pic.svg" /></svg>'), false);
  });
});
