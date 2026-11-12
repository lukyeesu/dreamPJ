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

test('Barcode sizing blocks unsupported codes and too-narrow labels instead of squeezing bars', async () => {
  const q = await import('../src/utils/qrLabels.js');
  assert.equal(q.validateBarcodeDimensions({ widthMm: 50, heightMm: 15, unitCodes: ['SC-001'] }).blocked, false);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 18, heightMm: 24, unitCodes: ['SC-001'] }).blocked, true);
  assert.equal(q.validateBarcodeDimensions({ widthMm: 50, heightMm: 15, unitCodes: ['SC-001', 'X'.repeat(64)] }).blocked, true);
  assert.throws(() => q.generateBarcodeSvgString('X'.repeat(64), { widthMm: 50, heightMm: 15 }));
  assert.throws(() => q.getBarcodeSymbol('ไทย'));
  assert.throws(() => q.getBarcodeSymbol('F2U:T:SC-001'));
});
