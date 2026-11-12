const {test} = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const {createCompactFixture, assembleCompact, setAuthUser, TECH_AUTH_ID, itemId} = require('./helpers/compactRuntimeHarness.cjs');

function service() {
  const code = esbuild.buildSync({entryPoints:['src/services/inventoryImageService.js'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
  const mod = {exports:{}};
  new Function('module','exports',code)(mod,mod.exports);
  return mod.exports;
}

test('inventory image upload uses configured Drive folder and stores a validated URL only', async () => {
  const api = service();
  assert.equal(api.resolveInventoryImageFolder([{type:'inventory',folderId:' stock '},{type:'assets',folderId:'assets'}]),'stock');
  assert.equal(api.resolveInventoryImageFolder([{type:'assets',folderId:' assets '}]),'assets');
  assert.equal(api.resolveInventoryImageFolder([], 'fallback'),'fallback');
  for(const value of ['javascript:alert(1)','data:image/png;base64,xxx','https://drive.google.com.evil.com/d/id','https://user:pass@drive.google.com/d/id']) assert.equal(api.inventoryImageUrl(value),null);
  assert.equal(api.inventoryImageUrl('https://drive.google.com/uc?export=view&id=photo_123'),'https://lh3.googleusercontent.com/d/photo_123');
  let request;
  const options={folderId:'folder_123',scriptUrl:'https://script.google.com/macros/s/test/exec'};
  const injected={prepare:async()=>'data:image/jpeg;base64,AA==',fetchImpl:async(url,init)=>{
    request={url,...init};return {ok:true,json:async()=>({status:'success',fileId:'photo_123'})};
  }};
  const result=await api.uploadInventoryImage({},options,injected);
  assert.equal(result,'https://drive.google.com/uc?export=view&id=photo_123');
  assert.equal(request.headers['Content-Type'],'text/plain;charset=utf-8');
  const payload=JSON.parse(request.body);
  assert.equal(payload.action,'uploadAsset');assert.equal(payload.data.folderId,'folder_123');
  assert.equal(payload.data.mimeType,'image/jpeg');assert.equal(payload.data.fileData,'data:image/jpeg;base64,AA==');
  await assert.rejects(api.uploadInventoryImage({}, {...options,folderId:''},injected),/Folder ID/);
  await assert.rejects(api.uploadInventoryImage({},options,{...injected,fetchImpl:async()=>({ok:true,json:async()=>({status:'success',url:'data:image/png;base64,AA=='})})}),/URL/);
  await assert.rejects(api.prepareInventoryImage({type:'image/svg+xml',size:20}),/JPG/);
  await assert.rejects(api.prepareInventoryImage({type:'image/png',size:9*1024*1024}),/8 MB/);
});

test('product images are resized before upload and temporary object URLs are released', async () => {
  const api=service();
  const oldImage=global.Image, oldDocument=global.document;
  const oldCreate=URL.createObjectURL, oldRevoke=URL.revokeObjectURL;
  let revoked=false,drawn=false;
  const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){drawn=true;}}),toDataURL:(type,quality)=>{
    assert.equal(type,'image/jpeg');assert.equal(quality,0.78);return 'data:image/jpeg;base64,AA==';
  }};
  global.Image=class{naturalWidth=4000;naturalHeight=2000;async decode(){}};
  global.document={createElement:()=>canvas};
  URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=value=>{assert.equal(value,'blob:test');revoked=true;};
  try {
    assert.equal(await api.prepareInventoryImage({type:'image/png',size:100}),'data:image/jpeg;base64,AA==');
    assert.equal(canvas.width,1024);assert.equal(canvas.height,512);assert.ok(drawn);assert.ok(revoked);
    revoked=false;
    global.Image=class{async decode(){throw new Error('Invalid file');}};
    await assert.rejects(api.prepareInventoryImage({type:'image/jpeg',size:100}),/Invalid file/);
    assert.ok(revoked,'decode failures also release temporary file URLs');
  } finally {global.Image=oldImage;global.document=oldDocument;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});

test('compact inventory persists Drive image metadata, preserves omissions and validates URLs', async t => {
  const {pg,cmd}=await createCompactFixture(t);
  await setAuthUser(pg,TECH_AUTH_ID,'authenticated');
  const url='https://drive.google.com/uc?export=view&id=photo_123';
  const created=await cmd('item_create',{name:'Image item',item_type:'consumable',image_url:url});
  const id=created.data.id;
  const read=async()=> (await pg.query('SELECT image_url,current_stock FROM inventory_items WHERE id=$1',[id])).rows[0];
  assert.equal((await read()).image_url,url);
  await cmd('item_save_metadata',{id,name:'Renamed'});
  assert.equal((await read()).image_url,url,'metadata edits without photo field preserve the photo');
  const summary=(await pg.query('SELECT warehouse_get_summary() AS result')).rows[0].result;
  assert.equal(summary.capabilities.item_images,true);
  assert.equal(summary.items.find(i=>i.id===id).image_url,url);
  const page=(await pg.query('SELECT warehouse_list_stock($1::jsonb) AS result',[JSON.stringify({item_ids:[id]})])).rows[0].result;
  assert.equal(page.items[0].image_url,url);
  await setAuthUser(pg,null,null);
  await assembleCompact(pg);
  await setAuthUser(pg,TECH_AUTH_ID,'authenticated');
  assert.equal((await read()).image_url,url,'rerunning the installer preserves item photos');
  await assert.rejects(cmd('item_save_metadata',{id,image_url:'data:image/png;base64,AA=='}),/Invalid Google Drive/);
  await assert.rejects(cmd('item_create',{name:'Bad image',image_url:'https://evil.test/image.jpg'}),/Invalid Google Drive/);
  await cmd('item_save_metadata',{id,image_url:null});
  assert.equal((await read()).image_url,null);
  assert.equal(Number((await read()).current_stock),0);
  assert.equal(Number((await pg.query('SELECT current_stock FROM inventory_items WHERE id=$1',[itemId(1)])).rows[0].current_stock),100);
});
