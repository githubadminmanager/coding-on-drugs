try {
  localStorage.removeItem('cod_last_preview_html');
} catch {}

const state = {
  project: 'my-app',
  openFiles: {}, // path -> content
  activeFile: 'main.py',
  editor: null,
  usingFallback: false,
  pipeline: {},
  backendOrigin: ''
};

const el = (id) => document.getElementById(id);

// --- Monaco Setup with Rich Colors, Auto-Indent & Ghost Suggestions ---
function initEditor(initialContent) {
  if (typeof window.require === 'function') {
    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    window.require(
      ['vs/editor/editor.main'],
      () => {
        monaco.languages.register({ id: 'intentlang' });

        monaco.languages.setLanguageConfiguration('intentlang', {
          comments: { lineComment: '//' },
          brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
          ],
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          indentationRules: {
            increaseIndentPattern: /^\s*(if|elif|else|when|whenever|while|for|every|repeat|def|function|class|on)\b.*$|.*(:|\{)\s*$/i,
            decreaseIndentPattern: /^\s*(else|elif|end|done|\})\b.*$/i
          },
          onEnterRules: [
            {
              beforeText: /^\s*(if|elif|else|when|whenever|while|for|every|repeat|def|function|class|on)\b.*$/i,
              action: { indentAction: monaco.languages.IndentAction.Indent }
            }
          ]
        });

        monaco.languages.setMonarchTokensProvider('intentlang', {
          ignoreCase: true,
          keywordsControl: [
            'import', 'from', 'export', 'use', 'include', 'require',
            'if', 'elif', 'else', 'when', 'whenever', 'while', 'for', 'every', 'repeat',
            'then', 'do', 'end', 'return', 'break', 'continue', 'on', 'after', 'before',
            'and', 'or', 'not', 'in', 'to', 'with', 'as', 'is', 'has'
          ],
          keywordsAction: [
            'create', 'make', 'spawn', 'build', 'add', 'remove', 'delete', 'destroy',
            'set', 'change', 'update', 'move', 'walk', 'run', 'jump', 'fly', 'drive',
            'shoot', 'attack', 'defend', 'heal', 'damage', 'explode', 'follow', 'chase',
            'play', 'stop', 'pause', 'show', 'hide', 'enable', 'disable', 'load', 'save',
            'render', 'draw', 'print', 'say', 'give', 'take', 'open', 'close', 'lock', 'unlock'
          ],
          keywordsEntity: [
            'game', 'app', 'simulation', 'sim', 'calculator', 'calc', 'program', 'tool', 'dashboard',
            'world', 'scene', 'level', 'map', 'arena', 'city', 'room',
            'player', 'character', 'hero', 'car', 'cars', 'vehicle', 'npc', 'npcs',
            'police', 'enemy', 'enemies', 'boss', 'zombie', 'zombies', 'bot', 'bots',
            'camera', 'view', 'graphics', 'shader', 'lighting', 'shadows', 'sky',
            'physics', 'gravity', 'particles', 'fluid', 'orbit', 'graph', 'chart',
            'speed', 'velocity', 'health', 'damage', 'score',
            'money', 'coins', 'points', 'xp', 'inventory', 'weapon', 'weapons', 'gun',
            'weather', 'time', 'music', 'sound', 'audio', 'ui', 'hud', 'menu', 'button',
            'theme', 'color', 'background', 'style', 'font', 'size', 'count',
            'def', 'function', 'class', 'let', 'const', 'var', 'rule', 'system'
          ],
          keywordsConstant: [
            'true', 'false', 'yes', 'no', 'none', 'zero', 'null', 'empty',
            'infinite', 'unlimited', 'max', 'maximum', 'min', 'minimum',
            'alot', 'many', 'few', 'some', 'all', 'auto', 'default'
          ],
          keywordsTrait: [
            '3d', '2d', 'first', 'person', 'third', 'top', 'down', 'isometric', 'vr',
            'good', 'great', 'best', 'insane', 'ultra', 'high', 'low', 'medium', 'realistic',
            'fast', 'slow', 'smooth', 'aggressive', 'passive', 'friendly', 'hostile',
            'smart', 'intelligent', 'human', 'indestructible', 'invincible', 'immortal',
            'massive', 'huge', 'giant', 'big', 'small', 'tiny', 'dark', 'light', 'neon',
            'glowing', 'modern', 'retro', 'pixel', 'red', 'blue', 'green', 'yellow',
            'gold', 'purple', 'pink', 'cyan', 'orange', 'white', 'black', 'night', 'day',
            'rain', 'snow', 'fog', 'storm', 'sunny'
          ],
          tokenizer: {
            root: [
              [/(\/\/|#).*$/, 'comment'],
              [/"([^"\\]|\\.)*"/, 'string'],
              [/'([^'\\]|\\.)*'/, 'string'],
              [/\b\d+(\.\d+)?(fps|px|ms|s|m|km|%)?\b/, 'number'],
              [/^\s*([a-zA-Z_][\w\s]*?)(?=\s*(=|:|->))/, 'variable.property'],
              [/(=>|->|==|!=|>=|<=|=|:|\+|-|\*|\/|>|<)/, 'operator'],
              [/[{}()\[\]]/, 'delimiter.bracket'],
              [
                /[a-zA-Z_]\w*/,
                {
                  cases: {
                    '@keywordsControl': 'keyword.control',
                    '@keywordsAction': 'entity.name.function',
                    '@keywordsEntity': 'type.identifier',
                    '@keywordsConstant': 'constant.language',
                    '@keywordsTrait': 'string.value',
                    '@default': 'identifier'
                  }
                }
              ]
            ]
          }
        });

        monaco.editor.defineTheme('studio-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'keyword.control', foreground: 'FF7B72', fontStyle: 'bold' },
            { token: 'entity.name.function', foreground: 'DCDCAA', fontStyle: 'bold' },
            { token: 'type.identifier', foreground: '4EC9B0', fontStyle: 'bold' },
            { token: 'variable.property', foreground: '9CDCFE' },
            { token: 'constant.language', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'string.value', foreground: 'CE9178' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'operator', foreground: '56B6C2', fontStyle: 'bold' },
            { token: 'delimiter.bracket', foreground: 'FFD700' },
            { token: 'identifier', foreground: 'D4D4D4' }
          ],
          colors: {
            'editor.background': '#2b2d30',
            'editor.lineHighlightBackground': '#323439',
            'editorIndentGuide.background1': '#3d4047',
            'editorIndentGuide.activeBackground1': '#565a64'
          }
        });

        const SUGGESTIONS = [
          { label: 'print', insertText: 'print ${1:hello 123}', detail: 'Instant output (runs directly without AI)', kind: monaco.languages.CompletionItemKind.Function },
          { label: 'simulation', insertText: 'simulation = ${1:gravity particles with sliders}', detail: 'Create an interactive simulation', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'calculator', insertText: 'calculator = ${1:scientific with history and graphing}', detail: 'Create a custom calculator program', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'program', insertText: 'program = ${1:interactive dashboard}', detail: 'Create a utility or desktop program', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'if', insertText: 'if ${1:player touches enemy}:\n    ${2:health = health - 10}', detail: 'Conditional block (auto-indented)', kind: monaco.languages.CompletionItemKind.Snippet },
          { label: 'when', insertText: 'when ${1:key space pressed}:\n    ${2:player = jump}', detail: 'Event trigger block (auto-indented)', kind: monaco.languages.CompletionItemKind.Snippet },
          { label: 'every', insertText: 'every ${1:5 seconds}:\n    ${2:spawn = enemy}', detail: 'Timer loop block (auto-indented)', kind: monaco.languages.CompletionItemKind.Snippet },
          { label: 'import', insertText: 'import ${1:physics, lighting, audio}', detail: 'Import module or system', kind: monaco.languages.CompletionItemKind.Keyword },
          { label: 'game', insertText: 'game = ${1:good graphics}', detail: 'Set core game style', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'view', insertText: 'view = ${1:first person}', detail: 'Camera perspective (first person / third person / 3d)', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'graphics', insertText: 'graphics = ${1:3d realistic}', detail: 'Visual rendering quality', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'player', insertText: 'player = ${1:fast}', detail: 'Configure player traits', kind: monaco.languages.CompletionItemKind.Variable },
          { label: 'npc', insertText: 'npc = ${1:alot}', detail: 'Configure NPC count or behavior', kind: monaco.languages.CompletionItemKind.Variable },
          { label: 'enemy', insertText: 'enemy = ${1:aggressive}', detail: 'Configure enemy AI', kind: monaco.languages.CompletionItemKind.Variable },
          { label: 'physics', insertText: 'physics = ${1:realistic}', detail: 'Configure physics & gravity', kind: monaco.languages.CompletionItemKind.Property },
          { label: 'weather', insertText: 'weather = ${1:night neon}', detail: 'Set lighting & atmosphere', kind: monaco.languages.CompletionItemKind.Property }
        ];

        monaco.languages.registerCompletionItemProvider('intentlang', {
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn
            };
            return {
              suggestions: SUGGESTIONS.map((s) => ({
                label: s.label,
                kind: s.kind,
                detail: s.detail,
                insertText: s.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range
              }))
            };
          }
        });

        monaco.languages.registerInlineCompletionsProvider('intentlang', {
          provideInlineCompletions: (model, position) => {
            const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
            const trimmed = line.trim();
            if (!trimmed) return { items: [] };

            const ghostMap = [
              { match: /^print\s*$/i, text: ' hello 123' },
              { match: /^simulation\s*$/i, text: ' = gravity particles with sliders' },
              { match: /^calculator\s*$/i, text: ' = scientific with history' },
              { match: /^program\s*$/i, text: ' = interactive tool' },
              { match: /^if\s*$/i, text: ' player touches coin:\n    score = score + 10' },
              { match: /^if\s+[a-z0-9_\s]+$/i, text: ':\n    ' },
              { match: /^when\s*$/i, text: ' space pressed:\n    player = jump' },
              { match: /^import\s*$/i, text: ' 3d, physics, lighting' },
              { match: /^game\s*$/i, text: ' = 3d good graphics' },
              { match: /^view\s*$/i, text: ' = first person' },
              { match: /^npc\s*$/i, text: ' = alot' },
              { match: /^player\s*$/i, text: ' = fast' },
              { match: /^graphics\s*$/i, text: ' = realistic neon' }
            ];

            for (const g of ghostMap) {
              if (g.match.test(trimmed)) {
                return {
                  items: [
                    {
                      insertText: g.text,
                      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
                    }
                  ]
                };
              }
            }
            return { items: [] };
          },
          freeInlineCompletions: () => {}
        });

        state.editor = monaco.editor.create(el('monaco-host'), {
          value: state.openFiles[state.activeFile] ?? initialContent,
          language: 'intentlang',
          theme: 'studio-dark',
          automaticLayout: true,
          fontSize: 14,
          tabSize: 4,
          insertSpaces: true,
          autoIndent: 'full',
          formatOnType: true,
          inlineSuggest: { enabled: true },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          minimap: { enabled: false },
          scrollBeyondLastLine: false
        });
        applyEditorSettings();

        // Auto-format ugly lines when pressing Enter (adds clean spacing around = and : on if/when blocks)
        state.editor.onKeyDown((e) => {
          if (el('setting-auto-format') && !el('setting-auto-format').checked) return;
          if (e.keyCode === monaco.KeyCode.Enter && !e.ctrlKey && !e.metaKey && state.activeFile.endsWith('.py')) {
            const pos = state.editor.getPosition();
            const model = state.editor.getModel();
            const lineContent = model.getLineContent(pos.lineNumber);
            const indentMatch = lineContent.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            const trimmed = lineContent.trim();

            if (/^(if|elif|when|whenever|while|for|every|repeat)\b/i.test(trimmed) && !trimmed.endsWith(':') && !trimmed.endsWith('{')) {
              e.preventDefault();
              e.stopPropagation();
              const fixedLine = `${indent}${trimmed}:`;
              const nextIndent = `${indent}    `;
              model.pushEditOperations(
                [],
                [
                  {
                    range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, lineContent.length + 1),
                    text: `${fixedLine}\n${nextIndent}`
                  }
                ],
                () => null
              );
              state.editor.setPosition({ lineNumber: pos.lineNumber + 1, column: nextIndent.length + 1 });
              return;
            }

            const eqMatch = trimmed.match(/^([a-zA-Z0-9_\s]+?)\s*=\s*(.+)$/);
            if (eqMatch && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
              const cleanLine = `${indent}${eqMatch[1].trim()} = ${eqMatch[2].trim()}`;
              if (cleanLine !== lineContent) {
                model.pushEditOperations(
                  [],
                  [{ range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, lineContent.length + 1), text: cleanLine }],
                  () => null
                );
              }
            }
          }
        });

        state.editor.onDidChangeModelContent(() => {
          const val = state.editor.getValue();
          state.openFiles[state.activeFile] = val;
          scheduleAutoSave(state.activeFile, val);
        });

        state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, compileAndRun);
      },
      () => activateFallbackEditor(initialContent)
    );
  } else {
    activateFallbackEditor(initialContent);
  }
}

