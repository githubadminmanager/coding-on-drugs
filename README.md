# 💊 CODING ON DRUGS

> ⚠️ **Work in Progress:** This is **not yet a finished product** and is currently being actively worked on.

> **The IDE built to make vibecoders feel like 10x systems engineers.**

Most "vibecoding" tools trap you inside a boring chat bubble where you beg a chatbot to write code for you. It doesn't feel like programming—it feels like customer support.

**Coding On Drugs** flips the entire experience on its head. It gives you a pitch-black, distraction-free IDE where you write `.py` files using whatever syntax your brain invents on the spot—`game = good graphics`, `view = first person`, `if player touches enemy:`—while a real-time "compiler" pipeline parses your intent, highlights every keyword, auto-indents your logic blocks, checks for "compiler" errors, and builds a live playable 3D/2D application right next to your code.

🌐 **Live Web Demo:** [https://githubadminmanager.github.io/coding-on-drugs/](https://githubadminmanager.github.io/coding-on-drugs/)

---

## 😂 Finally: Those `code = good` Meme Videos Are Now Real

You've seen [those viral videos](https://vt.tiktok.com/ZSp4waYVr/) where someone opens a code editor, types:

```python
code = good
game = realistic
graphics = ultra
bugs = 0
fps = 999
```

and everyone laughs because obviously that's not how programming works.

**Except now it actually works.**  
In **Coding On Drugs**, you can literally type `code = good`, `game = good graphics`, `npc = alot` into `main.py`, hit **▶ Run**, and watch the "compiler" actually build and launch a playable game from it.

---

## 🧠 The Philosophy: Why Vibecoders Deserve a Real IDE

When you're in flow state, you shouldn't have to worry about missing semicolons, boilerplate imports, or webpack configs—**but you still want the tactile feeling of writing code, organizing `.py` files, debugging red squiggly errors, and hitting `Ctrl+Enter` to compile.**

**Coding On Drugs** bridges that gap:

1. **You Write Code, Not Prompts**: Every line in your `.py` file looks and behaves like real source code. Assignments (`player = fast`), event triggers (`when space pressed:`), conditionals (`if health == 0:`), and module imports (`import physics, lighting`) light up with full syntax coloring.
2. **Smart Auto-Formatting & Ghost Autocomplete**: Type `if` or `when` and press `Enter`—the editor automatically adds the colon, indents the next line, and suggests inline ghost completions so your code always looks structured and clean.
3. **Incremental In-Place Compilation**: Unlike chat tools that regenerate a brand-new broken app every time you change one line, **Coding On Drugs** snapshots your existing application state and modifies your running game **in-place**. Add a new rule or tweak a variable, hit **▶ Run**, and watch your existing world evolve.
4. **File-Based Version Control**: Want to save a checkpoint before trying something crazy? Click **`+ New .py`** in the `FILES` sidebar, give your new `.py` file a name (`v2.py`, `boss_fight.py`), and hit **▶ Run**—the "compiler" builds whichever `.py` file you currently have open.
5. **⚡ Instant Direct Execution (No AI Needed for Normal Code)**: If you type normal code like `print hello 123`, `print("hello 123")`, or basic math and variables (`x = 10`, `y = 25`, `print x + y`), **Coding On Drugs** doesn't waste time calling the AI—it executes your code directly in milliseconds and displays `hello 123` immediately in the output pane.
6. **🔬 Not Just 3D Games — Calculators, Simulations & Any Program**: You aren't limited to games. Type `calculator = scientific with graphing`, `simulation = gravity particles with sliders`, or `program = expense tracker` and the "compiler" builds calculators, real-time physics/fluid/orbital simulations, desktop utilities, and interactive tools.

---

## 🎮 What You Can Build (Examples)

### 1. Instant Normal Code (Runs in 0ms Without AI)
```python
print hello 123
x = 50
y = 73
print x + y
```

### 2. Calculators, Utilities & Programs
```python
calculator = scientific with history and dark theme
buttons = glowing
```

### 3. Advanced Physics & Particle Simulations
```python
simulation = orbital gravity and colliding particles
particles = alot
controls = sliders for gravity, speed, and bounce
```

### 4. 3D & 2D Games
```python
# main.py
import 3d, physics, lighting

game = good graphics
view = first person
weather = night neon

player = fast
npc = alot
enemy = aggressive

when key space pressed:
    player = jump

if player touches coin:
    score = score + 10

every 5 seconds:
    spawn = enemy
```

---

## ⚡ "Compiler" Effort Levels

Open **⚙️ Settings** in the left sidebar to choose the **"Compiler" Effort**:

| "Compiler" Effort | How It Works |
| :--- | :--- |
| **🟢 Low (Fast)** | Prioritizes fast compilation with clean, concise, working code and solid core mechanics. |
| **⚪ Medium (Balanced — Default)** | Balanced realism and build speed—detailed visuals, natural physics, and smooth controls. |
| **🔥 High (Max Realism)** | Gives the "compiler" maximum reasoning budget and time to craft deeply realistic 3D geometry, textures, lighting, physics, animations, and Web Audio sound effects. |

---

## ⚙️ The Build Pipeline

Every time you press **▶ Run** (`Ctrl+Enter`), the bottom **Build Pipeline** panel tracks compilation in real time:

1. **`1. Parse Instructions`** — Tokenizes your active `.py` file, extracts entities, traits, and event blocks, and populates the **🧠 Parsed Intent** inspector in the sidebar.
2. **`2. Context & Intent Check`** — Diffs your current `.py` file against the previous Intermediate Representation (`intent.ir.json`) and applies your selected **"Compiler" Effort** level.
3. **`3. AI Code Generation`** — Sends your structured IR + existing application snapshot to your connected AI engine to generate or update the self-contained runtime (`index.html` + Three.js WebGL modules).
4. **`4. Launch & Execute`** — Mounts the compiled build directly into the **FINISHED PRODUCT** split pane with instant **`■ Stop`** and reload controls.

---

## 📦 Exporting & Sharing Your Creation

Once your game or app is running in the **FINISHED PRODUCT** pane, click **`⬇ Export ▾`** in the top bar:

- **🖥️ Download Windows `.EXE`**: Invokes the built-in Windows `.NET` native "compiler" (`csc.exe`) to pack your entire compiled application, assets, and Three.js engine into a single standalone `.exe` file. You can send this `.exe` to anyone on Windows and it launches immediately in a dedicated app window.
- **📦 Download Project `.ZIP`**: Bundles all HTML/JS/Three.js files into a clean portable `.zip` archive with relative paths so it can be hosted anywhere.
- **🔗 Copy Shareable Web Link**: Generates a local/LAN URL so anyone on your network can play your build in their browser.

---

## 🚀 Running Locally

```bash
git clone https://github.com/githubadminmanager/coding-on-drugs.git
cd coding-on-drugs
npm install
npm start
```

Then open **localhost** in your browser.

---

## 🔌 Supported AI Engines (Configured in `⚙️ Settings`)

1. **Main AI Providers**
   - **Gemini** (Google account via Gemini CLI locally, or Gemini API key)
   - **Grok** (xAI API key)
   - **ChatGPT** (ChatGPT account via Codex CLI locally, or OpenAI API key)
   - **Claude** (Claude CLI locally)
2. **Local Models (100% Offline)**
   - **Local Ollama** (`llama3.2`, `qwen2.5-coder`, `deepseek-coder-v2`, etc.)
3. **API Keys**
   - **Grok (xAI)** (`xai-...`)
   - **Google Gemini** (`AIza...`)
   - **OpenAI / Custom API Endpoint** (`sk-...`, OpenRouter, or any OpenAI-compatible `/v1` endpoint)

---

## 🐛 Report a Bug

Found a bug or something broken? [Open a GitHub Issue](https://github.com/githubadminmanager/coding-on-drugs/issues/new?template=bug_report.md) with your code, OS/browser, and a screenshot if possible.
