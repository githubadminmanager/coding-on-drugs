const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const workspaces = path.join(repoRoot, 'workspaces');
const STUB = /repo_core|guns = faster/;

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

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

test('github import stores the repository and refuses a missing one', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const base = `http://127.0.0.1:${port}`;
  const projectDir = path.join(workspaces, 'octocat-hello-world');
  const missingDir = path.join(workspaces, 'octocat-this-repo-does-not-exist-cod-zz'.slice(0, 48));
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });
  try {
    let up = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${base}/api/provider`)).ok) {
          up = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!up) throw new Error(`server did not start\n${log}`);

    async function importRepo(repo) {
      const res = await fetch(`${base}/api/repos/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });
      const body = await res.json();
      return { status: res.status, body };
    }

    for (let pass = 1; pass <= 2; pass++) {
      const result = await importRepo('octocat/Hello-World');
      console.log(`import pass ${pass}`, result.status, JSON.stringify(result.body));
      assert.equal(result.body.ok, true, JSON.stringify(result.body));
      const readme = path.join(projectDir, 'README');
      assert.equal(fs.existsSync(readme), true);
      const files = walkFiles(projectDir);
      const blob = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
      assert.equal(STUB.test(blob), false);
      assert.match(fs.readFileSync(readme, 'utf8'), /Hello World/i);
    }

    const missing = await importRepo('octocat/this-repo-does-not-exist-cod-zz');
    console.log('import missing', missing.status, JSON.stringify(missing.body));
    assert.equal(missing.body.ok, false);
    assert.equal(fs.existsSync(missingDir), false);
    const after = walkFiles(projectDir).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    assert.equal(STUB.test(after), false);
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(missingDir, { recursive: true, force: true });
  }
});
