const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(tag) {
  const element = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {},
    className: '',
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    children: [],
    options: [],
    selectedIndex: 0,
    classList: null,
    parentNode: {
      children: [],
      insertBefore(child) { this.children.push(child); return child; },
      appendChild(child) { this.children.push(child); return child; }
    },
    nextSibling: null
  };
  element.classList = {
    add() {},
    remove() {},
    toggle() {},
    contains() { return false; }
  };
  element.addEventListener = () => {};
  element.removeEventListener = () => {};
  element.focus = () => {};
  element.click = () => {};
  element.removeAttribute = () => {};
  element.setAttribute = (key, value) => { element[key] = value; };
  element.getAttribute = (key) => element[key];
  element.hasAttribute = () => false;
  element.appendChild = (child) => {
    element.children.push(child);
    child.parentNode = element;
    if (child.tagName === 'OPTION') element.options.push(child);
    return child;
  };
  element.insertBefore = (child) => element.appendChild(child);
  element.querySelector = () => makeElement('div');
  element.querySelectorAll = () => [];
  Object.defineProperty(element, 'selectedOptions', {
    get() {
      return element.options.filter((opt) => opt.value === element.value);
    }
  });
  return element;
}

test('the IDE script returns server failures instead of a static success', async () => {
  const store = new Map();
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement: (tag) => makeElement(tag),
    querySelector: () => makeElement('div'),
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeElement('body')
  };
  const provider = document.getElementById('provider-type');
  provider.value = 'cli:codex';
  provider.options.push({ value: 'cli:codex', textContent: 'ChatGPT (Codex)' });
  const mode = document.getElementById('mode-select');
  mode.value = 'normal';
  mode.options.push({ value: 'normal', textContent: 'Normal' });

  let fetchImpl = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      ok: true,
      type: 'cli',
      cli: 'codex',
      model: 'auto',
      projects: ['my-app'],
      catalog: [],
      tree: [],
      content: ''
    }),
    text: async () => '{"ok":true}'
  });

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    Blob,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Promise,
    Map,
    Set,
    encodeURIComponent,
    decodeURIComponent,
    parseInt,
    isNaN,
    document,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    EventSource: class {
      addEventListener() {}
      close() {}
    },
    navigator: { clipboard: { writeText: async () => {} } },
    location: { hostname: 'localhost', origin: 'http://127.0.0.1', pathname: '/', href: 'http://127.0.0.1/' },
    innerWidth: 1280,
    innerHeight: 800,
    alert() {},
    prompt() { return ''; },
    confirm() { return false; },
    addEventListener() {},
    removeEventListener() {},
    fetch: (...args) => fetchImpl(...args)
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8'), sandbox, { filename: 'public/app.js' });
  assert.equal(typeof sandbox.api, 'function');
  await new Promise((resolve) => setTimeout(resolve, 30));

  const calls = [];
  fetchImpl = async (url) => {
    calls.push(String(url));
    const body = String(url).includes('/api/compile')
      ? { ok: false, error: 'Claude CLI error: claude is not installed.' }
      : { ok: false, error: 'no such route' };
    const text = JSON.stringify(body);
    return {
      ok: false,
      status: String(url).includes('/api/compile') ? 500 : 404,
      statusText: 'error',
      json: async () => body,
      text: async () => text
    };
  };

  const compile = await sandbox.api('/api/compile', { method: 'POST', body: '{}' });
  const unknown = await sandbox.api('/api/not-a-real-route');
  assert.deepEqual(compile, { ok: false, error: 'Claude CLI error: claude is not installed.' });
  assert.equal(compile.previewUrl, undefined);
  assert.deepEqual(unknown, { ok: false, error: 'no such route' });
  assert.notDeepEqual(unknown, { ok: true });
  assert.equal(calls.length, 2);
});
