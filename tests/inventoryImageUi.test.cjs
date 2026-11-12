const {loadProductionComponent}=require('./helpers/productionUiHarness.cjs');
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {render,fireEvent,act,cleanup,waitFor}=require('@testing-library/react');
afterEach(cleanup);

test('item photo upload is retained across a failed save and retry never uploads twice',async()=>{
  const ItemForm=await loadProductionComponent('src/components/inventory/ItemFormModal.jsx');
  let uploads=0,closed=0;const saves=[];
  const url='https://drive.google.com/uc?export=view&id=photo_123';
  const ui=render(React.createElement(ItemForm,{isOpen:true,editingItem:{id:'item',name:'Scissors',item_type:'consumable',unit:'piece'},supportsItemImages:true,imageUploadReady:true,
    onUploadImage:async()=>{uploads++;return url;},onClose:()=>closed++,
    onSaveItem:async p=>{saves.push(p);if(saves.length===1)throw new Error('Test save failed');return {success:true};}}));
  await act(async()=>fireEvent.change(ui.getByLabelText('รูปสินค้า'),{target:{files:[new window.File(['image'],'scissors.jpg',{type:'image/jpeg'})]}}));
  assert.equal(uploads,1);
  assert.ok(document.querySelector('img[src="https://lh3.googleusercontent.com/d/photo_123"]'));
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'บันทึกการแก้ไข'})));
  assert.equal(closed,0);assert.equal(saves[0].image_url,url);
  await act(async()=>fireEvent.click(ui.getByRole('button',{name:'บันทึกการแก้ไข'})));
  assert.equal(closed,1);assert.equal(uploads,1);assert.equal(saves[1].image_url,url);
  assert.equal(saves[0].idempotencyKey,saves[1].idempotencyKey);
});

test('photo upload blocks premature save; old schema cannot silently discard a photo',async()=>{
  const ItemForm=await loadProductionComponent('src/components/inventory/ItemFormModal.jsx');
  let release,closed=0;
  const props={isOpen:true,editingItem:{id:'item',name:'Tape',item_type:'consumable'},onClose:()=>closed++,supportsItemImages:true,imageUploadReady:true,onUploadImage:()=>new Promise(r=>{release=r;})};
  const ui=render(React.createElement(ItemForm,props));
  await act(async()=>fireEvent.change(ui.getByLabelText('รูปสินค้า'),{target:{files:[new window.File(['image'],'tape.jpg',{type:'image/jpeg'})]}}));
  assert.equal(document.querySelector('button[type="submit"]').disabled,true);
  await act(async()=>fireEvent.keyDown(window,{key:'Escape'}));assert.equal(closed,0);
  await act(async()=>release('https://drive.google.com/uc?export=view&id=tape_123'));
  await waitFor(()=>assert.equal(document.querySelector('button[type="submit"]').disabled,false));
  ui.rerender(React.createElement(ItemForm,{...props,supportsItemImages:false}));
  assert.equal(ui.getByLabelText('รูปสินค้า').disabled,true);
  assert.ok(document.body.textContent.includes('อัปเดต inventory_compact.sql'));
});
