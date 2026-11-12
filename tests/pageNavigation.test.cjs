const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator; global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, cleanup, fireEvent } = require('@testing-library/react');

function loadAppPages() {
  const source = fs.readFileSync(path.resolve(__dirname,'../src/App.jsx'),'utf8');
  const ast = parse(source,{sourceType:'module',plugins:['jsx']});
  let fragment;
  traverse(ast,{VariableDeclarator(p){
    if (p.node.id.name==='renderContent') fragment=p.node.init.body.body.at(-1).argument;
  }});
  const jsx = source.slice(fragment.start,fragment.end);
  const expression = parse(`const result = (${jsx})`,{sourceType:'module',plugins:['jsx']});
  const names = new Set(['React']);
  traverse(expression,{
    ReferencedIdentifier(p){if(!p.scope.hasBinding(p.node.name)) names.add(p.node.name);},
    JSXOpeningElement(p){if(p.node.name.type==='JSXIdentifier' && /^[A-Z]/.test(p.node.name.name)) names.add(p.node.name.name);}
  });
  const args=[...names];
  const code=esbuild.transformSync(`module.exports=(${args.join(',')})=>(${jsx});`,{loader:'jsx',format:'cjs'}).code;
  const loaded={exports:{}}; new Function('module',code)(loaded);
  return env=>loaded.exports(...args.map(name=>env[name]));
}

function loadPersistentPage() {
  const file=path.resolve(__dirname,'../src/components/common/PersistentPage.jsx');
  if(!fs.existsSync(file)) return undefined;
  const code=esbuild.buildSync({entryPoints:[file],bundle:true,write:false,format:'cjs',platform:'node',external:['react']}).outputFiles[0].text;
  const loaded={exports:{}}; new Function('require','module','exports',code)(require,loaded,loaded.exports);
  return loaded.exports.default;
}

test('App navigation does not render other inactive pages and restores their latest data and draft',()=>{
  const pages=loadAppPages();
  const renders={Calendar:0,Plans:0,Finance:0,Inventory:0};
  const env={React,PersistentPage:loadPersistentPage(),visitedTabs:new Set(Object.keys(renders)),
    allActivities:[],analyticsData:{},financeFilter:{},shopInfo:{},userProfile:{},stats:[],resolveInventoryImageFolder:()=>''};
  for(const name of Object.keys(renders)) env[name]=props=>{
    renders[name]++;
    return React.createElement('section',null,
      React.createElement('input',{'data-testid':`${name}-draft`,defaultValue:''}),
      React.createElement('span',{'data-testid':`${name}-data`},props.activities?.[0]?.name || 'initial'));
  };
  const ui=render(pages({...env,activeTab:'Calendar'}));
  try{
    fireEvent.change(ui.getByTestId('Inventory-draft'),{target:{value:'unfinished work'}});
    const before={...renders};
    ui.rerender(pages({...env,activeTab:'Plans'}));
    assert.equal(renders.Inventory,before.Inventory,'hidden inventory must not render when switching Calendar to Plans');
    assert.equal(renders.Finance,before.Finance,'hidden finance must not render on other page navigation');
    ui.rerender(pages({...env,activeTab:'Plans',allActivities:[{name:'latest server data'}]}));
    assert.equal(renders.Inventory,before.Inventory,'hidden pages defer unrelated data updates');
    ui.rerender(pages({...env,activeTab:'Inventory',allActivities:[{name:'latest server data'}]}));
    assert.equal(ui.getByTestId('Inventory-data').textContent,'latest server data');
    assert.equal(ui.getByTestId('Inventory-draft').value,'unfinished work');
  } finally {cleanup();dom.window.close();}
});
