const express = require('express');
const fs = require('fs');
const path = require('path');
const { runCommandInWorkspace, startBackgroundProcess, stopActiveProcess, isRunning } = require('./runner');
const { buildZipBuffer, buildExeBuffer, getShareUrls } = require('./exporter');
const {
  parseInstructions,
  validateCodeSyntax,
  validateHardMode,
  detectTarget,
  getCodexCatalog,
  resolveCodexBinary,
  resolveGrokBinary,
  grokCliEnv,
  getGrokAuthStatus,
  getBuildHtmlName,
  tryDirectCodeExecution,
  compileWithAI,
  cancelActiveBuild,
  testAIProvider
} = require('./compiler');

const app = express();
const PORT = process.env.PORT || 4321;
const ROOT_DIR = path.resolve(__dirname, '..');
const WORKSPACES_DIR = path.join(ROOT_DIR, 'workspaces');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  })
);
app.use('/vendor/three', express.static(path.join(ROOT_DIR, 'node_modules', 'three', 'build')));

// Ensure default workspace exists and migrate any legacy instructions.txt -> main.py
const DEFAULT_PROJECT = 'my-app';
const DEFAULT_INSTRUCTIONS = `# Type anything you want to build in plain English!
# Press Ctrl+Enter or click "▶ Run".

game = good graphics
view = first person
`;

function ensureDefaultWorkspace() {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  const projDir = path.join(WORKSPACES_DIR, DEFAULT_PROJECT);
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'main.py'), DEFAULT_INSTRUCTIONS, 'utf-8');
  }
  // Migrate any legacy instructions.txt files across workspaces to main.py
  for (const d of fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const wDir = path.join(WORKSPACES_DIR, d.name);
    const oldTxt = path.join(wDir, 'instructions.txt');
    const newPy = path.join(wDir, 'main.py');
    if (fs.existsSync(oldTxt)) {
      if (!fs.existsSync(newPy)) {
        fs.renameSync(oldTxt, newPy);
      } else {
        fs.unlinkSync(oldTxt);
      }
    }
  }
}
ensureDefaultWorkspace();

// Default AI provider: Codex CLI (uses your ChatGPT account directly)
let aiProvider = {
  type: 'cli',
  cli: 'codex',
  label: 'ChatGPT Account (Codex)',
  endpoint: 'local-cli',
  model: 'gpt-6-sol',
  token: ''
};

// SSE clients
const sseClients = new Set();
function emit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`event: process_status\ndata: ${JSON.stringify({ running: isRunning() })}\n\n`);

  req.on('close', () => sseClients.delete(res));
});

// Serve compiled web projects for live preview
app.use('/preview/:project', (req, res, next) => {
  const safeName = path.basename(req.params.project);
  const projDir = path.join(WORKSPACES_DIR, safeName);
  if (!fs.existsSync(projDir)) return res.status(404).send('Project not found');
  express.static(projDir)(req, res, next);
});

function listFilesRecursive(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const children = listFilesRecursive(path.join(dir, entry.name), rel);
      if (children.length) result.push({ name: entry.name, path: rel, type: 'dir', children });
    } else if (entry.name.endsWith('.py')) {
      result.push({ name: entry.name, path: rel, type: 'file' });
    }
  }
  return result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

