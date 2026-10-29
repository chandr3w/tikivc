const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const script = html.match(/<script id="startup">([\s\S]*?)<\/script>/)[1];

function boot() {
  const events = {};
  const button = { disabled: true, textContent: 'Loading…', addEventListener(type, fn) { this[type] = fn; } };
  const state = { starts: 0, reloads: 0, timeout: null };
  const document = {
    getElementById: () => button,
    addEventListener: (type, fn) => { events[type] = fn; },
    dispatchEvent: event => { if (event.type === 'palm-start') state.starts++; }
  };
  vm.runInNewContext(script, {
    document, Event: class { constructor(type) { this.type = type; } },
    window: { location: { reload: () => state.reloads++ } },
    setTimeout: fn => { state.timeout = fn; return 1; },
    clearTimeout: () => { state.timeout = null; }
  });
  return { button, state, events };
}

test('consent cannot be clicked before initialization; readiness enables it', () => {
  assert.match(html, /id="accept" disabled/);
  const { button, state, events } = boot();
  assert.equal(button.disabled, true);
  assert.equal(state.starts, 0);
  events['palm-ready']();
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'I can handle it');
  assert.equal(state.timeout, null);
  button.click();
  assert.equal(state.starts, 1);
  assert.equal(state.reloads, 0);
});

test('failed load offers reload without dismissing consent or starting', () => {
  const { button, state } = boot();
  state.timeout();
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Loading failed. Retry');
  button.click();
  assert.equal(state.reloads, 1);
  assert.equal(state.starts, 0);
});

test('late successful load replaces retry with working consent', () => {
  const { button, state, events } = boot();
  state.timeout();
  events['palm-ready']();
  assert.equal(button.textContent, 'I can handle it');
  button.click();
  assert.equal(state.starts, 1);
  assert.equal(state.reloads, 0);
});
