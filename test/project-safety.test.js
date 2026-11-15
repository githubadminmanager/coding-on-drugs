const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateCodeSyntax, writeFilesToWorkspace, resolveProjectPath } = require('../server/compiler');

test('an indented statement outside a block is a syntax error', () => {
  const orphan = validateCodeSyntax('speed = 3\n    speed += 15%\n');
  assert.ok(orphan.some((err) => err.code === 'ORPHAN-INDENT' && err.line === 2));

  const block = validateCodeSyntax('if jump:\n    speed += 15%\n');
  assert.equal(block.some((err) => err.code === 'ORPHAN-INDENT'), false);
});

test('the current my-app source reports the unattached speed line', () => {
  const filePath = path.join(__dirname, '..', 'workspaces', 'my-app', 'main.py');
  const source = fs.readFileSync(filePath, 'utf8');
  const errors = validateCodeSyntax(source);
  const hit = errors.find((err) => err.code === 'ORPHAN-INDENT');
  console.log('my-app ORPHAN-INDENT', hit ? JSON.stringify(hit) : 'not reported');
  assert.ok(hit, 'expected the unattached indented line to be reported');
  assert.match(source.split(/\r?\n/)[hit.line - 1], /speed \+= 15%/);
});

test('compiler writes cannot leave the project directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cod-safe-'));
  const project = path.join(root, 'my-app');
  const sibling = path.join(root, 'my-app-evil');
  fs.mkdirSync(project);
  fs.mkdirSync(sibling);
  const siblingFile = path.join(sibling, 'secret.txt');
  const parentFile = path.join(root, 'secret.txt');
  try {
    assert.equal(resolveProjectPath(project, '../my-app-evil/secret.txt'), null);
    assert.equal(resolveProjectPath(project, '../secret.txt'), null);
    assert.equal(resolveProjectPath(project, 'nested/ok.html').startsWith(project + path.sep), true);

    assert.throws(() => writeFilesToWorkspace(project, { '../my-app-evil/secret.txt': 'nope' }), /outside the project/);
    assert.equal(fs.existsSync(siblingFile), false);
    assert.throws(() => writeFilesToWorkspace(project, { '../secret.txt': 'nope' }), /outside the project/);
    assert.equal(fs.existsSync(parentFile), false);
    assert.throws(
      () => writeFilesToWorkspace(project, { 'ok.html': 'safe', '../my-app-evil/secret.txt': 'nope' }),
      /outside the project/
    );
    assert.equal(fs.existsSync(path.join(project, 'ok.html')), false);
    assert.equal(fs.existsSync(siblingFile), false);

    const written = writeFilesToWorkspace(project, { 'nested/ok.html': '<p>ok</p>' });
    assert.equal(fs.readFileSync(path.join(project, 'nested', 'ok.html'), 'utf8'), '<p>ok</p>');
    assert.equal(written[0].path, 'nested/ok.html');
    assert.equal(fs.existsSync(siblingFile), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