const STARTER_REPOS = {
  'fps-shooter-repo': {
    title: '3D Tactical FPS Repo',
    desc: '3D arena shooter — edit guns = faster, recoil = zero, enemies = 25, or speed = 2x',
    files: {
      'main.py': `# Repository: 3D Tactical FPS Engine
import engine_3d, physics, weapons, ai_bots

game = 3d tactical arena shooter
view = first person
graphics = 3d realistic shadows + neon muzzle flash

# Tweak weapon & combat mechanics below:
guns = assault_rifle + sniper + plasma_shotgun
fire_rate = fast
recoil = low
ammo = infinite
reload_speed = instant

# Tweak player & enemy stats:
me = tactical soldier
speed = fast
jump_height = high
enemies = 15 smart bots
when headshot:
    damage = 250
    slow_motion = 0.5s
`
    }
  },
  'open-world-driving-repo': {
    title: '3D Open-World Drift & Police Repo',
    desc: '3D city racer — edit car = lamborghini, top_speed = 400, drift = extreme, police = aggressive',
    files: {
      'main.py': `# Repository: 3D Open-World Street Racing & Police Chase
import city_3d, vehicle_physics, traffic_ai

game = 3d open world driving
view = third person follow camera
graphics = 3d sunset + wet asphalt reflections

# Tweak vehicle & handling:
me = twin_turbo supercar
top_speed = 340
acceleration = insane
drift = smooth arcade
nitro = unlimited blue_flames

# Tweak world & police heat:
city = neon highway + downtown ramps
traffic = medium
police = 5 aggressive interceptors
when crash_into_police:
    sparks = heavy
    wanted_level += 1
`
    }
  },
  'pig-survival-3d-repo': {
    title: '3D Piggy Meadow Survival Repo',
    desc: '3D animal sandbox — edit me = pig, size = giant, speed = turbo, world = sunny meadow',
    files: {
      'main.py': `# Repository: 3D Piggy Meadow Sandbox
import terrain_3d, animal_physics, weather_system

game = 3d animal adventure
view = third person + first person toggle
graphics = 3d realistic sunlit grass + soft shadows

# Tweak your character & abilities:
me = pig
speed = fast
jump = bouncy
oink_power = shockwave

# Tweak world & collectibles:
world = rolling hills + oak trees + mud puddles
acorns = 20 golden glowing
farmers = 3 patrolling
when eat_golden_acorn:
    size += 20%
    speed += 15%
`
    }
  },
  'zombie-base-defense-repo': {
    title: 'Zombie Horde & Turret Defense Repo',
    desc: ' Survival shooter — edit turrets = laser, zombies = 100, guns = minigun, barricades = steel',
    files: {
      'main.py': `# Repository: Zombie Horde & Base Defense
import survival_engine, pathfinding, particles

game = 3d survival wave shooter
view = first person + top down build mode
graphics = dark atmospheric fog + dynamic flashlight

# Tweak weapons & turrets:
guns = explosive_minigun + flamethrower
guns_speed = ultra_fast
turrets = 4 auto_laser_turrets
barricades = reinforced_steel

# Tweak zombie waves:
zombies = 40 fast_runners
boss_zombie = giant_brute every 3 waves
starting_cash = 5000
when zombie_killed:
    cash += 100
    gore_particles = high
`
    }
  }
};

function ensureStarterRepos() {
  for (const [repoName, tpl] of Object.entries(STARTER_REPOS)) {
    const projDir = path.join(WORKSPACES_DIR, repoName);
    if (!fs.existsSync(projDir)) {
      fs.mkdirSync(projDir, { recursive: true });
      for (const [fName, fCode] of Object.entries(tpl.files)) {
        fs.writeFileSync(path.join(projDir, fName), fCode, 'utf-8');
      }
    }
  }
}
ensureStarterRepos();

