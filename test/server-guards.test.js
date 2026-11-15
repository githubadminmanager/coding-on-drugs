const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const repo = path.join(__dirname, '..');
const workspaces = path.join(repo, 'workspaces');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function bootServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: repo,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/api/provider`);
      if (res.ok) {
        up = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!up) {
    child.kill('SIGKILL');
    throw new Error(`server did not start\n${log}`);
  }
  return {
    base,
    log: () => log,
    stop() {
      child.kill('SIGTERM');
    }
  };
}

test('project file routes reject paths outside the project', async () => {
  const server = await bootServer();
  const project = 'cod-path-test';
  const siblingDir = path.join(workspaces, `${project}-evil`);
  const siblingFile = path.join(siblingDir, 'secret.txt');
  const parentFile = path.join(workspaces, 'cod-path-secret.txt');
  try {
    const providerRes = await fetch(`${server.base}/api/provider`);
    const provider = await providerRes.json();
    assert.equal(typeof provider.type, 'string');
    assert.equal(typeof provider.model, 'string');
    assert.ok(provider.type);
    assert.ok(provider.model.length >= 0);

    const created = await fetch(`${server.base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: project })
    });
    assert.equal(created.ok, true);

    const escapes = ['../cod-path-secret.txt', `../${project}-evil/secret.txt`];
    for (const rel of escapes) {
      const put = await fetch(`${server.base}/api/projects/${project}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: rel, content: 'nope' })
      });
      assert.ok(put.status === 403 || put.status === 404, `PUT ${rel} status ${put.status}`);
      const got = await fetch(`${server.base}/api/projects/${project}/file?path=${encodeURIComponent(rel)}`);
      assert.ok(got.status === 403 || got.status === 404, `GET ${rel} status ${got.status}`);
      const body = await got.text();
      assert.equal(body.includes('nope'), false);
      const del = await fetch(`${server.base}/api/projects/${project}/file?path=${encodeURIComponent(rel)}`, { method: 'DELETE' });
      assert.ok(del.status === 403 || del.status === 404, `DELETE ${rel} status ${del.status}`);
    }
    assert.equal(fs.existsSync(siblingFile), false);
    assert.equal(fs.existsSync(parentFile), false);
    assert.equal(fs.existsSync(siblingDir), false);
  } finally {
    server.stop();
    fs.rmSync(path.join(workspaces, project), { recursive: true, force: true });
    fs.rmSync(siblingDir, { recursive: true, force: true });
    fs.rmSync(parentFile, { force: true });
  }
});

test('compile uses the engine named in the request', async () => {
  const server = await bootServer();
  const project = 'cod-engine-test';
  try {
    const before = await (await fetch(`${server.base}/api/provider`)).json();
    assert.equal(before.type, 'cli');
    assert.equal(before.cli, 'codex');
    assert.equal(typeof before.model, 'string');

    await fetch(`${server.base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: project })
    });

    const res = await fetch(`${server.base}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        file: 'main.py',
        source: 'game = box\n',
        mode: 'normal',
        target: 'auto',
        provider: { type: 'cli', cli: 'claude', model: 'sonnet', label: 'Claude CLI' }
      })
    });
    const body = await res.json();
    const text = JSON.stringify(body);
    console.log('compile-provider', text);
    assert.match(text, /claude/i);
    assert.doesNotMatch(text, /Codex|ChatGPT|gpt-6/);
    const after = await (await fetch(`${server.base}/api/provider`)).json();
    assert.equal(after.cli, 'codex');
    assert.equal(after.model, before.model);
  } finally {
    server.stop();
    fs.rmSync(path.join(workspaces, project), { recursive: true, force: true });
  }
});
