// forest-launch.mjs — 森系皮肤「分享版」启动器
// 自动探测 WorkBuddy 安装路径与 node，拉起带调试端口的 WorkBuddy 并注入森系皮肤。
// 零第三方依赖（仅 Node 内置模块）。由 森系启动.vbs / 森系启动.bat 调用。
//
// 设计目标：可在任意机器运行，不依赖分享者本机目录或固定版本号。

import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9222;
const LOG = path.join(__dirname, '森系启动日志.txt');
const NODE = process.execPath; // 运行本脚本的 node（由 vbs/bat 事先找到）

function log(...a) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ` + a.join(' ');
  try { fs.appendFileSync(LOG, line + '\n', 'utf8'); } catch {}
  console.log(line);
}
function logClear() { try { fs.writeFileSync(LOG, '', 'utf8'); } catch {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 探测 WorkBuddy.exe ----
function wbFromProcess() {
  try {
    const out = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      '(Get-Process WorkBuddy -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)',
    ], { encoding: 'utf8', timeout: 8000 }).stdout || '';
    const p = out.trim();
    return p && fs.existsSync(p) ? p : null;
  } catch { return null; }
}
function wbFromCandidates() {
  const bases = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    'D:\\Soft',
  ].filter(Boolean);
  const rels = [
    'WorkBuddy\\WorkBuddy.exe',
    'Programs\\WorkBuddy\\WorkBuddy.exe',
    'WorkBuddy\\WorkBuddy.exe',
  ];
  for (const b of bases) {
    for (const r of rels) {
      const p = path.join(b, r);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}
function wbFromRegistry() {
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
  const res = spawnSync(NODE, [path.join(__dirname, 'forest-inject.mjs'), 'inject'], {
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
  log('森系皮肤启动器开始运行…');

  const wb = findWorkBuddy();
  if (!wb) {
    log('未找到 WorkBuddy.exe。请确认已安装 WorkBuddy，或把整个解压包放到任意盘符后再试。');
    return;
  }
  log('找到 WorkBuddy:', wb);

  const running = !!wbFromProcess();
  if (running && (await portOpen())) {
    log('WorkBuddy 已在运行且端口已开 → 直接注入（幂等，可重复双击）。');
    inject();
    return;
  }
  if (running && !(await portOpen())) {
    log('WorkBuddy 已在运行，但未开启调试端口。请先完全退出 WorkBuddy，再双击本启动器。');
    return;
  }

  // 未运行 → 拉起带端口的实例
  log('正在启动 WorkBuddy（带调试端口 ' + PORT + '）…');
  try {
    const child = spawn(wb, ['--remote-debugging-port=' + PORT], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    log('启动失败:', e.message);
    return;
  }

  // 等待端口就绪（最长 40 秒）
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
