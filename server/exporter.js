const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function collectAllFiles(dir, base = '') {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, collectAllFiles(full, rel));
    } else if (entry.name !== 'intent.ir.json') {
      result[rel] = fs.readFileSync(full);
    }
  }
  return result;
}

function buildZipBuffer(projDir, projectName, rootDir) {
  const tmpId = `${projectName}-${Date.now()}`;
  const stageDir = path.join(os.tmpdir(), `stage-${tmpId}`);
  const zipPath = path.join(os.tmpdir(), `${tmpId}.zip`);

  try {
    fs.mkdirSync(stageDir, { recursive: true });
    const files = collectAllFiles(projDir);
    let needsThree = false;

    for (const [rel, buf] of Object.entries(files)) {
      let contentBuf = buf;
      if (/\.(html|js|mjs)$/i.test(rel)) {
        const text = buf.toString('utf-8');
        if (text.includes('/vendor/three/')) {
          needsThree = true;
          contentBuf = Buffer.from(text.replace(/\/vendor\/three\//g, './vendor/three/'), 'utf-8');
        }
      }
      const dest = path.join(stageDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, contentBuf);
    }

    if (needsThree) {
      const threeDir = path.join(rootDir, 'node_modules', 'three', 'build');
      for (const f of ['three.module.js', 'three.core.js']) {
        const src = path.join(threeDir, f);
        if (fs.existsSync(src)) {
          const dest = path.join(stageDir, 'vendor', 'three', f);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      }
    }

    if (process.platform === 'win32') {
      execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `Compress-Archive -Path "${stageDir}\\*" -DestinationPath "${zipPath}" -Force`],
        { windowsHide: true, timeout: 30000 }
      );
    } else {
      execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stageDir, timeout: 30000 });
    }

    return fs.readFileSync(zipPath);
  } finally {
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
  }
}

