const { test } = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

const compiled = esbuild.buildSync({ entryPoints: ['src/utils/themeManager.js'], bundle: true,
  platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const loaded = { exports: {} };
new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, require);
const theme = loaded.exports;

function contrast(a, b) {
  const light = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const values = [light(a), light(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('warehouse text remains readable on preset and custom theme colors', () => {
  for (const color of ['#8b5cf6', '#10b981', '#f43f5e', '#ffffff', '#000000', '#eab308', '#00ffff', '#777777']) {
    const result = theme.computeThemeColors('custom', 'solid', color);
    assert.ok(contrast(color, result.onMain) >= 4.5, `button ${color}`);
    assert.ok(contrast('#ffffff', result.ink) >= 4.5, `ink ${color}`);
  }
  assert.equal(theme.getContrastYIQ('#fff'), '#000000');
  assert.equal(theme.getContrastYIQ('#000'), '#ffffff');
  assert.equal(theme.computeThemeInk('invalid'), '#0f172a');
});

test('changing theme updates live variables without duplicating the stylesheet', () => {
  const dom = new JSDOM('<html><head></head><body></body></html>');
  global.document = dom.window.document;
  try {
    theme.applyThemeVariables('custom', 'solid', '#10b981');
    assert.equal(document.documentElement.style.getPropertyValue('--theme-on-main'), '#000000');
    theme.applyThemeVariables('custom', 'solid', '#000000');
    assert.equal(document.documentElement.style.getPropertyValue('--theme-on-main'), '#ffffff');
    assert.equal(document.documentElement.style.getPropertyValue('--theme-main'), '#000000');
    assert.equal(document.querySelectorAll('#nexus-theme-styles').length, 1);
  } finally {
    delete global.document;
    dom.window.close();
  }
});
