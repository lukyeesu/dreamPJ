const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, fireEvent, act, cleanup } = require('@testing-library/react');
const output = esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../src/components/inventory/QrLabelPrint.jsx')],
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', 'qrcode', 'jsbarcode']
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(require, mod, mod.exports);
const QrLabelPrint = mod.exports.default;
const units = [{ unit_code: 'sc-002_a', item_id: 'tool', status: 'AVAILABLE' }];
const items = [{ id: 'tool', name: 'กรรไกร' }];
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

test('Print workspace explains missing real units and never previews or prints a fake serial', async () => {
  let requested = 0;
  const view = render(React.createElement(QrLabelPrint, { onAddUnitRequest: () => requested++ }));
  assert.ok(view.getByText('ยังไม่มีรหัสประจำชิ้นสำหรับพิมพ์ฉลาก'));
  assert.equal(document.body.textContent.includes('SC-001'), false);
  assert.equal(view.getByRole('button', { name: 'พิมพ์ฉลาก (0 ดวง)' }).disabled, true);
  fireEvent.click(view.getByRole('button', { name: 'เพิ่มครุภัณฑ์รายชิ้น' }));
  assert.equal(requested, 1);
  cleanup();
});

test('Actual print branch generates copied QR and Code128 documents, invokes print, and cleans each URL', async () => {
  const blobs = new Map();
  const revoked = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => { const url = `blob:job-${blobs.size}`; blobs.set(url, blob); return url; };
  URL.revokeObjectURL = (url) => revoked.push(url);
  let printed = 0;
  let notified = 0;
  try {
    const view = render(React.createElement(QrLabelPrint, { units, items, initialSelectedUnitCodes: ['sc-002_a'], onPrintSuccess: () => notified++ }));
    await act(flush);
    // Copies are print jobs only; the real serialized unit remains a single record.
    fireEvent.click(view.getByRole('button', { name: '2', exact: true }));
    async function printDocument() {
      await act(async () => {
        fireEvent.click(view.getByRole('button', { name: 'พิมพ์ฉลาก (2 ดวง)' }));
        await flush();
      });
      const iframe = document.querySelector('iframe');
      assert.ok(iframe);
      iframe.contentWindow.focus = () => {};
      iframe.contentWindow.print = () => printed++;
      await act(async () => { await iframe.onload(); });
      const url = iframe.src;
      const html = await blobs.get(url).text();
      const printedDoc = new JSDOM(html).window.document;
      assert.equal(printedDoc.querySelectorAll('.label-box').length, 2);
      assert.deepEqual([...printedDoc.querySelectorAll('.label-code')].map((el) => el.textContent), ['sc-002_a', 'sc-002_a']);
      await act(async () => { iframe.contentWindow.dispatchEvent(new dom.window.Event('afterprint')); });
      assert.ok(revoked.includes(url));
      return printedDoc;
    }
    const qrDoc = await printDocument();
    assert.equal(qrDoc.querySelectorAll('img.qr-img').length, 2);
    fireEvent.change(view.getByRole('combobox', { name: 'รูปแบบรหัส' }), { target: { value: 'code128' } });
    await act(flush);
    const barcodeDoc = await printDocument();
    assert.equal(barcodeDoc.querySelectorAll('svg').length, 2);
    assert.match(barcodeDoc.querySelector('svg').getAttribute('width'), /47mm/);
    assert.equal(printed, 2);
    assert.equal(notified, 2);
    assert.equal(units.length, 1);
    assert.equal(view.getByRole('button', { name: 'พิมพ์ฉลาก (2 ดวง)' }).disabled, false);
    cleanup();
    assert.equal(document.querySelector('iframe'), null);
  } finally {
    cleanup();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

test('Every selected code must fit and changing search filters does not change print selection', async () => {
  const view = render(React.createElement(QrLabelPrint, { units: [...units, { unit_code: 'X'.repeat(64), item_id: 'tool' }], items, initialSelectedUnitCodes: ['sc-002_a', 'X'.repeat(64)] }));
  fireEvent.change(view.getByRole('combobox', { name: 'รูปแบบรหัส' }), { target: { value: 'code128' } });
  await act(flush);
  assert.equal(view.getByRole('button', { name: 'พิมพ์ฉลาก (2 ดวง)' }).disabled, true);
  assert.ok(view.getByText(/ยาวเกินฉลาก/));
  fireEvent.change(view.getByPlaceholderText('ค้นหารหัส, ชื่อเครื่องมือ หรือสี...'), { target: { value: 'sc-002_a' } });
  assert.equal(view.getByRole('button', { name: 'พิมพ์ฉลาก (2 ดวง)' }).disabled, true);
  cleanup();
});
