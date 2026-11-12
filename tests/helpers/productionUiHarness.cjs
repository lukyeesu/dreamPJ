const { JSDOM } = require('jsdom');
const path = require('node:path');
const esbuild = require('esbuild');

// Immediately initialize JSDOM before any React / React-DOM requires occur
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;
global.HTMLVideoElement = dom.window.HTMLVideoElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.window.prompt = (msg, def) => (global.__PROMPT_RETURN_VALUE__ !== undefined ? global.__PROMPT_RETURN_VALUE__ : (def || ''));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const componentCache = new Map();

async function loadProductionComponent(relativePath) {
  if (componentCache.has(relativePath)) {
    return componentCache.get(relativePath);
  }

  const absPath = path.resolve(__dirname, '../../', relativePath);

  const mockServicePlugin = {
    name: 'mock-services',
    setup(build) {
      build.onResolve({ filter: /productionService(\.js)?$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-ps'
      }));
      build.onLoad({ filter: /.*/, namespace: 'mock-ps' }, () => ({
        contents: `
          const getH = () => global.__PRODUCTION_TEST_HARNESS__ || {};
          export const listWarehousePeople = (...a) => (getH().listWarehousePeople ? getH().listWarehousePeople(...a) : Promise.resolve({ people: [], has_more: false }));
          export const resolveWarehousePerson = (...a) => (getH().resolveWarehousePerson ? getH().resolveWarehousePerson(...a) : Promise.resolve(null));
          export const loadProductionProject = (...a) => (getH().loadProductionProject ? getH().loadProductionProject(...a) : Promise.resolve(null));
          export const loadProductionWorkDetails = (...a) => (getH().loadProductionWorkDetails ? getH().loadProductionWorkDetails(...a) : Promise.resolve({ details: null }));
          export const loadProductionWorkCards = (...a) => (getH().loadProductionWorkCards ? getH().loadProductionWorkCards(...a) : Promise.resolve({ assignments: [] }));
          export const createProductionAssignment = (...a) => (getH().createProductionAssignment ? getH().createProductionAssignment(...a) : Promise.resolve({ success: true }));
          export const updateProductionAssignment = (...a) => (getH().updateProductionAssignment ? getH().updateProductionAssignment(...a) : Promise.resolve({ success: true }));
          export const splitProductionAssignment = (...a) => (getH().splitProductionAssignment ? getH().splitProductionAssignment(...a) : Promise.resolve({ success: true }));
          export const submitProductionWork = (...a) => (getH().submitProductionWork ? getH().submitProductionWork(...a) : Promise.resolve({ success: true }));
          export const inspectProductionWork = (...a) => (getH().inspectProductionWork ? getH().inspectProductionWork(...a) : Promise.resolve({ success: true }));
          export const setProductionStatus = (...a) => (getH().setProductionStatus ? getH().setProductionStatus(...a) : Promise.resolve({ success: true }));
          export const inspectProductionCash = (...a) => (getH().inspectProductionCash ? getH().inspectProductionCash(...a) : Promise.resolve({ success: true }));
          export const subscribeProductionProject = (...a) => (getH().subscribeProductionProject ? getH().subscribeProductionProject(...a) : () => {});
          export const createProductionIssue = (...a) => (getH().createProductionIssue ? getH().createProductionIssue(...a) : Promise.resolve({ success: true }));
          export const generateIdempotencyKey = (...a) => (getH().generateIdempotencyKey ? getH().generateIdempotencyKey(...a) : crypto.randomUUID());
        `,
        loader: 'js'
      }));

      build.onResolve({ filter: /warehouseService(\.js)?$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-ws'
      }));
      build.onLoad({ filter: /.*/, namespace: 'mock-ws' }, () => ({
        contents: `
          const getH = () => global.__PRODUCTION_TEST_HARNESS__ || {};
          export const createRecipient = (...a) => (getH().createRecipient ? getH().createRecipient(...a) : Promise.resolve({ success: true }));
          export const createTeam = (...a) => (getH().createTeam ? getH().createTeam(...a) : Promise.resolve({ success: true }));
          export const returnTools = (...a) => (getH().returnTools ? getH().returnTools(...a) : Promise.resolve({ success: true }));
          export const dispatchWarehouseCommand = (...a) => (getH().dispatchWarehouseCommand ? getH().dispatchWarehouseCommand(...a) : Promise.resolve({ success: true }));
          export const generateIdempotencyKey = (...a) => (getH().generateIdempotencyKey ? getH().generateIdempotencyKey(...a) : crypto.randomUUID());
        `,
        loader: 'js'
      }));
    }
  };

  const result = await esbuild.build({
    entryPoints: [absPath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    plugins: [mockServicePlugin],
    define: {
      'import.meta.env': '{}',
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""'
    },
    external: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@testing-library/react',
      'lucide-react'
    ]
  });

  const bundledCode = result.outputFiles[0].text;
  const mod = { exports: {} };
  const wrapper = new Function('require', 'module', 'exports', '__dirname', '__filename', bundledCode);
  wrapper(require, mod, mod.exports, path.dirname(absPath), absPath);
  const comp = mod.exports.default || mod.exports;
  componentCache.set(relativePath, comp);
  return comp;
}

function setHarness(mocks = {}) {
  global.__PRODUCTION_TEST_HARNESS__ = { ...mocks };
}

function resetHarness() {
  global.__PRODUCTION_TEST_HARNESS__ = {};
  global.__PROMPT_RETURN_VALUE__ = undefined;
}

module.exports = {
  loadProductionComponent,
  setHarness,
  resetHarness
};