let autoSaveTimer = null;
function saveSessionLocal() {
  try {
    localStorage.setItem(
      'cod_session_v1',
      JSON.stringify({
        project: state.project,
        activeFile: state.activeFile,
        openFiles: state.openFiles,
        mode: el('mode-select') ? el('mode-select').value : 'smart'
      })
    );
  } catch {}
}

function scheduleAutoSave(filePath, content) {
  staticStore.files[filePath] = content;
  saveStaticFiles();
  saveSessionLocal();
  if (el('setting-auto-save') && !el('setting-auto-save').checked) return;
  const st = el('status-process');
  if (st && (st.textContent === 'Idle' || st.textContent.startsWith('Saved'))) {
    st.textContent = `Saved ${filePath} ✓`;
  }
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    await api(`/api/projects/${state.project}/file`, {
      method: 'PUT',
      keepalive: true,
      body: JSON.stringify({ path: filePath, content })
    }).catch(() => {});
  }, 80);
}

function flushActiveFileSave() {
  if (state.activeFile) {
    const val = getEditorValue();
    state.openFiles[state.activeFile] = val;
    staticStore.files[state.activeFile] = val;
    saveStaticFiles();
    saveSessionLocal();
    try {
      const base = state.backendOrigin || (window.location.hostname.endsWith('github.io') ? 'http://localhost:4321' : '');
      fetch(`${base}/api/projects/${state.project}/file`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.activeFile, content: val })
      }).catch(() => {});
    } catch {}
  }
}

window.addEventListener('beforeunload', flushActiveFileSave);
window.addEventListener('pagehide', flushActiveFileSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushActiveFileSave();
});

function activateFallbackEditor(initialContent) {
  state.usingFallback = true;
  el('monaco-host').style.display = 'none';
  const ta = el('fallback-editor');
  ta.style.display = 'block';
  ta.value = initialContent;
  ta.addEventListener('input', () => {
    state.openFiles[state.activeFile] = ta.value;
    scheduleAutoSave(state.activeFile, ta.value);
  });
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      compileAndRun();
    }
  });
}

function getEditorValue() {
  if (state.editor) return state.editor.getValue();
  return el('fallback-editor').value;
}

function setEditorValue(content, filename) {
  if (state.editor) {
    const ext = filename.split('.').pop();
    const langMap = { py: 'intentlang', txt: 'intentlang', js: 'javascript', html: 'html', css: 'css', json: 'json' };
    monaco.editor.setModelLanguage(state.editor.getModel(), langMap[ext] || 'intentlang');
    state.editor.setValue(content);
  } else {
    el('fallback-editor').value = content;
  }
}

// --- API Helpers (with seamless GitHub Pages / static web mode fallback) ---
const staticStore = {
  files: JSON.parse(localStorage.getItem('cod_clean_files_v2') || 'null') || {
    'main.py': '# Write your code below and click ▶ Run (Ctrl+Enter)\n'
  },
  previews: {},
  compiledHtmlByFile: {},
  provider: { type: 'cli', cli: 'codex', label: 'ChatGPT Account (Codex)', model: 'auto', endpoint: 'local-cli', token: '' }
};

function saveStaticFiles() {
  try { localStorage.setItem('cod_clean_files_v2', JSON.stringify(staticStore.files)); } catch {}
}

function parseStaticIR(source, mode) {
  const entities = {};
  const lines = (source || '').split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const m = line.match(/^([a-zA-Z0-9_\s]+?)\s*(?:=|:)\s*(.+)$/);
    if (m) {
      const k = m[1].trim().toLowerCase();
      entities[k] = { traits: m[2].split(/[,+]/).map((s) => s.trim()).filter(Boolean), line: idx + 1 };
    }
  });
  return { mode, entities };
}

const STATIC_STARTER_REPOS = {
  'fps-shooter-repo': {
    title: '3D Tactical FPS Repo',
    desc: '3D arena shooter — edit guns = faster, recoil = zero, enemies = 25, or speed = 2x',
    code: `# Repository: 3D Tactical FPS Engine
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
  },
  'open-world-driving-repo': {
    title: '3D Open-World Drift & Police Repo',
    desc: '3D city racer — edit car = lamborghini, top_speed = 400, drift = extreme, police = aggressive',
    code: `# Repository: 3D Open-World Street Racing & Police Chase
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
  },
  'pig-survival-3d-repo': {
    title: '3D Piggy Meadow Survival Repo',
    desc: '3D animal sandbox — edit me = pig, size = giant, speed = turbo, world = sunny meadow',
    code: `# Repository: 3D Piggy Meadow Sandbox
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
  },
  'zombie-base-defense-repo': {
    title: 'Zombie Horde & Turret Defense Repo',
    desc: 'Survival shooter — edit turrets = laser, zombies = 100, guns = minigun, barricades = steel',
    code: `# Repository: Zombie Horde & Base Defense
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
};

const STATIC_KNOWN_CONSONANT_WORDS = new Set([
  'fps', '3d', '2d', 'html', 'css', 'js', 'svg', 'npc', 'npcs', 'hud', 'ui', 'vx', 'vy', 'vz',
  'dx', 'dy', 'dz', 'rgb', 'rgba', 'hsl', 'btn', 'txt', 'xp', 'hp', 'mp', 'kb', 'mb', 'gb',
  'str', 'int', 'ptr', 'sys', 'cmd', 'src', 'dst', 'tmp', 'rng', 'ai', 'vr', 'ar', 'fx', 'sfx',
  'bgm', 'px', 'ms', 'wasd', 'ctrl', 'shift', 'esc', 'glsl', 'webgl', 'http', 'https', 'url', 'www',
  'ttf', 'png', 'jpg', 'mp3', 'wav', 'json', 'xml', 'py', 'ts', 'tsx', 'jsx', 'cpp', 'csharp'
]);

function looksLikeStaticGibberish(word) {
  const w = word.toLowerCase();
  if (!w || w.length <= 2 || STATIC_KNOWN_CONSONANT_WORDS.has(w) || /^\d+$/.test(w)) return false;
  if (/^(asdf|qwer|zxcv|hjkl|fdsa|poiuy|lkjh|mnbv|blah|bruh|lol|lmao|rofl|idk|whatever|gibberish|nothing|none|null|undefined|foo|bar|baz|qwerty|abcde|xyz)+$/i.test(w)) {
    return true;
  }
  if (/(.)\1{3,}/.test(w)) return true;
  if (/^[a-z]+$/.test(w) && /[bcdfghjklmnpqrstvwxyz]{5,}/.test(w)) return true;
  if (/^[a-z]{6,}$/.test(w) && !/[aeiouy]/.test(w)) return true;
  return false;
}

function validateStaticCodeSyntax(source) {
  if (el('setting-strict-syntax') && !el('setting-strict-syntax').checked) return [];
  const errors = [];
  const lines = (source || '').split(/\r?\n/);
  const codeLines = [];

  lines.forEach((raw, idx) => {
    const lineNum = idx + 1;
    const t = raw.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) return;
    codeLines.push({ lineNum, t });

    const eqMatch = t.match(/^([a-zA-Z_][\w\s.]*?)\s*(=|:|->|\+=|-=|\*=|\/=)\s*(.+)$/);
    const isControlBlock = /^(if|elif|else|when|whenever|while|for|every|repeat|def|function|class|on|try|except|finally)\b.*(:|\{)?$/i.test(t);
    const isKeywordStmt = /^(import|from|use|include|require|print|return|break|continue|pass|end|done|spawn|delete|remove|\})\b/i.test(t);
    const isFuncCall = /^[a-zA-Z_][\w.]*\s*\(.*\)$/.test(t);

    if (!eqMatch && !isControlBlock && !isKeywordStmt && !isFuncCall) {
      errors.push({
        severity: 'error',
        line: lineNum,
        code: 'SYNTAX-ERR',
        message: `SyntaxError on line ${lineNum}: Invalid statement "${t}". You cannot write plain English sentences — use code syntax like: game = 3d, graphics = good, guns = faster, or if/when blocks.`
      });
      return;
    }

    const strippedQuotes = t.replace(/"[^"]*"|'[^']*'/g, '');
    const tokens = strippedQuotes.match(/[a-zA-Z0-9_]+/g) || [];
    for (const tok of tokens) {
      if (looksLikeStaticGibberish(tok)) {
        errors.push({
          severity: 'error',
          line: lineNum,
          code: 'GIBBERISH-ERR',
          message: `CompilerError on line ${lineNum}: "${tok}" looks like nonsense/gibberish. Write real code properties and values.`
        });
        return;
      }
    }

    if (eqMatch) {
      const k = eqMatch[1].trim().toLowerCase();
      const v = eqMatch[3].trim().toLowerCase();
      if (/^(idk|whatever|something|stuff|things|nothing|none|null|asdf|blah|test)$/i.test(v)) {
        errors.push({
          severity: 'error',
          line: lineNum,
          code: 'VAGUE-VAL',
          message: `CompilerError on line ${lineNum}: "${k} = ${eqMatch[3].trim()}" is a placeholder/nonsense value. Specify what "${k}" actually should be.`
        });
      }
    }
  });

  if (!codeLines.length) {
    errors.push({
      severity: 'error',
      line: 1,
      code: 'EMPTY-FILE',
      message: 'SyntaxError: File has no executable statements. Write code like: game = 3d, player = fast, controls = wasd'
    });
    return errors;
  }

  if (errors.length === 0 && codeLines.length === 1) {
    const only = codeLines[0].t.toLowerCase();
    const hasCoreSubject =
      /^(print|import|from|def|class|if|when|every)\b/.test(only) ||
      /^(game|app|simulation|sim|calculator|calc|program|tool|dashboard|world|scene|me|player|car|hero|screen|window)\b/.test(only) ||
      /^[a-zA-Z_]\w*\s*\(.*\)$/.test(only);
    if (!hasCoreSubject) {
      errors.push({
        severity: 'error',
        line: codeLines[0].lineNum,
        code: 'INCOMPLETE-PROGRAM',
        message: `IncompleteCodeError: "${codeLines[0].t}" alone is not enough to build an app. Define what you're building first (e.g. "game = 3d", "player = fast", "simulation = gravity", or "print ...").`
      });
    }
  }

  return errors;
}

