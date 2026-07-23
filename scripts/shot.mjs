// shot.mjs — 用 CDP 截取 WorkBuddy 窗口为 PNG (需 WorkBuddy 已用 --remote-debugging-port=9222 启动)
// 用法:
//   node shot.mjs                  # 截到 docs/preview.png
//   node shot.mjs out.png          # 指定输出路径
//   node shot.mjs --full out.png   # 截完整页面(含滚动区)
// 建议先把皮肤套上: node launch.mjs, 再跑本脚本。

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WB_DEBUG_PORT) || 9222;
const args = process.argv.slice(2);
const full = args.includes('--full');
const outArg = args.find((a) => !a.startsWith('--'));
const OUT = resolve(outArg || join(__dirname, '..', 'docs', 'preview.png'));

function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const queue = [];
  let opened = false;
  ws.addEventListener('open', () => {
    opened = true;
    queue.forEach((m) => ws.send(m));
    queue.length = 0;
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  ws.addEventListener('error', (e) => console.error('[CDP] WebSocket error:', e.message || e));
  function send(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve) => {
      pending.set(id, resolve);
      if (opened) ws.send(payload); else queue.push(payload);
    });
  }
  return { send, close: () => ws.close(), waitOpen: () => new Promise((r) => (opened ? r() : ws.addEventListener('open', r))) };
}

async function getTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json`);
  if (!r.ok) throw new Error(`无法连接调试端口 ${PORT} (HTTP ${r.status})`);
  return r.json();
}
function pickTarget(targets) {
  const pages = targets.filter((t) => t.type === 'page');
  return pages.find((t) => t.url && !/devtools\.frontend|chrome-devtools/.test(t.url)) || pages[0];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = await getTargets();
  const target = pickTarget(targets);
  if (!target) throw new Error('未找到 page 类型调试目标');
  console.log('[shot] 目标窗口:', target.title || target.url);

  const cdp = cdpConnect(target.webSocketDebuggerUrl);
  await cdp.waitOpen();
  await cdp.send('Page.enable');
  await sleep(300);

  const res = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
    clip: full ? undefined : { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
  });
  const b64 = res.result?.data;
  if (!b64) throw new Error('截图失败: 无数据');
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log('[shot] 已保存:', OUT);
  cdp.close();
}

main().catch((e) => {
  console.error('[shot] 失败:', e.message);
  console.error(`提示: 确认 WorkBuddy 已用 --remote-debugging-port=${PORT} 启动, 且本机可访问 127.0.0.1:${PORT}`);
  process.exit(1);
});
