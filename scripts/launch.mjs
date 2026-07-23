// launch.mjs — 通用 WorkBuddy 皮肤启动器 (跨平台)
// 自动探测 WorkBuddy 安装路径与 node，拉起带调试端口的 WorkBuddy 并注入皮肤。
// 零第三方依赖 (仅 Node 内置模块)。由分享入口 (.vbs / .bat / .command / .sh) 调用。
//
// 逻辑:
//   1. 已在运行且端口已开  -> 直接注入 (幂等, 可重复双击)
//   2. 已在运行但端口未开  -> 提示先完全退出 WorkBuddy 再启动
//   3. 未运行              -> 拉起带 --remote-debugging-port 的实例, 等待端口, 注入
//
// 皮肤配置读取脚本所在目录 (或 cwd) 的 skin.config.json:
//   { "css": "x.css", "id": "x", "marker": "__forest_send", "port": 9222 }

import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath; // 运行本脚本的 node
const PLATFORM = process.platform; // win32 | darwin | linux
const PORT = (() => {
  for (const base of [__dirname, path.dirname(__dirname)]) {
    try {
      const p = path.join(base, 'skin.config.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')).port || 9222;
    } catch {}
  }
  return 9222;
})();
const LOG = path.join(__dirname, 'skin-launch.log');

function log(...a) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ` + a.join(' ');
  try { fs.appendFileSync(LOG, line + '\n', 'utf8'); } catch {}
  console.log(line);
}
function logClear() { try { fs.writeFileSync(LOG, '', 'utf8'); } catch {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 探测 WorkBuddy.exe ----------
function wbFromProcess() {
  try {
    if (PLATFORM === 'win32') {
      const out = spawnSync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        '(Get-Process WorkBuddy -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)',
      ], { encoding: 'utf8', timeout: 8000 }).stdout || '';
      const p = out.trim();
      return p && fs.existsSync(p) ? p : null;
    }
    // macOS / Linux: pgrep + ps
    const pid = (spawnSync('pgrep', ['-f', 'WorkBuddy'], { encoding: 'utf8', timeout: 8000 }).stdout || '').trim().split('\n')[0];
    if (pid) {
      const cmd = (spawnSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8', timeout: 8000 }).stdout || '').trim();
      const m = cmd.split(/\s+/)[0];
      return m && fs.existsSync(m) ? m : null;
    }
  } catch {}
  return null;
}

function wbFromCandidates() {
  const bases = [];
  if (PLATFORM === 'win32') {
    bases.push(process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA, 'D:\\Soft', 'C:\\Program Files');
  } else if (PLATFORM === 'darwin') {
    bases.push('/Applications', path.join(process.env.HOME || '', 'Applications'));
  } else {
    bases.push('/opt', '/usr/local/bin', '/usr/bin', path.join(process.env.HOME || '', '.local/bin'));
  }
  bases.filter(Boolean).forEach((b) => {
    const rels = PLATFORM === 'win32'
      ? ['WorkBuddy\\WorkBuddy.exe', 'Programs\\WorkBuddy\\WorkBuddy.exe']
      : PLATFORM === 'darwin'
        ? ['WorkBuddy.app/Contents/MacOS/WorkBuddy']
        : ['workbuddy', 'WorkBuddy/workbuddy'];
    for (const r of rels) {
      const p = path.join(b, r);
      if (fs.existsSync(p)) return p;
    }
  });
  return null;
}

function wbFromRegistry() {
  if (PLATFORM !== 'win32') return null;
  for (const root of ['HKLM', 'HKCU']) {
    try {
      const out = spawnSync('reg', [
        'query', `${root}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
        '/s', '/f', 'WorkBuddy',
      ], { encoding: 'utf8', timeout: 8000 }).stdout || '';
      const m = out.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
      if (m) {
        const p = path.join(m[1].trim(), 'WorkBuddy.exe');
        if (fs.existsSync(p)) return p;
      }
    } catch {}
  }
  return null;
}

function findWorkBuddy() {
  return wbFromProcess() || wbFromCandidates() || wbFromRegistry() || null;
}

async function portOpen() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    return r.ok;
  } catch { return false; }
}

function inject() {
  const res = spawnSync(NODE, [path.join(__dirname, 'inject.mjs'), 'inject'], {
    cwd: __dirname, encoding: 'utf8', timeout: 60000,
  });
  if (res.status === 0) {
    const last = (res.stdout || '').trim().split('\n').pop();
    log('皮肤注入成功 ✅ (', last, ')');
    return true;
  }
  log('皮肤注入失败 ❌:', (res.stderr || res.stdout || '').trim().slice(0, 400));
  return false;
}

async function main() {
  logClear();
  log('WorkBuddy 皮肤启动器开始运行 … (platform=' + PLATFORM + ')');

  const wb = findWorkBuddy();
  if (!wb) {
    log('未找到 WorkBuddy。请确认已安装 WorkBuddy，或手动设置皮肤文件夹里的 skin.config.json。');
    return;
  }
  log('找到 WorkBuddy:', wb);

  const running = !!wbFromProcess();
  if (running && (await portOpen())) {
    log('WorkBuddy 已在运行且端口已开 → 直接注入（幂等）。');
    inject();
    return;
  }
  if (running && !(await portOpen())) {
    log('WorkBuddy 已在运行，但未开启调试端口。请先完全退出 WorkBuddy，再双击本启动器。');
    return;
  }

  log('正在启动 WorkBuddy（带调试端口 ' + PORT + '）…');
  try {
    const child = spawn(wb, ['--remote-debugging-port=' + PORT], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    log('启动失败:', e.message);
    return;
  }

  let ok = false;
  for (let i = 1; i <= 40; i++) {
    await sleep(1000);
    if (await portOpen()) { ok = true; break; }
    log(`等待调试端口… (${i}/40)`);
  }
  if (!ok) { log('调试端口未能在 40 秒内打开，注入中止。'); return; }

  log('端口就绪，开始注入…');
  inject();
}

main().then(() => log('启动器结束。'));