function validateStaticHardMode(source, ir) {
  return [];
}

function tryStaticDirectCode(source) {
  const lines = (source || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  if (!lines.length) return null;
  const full = lines.join('\n');
  if (
    /\b(game|app|simulation|sim|calculator|calc|program|tool|dashboard|world|scene|view|camera|graphics|shader|lighting|weather|player|npc|enemy|car|zombie|physics|gravity|particles|fluid|orbit|screen|window|theme|ui|button|menu|hud|sound|music|spawn|draw|render|3d|2d|good|realistic|alot)\b/i.test(
      full
    )
  ) {
    return null;
  }
  if (!lines.some((l) => /^print\b/i.test(l) || /^[a-zA-Z_]\w*\s*=\s*[\d"'\[\(\{]/.test(l))) {
    return null;
  }

  const scope = {};
  const outputs = [];
  for (const line of lines) {
    const assign = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assign && !/^print\b/i.test(line)) {
      const k = assign[1];
      const rawExpr = assign[2].trim();
      try {
        const fn = new Function(...Object.keys(scope), `return (${rawExpr});`);
        scope[k] = fn(...Object.values(scope));
      } catch {
        scope[k] = rawExpr.replace(/^["']|["']$/g, '');
      }
      continue;
    }
    const pm = line.match(/^print\s*(?:\((.*)\)|(.+))$/i);
    if (pm) {
      const rawExpr = (pm[1] !== undefined ? pm[1] : pm[2]).trim();
      try {
        const fn = new Function(...Object.keys(scope), `return (${rawExpr});`);
        outputs.push(String(fn(...Object.values(scope))));
      } catch {
        outputs.push(rawExpr.replace(/^["']|["']$/g, ''));
      }
    }
  }
  if (!outputs.length) return null;
  const escaped = outputs
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #2b2d30; color: #f1f3f5; font-family: Consolas, 'Courier New', monospace; padding: 24px; height: 100vh; display: flex; flex-direction: column; gap: 14px; }
  .header { font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; color: #b5bac4; text-transform: uppercase; border-bottom: 1px solid #43464d; padding-bottom: 10px; display: flex; justify-content: space-between; }
  .badge { color: #59a869; }
  pre { background: #313338; border: 1px solid #43464d; border-radius: 8px; padding: 18px; font-size: 16px; line-height: 1.6; color: #ffffff; white-space: pre-wrap; word-break: break-word; flex: 1; overflow: auto; }
</style>
</head>
<body>
  <div class="header">
    <span>Direct Code Output</span>
    <span class="badge">⚡ Instant Execution (No AI Needed)</span>
  </div>
  <pre>${escaped}</pre>
</body>
</html>`;
}

function extractBrowserHtml(rawText) {
  if (!rawText) return null;
  const blockMatch = rawText.match(/===FILE:\s*[^\r\n=]+?===\r?\n([\s\S]*?)\r?\n===END FILE===/);
  if (blockMatch) return blockMatch[1].trim();
  const fenceMatch = rawText.match(/```(?:html|htm)\r?\n([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const htmlIdx = rawText.search(/<!DOCTYPE html>|<html[\s>]/i);
  if (htmlIdx !== -1) return rawText.slice(htmlIdx).trim();
  return null;
}

async function callBrowserAI(provider, promptText) {
  const tok = (provider.token || '').trim();
  const isGem = provider.type === 'gemini-api' || tok.startsWith('AIza') || (provider.endpoint || '').includes('googleapis.com');
  if (isGem) {
    if (!tok) throw new Error('Paste your Google Gemini API key (starts with AIza...) in Settings -> API Key.');
    const model = provider.model && provider.model.startsWith('gemini') ? provider.model : 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(tok)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API HTTP ${res.status}: ${errText.slice(0, 140)}`);
    }
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
  }

  if (provider.type === 'ollama') {
    const ep = (provider.endpoint || 'http://localhost:11434').replace(/\/$/, '');
    const res = await fetch(`${ep}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model || 'llama3.2', stream: false, messages: [{ role: 'user', content: promptText }] })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
  }

  if (provider.type === 'grok') {
    throw new Error('Grok uses browser sign-in. Start the local server with npm start, then click Sign in with Grok.');
  }

  if (provider.type === 'openai-compatible') {
    if (!tok) throw new Error('Paste your API Key in Settings -> API Key first.');
    const ep = (provider.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = provider.model && !provider.model.includes('-sol') && !provider.model.includes('-luna') ? provider.model : 'gpt-4o-mini';
    const res = await fetch(`${ep}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: promptText }] })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API HTTP ${res.status}: ${errText.slice(0, 140)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error('Start the local server (`npm start`) to use ChatGPT Codex CLI, or select "Google Gemini API Key" / "OpenAI API Key" in Settings.');
}

async function handleStaticApi(url, opts = {}) {
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (url === '/api/projects') {
    const projects = ['my-app', ...Object.keys(STATIC_STARTER_REPOS)];
    return {
      projects,
      catalog: Object.entries(STATIC_STARTER_REPOS).map(([id, info]) => ({
        id,
        title: info.title,
        desc: info.desc
      }))
    };
  }
  if (url === '/api/repos/import') {
    const raw = String(body.repo || '').trim();
    if (STATIC_STARTER_REPOS[raw]) {
      staticStore.files['main.py'] = STATIC_STARTER_REPOS[raw].code;
      saveStaticFiles();
      return { ok: true, name: raw, file: 'main.py' };
    }
    const slug = raw.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'imported-repo';
    staticStore.files['main.py'] = `# Cloned Repository: ${raw}\nimport repo_core, graphics_engine, physics\n\nrepo = "${raw}"\ngraphics = 3d good\n\n# Mod repository variables below:\nme = player\nspeed = fast\nguns = faster\n`;
    saveStaticFiles();
    return { ok: true, name: slug, file: 'main.py' };
  }
  if (url.endsWith('/files')) {
    const tree = Object.keys(staticStore.files)
      .filter((n) => n.endsWith('.py'))
      .sort()
      .map((n) => ({ name: n, path: n, type: 'file' }));
    return { tree, hasPreview: false };
  }
  const folderMatch = url.match(/^\/api\/projects\/[^/]+\/folder\?path=(.+)$/);
  if (folderMatch && (opts.method || 'GET').toUpperCase() === 'DELETE') {
    const folderPath = decodeURIComponent(folderMatch[1]).replace(/\/+$/, '');
    const prefix = `${folderPath}/`;
    for (const k of Object.keys(staticStore.files)) {
      if (k.startsWith(prefix)) delete staticStore.files[k];
    }
    saveStaticFiles();
    return { ok: true };
  }
  const fileDelMatch = url.match(/^\/api\/projects\/[^/]+\/file\?path=(.+)$/);
  if (fileDelMatch && (opts.method || 'GET').toUpperCase() === 'DELETE') {
    const filePath = decodeURIComponent(fileDelMatch[1]);
    delete staticStore.files[filePath];
    delete staticStore.compiledHtmlByFile[filePath];
    delete staticStore.previews[filePath];
    saveStaticFiles();
    return { ok: true };
  }
  if (url.includes('/file?path=')) {
    const p = decodeURIComponent(url.split('path=')[1] || 'main.py');
    return { path: p, content: staticStore.files[p] ?? '', previewUrl: staticStore.previews[p] || null };
  }
  if (url.endsWith('/file') && opts.method === 'PUT') {
    staticStore.files[body.path] = body.content;
    saveStaticFiles();
    return { ok: true };
  }
  if (url === '/api/provider') {
    return opts.method === 'POST' ? { ok: true, provider: Object.assign(staticStore.provider, body) } : staticStore.provider;
  }
  if (url === '/api/provider/test') {
    const cand = body && body.type ? body : staticStore.provider;
    try {
      await callBrowserAI(cand, 'Say ok');
      return { ok: true, message: `Connected to ${cand.label || cand.type} (${cand.model}) ✓` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
  if (url === '/api/compile') {
    const targetFile = body.file || 'main.py';
    if (typeof body.source === 'string') {
      staticStore.files[targetFile] = body.source;
      saveStaticFiles();
    }
    const syntaxErrors = validateStaticCodeSyntax(body.source || '');
    if (syntaxErrors.length) {
      state.pipeline = {
        compile: { id: 'compile', title: 'SyntaxError', status: 'error', detail: syntaxErrors[0].message }
      };
      renderPipeline();
      return { ok: false, error: syntaxErrors[0].message, diagnostics: syntaxErrors };
    }

    const ir = parseStaticIR(body.source || '', body.mode || 'smart');
    state.pipeline = {
      compile: { id: 'compile', title: 'Compiling...', status: 'running', detail: '' }
    };
    renderPipeline();

    if (body.mode === 'hard') {
      const hardErrors = validateStaticHardMode(body.source || '', ir);
      if (hardErrors.length) {
        state.pipeline.compile = { id: 'compile', title: 'Compilation Failed', status: 'error', detail: '' };
        renderPipeline();
        return { ok: false, diagnostics: hardErrors, ir };
      }
    }

    const directHtml = tryStaticDirectCode(body.source || '');
    if (directHtml) {
      state.pipeline.compile = { id: 'compile', title: 'Compiled ✓', status: 'done', detail: '' };
      renderPipeline();
      const blobUrl = URL.createObjectURL(new Blob([directHtml], { type: 'text/html' }));
      staticStore.previews[targetFile] = blobUrl;
      return { ok: true, file: targetFile, target: 'direct', previewUrl: blobUrl, diagnostics: [], ir };
    }

    let html = null;
    try {
      const fileSource = staticStore.files[targetFile] || body.source || '';
      const prevHtml = staticStore.compiledHtmlByFile[targetFile];
      const prevContext = prevHtml
        ? `\nEXISTING GENERATED APPLICATION CODE FOR ${targetFile} (Preserve 100% of working features when adding new ones):\n===EXISTING FILE: index.html===\n${prevHtml}\n===END EXISTING FILE===\n`
        : '';
      const compileMode = body.mode || 'normal';
      const helperRule =
        compileMode === 'ai-helper'
          ? '- AI HELPER MODE: Automatically upgrade graphics (richer PBR materials, procedural textures, environment details, atmospheric lighting, shadows, animations) and add real collision hitboxes + solid physics between the player, entities, and obstacles so nothing clips through solid objects.'
          : '- Build ONLY what is written in ' + targetFile + '. Do NOT invent unrequested collectibles (no truffles/coins), quests, or start screens.';
      const aiPrompt = `Build or update a clean, fast, playable HTML5/JS application in a single index.html file based on ${targetFile} (Mode: ${compileMode}):\n===SOURCE FILE: ${targetFile}===\n${fileSource}\n===END SOURCE FILE===\n${prevContext}\nRules:\n${helperRule}\n- Apply real-world common sense for relative speeds, scale, proportions, and physics even when exact numbers aren't written.\n- For 3D scenes, build detailed multi-part recognizable models (not crude primitive blobs). In first-person, keep the camera unobstructed at eye level (never block the view with the player's own head/body).\n- Use smooth dt-based acceleration/damping and responsive mouse-look (YXZ rotation, Pointer Lock + click-drag + arrow fallback).\n- If sound/audio is requested (e.g. "if jump play cool sound"), synthesize real Web Audio API sound effects.\n- Output ONLY:\n===FILE: index.html===\n<!DOCTYPE html>\n...\n===END FILE===`;
      const rawOut = await callBrowserAI(staticStore.provider, aiPrompt);
      html = extractBrowserHtml(rawOut);
      if (!html) throw new Error('AI did not return a valid HTML application.');
      staticStore.compiledHtmlByFile[targetFile] = html;
    } catch (err) {
      state.pipeline.compile = { id: 'compile', title: 'Compilation Failed', status: 'error', detail: '' };
      renderPipeline();
      return { ok: false, diagnostics: [{ severity: 'error', line: 1, code: 'AI-ERROR', message: err.message }], ir };
    }

    state.pipeline.compile = { id: 'compile', title: 'Compiled ✓', status: 'done', detail: '' };
    renderPipeline();
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    staticStore.previews[targetFile] = blobUrl;
    return { ok: true, file: targetFile, target: 'web', previewUrl: blobUrl, diagnostics: [], ir };
  }
  return { ok: true };
}

function resolvePreviewUrl(url) {
  if (!url) return url;
  if (url.startsWith('/') && state.backendOrigin) {
    return `${state.backendOrigin}${url}`;
  }
  return url;
}

async function api(url, opts = {}) {
  const isGithubPages = window.location.hostname.endsWith('github.io');
  if (!isGithubPages) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts
      });
      if (res.ok) return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // Try local backend at http://localhost:4321 (allows ChatGPT Codex CLI to work even when opened via github.io)
  try {
    const localRes = await fetch(`http://localhost:4321${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (localRes.ok) {
      state.backendOrigin = 'http://localhost:4321';
      return await localRes.json();
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
  }

  return handleStaticApi(url, opts);
}

async function switchRepo(repoName) {
  if (!repoName) return;
  state.project = repoName;
  state.openFiles = {};
  state.activeFile = 'main.py';
  if (el('explorer-repo-label')) el('explorer-repo-label').textContent = repoName.toUpperCase();
  if (el('repo-select')) {
    el('repo-select').value = repoName;
    const wrap = customSelectRegistry.get(el('repo-select'));
    if (wrap && wrap.refresh) wrap.refresh();
  }
  await refreshFileTree();
  const filesData = await api(`/api/projects/${state.project}/files`);
  const firstFile = (filesData.tree || []).find((f) => f.type === 'file')?.path || 'main.py';
  await openFile(firstFile, false);
  saveSessionLocal();
}

async function renderRepoPanel(projectsData) {
  const projects = projectsData?.projects || ['my-app'];
  const catalog = projectsData?.catalog || [];

  const repoSelect = el('repo-select');
  if (repoSelect) {
    repoSelect.innerHTML = projects
      .map((p) => `<option value="${p}" ${p === state.project ? 'selected' : ''}>${p}</option>`)
      .join('');
    repoSelect.onchange = () => switchRepo(repoSelect.value);
    upgradeCustomSelect(repoSelect);
  }

  const catalogEl = el('repo-catalog-list');
  if (catalogEl) {
    catalogEl.innerHTML = catalog
      .map(
        (item) => `
      <div class="repo-card">
        <div class="repo-card-title">
          <span>${item.title}</span>
          <button class="btn-mini active btn-open-repo" data-repo="${item.id}">Open</button>
        </div>
        <div class="repo-card-desc">${item.desc}</div>
      </div>`
      )
      .join('');

    catalogEl.querySelectorAll('.btn-open-repo').forEach((btn) => {
      btn.onclick = async () => {
        const repoId = btn.dataset.repo;
        await switchRepo(repoId);
        // Switch back to Explorer so user sees the repo files immediately
        const expBtn = document.querySelector('.act-btn[data-side="explorer"]');
        if (expBtn) expBtn.click();
      };
    });
  }
}

if (el('btn-repo-import')) {
  el('btn-repo-import').onclick = async () => {
    const inp = el('repo-import-input');
    const repoVal = (inp?.value || '').trim();
    if (!repoVal) {
      if (inp) inp.focus();
      return;
    }
    el('btn-repo-import').disabled = true;
    el('btn-repo-import').textContent = 'Cloning...';
    try {
      const res = await api('/api/repos/import', {
        method: 'POST',
        body: JSON.stringify({ repo: repoVal })
      });
      if (res.ok && res.name) {
        if (inp) inp.value = '';
        const projectsData = await api('/api/projects');
        await renderRepoPanel(projectsData);
        await switchRepo(res.name);
        const expBtn = document.querySelector('.act-btn[data-side="explorer"]');
        if (expBtn) expBtn.click();
      }
    } finally {
      el('btn-repo-import').disabled = false;
      el('btn-repo-import').textContent = 'Clone & Open in Editor';
    }
  };
}

async function loadProjects() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('cod_session_v1') || 'null');
  } catch {}

  const projectsData = await api('/api/projects').catch(() => ({ projects: ['my-app'], catalog: [] }));
  if (saved && saved.project && (projectsData.projects || []).includes(saved.project)) {
    state.project = saved.project;
  }
  if (el('explorer-repo-label')) el('explorer-repo-label').textContent = state.project.toUpperCase();
  await renderRepoPanel(projectsData);

  if (saved && saved.mode && el('mode-select')) {
    const validModes = Array.from(el('mode-select').options).map((o) => o.value);
    el('mode-select').value = validModes.includes(saved.mode) ? saved.mode : 'normal';
    const txt = el('mode-select').options[el('mode-select').selectedIndex]?.text || 'Normal';
    if (el('status-mode')) el('status-mode').textContent = `Mode: ${txt}`;
  }
  if (saved && saved.openFiles && typeof saved.openFiles === 'object') {
    for (const [fName, fCode] of Object.entries(saved.openFiles)) {
      if (typeof fCode === 'string') {
        state.openFiles[fName] = fCode;
        staticStore.files[fName] = fCode;
      }
    }
    saveStaticFiles();
  }

  await refreshFileTree();
  const filesData = await api(`/api/projects/${state.project}/files`);
  const existingNames = new Set((filesData.tree || []).map((f) => f.name));
  const initialFile = saved && saved.activeFile && (existingNames.has(saved.activeFile) || state.openFiles[saved.activeFile] !== undefined) ? saved.activeFile : 'main.py';

  await openFile(initialFile, true);
}

async function deleteTreeNode(node) {
  const isDir = node.type === 'dir';
  const msg = isDir
    ? `Delete folder "${node.name}" and all its contents?`
    : `Delete "${node.name}"?`;
  if (!confirm(msg)) return;
  const endpoint = isDir
    ? `/api/projects/${state.project}/folder?path=${encodeURIComponent(node.path)}`
    : `/api/projects/${state.project}/file?path=${encodeURIComponent(node.path)}`;
  const res = await api(endpoint, { method: 'DELETE' });
  if (res.ok) {
    if (isDir) {
      const prefix = `${node.path}/`;
      for (const f of Object.keys(state.openFiles)) {
        if (f.startsWith(prefix)) delete state.openFiles[f];
      }
      if (state.activeFile && state.activeFile.startsWith(prefix)) {
        state.activeFile = Object.keys(state.openFiles)[0] || 'main.py';
      }
    } else {
      delete state.openFiles[node.path];
      if (state.activeFile === node.path) {
        const nextFile = Object.keys(state.openFiles)[0];
        if (nextFile) {
          await openFile(nextFile);
        } else {
          state.activeFile = null;
          setEditorValue('');
        }
      }
    }
    saveSessionLocal();
    await refreshFileTree();
    renderTabs();
  }
}

function showFolderContextMenu(x, y, node) {
  let menu = document.getElementById('folder-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'folder-context-menu';
    menu.className = 'context-menu';
    document.body.appendChild(menu);
    document.addEventListener('click', () => { menu.style.display = 'none'; });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') menu.style.display = 'none';
    });
  }
  const label = node.type === 'dir' ? `Delete Folder "${node.name}"` : `Delete "${node.name}"`;
  menu.innerHTML = `<button type="button" class="context-menu-item danger">${label}</button>`;
  menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 48)}px`;
  menu.style.display = 'block';
  menu.querySelector('button').onclick = async (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    await deleteTreeNode(node);
  };
}

async function refreshFileTree() {
  const data = await api(`/api/projects/${state.project}/files`);
  const container = el('file-tree');
  container.innerHTML = '';

  function renderNodes(nodes, depth = 0) {
    for (const node of nodes) {
      if (node.type === 'file' && !node.name.endsWith('.py')) continue;
      const div = document.createElement('div');
      div.className = `tree-item ${node.path === state.activeFile ? 'active' : ''}`;
      div.style.paddingLeft = `${12 + depth * 14}px`;

      const delBtn = document.createElement('button');
      delBtn.className = 'tree-del-btn';
      delBtn.title = `Delete ${node.name}`;
      delBtn.textContent = '✕';
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteTreeNode(node);
      };

      const label = document.createElement('span');
      label.textContent = `${node.type === 'dir' ? '📂' : '🐍'} ${node.name}`;
      div.appendChild(delBtn);
      div.appendChild(label);

      if (node.type === 'dir') {
        div.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          showFolderContextMenu(e.clientX, e.clientY, node);
        };
      } else if (node.type === 'file') {
        div.onclick = () => openFile(node.path);
        div.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          showFolderContextMenu(e.clientX, e.clientY, node);
        };
      }
      container.appendChild(div);
      if (node.children) renderNodes(node.children, depth + 1);
    }
  }
  renderNodes(data.tree || []);
}

async function openFile(filePath, isInitial = false) {
  if (state.activeFile && state.openFiles[state.activeFile] !== undefined && !isInitial) {
    const curVal = getEditorValue();
    state.openFiles[state.activeFile] = curVal;
    staticStore.files[state.activeFile] = curVal;
    saveStaticFiles();
    saveSessionLocal();
    await api(`/api/projects/${state.project}/file`, {
      method: 'PUT',
      body: JSON.stringify({ path: state.activeFile, content: curVal })
    }).catch(() => {});
  }

  const localSaved = state.openFiles[filePath];
  const data = await api(`/api/projects/${state.project}/file?path=${encodeURIComponent(filePath)}`);
  const serverContent = data.content || '';

  if (isInitial && typeof localSaved === 'string' && localSaved.length > 0 && localSaved !== serverContent) {
    state.openFiles[filePath] = localSaved;
    staticStore.files[filePath] = localSaved;
    saveStaticFiles();
    api(`/api/projects/${state.project}/file`, {
      method: 'PUT',
      body: JSON.stringify({ path: filePath, content: localSaved })
    }).catch(() => {});
  } else {
    state.openFiles[filePath] = serverContent || localSaved || '';
  }
  state.activeFile = filePath;

  if (isInitial && !state.editor && !state.usingFallback) {
    initEditor(state.openFiles[filePath]);
  } else {
    setEditorValue(state.openFiles[filePath], filePath);
  }

  // Switch the live preview pane to show ONLY this active .py file's compiled build
  const frame = el('preview-frame');
  const empty = el('preview-empty');
  const pConsole = el('preview-console');
  if (pConsole) pConsole.style.display = 'none';
  if (data.previewUrl) {
    const resolvedUrl = resolvePreviewUrl(data.previewUrl);
    if (empty) empty.style.display = 'none';
    if (frame) {
      frame.removeAttribute('srcdoc');
      frame.style.display = 'block';
      frame.src = resolvedUrl;
    }
    if (el('preview-badge')) el('preview-badge').textContent = 'LIVE';
    if (el('btn-open-external')) el('btn-open-external').href = resolvedUrl;
  } else {
    if (frame) {
      frame.removeAttribute('srcdoc');
      frame.src = 'about:blank';
      frame.style.display = 'none';
    }
    if (empty) {
      empty.style.display = 'flex';
      empty.innerHTML = `<div>Click <strong>▶ Run</strong> to build and display <strong>${filePath}</strong> here.</div>`;
    }
    if (el('preview-badge')) el('preview-badge').textContent = 'READY';
  }

  renderTabs();
  refreshFileTree();
  saveSessionLocal();
}

function renderTabs() {
  const tabsEl = el('editor-tabs');
  tabsEl.innerHTML = Object.keys(state.openFiles)
    .map(
      (p) =>
        `<div class="editor-tab ${p === state.activeFile ? 'active' : ''}" data-path="${p}">${p}</div>`
    )
    .join('');

  tabsEl.querySelectorAll('.editor-tab').forEach((tab) => {
    tab.onclick = () => openFile(tab.dataset.path);
  });
}

function buildLiveStageHtml(source, threeUrl) {
  const safeLines = (source || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  const lower = safeLines.join('\n').toLowerCase();
  const isHorse = /\bhorse\b/.test(lower);
  const isPig = !isHorse && /\bpig\b/.test(lower);
  const isCar = /\b(car|lamborghini|supercar|vehicle|truck|drift)\b/.test(lower);
  const hasHumans = /\b(human|humans|huamn|huamns|person|people|tall)\b/.test(lower);
  const hasSkeletons = /\b(skeleton|skeletons|skelton)\b/.test(lower);
  const is3D = /\b(3d|first person|third person|good|realistic|pig|horse|car|zombie|soldier|world|human|skeleton)\b/.test(lower);
  const baseHref = window.location.href.split('#')[0];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<base href="${baseHref}" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #2b2d30; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<script type="module">
import * as THREE from '${threeUrl}';

const scene = new THREE.Scene();
scene.background = new THREE.Color(${is3D ? '0x87ceeb' : '0x2b2d30'});
scene.fog = new THREE.Fog(0x87ceeb, 18, 60);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(5.2, 3.2, 5.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x3b5332, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e4, 1.4);
sun.position.set(8, 12, 6);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: ${is3D ? '0x4c8c4a' : '0x313338'}, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const actor = new THREE.Group();
scene.add(actor);

const parts = [];
function addPart(group, mesh, pos, rot) {
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.set(0.01, 0.01, 0.01);
  mesh.visible = false;
  group.add(mesh);
  parts.push(mesh);
}

if (${isHorse}) {
  const coat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.65 });
  const mane = new THREE.MeshStandardMaterial({ color: 0x231712, roughness: 0.8 });
  const hoof = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.5 });
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 2.1), coat), [0, 1.45, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.05, 0.55), coat), [0, 2.05, 0.95], [0.35, 0, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.88), coat), [0, 2.52, 1.38], [0.2, 0, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.16), mane), [0, 2.15, 0.72], [0.35, 0, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), coat), [-0.15, 2.82, 1.1]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), coat), [0.15, 2.82, 1.1]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.24), coat), [-0.32, 0.55, 0.78]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.24), coat), [0.32, 0.55, 0.78]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.24), coat), [-0.32, 0.55, -0.78]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.24), coat), [0.32, 0.55, -0.78]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.18), mane), [0, 1.25, -1.15], [0.3, 0, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.28), hoof), [-0.32, 0.07, 0.78]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.28), hoof), [0.32, 0.07, 0.78]);
} else if (${isPig}) {
  const pink = new THREE.MeshStandardMaterial({ color: 0xf4a4b8, roughness: 0.6 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xe67e98, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.4 });
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.7), pink), [0, 0.95, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.78, 0.82), pink), [0, 1.15, 1.1]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.34, 0.28), snoutMat), [0, 1.02, 1.62]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.06), dark), [-0.22, 1.28, 1.52]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.06), dark), [0.22, 1.28, 1.52]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.14), snoutMat), [-0.34, 1.6, 1.0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.14), snoutMat), [0.34, 1.6, 1.0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), pink), [-0.34, 0.3, 0.55]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), pink), [0.34, 0.3, 0.55]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), pink), [-0.34, 0.3, -0.55]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), pink), [0.34, 0.3, -0.55]);
  addPart(actor, new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16), snoutMat), [0, 1.15, -0.92]);
} else if (${isCar}) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946, metalness: 0.5, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.1 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.8 });
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.6), bodyMat), [0, 0.55, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.7), glassMat), [0, 1.05, -0.15]);
  addPart(actor, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), wheelMat), [-0.95, 0.36, 1.1], [0, 0, Math.PI / 2]);
  addPart(actor, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), wheelMat), [0.95, 0.36, 1.1], [0, 0, Math.PI / 2]);
  addPart(actor, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), wheelMat), [-0.95, 0.36, -1.1], [0, 0, Math.PI / 2]);
  addPart(actor, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), wheelMat), [0.95, 0.36, -1.1], [0, 0, Math.PI / 2]);
} else {
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), torsoMat), [0, 1.3, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat), [0, 2.15, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), skinMat), [-0.56, 1.32, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), skinMat), [0.56, 1.32, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.32), legMat), [-0.22, 0.4, 0]);
  addPart(actor, new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.32), legMat), [0.22, 0.4, 0]);
}

