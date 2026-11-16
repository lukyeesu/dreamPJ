const test = require('node:test');
const assert = require('node:assert/strict');
const { RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader, BarcodeFormat, DecodeHintType } = require('@zxing/library');

test('Code128 labels round-trip exact unit codes, including numeric compaction and punctuation', async () => {
  const q = await import('../src/utils/qrLabels.js');
  for (const code of ['SC-001', 'sc-002_a', '123456789012', 'DR.12/3']) {
    const { data, quietZoneModules, totalModules } = q.getBarcodeSymbol(code);
    const width = totalModules * 3;
    const height = 100;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    for (let y = 10; y < 90; y++) {
      for (let x = 0; x < data.length; x++) {
        if (data[x] === '1') pixels.fill(0, y * width + (x + quietZoneModules) * 3, y * width + (x + quietZoneModules + 1) * 3);
      }
    }
    const reader = new MultiFormatReader();
    const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))), new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]));
    assert.equal(q.decodeQrPayload(decoded.getText()).unitCode, code);
    assert.equal(quietZoneModules, 10);
    assert.match(q.generateBarcodeSvgString(code, { widthMm: 50, heightMm: 15 }), /viewBox=/);
  }
});

test('Barcode sizing supports 15x5mm micro scissor labels while blocking unsupported codes and too-narrow labels', async () => {
  const q = await import('../src/utils/qrLabels.js');
  assert.equal(q.validateBarcodeDimensions({ widthMm: 50, heightMm: 15, unitCodes: ['SC-001'] }).blocked, false);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 15, heightMm: 5, unitCodes: ['SC-001', 'ITEM0001'] }).blocked, false);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 8, heightMm: 5, unitCodes: ['SC-001'] }).blocked, true);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 15, heightMm: 5, unitCodes: ['LONG-SCISSOR-CODE-2026-EXTENDED'] }).blocked, true);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 50, heightMm: 15, unitCodes: ['SC-001', 'X'.repeat(64)] }).blocked, true);
  assert.throws(() => q.generateBarcodeSvgString('X'.repeat(64), { widthMm: 50, heightMm: 15 }));
  assert.throws(() => q.getBarcodeSymbol('ไทย'));
  assert.throws(() => q.getBarcodeSymbol('F2U:T:SC-001'));
});

test('Thin and ultra-thin barcode SVG densities produce progressively finer bars while decoding cleanly via ZXing', async () => {
  const q = await import('../src/utils/qrLabels.js');
  const code = 'ITEM0001';
  const svgUltra = q.generateBarcodeSvgString(code, { widthMm: 15, heightMm: 5, barDensity: q.BARCODE_DENSITIES.ULTRA });
  const svgFine = q.generateBarcodeSvgString(code, { widthMm: 15, heightMm: 5, barDensity: q.BARCODE_DENSITIES.FINE });
  const svgNormal = q.generateBarcodeSvgString(code, { widthMm: 15, heightMm: 5, barDensity: q.BARCODE_DENSITIES.NORMAL });

  assert.equal(svgFine.includes('shape-rendering="crispEdges"'), false);

  const measureTotalInkMm = (svg) => {
    const [, widthMmStr] = svg.match(/width="([\d.]+)mm"/);
    const [, viewWStr] = svg.match(/viewBox="0 0 ([\d.]+) /);
    const moduleMm = Number(widthMmStr) / Number(viewWStr);
    const groupInner = svg.match(/<g fill="#000">(.*?)<\/g>/s)[1];
    const rects = groupInner.matchAll(/width="([\d.]+)"/g);
    let sumModules = 0;
    for (const m of rects) sumModules += Number(m[1]);
    return sumModules * moduleMm;
  };

  const inkUltra = measureTotalInkMm(svgUltra);
  const inkFine = measureTotalInkMm(svgFine);
  const inkNormal = measureTotalInkMm(svgNormal);
  assert.ok(inkUltra < inkFine, `Expected ultra ink (${inkUltra}) < fine ink (${inkFine})`);
  assert.ok(inkFine < inkNormal, `Expected fine ink (${inkFine}) < normal ink (${inkNormal})`);

  for (const svg of [svgUltra, svgFine, svgNormal]) {
    const [, viewWStr] = svg.match(/viewBox="0 0 ([\d.]+) /);
    const viewW = Number(viewWStr);
    const scalePx = 8;
    const width = Math.ceil(viewW * scalePx);
    const height = 80;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    const inner = svg.match(/<g fill="#000">(.*?)<\/g>/s)[1];
    for (const rect of inner.matchAll(/<rect x="([\d.]+)" y="0" width="([\d.]+)"/g)) {
      const x0 = Math.round(Number(rect[1]) * scalePx);
      const x1 = Math.max(x0 + 1, Math.round((Number(rect[1]) + Number(rect[2])) * scalePx));
      for (let y = 8; y < height - 8; y++) {
        pixels.fill(0, y * width + x0, y * width + Math.min(width, x1));
      }
    }
    const reader = new MultiFormatReader();
    const decoded = reader.decode(
      new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))),
      new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]])
    );
    assert.equal(decoded.getText(), code);
  }
});