app.get('/api/projects', (req, res) => {
  const dirs = fs
    .readdirSync(WORKSPACES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  res.json({
    projects: dirs,
    catalog: Object.entries(STARTER_REPOS).map(([id, info]) => ({
      id,
      title: info.title,
      desc: info.desc
    }))
  });
});

app.post('/api/repos/import', async (req, res) => {
  const rawInput = String(req.body?.repo || '').trim();
  if (!rawInput) return res.status(400).json({ error: 'Enter a GitHub repository URL or user/repo name.' });

  // Check if it matches a starter repo id
  if (STARTER_REPOS[rawInput]) {
    ensureStarterRepos();
    return res.json({ ok: true, name: rawInput, file: 'main.py' });
  }

  // Extract owner/repo from URL or slug
  const ghMatch = rawInput.match(/(?:github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  const slug = ghMatch ? `${ghMatch[1]}-${ghMatch[2].replace(/\.git$/, '')}` : rawInput.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeName = slug.toLowerCase().slice(0, 48);
  const projDir = path.join(WORKSPACES_DIR, safeName);
  fs.mkdirSync(projDir, { recursive: true });

  let repoDesc = `Imported repository ${rawInput}`;
  let topics = 'interactive, 3d, high_fps';
  if (ghMatch) {
    try {
      const apiRes = await fetch(`https://api.github.com/repos/${ghMatch[1]}/${ghMatch[2].replace(/\.git$/, '')}`, {
        headers: { 'User-Agent': 'CodingOnDrugs-IDE' }
      });
      if (apiRes.ok) {
        const meta = await apiRes.json();
        if (meta.description) repoDesc = meta.description;
        if (Array.isArray(meta.topics) && meta.topics.length) topics = meta.topics.join(', ');
      }
    } catch {}
  }

  const mainPyPath = path.join(projDir, 'main.py');
  if (!fs.existsSync(mainPyPath)) {
    const starterCode = `# Cloned Repository: ${rawInput}
# ${repoDesc}
import repo_core, graphics_engine, physics

repo = "${rawInput}"
features = ${topics}
graphics = 3d good

# Override & mod repository variables below:
me = player
speed = fast
guns = faster
physics = realistic
`;
    fs.writeFileSync(mainPyPath, starterCode, 'utf-8');
  }

  res.json({ ok: true, name: safeName, file: 'main.py' });
});

app.post('/api/projects', (req, res) => {
  const rawName = String(req.body?.name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!rawName) return res.status(400).json({ error: 'Invalid project name' });
  const projDir = path.join(WORKSPACES_DIR, rawName);
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, 'main.py'),
      `# Project: ${rawName}\ngame = interactive\ntheme = dark\n`,
      'utf-8'
    );
  }
  res.json({ name: rawName });
});

app.get('/api/projects/:name/files', (req, res) => {
  const projDir = path.join(WORKSPACES_DIR, path.basename(req.params.name));
  if (!fs.existsSync(projDir)) return res.status(404).json({ error: 'Project not found' });
  res.json({
    tree: listFilesRecursive(projDir),
    hasPreview: fs.existsSync(path.join(projDir, 'index.html'))
  });
});