function buildExeBuffer(projDir, projectName, rootDir) {
  if (process.platform !== 'win32') {
    throw new Error('Windows .exe export is only supported on Windows. Use Export ZIP on macOS/Linux instead.');
  }
  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  if (!fs.existsSync(cscPath)) {
    throw new Error('Windows .NET C# compiler (csc.exe) not found on this machine.');
  }

  const files = collectAllFiles(projDir);
  let needsThree = false;
  for (const [rel, buf] of Object.entries(files)) {
    if (/\.(html|js|mjs)$/i.test(rel) && buf.toString('utf-8').includes('/vendor/three/')) {
      needsThree = true;
    }
  }

  if (needsThree) {
    const threeDir = path.join(rootDir, 'node_modules', 'three', 'build');
    for (const f of ['three.module.js', 'three.core.js']) {
      const src = path.join(threeDir, f);
      if (fs.existsSync(src)) {
        files[`vendor/three/${f}`] = fs.readFileSync(src);
      }
    }
  }

  const entriesCs = Object.entries(files)
    .map(([rel, buf]) => {
      const key = '/' + rel.replace(/\\/g, '/');
      let finalBuf = buf;
      if (key.toLowerCase() === '/index.html') {
        const html = buf.toString('utf-8');
        const heartbeatScript = `<script>setInterval(()=>fetch('/__ping').catch(()=>{}),2000);window.addEventListener('pagehide',()=>navigator.sendBeacon('/__exit'));</script>`;
        finalBuf = Buffer.from(
          html.includes('</body>') ? html.replace('</body>', heartbeatScript + '</body>') : html + heartbeatScript,
          'utf-8'
        );
      }
      const b64 = finalBuf.toString('base64');
      return `      files["${key}"] = "${b64}";`;
    })
    .join('\r\n');

  const csSource = `using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

class StandaloneApp {
  static Dictionary<string, string> files = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
  static DateTime lastPing = DateTime.UtcNow;
  static volatile bool shouldExit = false;

  static string GetMime(string path) {
    if (path.EndsWith(".html") || path.EndsWith(".htm")) return "text/html; charset=utf-8";
    if (path.EndsWith(".js") || path.EndsWith(".mjs")) return "application/javascript; charset=utf-8";
    if (path.EndsWith(".css")) return "text/css; charset=utf-8";
    if (path.EndsWith(".json")) return "application/json; charset=utf-8";
    if (path.EndsWith(".png")) return "image/png";
    if (path.EndsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }

  [STAThread]
  static void Main() {
    ${entriesCs}

    TcpListener l = new TcpListener(IPAddress.Loopback, 0);
    l.Start();
    int port = ((IPEndPoint)l.LocalEndpoint).Port;

    Thread serverThread = new Thread(() => {
      while (!shouldExit) {
        try {
          TcpClient client = l.AcceptTcpClient();
          ThreadPool.QueueUserWorkItem(_ => {
            try {
              using (NetworkStream ns = client.GetStream())
              using (StreamReader sr = new StreamReader(ns, Encoding.ASCII, false, 1024, true)) {
                string reqLine = sr.ReadLine();
                if (string.IsNullOrEmpty(reqLine)) return;
                string[] parts = reqLine.Split(' ');
                string urlPath = parts.Length > 1 ? parts[1].Split('?')[0] : "/index.html";
                if (urlPath == "/") urlPath = "/index.html";
                lastPing = DateTime.UtcNow;
                if (urlPath == "/__ping") {
                  byte[] ok = Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\nok");
                  ns.Write(ok, 0, ok.Length);
                  return;
                }
                if (urlPath == "/__exit") {
                  shouldExit = true;
                  return;
                }
                byte[] body;
                string status = "200 OK";
                string mime = GetMime(urlPath);
                if (files.ContainsKey(urlPath)) {
                  body = Convert.FromBase64String(files[urlPath]);
                } else {
                  status = "404 Not Found";
                  mime = "text/plain";
                  body = Encoding.UTF8.GetBytes("Not found: " + urlPath);
                }
                string header = "HTTP/1.1 " + status + "\\r\\nContent-Type: " + mime + "\\r\\nContent-Length: " + body.Length + "\\r\\nConnection: close\\r\\n\\r\\n";
                byte[] hBytes = Encoding.ASCII.GetBytes(header);
                ns.Write(hBytes, 0, hBytes.Length);
                ns.Write(body, 0, body.Length);
              }
            } catch {} finally { try { client.Close(); } catch {} }
          });
        } catch { break; }
      }
    });
    serverThread.IsBackground = true;
    serverThread.Start();

    string url = "http://127.0.0.1:" + port + "/index.html";
    try {
      Process.Start(new ProcessStartInfo("msedge.exe", "--app=" + url + " --window-size=1200,800") { UseShellExecute = true });
    } catch {
      Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    lastPing = DateTime.UtcNow;
    while (!shouldExit && (DateTime.UtcNow - lastPing).TotalSeconds < 12) {
      Thread.Sleep(1000);
    }
  }
}
`;

  const tmpId = `${projectName}-${Date.now()}`;
  const csPath = path.join(os.tmpdir(), `${tmpId}.cs`);
  const exePath = path.join(os.tmpdir(), `${tmpId}.exe`);

  try {
    fs.writeFileSync(csPath, csSource, 'utf-8');
    execFileSync(cscPath, ['/nologo', '/target:winexe', `/out:${exePath}`, csPath], {
      windowsHide: true,
      timeout: 30000
    });
    return fs.readFileSync(exePath);
  } finally {
    try { if (fs.existsSync(csPath)) fs.unlinkSync(csPath); } catch {}
    try { if (fs.existsSync(exePath)) fs.unlinkSync(exePath); } catch {}
  }
}

function getShareUrls(projectName, port) {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const list of Object.values(nets)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIp = iface.address;
        break;
      }
    }
  }
  return {
    localUrl: `http://localhost:${port}/preview/${projectName}/index.html`,
    lanUrl: `http://${lanIp}:${port}/preview/${projectName}/index.html`
  };
}

function buildStandaloneHtml(projDir, activeFile, getBuildHtmlName) {
  const buildName = activeFile && getBuildHtmlName ? getBuildHtmlName(activeFile) : 'index.html';
  let htmlPath = path.join(projDir, buildName);
  if (!fs.existsSync(htmlPath)) htmlPath = path.join(projDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('No compiled build found yet. Click Run first before exporting.');
  }
  let html = fs.readFileSync(htmlPath, 'utf-8');
  html = html.replace(/(['"])\/vendor\/three\/three\.module\.js\1/g, '$1https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js$1');
  return html;
}

module.exports = {
  buildZipBuffer,
  buildExeBuffer,
  buildStandaloneHtml,
  getShareUrls
};