if (${hasHumans}) {
  const hGroup = new THREE.Group();
  hGroup.position.set(-2.6, 0, -1.5);
  scene.add(hGroup);
  const hCoat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
  const hSkin = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.7 });
  addPart(hGroup, new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.5), hCoat), [0, 2.2, 0]);
  addPart(hGroup, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), hSkin), [0, 3.5, 0]);
  addPart(hGroup, new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.34), hCoat), [-0.24, 0.65, 0]);
  addPart(hGroup, new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.34), hCoat), [0.24, 0.65, 0]);
}

if (${hasSkeletons}) {
  const sGroup = new THREE.Group();
  sGroup.position.set(2.6, 0, -1.2);
  scene.add(sGroup);
  const bone = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.45 });
  addPart(sGroup, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bone), [0, 1.95, 0]);
  addPart(sGroup, new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), bone), [0, 1.25, 0]);
  addPart(sGroup, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), bone), [-0.18, 0.43, 0]);
  addPart(sGroup, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), bone), [0.18, 0.43, 0]);
}

let revealed = 0;
function revealNext() {
  if (revealed < parts.length) {
    parts[revealed].visible = true;
    revealed++;
    setTimeout(revealNext, 700);
  }
}
setTimeout(revealNext, 180);

let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.015;
  camera.position.x = Math.sin(t * 0.6) * 5.6;
  camera.position.z = Math.cos(t * 0.6) * 5.6;
  camera.lookAt(0, 1.3, 0);
  for (const m of parts) {
    if (m.visible) m.scale.lerp(new THREE.Vector3(1, 1, 1), 0.14);
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
</script>
</body>
</html>`;
}

// --- Compile & Run ---
async function compileAndRun() {
  if (state.compileAbort) {
    state.compileAbort.abort();
  }
  state.compileAbort = new AbortController();

  const isPy = state.activeFile && state.activeFile.endsWith('.py');
  const targetPyFile = isPy ? state.activeFile : 'main.py';
  const source = isPy ? getEditorValue() : (state.openFiles[targetPyFile] || '');
  if (!isPy && state.activeFile) {
    await api(`/api/projects/${state.project}/file`, {
      method: 'PUT',
      body: JSON.stringify({ path: state.activeFile, content: getEditorValue() })
    });
  }

  // Enforce structured code syntax (reject plain conversational English prompts)
  const syntaxErrors = validateStaticCodeSyntax(source);
  if (syntaxErrors.length > 0) {
    renderProblems(syntaxErrors);
    state.pipeline = {
      compile: { id: 'compile', title: 'SyntaxError', status: 'error', detail: syntaxErrors[0].message }
    };
    renderPipeline();
    return;
  }
  renderProblems([]);

  if (state.compileTimer) clearInterval(state.compileTimer);
  const compileStartedAt = Date.now();

  // Immediately render the live progressive 3D assembly inside the Finished Product viewport
  const frame = el('preview-frame');
  const empty = el('preview-empty');
  const pConsole = el('preview-console');
  if (pConsole) pConsole.style.display = 'none';
  if (empty) empty.style.display = 'none';
  if (frame) {
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '');
    const threeUrl = `${window.location.origin}${basePath}/vendor/three/three.module.js`;
    frame.removeAttribute('src');
    frame.srcdoc = buildLiveStageHtml(source, threeUrl);
    frame.style.display = 'block';
  }
  if (el('preview-badge')) el('preview-badge').textContent = 'BUILDING';
  const openExt = el('btn-open-external');
  if (openExt) {
    openExt.removeAttribute('href');
    openExt.style.opacity = '0.45';
    openExt.title = 'Still building — wait until compile finishes';
  }

  state.pipeline = {
    compile: { id: 'compile', title: 'Compiling...', status: 'running', detail: '0s' }
  };
  renderPipeline();
  state.compileTimer = setInterval(() => {
    if (state.pipeline.compile && state.pipeline.compile.status === 'running') {
      const secs = Math.floor((Date.now() - compileStartedAt) / 1000);
      state.pipeline.compile.detail = `${secs}s`;
      renderPipeline();
    } else {
      clearInterval(state.compileTimer);
      state.compileTimer = null;
    }
  }, 1000);
  switchBottomPanel('pipeline');

  const mode = el('mode-select').value;
  if (el('status-process')) el('status-process').textContent = `Compiling ${targetPyFile}...`;

  let result;
  try {
    result = await api('/api/compile', {
      method: 'POST',
      signal: state.compileAbort.signal,
      body: JSON.stringify({ project: state.project, file: targetPyFile, source, mode, target: 'auto' })
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    state.pipeline = {
      compile: { id: 'compile', title: 'Compilation Failed', status: 'error', detail: err.message || 'Request failed' }
    };
    renderPipeline();
    return;
  } finally {
    state.compileAbort = null;
    if (state.compileTimer) {
      clearInterval(state.compileTimer);
      state.compileTimer = null;
    }
  }

  if (result.ir) renderIntentIR(result.ir);
  if (result.diagnostics) renderProblems(result.diagnostics);

  if (result.ok) {
    state.pipeline = {
      compile: { id: 'compile', title: 'Compiled ✓', status: 'done', detail: '' }
    };
    renderPipeline();
  } else {
    const errDetail = result.diagnostics?.[0]?.message || result.error || '';
    state.pipeline = {
      compile: { id: 'compile', title: 'Compilation Failed', status: 'error', detail: errDetail }
    };
    renderPipeline();
  }

  if (result.ok && result.previewUrl) {
    const resolvedUrl = resolvePreviewUrl(result.previewUrl);
    el('preview-pane').classList.remove('hidden');
    el('preview-empty').style.display = 'none';
    el('preview-console').style.display = 'none';
    const frame = el('preview-frame');
    frame.removeAttribute('srcdoc');
    frame.style.display = 'block';
    frame.src = resolvedUrl;
    el('preview-badge').textContent = result.target.toUpperCase();
    const openExt = el('btn-open-external');
    if (openExt) {
      openExt.href = resolvedUrl;
      openExt.style.opacity = '';
      openExt.title = 'Open in Browser';
    }
    if (el('status-process')) el('status-process').textContent = `Running (${result.target})`;
  } else if (result.ok) {
    el('preview-pane').classList.remove('hidden');
    el('preview-empty').style.display = 'none';
    const frame = el('preview-frame');
    frame.removeAttribute('srcdoc');
    frame.style.display = 'none';
    const pConsole = el('preview-console');
    pConsole.style.display = 'block';
    pConsole.textContent = `=== Running ${result.target} output ===\n`;
    el('preview-badge').textContent = result.target.toUpperCase();
    if (el('status-process')) el('status-process').textContent = `Running (${result.target})`;
  } else {
    if (el('status-process')) el('status-process').textContent = 'Build Failed';
  }

  await refreshFileTree();
}

async function stopAll() {
  if (state.compileTimer) {
    clearInterval(state.compileTimer);
    state.compileTimer = null;
  }
  if (state.compileAbort) {
    state.compileAbort.abort();
    state.compileAbort = null;
  }
  await api('/api/stop', { method: 'POST' }).catch(() => {});

  // Clear the bottom pipeline status bar so "Compiling... — Stopped by user" disappears cleanly
  state.pipeline = {};
  renderPipeline();

  // Stop the live game preview iframe and console
  const frame = el('preview-frame');
  if (frame) {
    frame.removeAttribute('srcdoc');
    frame.src = 'about:blank';
    frame.style.display = 'none';
  }
  const pConsole = el('preview-console');
  if (pConsole) pConsole.style.display = 'none';

  const empty = el('preview-empty');
  if (empty) {
    empty.style.display = 'flex';
    empty.innerHTML = `<div>Click <strong>▶ Run</strong> to build and display <strong>${state.activeFile || 'main.py'}</strong> here.</div>`;
  }
  if (el('preview-badge')) el('preview-badge').textContent = 'READY';
  if (el('status-process')) el('status-process').textContent = 'Idle';
}

function renderIntentIR(ir) {
  const container = el('intent-view');
  if (!container) return;
  const entries = Object.entries(ir.entities || {});
  if (!entries.length) {
    container.innerHTML = '<div class="muted">No entities extracted yet.</div>';
    return;
  }
  container.innerHTML = entries
    .map(
      ([name, data]) => `
    <div class="entity-card">
      <div class="entity-name">${name}</div>
      <div>${(data.traits || []).map((t) => `<span class="trait-pill">${t}</span>`).join('')}</div>
    </div>`
    )
    .join('');
}

function renderProblems(diagnostics) {
  if (state.editor && typeof monaco !== 'undefined') {
    const model = state.editor.getModel();
    const markers = (diagnostics || []).map((d) => ({
      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      startLineNumber: d.line || 1,
      startColumn: 1,
      endLineNumber: d.line || 1,
      endColumn: model.getLineMaxColumn(d.line || 1),
      message: `[${d.code}] ${d.message}`
    }));
    monaco.editor.setModelMarkers(model, 'compiler', markers);
  }
  const countEl = el('problems-count');
  const list = el('problems-list');
  if (!countEl || !list) return;
  countEl.textContent = diagnostics.length;
  if (!diagnostics.length) {
    list.innerHTML = '<div class="muted">No problems or diagnostics.</div>';
    return;
  }
  list.innerHTML = diagnostics
    .map(
      (d) => `
    <div class="prob-item ${d.severity}">
      <span class="prob-code">[${d.code}] (Line ${d.line})</span>
      <span>${d.message}</span>
    </div>`
    )
    .join('');
}

function renderPipeline() {
  const list = el('pipeline-list');
  if (!list) return;
  const steps = Object.values(state.pipeline);
  if (!steps.length) {
    list.innerHTML = '<div class="muted">Idle</div>';
    return;
  }
  list.innerHTML = steps
    .map(
      (s) => `
    <div class="pipe-step ${s.status}">
      <span><strong>${s.title}</strong>${s.detail ? ` — <span class="muted">${s.detail}</span>` : ''}</span>
      <span>${s.status === 'running' ? '' : s.status.toUpperCase()}</span>
    </div>`
    )
    .join('');
}

// --- SSE Events ---
function connectEvents() {
  const evUrl = window.location.hostname.endsWith('github.io') ? 'http://localhost:4321/api/events' : '/api/events';
  const es = new EventSource(evUrl);

  es.addEventListener('pipeline', (e) => {
    const data = JSON.parse(e.data);
    state.pipeline = { [data.id]: data };
    renderPipeline();
  });

  es.addEventListener('diagnostics', (e) => {
    const { diagnostics } = JSON.parse(e.data);
    renderProblems(diagnostics);
  });

  es.addEventListener('terminal', (e) => {
    const { stream, text } = JSON.parse(e.data);
    const term = el('terminal-output');
    if (term) {
      term.textContent += text;
      term.parentElement.scrollTop = term.parentElement.scrollHeight;
    }
    const pConsole = el('preview-console');
    if (pConsole && pConsole.style.display === 'block' && stream !== 'system') {
      pConsole.textContent += text;
      pConsole.scrollTop = pConsole.scrollHeight;
    }
  });

  es.addEventListener('process_status', (e) => {
    const { running } = JSON.parse(e.data);
    const sp = el('status-process');
    if (!running && sp && sp.textContent.startsWith('Running')) {
      sp.textContent = 'Idle';
    }
  });

  es.addEventListener('files_updated', () => refreshFileTree());
  es.addEventListener('auth_updated', () => {
    initProviderCatalog();
  });
  es.addEventListener('compile_complete', (e) => {
    const result = JSON.parse(e.data);
    if (result.ok && result.previewUrl && (!result.file || result.file === state.activeFile)) {
      const resolvedUrl = resolvePreviewUrl(result.previewUrl);
      el('preview-pane').classList.remove('hidden');
      el('preview-empty').style.display = 'none';
      el('preview-console').style.display = 'none';
      const frame = el('preview-frame');
      frame.removeAttribute('srcdoc');
      frame.style.display = 'block';
      frame.src = resolvedUrl;
      el('preview-badge').textContent = (result.target || 'LIVE').toUpperCase();
      el('btn-open-external').href = resolvedUrl;
      if (el('status-process')) el('status-process').textContent = `Running (${result.target})`;
    }
    refreshFileTree();
  });
}

// --- UI Switching ---
function switchBottomPanel(name) {
  document.querySelectorAll('.panel-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === name));
  document.querySelectorAll('.panel-view').forEach((v) => v.classList.toggle('active', v.id === `panel-${name}`));
}

document.querySelectorAll('.act-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.act-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.side-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const pane = el(`side-${btn.dataset.side}`);
    if (pane) pane.classList.add('active');
  };
});

document.querySelectorAll('.panel-tab').forEach((tab) => {
  tab.onclick = () => switchBottomPanel(tab.dataset.panel);
});

el('mode-select').onchange = () => {
  const txt = el('mode-select').options[el('mode-select').selectedIndex].text;
  if (el('status-mode')) el('status-mode').textContent = `Mode: ${txt}`;
  saveSessionLocal();
};

el('btn-export-menu').onclick = (e) => {
  e.stopPropagation();
  el('export-menu').classList.toggle('open');
};
window.addEventListener('click', () => {
  if (el('export-menu')) el('export-menu').classList.remove('open');
});

// --- Multi-.py Files (Named by User) ---
function toggleNewFileBox(show) {
  const box = el('new-file-box');
  if (!box) return;
  box.style.display = show ? 'flex' : 'none';
  if (show) {
    const inp = el('new-file-input');
    inp.value = '';
    inp.focus();
  }
}

async function createNamedPyFile() {
  const inp = el('new-file-input');
  let raw = (inp.value || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!raw) {
    inp.focus();
    return;
  }
  if (!raw.endsWith('.py')) raw += '.py';
  const freshContent = `# ${raw}\n`;
  state.openFiles[raw] = freshContent;
  staticStore.files[raw] = freshContent;
  saveStaticFiles();
  await api(`/api/projects/${state.project}/file`, {
    method: 'PUT',
    body: JSON.stringify({ path: raw, content: freshContent })
  });
  toggleNewFileBox(false);
  await refreshFileTree();
  await openFile(raw);
}