app.get('/api/projects/:name/file', (req, res) => {
  const safeProject = path.basename(req.params.name);
  const projDir = path.join(WORKSPACES_DIR, safeProject);
  const relPath = String(req.query.path || '');
  const fullPath = path.resolve(projDir, relPath);
  if (!fullPath.startsWith(projDir) || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const buildHtmlName = getBuildHtmlName(relPath);
  const hasFileBuild = fs.existsSync(path.join(projDir, buildHtmlName));
  const previewUrl = hasFileBuild ? `/preview/${safeProject}/${buildHtmlName}?t=${Date.now()}` : null;
  res.json({ path: relPath, content: fs.readFileSync(fullPath, 'utf-8'), previewUrl });
});

app.put('/api/projects/:name/file', (req, res) => {
  const projDir = path.join(WORKSPACES_DIR, path.basename(req.params.name));
  const relPath = String(req.body?.path || '');
  const content = String(req.body?.content ?? '');
  const fullPath = path.resolve(projDir, relPath);
  if (!fullPath.startsWith(projDir)) return res.status(403).json({ error: 'Forbidden' });
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  res.json({ ok: true });
});

app.delete('/api/projects/:name/folder', (req, res) => {
  const projDir = path.join(WORKSPACES_DIR, path.basename(req.params.name));
  const relPath = String(req.query.path || '').trim();
  if (!relPath) return res.status(400).json({ error: 'Folder path is required' });
  const fullPath = path.resolve(projDir, relPath);
  if (!fullPath.startsWith(projDir + path.sep) || fullPath === projDir) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Folder not found' });
  fs.rmSync(fullPath, { recursive: true, force: true });
  res.json({ ok: true });
});

app.delete('/api/projects/:name/file', (req, res) => {
  const projDir = path.join(WORKSPACES_DIR, path.basename(req.params.name));
  const relPath = String(req.query.path || '').trim();
  if (!relPath) return res.status(400).json({ error: 'File path is required' });
  const fullPath = path.resolve(projDir, relPath);
  if (!fullPath.startsWith(projDir + path.sep)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
  fs.unlinkSync(fullPath);
  const buildHtmlName = getBuildHtmlName(relPath);
  const buildHtmlPath = path.join(projDir, buildHtmlName);
  if (fs.existsSync(buildHtmlPath)) {
    try { fs.unlinkSync(buildHtmlPath); } catch {}
  }
  res.json({ ok: true });
});

app.get('/api/projects/:name/export/zip', (req, res) => {
  try {
    const safeName = path.basename(req.params.name);
    const projDir = path.join(WORKSPACES_DIR, safeName);
    if (!fs.existsSync(projDir)) return res.status(404).send('Project not found');
    const buf = buildZipBuffer(projDir, safeName, ROOT_DIR);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
    res.send(buf);
  } catch (err) {
    res.status(500).send(`Export ZIP failed: ${err.message}`);
  }
});

app.get('/api/projects/:name/export/exe', (req, res) => {
  try {
    const safeName = path.basename(req.params.name);
    const projDir = path.join(WORKSPACES_DIR, safeName);
    if (!fs.existsSync(projDir)) return res.status(404).send('Project not found');
    const buf = buildExeBuffer(projDir, safeName, ROOT_DIR);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.exe"`);
    res.send(buf);
  } catch (err) {
    res.status(500).send(`Export EXE failed: ${err.message}`);
  }
});

app.get('/api/projects/:name/share', (req, res) => {
  const safeName = path.basename(req.params.name);
  res.json(getShareUrls(safeName, PORT));
});

app.get('/api/provider', (req, res) => {
  res.json({
    type: aiProvider.type,
    cli: aiProvider.cli,
    label: aiProvider.label,
    endpoint: aiProvider.endpoint,
    model: aiProvider.model,
    hasToken: Boolean(aiProvider.token),
    codexCatalog: getCodexCatalog(),
    grokAuth: getGrokAuthStatus()
  });
});

app.post('/api/provider', (req, res) => {
  const { type, cli, label, endpoint, model, token } = req.body || {};
  aiProvider = {
    type: type || 'cli',
    cli: cli || aiProvider.cli || 'codex',
    label: label || type || 'ChatGPT Account (Codex CLI)',
    endpoint: endpoint || 'http://localhost:11434',
    model: model || 'auto',
    token: token !== undefined ? token : aiProvider.token
  };
  res.json({ ok: true, provider: { ...aiProvider, token: undefined, hasToken: Boolean(aiProvider.token) } });
});

app.post('/api/provider/test', async (req, res) => {
  try {
    const candidate = req.body && req.body.type ? req.body : aiProvider;
    const result = await testAIProvider(candidate);
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

let activeLoginProc = null;

app.post('/api/cli/login', (req, res) => {
  const { execFile, spawn } = require('child_process');
  const requested = req.body?.cli;
  const cli = requested === 'gemini' ? 'gemini' : requested === 'grok' ? 'grok' : 'codex';
  const bin = cli === 'codex' ? resolveCodexBinary() : cli === 'grok' ? resolveGrokBinary() : 'gemini';
  const args = cli === 'codex' ? ['login'] : cli === 'grok' ? ['login', '--oauth'] : [];

  if (cli === 'grok') {
    const status = getGrokAuthStatus();
    if (!status.installed) {
      return res.status(400).json({
        ok: false,
        message: 'Grok CLI is not installed. Install it with: curl -fsSL https://x.ai/cli/install.sh | bash'
      });
    }
    if (activeLoginProc) {
      try { activeLoginProc.kill(); } catch {}
      activeLoginProc = null;
    }

    let responded = false;
    let combined = '';
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: grokCliEnv()
    });
    activeLoginProc = child;

    const handleChunk = (chunk) => {
      combined += chunk.toString().replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
      const urlMatch = combined.match(/https:\/\/(?:auth\.x\.ai|accounts\.x\.ai|accounts\.spacex\.ai|auth\.grok\.com)\/\S+/);
      if (urlMatch && !responded) {
        responded = true;
        res.json({
          ok: true,
          authUrl: urlMatch[0].trim(),
          message: 'Grok sign-in link ready. Open it in your browser to finish OAuth:'
        });
      }
    };

    child.stdout.on('data', handleChunk);
    child.stderr.on('data', handleChunk);
    child.on('error', (err) => {
      if (!responded) {
        responded = true;
        res.status(400).json({
          ok: false,
          message: err.code === 'ENOENT'
            ? 'Grok CLI is not installed. Install it with: curl -fsSL https://x.ai/cli/install.sh | bash'
            : `Grok CLI could not start: ${err.message}`
        });
      }
    });
    child.on('close', () => {
      if (activeLoginProc === child) activeLoginProc = null;
      const auth = getGrokAuthStatus();
      if (auth.loggedIn) emit('auth_updated', { cli: 'grok', grokAuth: auth });
    });
    setTimeout(() => {
      if (!responded) {
        responded = true;
        res.json({
          ok: true,
          message: 'Grok sign-in started. Finish it in the browser window.'
        });
      }
    }, 3000);
    return;
  }

  if (cli === 'codex') {
    if (activeLoginProc) {
      try { activeLoginProc.kill(); } catch {}
      activeLoginProc = null;
    }

    let responded = false;
    let combined = '';
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    activeLoginProc = child;

    const handleChunk = (chunk) => {
      combined += chunk.toString();
      const urlMatch = combined.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\S+/);
      if (urlMatch && !responded) {
        responded = true;
        const authUrl = urlMatch[0].trim();
        res.json({
          ok: true,
          authUrl,
          message: 'Login link ready — copy and paste it in your browser to sign in:'
        });
      }
    };

    child.stdout.on('data', handleChunk);
    child.stderr.on('data', handleChunk);

    child.on('error', (err) => {
      if (!responded) {
        responded = true;
        res.status(400).json({
          ok: false,
          message: `Codex CLI could not start: ${err.message}`
        });
      }
    });

    child.on('close', (code) => {
      if (activeLoginProc === child) activeLoginProc = null;
      const cat = getCodexCatalog();
      if (code === 0 || cat.loggedIn) {
        emit('auth_updated', { cli: 'codex', catalog: cat });
      }
    });

    setTimeout(() => {
      if (!responded) {
        responded = true;
        res.json({
          ok: true,
          message: 'ChatGPT login started — check your browser window to complete sign-in.'
        });
      }
    }, 3000);
    return;
  }

  execFile(bin, ['--version'], { shell: true, timeout: 4000 }, (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        message: `"${cli}" CLI is not installed. Run "npm i -g @google/gemini-cli" in a terminal first.`
      });
    }
    const child = spawn(bin, args, { shell: true, detached: true, stdio: 'ignore' });
    child.unref();
    res.json({
      ok: true,
      message: `Launched "${cli}" — complete sign-in in the window that opens.`
    });
  });
});

