// Rebuild a self-contained viewer: node .impeccable/build-inventory-preview.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory-options.json'), 'utf8'));
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const options = payload.options.map(option => {
  const html = fs.readFileSync(path.join(root, option.html), 'utf8');
  assert(!/\?{3,}|\uFFFD/.test(html), `Corrupted text in ${option.html}`);
  assert(/<body[\s>]/i.test(html), `Missing body in ${option.html}`);
  return { ...option, html, file: path.basename(option.html) };
});
assert(!/\?{3,}|\uFFFD/.test(JSON.stringify(payload)), 'Corrupted preview labels');
const data = JSON.stringify(options).replace(/</g, '\\u003c');
const buttons = options.map((option, index) => `<button type="button" data-index="${index}" aria-pressed="${index === 0}"><strong>${escapeHtml(option.label)}</strong><span>${escapeHtml(option.thesis)}</span></button>`).join('\n');
const directLinks = options.map(option => `<a href="${option.file}">${escapeHtml(option.label)}</a>`).join(' · ');
const output = `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตัวอย่างคลังสินค้า Flower2you · A / B / C</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#243247;font:15px/1.6 "Leelawadee UI",Tahoma,sans-serif}button,a{font:inherit}button{cursor:pointer}a{color:#923e54}header{padding:20px 24px;background:#fff;border-bottom:1px solid #dde3e9;display:flex;justify-content:space-between;gap:20px;align-items:center}h1{font-size:21px;margin:0 0 3px}header p{margin:0;color:#556476;font-size:13px}.full{display:inline-block;border:1px solid #b9c3d0;border-radius:7px;padding:10px 15px;text-decoration:none;white-space:nowrap;background:white}main{display:grid;grid-template-columns:275px minmax(0,1fr);min-height:calc(100vh - 109px)}aside{padding:22px 18px;border-right:1px solid #dce2e9;background:#fff}.options{display:grid;gap:12px}.options button{border:1px solid #ccd5df;background:#fff;color:#273748;border-radius:9px;padding:15px;text-align:left;min-height:90px}.options button[aria-pressed="true"]{border-color:#9f455a;background:#fbf2f5}.options strong{display:block;font-size:15px}.options span{display:block;font-size:13px;margin-top:6px;color:#556476}.note{font-size:13px;color:#566576;margin:20px 0 0}button:focus-visible,a:focus-visible{outline:3px solid #9f455a;outline-offset:3px}.workspace{min-width:0}.toolbar{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:15px}.toolbar h2{font-size:16px;margin:0}.toolbar span{font-size:13px;color:#59687a}.stage{padding:0 16px 20px;overflow:auto}.frame-box{position:relative;overflow:hidden;background:#fff;outline:1px solid #dce2e9;margin:0 auto;min-height:180px}iframe{display:block;width:1440px;height:900px;border:0;transform-origin:top left;background:#fff}.fallback{padding:0 20px 20px;font-size:13px;color:#566576}.fallback a{display:inline-block;margin:3px 6px 3px 0}@media(max-width:800px){header{padding:16px;display:block}.full{margin-top:12px}main{display:block}aside{padding:12px;border-right:0;border-bottom:1px solid #dce2e9}.options{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.options button{padding:10px;min-height:85px}.options strong{font-size:13px}.options span{font-size:12px}.note{margin:12px 2px 0}.toolbar{padding:14px 16px;display:block}.toolbar span{display:block;margin-top:5px}}@media print{aside,.toolbar,.fallback,.full{display:none}main{display:block}.stage{overflow:visible;padding:0}iframe{transform:none!important}.frame-box{width:1440px!important;height:900px!important}}
</style>
</head>
<body>
<header><div><h1>ตัวอย่างหน้าคลังสินค้า</h1><p>สลับดู A / B / C ได้โดยไม่ยืนยันเลือกแบบใด</p></div><a id="fullLink" class="full" href="${options[0].file}">เปิดแบบนี้เต็มหน้า</a></header>
<main>
<aside><div class="options">${buttons}</div><p class="note">นี่คือภาพร่างหน้าจอที่ใช้ข้อมูลตัวอย่าง ปุ่มภายในภาพยังไม่ใช่ระบบทำรายการจริง</p><p class="note">ดูครบแล้วแจ้ง A, B หรือ C ในแชตได้ การกดสลับดูไม่ถือเป็นการยืนยันเลือก</p></aside>
<section class="workspace"><div class="toolbar"><h2 id="currentTitle">${escapeHtml(options[0].label)}</h2><span>ย่อให้พอดีหน้าจอ · ใช้ปุ่มเปิดเต็มหน้าเพื่ออ่านข้อความขนาดจริง</span></div>
<div class="stage" id="stage"><div class="frame-box" id="frameBox"><iframe id="designFrame" title="${escapeHtml(options[0].label)}" sandbox="" srcdoc="${escapeHtml(options[0].html)}"></iframe></div></div>
<div class="fallback">เปิดแบบเต็มหน้าโดยตรง: ${directLinks}</div>
</section>
</main>
<script id="preview-data" type="application/json">${data}</script>
<script>
const designs = JSON.parse(document.getElementById('preview-data').textContent);
const frame = document.getElementById('designFrame');
const frameBox = document.getElementById('frameBox');
const stage = document.getElementById('stage');
const title = document.getElementById('currentTitle');
const fullLink = document.getElementById('fullLink');
const buttons = document.querySelectorAll('[data-index]');
function fit() {
  const scale = Math.min(1, Math.max(0.15, (stage.clientWidth - 32) / 1440));
  frame.style.transform = 'scale(' + scale + ')';
  frameBox.style.width = (1440 * scale) + 'px';
  frameBox.style.height = (900 * scale) + 'px';
}
function show(index) {
  const design = designs[index];
  if (!design) return;
  frame.srcdoc = design.html;
  frame.title = design.label;
  title.textContent = design.label;
  fullLink.href = design.file;
  buttons.forEach((button, current) => button.setAttribute('aria-pressed', String(current === index)));
  fit();
}
buttons.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.index))));
window.addEventListener('resize', fit);
const requested = window.location.hash.slice(1).toUpperCase();
const initial = ['A', 'B', 'C'].indexOf(requested);
if (initial >= 0) show(initial); else fit();
</script>
</body>
</html>`;
const target = path.join(__dirname, 'mocks/decision/inventory-preview.html');
fs.writeFileSync(target, output, 'utf8');
console.log(`Built ${path.relative(root, target)} with ${options.length} embedded designs.`);