el('btn-new-file').onclick = () => {
  const isVisible = el('new-file-box').style.display !== 'none';
  toggleNewFileBox(!isVisible);
};
el('btn-new-file-cancel').onclick = () => toggleNewFileBox(false);
el('btn-new-file-create').onclick = createNamedPyFile;
el('new-file-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createNamedPyFile();
  } else if (e.key === 'Escape') {
    toggleNewFileBox(false);
  }
});

el('btn-compile').onclick = compileAndRun;
el('btn-stop').onclick = stopAll;
el('btn-export-exe').onclick = () => {
  window.location.href = resolvePreviewUrl(`/api/projects/${encodeURIComponent(state.project)}/export/exe`);
};
el('btn-export-zip').onclick = () => {
  window.location.href = resolvePreviewUrl(`/api/projects/${encodeURIComponent(state.project)}/export/zip`);
};
el('btn-share-link').onclick = async () => {
  const data = await api(`/api/projects/${encodeURIComponent(state.project)}/share`);
  const url = data.lanUrl || data.localUrl;
  try {
    await navigator.clipboard.writeText(url);
    alert(`Shareable web link copied to clipboard:\n\n${url}`);
  } catch {
    prompt('Copy your shareable web link:', url);
  }
};
el('btn-toggle-preview').onclick = () => el('preview-pane').classList.toggle('hidden');
el('btn-refresh-preview').onclick = () => {
  const frame = el('preview-frame');
  if (frame.hasAttribute('srcdoc')) {
    frame.srcdoc = frame.srcdoc;
  } else if (frame.src) {
    frame.src = frame.src;
  }
};
if (el('btn-open-external')) {
  el('btn-open-external').onclick = (e) => {
    if (state.compileAbort || !el('btn-open-external').getAttribute('href')) {
      e.preventDefault();
      if (el('status-process')) el('status-process').textContent = 'Still building — wait until compile finishes';
    }
  };
}

