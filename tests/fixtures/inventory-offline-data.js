// Explicit TEST DATA. No network client is constructed by this module.
export const categories = [{id:'cat-flowers',name:'ดอกไม้พลาสติก'}, {id:'cat-tools',name:'เครื่องมือ'}];
export const items = [
  {id:'flower',name:'ทิวลิปพลาสติก',code:'FL-W',item_type:'reusable',category_id:'cat-flowers',color:'ขาว',size:'M',current_stock:100,unit:'ดอก',min_stock:10},
  {id:'tape',name:'เทปใส',code:'TP-01',item_type:'consumable',color:'ใส',current_stock:25,unit:'ม้วน',min_stock:5},
  {id:'scissors',name:'กรรไกรตัดริบบิ้น',code:'SC-B',item_type:'asset',category_id:'cat-tools',color:'ฟ้า',current_stock:2,unit:'ด้าม',tool_total:2,tool_available:1}
];
export const units = [
  {id:'unit1',unit_code:'SC-001',item_id:'scissors',status:'AVAILABLE'},
  {id:'unit2',unit_code:'SC-002',item_id:'scissors',status:'BORROWED'}
];
export const people = [{id:'11111111-1111-4111-8111-111111111111',recipient_id:'11111111-1111-4111-8111-111111111111',key:'recipient:11111111-1111-4111-8111-111111111111',name:'ผู้ช่วยตัวอย่าง',recipient_type:'individual',kind:'recipient',is_active:true}];
export const activities = [{id:'preview-project',code:'TEST-001',name:'งานตัวอย่างสำหรับทดสอบ',title:'งานตัวอย่างสำหรับทดสอบ',status:'in_progress'}];
const page = key => ({[key]:[],total_count:0,offset:0,limit:20,has_more:false});
const client = {
  auth: { onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) },
  channel: () => { const channel = {on:()=>channel,subscribe:()=>channel,unsubscribe(){}}; return channel; },
  removeChannel() {},
  async rpc(name, args = {}) {
    window.__offlineRpcCalls ||= [];
    window.__offlineRpcCalls.push({name,args});
    if (window.__inventoryTestRpc) {
      const custom = await window.__inventoryTestRpc(name, args);
      if (custom !== undefined) return custom;
    }
    const catalog = window.__inventoryTestItems || items;
    const toolUnits = window.__inventoryTestUnits || units;
    let data;
    if (name === 'warehouse_get_summary') data = {schema_version:2,capabilities:{item_images:true},items:catalog.slice(0,50),categories,recipients:people,rounds:[],asset_units:[],total_items_count:catalog.length,counts:{borrowed_tools:1,pending_recoveries:0}};
    else if (name === 'warehouse_list_stock') {
      const filters = args.p_filters || {};
      const found = catalog.filter(item => (!filters.search || [item.name,item.code,item.color].join(' ').toLowerCase().includes(filters.search.toLowerCase()))
        && (!filters.item_type || item.item_type === filters.item_type) && (!filters.category_id || item.category_id === filters.category_id)
        && (!filters.color || item.color === filters.color) && (!filters.size || item.size === filters.size));
      const offset=filters.offset || 0, limit=filters.limit || 50;
      data = {items:found.slice(offset,offset+limit),total_count:found.length,offset,limit,has_more:offset+limit<found.length};
    }
    else if (name === 'warehouse_list_units') data = {...page('units'),units:toolUnits.filter(unit => !args.p_filters?.item_id || unit.item_id === args.p_filters.item_id),total_count:toolUnits.length};
    else if (name === 'warehouse_list_people') data = people;
    else if (name === 'warehouse_resolve_person') data = {...people[0],success:true};
    else if (name === 'warehouse_get_operations') data = {issue_lines:[],recoveries:[],custodies:[],incidents:[],has_more:false};
    else if (name === 'warehouse_get_cash_summary') data = {denominations:[20,50,100,500,1000].map(denomination=>({denomination,physical_count:20,reserved_count:0,available_count:20})),helper_batches:[],reservations:[],prepared_sets:[]};
    else if (name === 'warehouse_load_production_project') data = {project_id:'preview-project',assignments:[],summary:{},has_more:false};
    else if (name.includes('history')) data = args.p_filters?.doc_type === 'LEGACY_LOAN'
      ? {documents:[{id:'old-loan',recipient_name_snapshot:'ผู้ยืมจากประวัติเดิม',project_id:'preview-project',created_at:'2026-11-01',due_at:'2026-11-15',status:'RETURNED'}],movements:[],cash_movements:[],has_more:false}
      : {documents:[],movements:[{id:'movement-test',item_name_snapshot:'เทปใส',movement_type:'ISSUE',quantity:2,delta_stock:-2,unit:'ม้วน',project_id:'preview-project'}],cash_movements:[{id:'cash-movement-test',action_type:'ISSUE',denomination:50,note_count:10,from_location:'VAULT',to_location:'HELPER'}],has_more:false};
    else if (name.includes('checklist')) data = page('checklists');
    else return {data:null,error:{message:'ตัวอย่างอ่านอย่างเดียว: ไม่มีการบันทึกข้อมูลจริง'}};
    return {data,error:null};
  }
};
export const getActiveClient = () => client;