app.get('/api/ollama/check', async (req, res) => {
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    if (!r.ok) return res.json({ available: false, models: [] });
    const data = await r.json();
    res.json({ available: true, models: (data.models || []).map((m) => m.name) });
  } catch {
    res.json({ available: false, models: [] });
  }
});

app.post('/api/stop', (req, res) => {
  cancelActiveBuild();
  stopActiveProcess(emit);
  emit('terminal', { stream: 'system', text: '\r\n[stopped] Build and running application stopped.\r\n' });
  emit('process_status', { running: false });
  res.json({ ok: true });
});

app.post('/api/compile', async (req, res) => {
  const { project = DEFAULT_PROJECT, file = 'main.py', source, mode = 'smart', target = 'auto' } = req.body || {};
  const safeProject = path.basename(project);
  const safeFile = path.basename(file || 'main.py');
  const projDir = path.join(WORKSPACES_DIR, safeProject);
  if (!fs.existsSync(projDir)) return res.status(404).json({ error: 'Project not found' });

  // Persist active .py file
  const sourcePath = path.join(projDir, safeFile);
  if (typeof source === 'string') {
    fs.writeFileSync(sourcePath, source, 'utf-8');
  }
  const userSource = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf-8') : (source || '');

  const stage = (id, title, status, detail = '') => {
    emit('pipeline', { id, title, status, detail, timestamp: Date.now() });
  };

  try {
    emit('terminal', { stream: 'system', text: `\r\n=== Build started [${safeProject}/${safeFile}] mode=${mode} ===\r\n` });
    stage('compile', 'Compiling...', 'running', '');

    const syntaxErrors = validateCodeSyntax(userSource);
    if (syntaxErrors.length > 0) {
      stage('compile', 'SyntaxError', 'error', syntaxErrors[0].message);
      emit('diagnostics', { diagnostics: syntaxErrors });
      return res.json({ ok: false, error: syntaxErrors[0].message, diagnostics: syntaxErrors });
    }

    const ir = parseInstructions(userSource, mode);

    if (mode === 'hard') {
      const hardErrors = validateHardMode(userSource, ir);
      if (hardErrors.length > 0) {
        stage('compile', 'Compilation Failed', 'error', hardErrors[0].message);
        hardErrors.forEach((e) => emit('terminal', { stream: 'stderr', text: `[${e.code}] Line ${e.line}: ${e.message}\r\n` }));
        emit('diagnostics', { diagnostics: hardErrors });
        return res.json({ ok: false, error: hardErrors[0].message, diagnostics: hardErrors, ir });
      }
    }
    const irPath = path.join(projDir, 'intent.ir.json');

    const resolvedTarget = detectTarget(ir, userSource, target);
    let written = await tryDirectCodeExecution(userSource, projDir, emit, safeFile);
    const isDirect = Boolean(written);
    if (!written) {
      try {
        written = await compileWithAI({
          provider: aiProvider,
          ir,
          source: userSource,
          activeFile: safeFile,
          target: resolvedTarget,
          projDir,
          emit
        });
      } catch (err) {
        const msg = `${aiProvider.label} error: ${err.message}`;
        const diags = err.diagnostics || [{ severity: 'error', line: 1, code: 'AI-ERROR', message: msg }];
        stage('compile', 'Compilation Failed', 'error', '');
        emit('terminal', { stream: 'stderr', text: `[ai-error] ${msg}\r\n` });
        emit('diagnostics', { diagnostics: diags });
        return res.json({ ok: false, error: msg, diagnostics: diags, ir });
      }
    }

    fs.writeFileSync(irPath, JSON.stringify(ir, null, 2), 'utf-8');
    written.forEach((w) => {
      emit('terminal', { stream: 'stdout', text: `[codegen] ${w.status}: ${w.path}\r\n` });
    });

    if (fs.existsSync(path.join(projDir, 'index.js'))) {
      await runCommandInWorkspace({ command: 'node', args: ['--check', 'index.js'], cwd: projDir, emit });
    }

    const fileBuildHtml = getBuildHtmlName(safeFile);
    let previewUrl = null;
    if (fs.existsSync(path.join(projDir, fileBuildHtml))) {
      previewUrl = `/preview/${safeProject}/${fileBuildHtml}?t=${Date.now()}`;
      emit('terminal', { stream: 'system', text: `[runtime] Live app for ${safeFile} served at ${previewUrl}\r\n` });
    } else if (isDirect && fs.existsSync(path.join(projDir, '_direct_output.html'))) {
      previewUrl = `/preview/${safeProject}/_direct_output.html?t=${Date.now()}`;
      emit('terminal', { stream: 'system', text: `[runtime] Direct output served at ${previewUrl}\r\n` });
    } else if (fs.existsSync(path.join(projDir, 'index.html'))) {
      previewUrl = `/preview/${safeProject}/index.html?t=${Date.now()}`;
      emit('terminal', { stream: 'system', text: `[runtime] Live app served at ${previewUrl}\r\n` });
    } else if (resolvedTarget === 'node' && fs.existsSync(path.join(projDir, 'index.js'))) {
      startBackgroundProcess({ command: 'node', args: ['index.js'], cwd: projDir, emit });
    }
    stage('compile', 'Compiled ✓', 'done', '');

    emit('diagnostics', { diagnostics: [] });
    emit('files_updated', { project: safeProject });
    emit('compile_complete', { ok: true, file: safeFile, target: resolvedTarget, previewUrl, diagnostics: [], ir, written });
    res.json({ ok: true, file: safeFile, target: resolvedTarget, previewUrl, diagnostics: [], ir, written });
  } catch (err) {
    emit('terminal', { stream: 'stderr', text: `[compiler-error] ${err.message}\r\n` });
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Coding On Drugs running at http://localhost:${PORT}`);
});