// AI Provider / Account & Model Connection
let codexLoggedIn = false;
let grokLoggedIn = false;
let grokAuthUpdatedAt = 0;
let loginPollTimer = null;

const customSelectRegistry = new Map();

function upgradeCustomSelect(selectEl, onOptionClick = null) {
  if (!selectEl) return null;
  selectEl.style.display = 'none';

  let wrap = customSelectRegistry.get(selectEl);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'cselect';
    selectEl.parentNode.insertBefore(wrap, selectEl.nextSibling);
    customSelectRegistry.set(selectEl, wrap);
  }

  function render() {
    const opts = Array.from(selectEl.options);
    const activeOpt = opts.find((o) => o.value === selectEl.value) || opts[0];
    const activeText = activeOpt ? activeOpt.textContent : '';

    wrap.innerHTML = `
      <button type="button" class="cselect-trigger">
        <span class="cselect-title">${activeText}</span>
        <span class="cselect-chevron">▾</span>
      </button>
      <div class="cselect-menu">
        ${opts
          .map(
            (o) => `
              <div class="cselect-option ${o.value === selectEl.value ? 'selected' : ''}" data-value="${o.value}">
                <span class="cselect-title">${o.textContent}</span>
                ${o.value === selectEl.value ? '<span class="cselect-dot"></span>' : ''}
              </div>
            `
          )
          .join('')}
      </div>
    `;

    const trigger = wrap.querySelector('.cselect-trigger');
    trigger.onclick = (e) => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('open');
      document.querySelectorAll('.cselect.open').forEach((elNode) => elNode.classList.remove('open'));
      if (!wasOpen) wrap.classList.add('open');
    };

    wrap.querySelectorAll('.cselect-option').forEach((optNode) => {
      optNode.onclick = (e) => {
        e.stopPropagation();
        const val = optNode.dataset.value;
        const changed = selectEl.value !== val;
        selectEl.value = val;
        wrap.classList.remove('open');
        render();
        if (changed && typeof selectEl.onchange === 'function') {
          selectEl.onchange();
        }
        if (typeof onOptionClick === 'function') {
          onOptionClick(val, changed);
        }
      };
    });
  }

  render();
  wrap.refresh = render;
  return wrap;
}

