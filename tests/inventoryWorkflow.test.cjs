const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
global.requestAnimationFrame=cb=>setTimeout(cb,0);global.cancelAnimationFrame=clearTimeout;
const React=require('react');
const {render,fireEvent,act,waitFor,cleanup,within,configure}=require('@testing-library/react');
configure({getElementError:message=>new Error(message)});
const observers=[];
global.IntersectionObserver=class {
  constructor(callback){this.callback=callback;this.active=false;observers.push(this);}
  observe(){this.active=true;} disconnect(){this.active=false;}
};
async function loadInventory(){
  const built=await esbuild.build({entryPoints:['src/Inventory.jsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','lucide-react','qrcode','@zxing/browser','@zxing/library','jsbarcode'],plugins:[{name:'offline',setup(b){
    b.onResolve({filter:/supabaseClient(?:\.js)?$/},()=>({path:path.resolve('tests/fixtures/inventory-offline-data.js')}));
    b.onResolve({filter:/\/db(?:\.js)?$/},()=>({path:path.resolve('tests/fixtures/inventory-offline-db.js')}));
  }}]});
  const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
  return mod.exports.default;
}
afterEach(()=>{cleanup();delete window.__inventoryTestItems;delete window.__inventoryTestUnits;delete window.__inventoryTestRpc;window.__offlineRpcCalls=[];observers.length=0;});

test('infinite catalog appends bounded pages once, keeps cart, resets search and stops when inactive',async()=>{
  window.__inventoryTestItems=Array.from({length:105},(_,n)=>({id:`i-${n}`,name:`Catalog ${String(n).padStart(3,'0')}`,item_type:'consumable',current_stock:5,unit:'piece',image_url:n===0?'https://drive.google.com/uc?export=view&id=photo_123':null}));
  const Inventory=await loadInventory();
  const ui=render(React.createElement(Inventory,{userProfile:{id:'test',role:'admin'}}));
  const nearBottom=()=>{const observer=observers.findLast(o=>o.active);assert.ok(observer);observer.callback([{isIntersecting:true}]);};
  const calls=()=>window.__offlineRpcCalls.filter(c=>c.name==='warehouse_list_stock');
  const choice=n=>document.querySelector(`[aria-label="เลือก Catalog ${String(n).padStart(3,'0')}"]`);
  await waitFor(()=>assert.ok(choice(0)));
  await act(async()=>new Promise(r=>setTimeout(r,350)));
  assert.equal(calls().length,0,'first bounded summary page is reused');
  assert.ok(document.querySelector('img[src="https://lh3.googleusercontent.com/d/photo_123"][loading="lazy"]'));
  assert.ok(!document.body.textContent.includes('1?50'));
  await act(async()=>fireEvent.click(choice(0)));
  await act(async()=>{nearBottom();nearBottom();});
  await waitFor(()=>assert.ok(choice(99)));
  assert.equal(calls().filter(c=>c.args.p_filters.offset===50).length,1);
  assert.ok(choice(0));
  assert.equal(choice(0).getAttribute('aria-pressed'),'true');
  assert.ok(calls().every(c=>c.args.p_filters.limit===50));
  await act(async()=>ui.rerender(React.createElement(Inventory,{isActive:false,userProfile:{id:'test',role:'admin'}})));
  assert.ok(observers.every(o=>!o.active),'hidden catalog disconnects its scroll observer');
  await act(async()=>ui.rerender(React.createElement(Inventory,{isActive:true,userProfile:{id:'test',role:'admin'}})));
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'โหลดเพิ่มเติม'})));
  await waitFor(()=>assert.ok(choice(104)));
  assert.ok(!ui.queryByRole('button',{name:'โหลดเพิ่มเติม'}));
  await act(async()=>fireEvent.change(ui.getByPlaceholderText('ค้นหาชื่อ หมวดหมู่ สี ขนาด หรือรหัส...'),{target:{value:'Catalog 104'}}));
  await waitFor(()=>assert.ok(!choice(99)));
  assert.equal(calls().at(-1).args.p_filters.offset,0);
  assert.ok(choice(104));
});

test('empty print workspace creates a real tool and unit, then reopens selected printable label',async()=>{
  window.__inventoryTestItems=[];window.__inventoryTestUnits=[];
  window.__inventoryTestRpc=async(name,args)=>{
    if(name!=='warehouse_dispatch')return undefined;
    const p=args.p_payload;
    if(args.p_action==='item_create'){
      window.__inventoryTestItems.push({...p,id:'created-tool',current_stock:0});
      return {data:{success:true,data:{id:'created-tool',affected_item_ids:['created-tool']}},error:null};
    }
    if(args.p_action==='unit_add'){
      window.__inventoryTestUnits.push({...p,id:'new-unit',status:'AVAILABLE'});
      return {data:{success:true,data:{affected_item_ids:['created-tool']}},error:null};
    }
    throw new Error('Unexpected mutation');
  };
  const Inventory=await loadInventory();
  const ui=render(React.createElement(Inventory,{userProfile:{id:'test',role:'admin'}}));
  await waitFor(()=>assert.ok(document.body.textContent.includes('ไม่พบ')));
  await act(async()=>fireEvent.click(within(document.querySelector('header')).getByText('จัดการคลัง')));
  await act(async()=>fireEvent.click(within(document.querySelector('header')).getByRole('button',{name:'พิมพ์ฉลาก QR'})));
  await waitFor(()=>assert.ok(ui.getByRole('button',{name:'เพิ่มครุภัณฑ์รายชิ้น'})));
  assert.equal(document.body.textContent.includes('SC-001'),false,'no fabricated preview identity');
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'เพิ่มครุภัณฑ์รายชิ้น'})));
  const nameInput=await waitFor(()=>ui.getByPlaceholderText('เช่น ดอกกุหลาบประดิษฐ์, กรรไกรตัดแต่ง...'));
  await act(async()=>fireEvent.change(nameInput,{target:{value:'New scissors'}}));
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'สร้างรายการพัสดุ'})));
  const code=await waitFor(()=>ui.getByPlaceholderText('เช่น SC-001, SC-002, DR-001...'));
  await act(async()=>fireEvent.change(code,{target:{value:'NEW-001'}}));
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'บันทึกรหัสประจำชิ้น'})));
  await waitFor(()=>assert.equal(ui.getByRole('button',{name:'เลือก NEW-001'}).getAttribute('aria-pressed'),'true'));
  assert.ok(window.__offlineRpcCalls.some(c=>c.name==='warehouse_list_units' && c.args.p_filters.item_id==='created-tool'));
  assert.equal(window.__inventoryTestItems[0].item_type,'asset');
});