window.addEventListener('click', () => {
  document.querySelectorAll('.cselect.open').forEach((elNode) => elNode.classList.remove('open'));
});

const MODEL_OPTIONS = {
  'cli:codex': [
    { value: 'gpt-6.1-sol', label: 'gpt-6.1-sol', shortLabel: 'gpt-6.1-sol' },
    { value: 'gpt-6-astra', label: 'gpt-6-astra', shortLabel: 'gpt-6-astra' },
    { value: 'gpt-6.1-terra', label: 'gpt-6.1-terra', shortLabel: 'gpt-6.1-terra' },
    { value: 'gpt-6-sol', label: 'gpt-6-sol', shortLabel: 'gpt-6-sol' },
    { value: 'gpt-reserve', label: 'gpt-reserve', shortLabel: 'gpt-reserve' },
    { value: 'gpt-6-luna', label: 'gpt-6-luna', shortLabel: 'gpt-6-luna' },
    { value: 'gpt-5.6-sol', label: 'gpt-5.6-sol', shortLabel: 'gpt-5.6-sol' },
    { value: 'gpt-5.6-terra', label: 'gpt-5.6-terra', shortLabel: 'gpt-5.6-terra' },
    { value: 'gpt-5.6-luna', label: 'gpt-5.6-luna', shortLabel: 'gpt-5.6-luna' }
  ],
  'cli:gemini': [
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash', shortLabel: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro', shortLabel: 'gemini-2.5-pro' }
  ],
  'gemini-api': [
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash', shortLabel: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro', shortLabel: 'gemini-2.5-pro' },
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash', shortLabel: 'gemini-2.0-flash' }
  ],
  'cli:claude': [
    { value: 'claude-sonnet-4-20250514', label: 'claude-sonnet-4', shortLabel: 'claude-sonnet-4' },
    { value: 'claude-opus-4-20250514', label: 'claude-opus-4', shortLabel: 'claude-opus-4' }
  ],
  ollama: [
    { value: 'llama3.2', label: 'llama3.2', shortLabel: 'llama3.2' },
    { value: 'qwen2.5-coder:7b', label: 'qwen2.5-coder:7b', shortLabel: 'qwen2.5-coder:7b' },
    { value: 'deepseek-coder-v2', label: 'deepseek-coder-v2', shortLabel: 'deepseek-coder-v2' }
  ],
  'openai-compatible': [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini', shortLabel: 'gpt-4o-mini' },
    { value: 'gpt-4o', label: 'gpt-4o', shortLabel: 'gpt-4o' },
    { value: 'o3-mini', label: 'o3-mini', shortLabel: 'o3-mini' }
  ]
};

function providerSelectValue(info) {
  if (!info) return '';
  if (info.selectValue) return info.selectValue;
  if (info.type === 'grok') return 'grok';
  if (info.type === 'cli') return `cli:${info.cli || 'codex'}`;
  return info.type || '';
}

function readSavedProviderChoice() {
  try {
    return JSON.parse(localStorage.getItem('cod_provider_v1') || 'null');
  } catch {
    return null;
  }
}

function rememberProviderChoice(selectValue, extra = {}) {
  try {
    localStorage.setItem('cod_provider_v1', JSON.stringify({
      selectValue,
      endpoint: extra.endpoint || '',
      model: extra.model || ''
    }));
  } catch {}
}

function restoreProviderForm(choice) {
  const select = el('provider-type');
  const value = providerSelectValue(choice);
  if (!select || !value) return false;
  if (!Array.from(select.options).some((opt) => opt.value === value)) return false;
  select.value = value;
  if ((value === 'ollama' || value === 'openai-compatible') && choice.endpoint && el('provider-endpoint')) {
    el('provider-endpoint').value = choice.endpoint;
  }
  return true;
}

function parseProviderPayload() {
  const rawType = el('provider-type').value;
  const label = el('provider-type').options[el('provider-type').selectedIndex]?.text || rawType;
  const endpoint = el('provider-endpoint').value;
  const token = el('provider-token').value;

  if (rawType.startsWith('cli:')) {
    const cliName = rawType.split(':')[1];
    return { type: 'cli', cli: cliName, model: 'auto', label, endpoint: 'local-cli', token: '' };
  }
  if (rawType === 'grok') {
    return { type: 'grok', model: 'grok-4.7', label, endpoint: 'grok-oauth', token: '' };
  }
  return { type: rawType, model: 'auto', label, endpoint, token };
}

async function applyAndSaveProvider() {
  const payload = parseProviderPayload();
  rememberProviderChoice(el('provider-type').value, {
    endpoint: payload.endpoint,
    model: payload.model
  });
  await api('/api/provider', { method: 'POST', body: JSON.stringify(payload) });
  if (el('status-provider')) el('status-provider').textContent = `Engine: ${payload.label}`;
  if (payload.type === 'grok') {
    el('provider-status').style.color = grokLoggedIn ? '#59a869' : '#a3a3a3';
    el('provider-status').textContent = grokLoggedIn
      ? 'Grok signed in • grok-4.7'
      : 'Not signed in — click Sign in with Grok.';
  } else if (payload.type === 'cli' && payload.cli === 'codex' && !codexLoggedIn) {
    el('provider-status').style.color = '#a3a3a3';
    el('provider-status').textContent = 'Not signed in — click Connect ChatGPT above.';
  } else {
    el('provider-status').style.color = '#59a869';
    el('provider-status').textContent = `${payload.label} • Auto (Medium Effort)`;
  }
}

async function syncProviderUI() {
  const t = el('provider-type').value;
  if (t === 'ollama') {
    el('provider-endpoint').value = 'http://localhost:11434';
  } else if (t === 'openai-compatible' && el('provider-endpoint').value.includes('11434')) {
    el('provider-endpoint').value = 'https://api.openai.com/v1';
  }
  el('field-endpoint').style.display = t === 'ollama' || t === 'openai-compatible' ? 'flex' : 'none';
  el('field-token').style.display = t === 'gemini-api' || t === 'openai-compatible' ? 'flex' : 'none';
  el('provider-token').placeholder = t === 'gemini-api' ? 'Paste Gemini API key (AIza...)' : 'Paste API key (sk-...)';
  if (el('btn-cli-login')) {
    el('btn-cli-login').style.display = t.startsWith('cli:') || t === 'grok' ? 'inline-flex' : 'none';
    el('btn-cli-login').textContent = t === 'grok'
      ? (grokLoggedIn ? 'Switch Grok account' : 'Sign in with Grok')
      : t === 'cli:codex'
        ? (codexLoggedIn ? 'Switch ChatGPT Account' : 'Connect ChatGPT')
        : 'Sign In';
  }

  upgradeCustomSelect(el('provider-type'), (val) => {
    if (val === 'cli:codex' && !codexLoggedIn) {
      triggerCliLogin('codex');
    }
    if (val === 'grok' && !grokLoggedIn) {
      triggerCliLogin('grok');
    }
  });
  upgradeCustomSelect(el('mode-select'));

  await applyAndSaveProvider();
}

el('provider-type').onchange = () => syncProviderUI();
if (el('provider-model')) el('provider-model').onchange = () => applyAndSaveProvider();
el('provider-token').onchange = () => applyAndSaveProvider();
el('provider-endpoint').onchange = () => applyAndSaveProvider();

async function triggerCliLogin(cli = 'codex') {
  const grokStamp = grokAuthUpdatedAt;
  el('provider-status').style.color = '#a3a3a3';
  el('provider-status').textContent = `Generating ${cli === 'codex' ? 'ChatGPT' : cli === 'grok' ? 'Grok' : cli} sign-in link...`;
  const res = await api('/api/cli/login', {
    method: 'POST',
    body: JSON.stringify({ cli })
  });
  el('provider-status').style.color = res.ok ? '#59a869' : '#ef4444';
  if (res.authUrl) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(res.authUrl);
      copied = true;
    } catch {}
    el('provider-status').innerHTML = `
      <div>${copied ? 'Login link copied to clipboard! Paste it in your browser to sign in:' : (res.message || 'Copy this login link and paste it in your browser:')}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" id="btn-copy-auth-url" class="provider-auth-link" style="cursor:pointer;border:none;">${copied ? 'Copied ✓ (Copy Again)' : 'Copy Login Link'}</button>
        <input type="text" readonly value="${res.authUrl.replace(/"/g, '&quot;')}" style="flex:1;min-width:180px;background:#1e1f22;color:#d4d4d8;border:1px solid #43464d;border-radius:4px;padding:4px 8px;font-size:11px;" onclick="this.select()" />
      </div>
    `;
    const copyBtn = document.getElementById('btn-copy-auth-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(res.authUrl);
          copyBtn.textContent = 'Copied ✓';
          setTimeout(() => { copyBtn.textContent = 'Copy Login Link'; }, 1800);
        } catch {}
      });
    }
  } else {
    el('provider-status').textContent = res.message || 'Check your terminal output for the sign-in link.';
  }

  if (loginPollTimer) clearInterval(loginPollTimer);
  let checks = 0;
  loginPollTimer = setInterval(async () => {
    checks++;
    if (checks > 45) {
      clearInterval(loginPollTimer);
      loginPollTimer = null;
      return;
    }
    try {
      const info = await api('/api/provider');
      if (cli === 'grok' && info.grokAuth && info.grokAuth.loggedIn && info.grokAuth.updatedAt !== grokStamp) {
        clearInterval(loginPollTimer);
        loginPollTimer = null;
        grokLoggedIn = true;
        grokAuthUpdatedAt = info.grokAuth.updatedAt || 0;
        await initProviderCatalog();
        el('provider-status').style.color = '#59a869';
        el('provider-status').textContent = 'Grok signed in ✓';
      } else if (cli !== 'grok' && info.codexCatalog && info.codexCatalog.loggedIn) {
        clearInterval(loginPollTimer);
        loginPollTimer = null;
        codexLoggedIn = true;
        await initProviderCatalog();
        el('provider-status').style.color = '#59a869';
        el('provider-status').textContent = 'ChatGPT Connected ✓';
      }
    } catch {}
  }, 2000);
}

if (el('btn-cli-login')) {
  el('btn-cli-login').onclick = async () => {
    const raw = el('provider-type').value;
    if (raw === 'grok') {
      await triggerCliLogin('grok');
      return;
    }
    const payload = parseProviderPayload();
    const cli = payload.cli || 'codex';
    await triggerCliLogin(cli);
  };
}

if (el('btn-test-provider')) {
  el('btn-test-provider').onclick = async () => {
    await applyAndSaveProvider();
    const payload = parseProviderPayload();
    el('provider-status').style.color = '#a3a3a3';
    el('provider-status').textContent = 'Testing connection...';
    const res = await api('/api/provider/test', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    el('provider-status').style.color = res.ok ? '#59a869' : '#ef4444';
    el('provider-status').textContent = res.message || (res.ok ? 'Connected ✓' : 'Connection failed.');
  };
}

async function initProviderCatalog() {
  let info = null;
  try {
    info = await api('/api/provider');
    if (info.codexCatalog) {
      codexLoggedIn = Boolean(info.codexCatalog.loggedIn);
    }
    if (info.grokAuth) {
      grokLoggedIn = Boolean(info.grokAuth.loggedIn);
      grokAuthUpdatedAt = info.grokAuth.updatedAt || 0;
    }
  } catch {}
  if (!restoreProviderForm(readSavedProviderChoice())) restoreProviderForm(info);
  await syncProviderUI();
}

function applyEditorSettings() {
  const fontSize = parseInt(el('setting-font-size')?.value || '14', 10);
  const tabSize = parseInt(el('setting-tab-size')?.value || '4', 10);
  const lineNumbers = el('setting-line-numbers')?.checked !== false ? 'on' : 'off';
  const wordWrap = el('setting-word-wrap')?.checked ? 'on' : 'off';
  const minimap = Boolean(el('setting-minimap')?.checked);

  if (state.editor) {
    state.editor.updateOptions({
      fontSize,
      tabSize,
      lineNumbers,
      wordWrap,
      minimap: { enabled: minimap }
    });
  }
  const fb = el('fallback-editor');
  if (fb) fb.style.fontSize = `${fontSize}px`;

  try {
    localStorage.setItem(
      'cod_ide_settings_v1',
      JSON.stringify({
        fontSize: String(fontSize),
        tabSize: String(tabSize),
        lineNumbers: lineNumbers === 'on',
        wordWrap: wordWrap === 'on',
        minimap,
        autoFormat: el('setting-auto-format')?.checked !== false,
        strictSyntax: el('setting-strict-syntax')?.checked !== false,
        autoSave: el('setting-auto-save')?.checked !== false,
        fpsLimit: el('setting-fps-limit')?.value || '60'
      })
    );
  } catch {}
}

function initEditorSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('cod_ide_settings_v1') || 'null');
    if (s) {
      if (el('setting-font-size') && s.fontSize) el('setting-font-size').value = s.fontSize;
      if (el('setting-tab-size') && s.tabSize) el('setting-tab-size').value = s.tabSize;
      if (el('setting-line-numbers') && typeof s.lineNumbers === 'boolean') el('setting-line-numbers').checked = s.lineNumbers;
      if (el('setting-word-wrap') && typeof s.wordWrap === 'boolean') el('setting-word-wrap').checked = s.wordWrap;
      if (el('setting-minimap') && typeof s.minimap === 'boolean') el('setting-minimap').checked = s.minimap;
      if (el('setting-auto-format') && typeof s.autoFormat === 'boolean') el('setting-auto-format').checked = s.autoFormat;
      if (el('setting-strict-syntax') && typeof s.strictSyntax === 'boolean') el('setting-strict-syntax').checked = s.strictSyntax;
      if (el('setting-auto-save') && typeof s.autoSave === 'boolean') el('setting-auto-save').checked = s.autoSave;
      if (el('setting-fps-limit') && s.fpsLimit) el('setting-fps-limit').value = s.fpsLimit;
    }
  } catch {}

  ['setting-font-size', 'setting-tab-size', 'setting-fps-limit'].forEach((id) => {
    const node = el(id);
    if (node) {
      node.onchange = applyEditorSettings;
      upgradeCustomSelect(node);
    }
  });
  ['setting-line-numbers', 'setting-word-wrap', 'setting-minimap', 'setting-auto-format', 'setting-strict-syntax', 'setting-auto-save'].forEach((id) => {
    const node = el(id);
    if (node) node.onchange = applyEditorSettings;
  });
  applyEditorSettings();
}

// Boot
initEditorSettings();
connectEvents();
initProviderCatalog();
loadProjects();
