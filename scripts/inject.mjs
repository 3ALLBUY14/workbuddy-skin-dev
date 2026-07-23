// inject.mjs — 通用 WorkBuddy 皮肤注入器 (Chrome DevTools Protocol)
// 零第三方依赖 (仅 Node 22+ 内置: 全局 WebSocket / fetch)。
//
// 设计目标: 与具体皮肤解耦。皮肤 = 一个 CSS 文件 + 一个 skin id。
// 本脚本负责把 CSS 注入 WorkBuddy 渲染进程，并附带一组"通用修复"
// (清理流式空气泡 / 捕获浮层类名 / 标记发送按钮)，这些修复对所有皮肤都适用。
//
// 用法:
//   node inject.mjs                       # 读取 skin.config.json, 注入默认皮肤
//   node inject.mjs inject                # 同上
//   node inject.mjs remove                # 移除已注入皮肤
//   node inject.mjs inspect              # 只读: 打印真实 CSS 变量/类名, 用于精修
//
// 配置优先级: CLI 参数 > skin.config.json > 环境变量 > 默认值
//   --css <path>     皮肤 CSS 文件路径
//   --id  <id>       皮肤 id (默认取 css 文件名 stem)
//   --marker <cls>   给"发送/强调按钮"加的 class (默认 __forest_send)
//   --port <n>       调试端口 (默认 9222, 或 WB_DEBUG_PORT)
//
// skin.config.json 字段: { "css": "x.css", "id": "x", "marker": "__forest_send", "port": 9222 }

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- 配置解析 ----------
function loadConfigFile() {
  // 依次在 cwd / 脚本目录 / 脚本目录的上级(技能根) 找 skin.config.json
  for (const base of [process.cwd(), __dirname, dirname(__dirname)]) {
    const p = join(base, 'skin.config.json');
    if (existsSync(p)) {
      try { return { cfg: JSON.parse(readFileSync(p, 'utf8')), cfgDir: base }; } catch { /* ignore */ }
    }
  }
  return { cfg: {}, cfgDir: process.cwd() };
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--css') out.css = argv[++i];
    else if (a === '--id') out.id = argv[++i];
    else if (a === '--marker') out.marker = argv[++i];
    else if (a === '--port') out.port = Number(argv[++i]);
  }
  return out;
}

const { cfg, cfgDir } = loadConfigFile();
const flags = parseFlags(process.argv.slice(3));
const mode = process.argv[2] || 'inject';

const PORT = flags.port || cfg.port || Number(process.env.WB_DEBUG_PORT) || 9222;
// CSS 相对路径以配置文件所在目录为基准解析, 这样无论从哪 cwd 运行都能找到
const CSS_RAW = flags.css || cfg.css || '';
const CSS_PATH = CSS_RAW ? resolve(cfgDir, CSS_RAW) : '';
const SKIN_ID = (flags.id || cfg.id || (CSS_PATH ? basename(CSS_PATH, '.css') : '') || 'skin').replace(/[^a-zA-Z0-9_-]/g, '_');
const MARKER = (flags.marker || cfg.marker || '__forest_send').replace(/[^a-zA-Z0-9_-]/g, '_');
const GLOW_ID = (cfg.glow || `${SKIN_ID}-bg`).replace(/[^a-zA-Z0-9_-]/g, '_');

if (mode !== 'inspect' && mode !== 'remove' && !CSS_PATH) {
  console.error('[inject] 未指定皮肤 CSS。用法: node inject.mjs inject --css <path> [--id id] [--marker cls]');
  console.error('[inject] 或在 skin.config.json 中设置 "css" 字段。');
  process.exit(1);
}
if (mode !== 'inspect' && mode !== 'remove' && !existsSync(CSS_PATH)) {
  console.error('[inject] 找不到 CSS 文件:', CSS_PATH);
  process.exit(1);
}

// ---------- 极简 CDP 客户端 (基于 Node 全局 WebSocket) ----------
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
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  ws.addEventListener('error', (e) => {
    console.error('[CDP] WebSocket error:', e.message || e);
  });

  function send(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve) => {
      pending.set(id, resolve);
      if (opened) ws.send(payload);
      else queue.push(payload);
    });
  }
  return {
    send,
    close: () => ws.close(),
    waitOpen: () => new Promise((res) => (opened ? res() : ws.addEventListener('open', res))),
  };
}

async function getTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json`);
  if (!r.ok) throw new Error(`无法连接调试端口 ${PORT} (HTTP ${r.status})`);
  return r.json();
}

function pickTarget(targets) {
  const pages = targets.filter((t) => t.type === 'page');
  const app = pages.find((t) => t.url && !/devtools\.frontend|chrome-devtools/.test(t.url));
  return app || pages[0];
}

// 默认要剥离内联背景的 WorkBuddy 已知类名 (流式生成可能写入内联 background)。
// 类名哈希会随版本变化 —— 用 inspect 模式重新获取后更新此处。
const DEFAULT_STRIP = [
  '._assistantMessage_14nyt_190', '._assistantMessageContent_14nyt_202',
  '._assistantTextContent_14nyt_207', '._editable_5t975_1',
  '._input-area-container_1akz6_19',
];

function buildInjectFn(css) {
  const stripJson = JSON.stringify(DEFAULT_STRIP);
  return `
(async () => {
  const ID = ${JSON.stringify(SKIN_ID)};
  const GLOW = ${JSON.stringify(GLOW_ID)};
  const MARKER = ${JSON.stringify(MARKER)};
  const css = ${JSON.stringify(css)};
  // 等待 document.head/body 就绪 (启动即注入时 DOM 可能还没解析完, 否则 appendChild 报 null)
  await new Promise((res) => {
    if (document.head && document.body) return res();
    const t0 = Date.now();
    const iv = setInterval(() => {
      if ((document.head && document.body) || Date.now() - t0 > 8000) {
        clearInterval(iv);
        res();
      }
    }, 80);
  });
  let el = document.getElementById(ID);
  if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el); }
  el.textContent = css;
  // 仅当皮肤用到背景层时才创建 (CSS 里出现 GLOW id 才建, 否则留空 div 无害)
  if (css.indexOf(GLOW) !== -1) {
    let glow = document.getElementById(GLOW);
    if (!glow) { glow = document.createElement('div'); glow.id = GLOW; document.body.appendChild(glow); }
    glow.removeAttribute('style');
    glow.style.cssText = '';
  }
  // 清除气泡/输入栏上可能被应用写入的内联 background, 确保半透明规则生效
  const strip = ${stripJson};
  strip.forEach(s => document.querySelectorAll(s).forEach(el => {
    el.style.removeProperty('background-color');
    el.style.removeProperty('background');
    el.style.removeProperty('background-image');
  }));
  // ---------- 清理流式生成残留的空 AI 消息气泡 ----------
  if (!window['__' + ID + '_empty_cleaner']) {
    const tick = () => {
      document.querySelectorAll('._assistantMessage_14nyt_190').forEach(msg => {
        const content = msg.querySelector('._assistantMessageContent_14nyt_202')
                     || msg.querySelector('._assistantTextContent_14nyt_207')
                     || msg;
        const txt = (content.textContent || '').replace(/\\s/g, '');
        const h = msg.getBoundingClientRect().height;
        if (txt === '' && h <= 2) {
          if (msg.style.display !== 'none') msg.style.display = 'none';
        } else {
          if (msg.style.display === 'none') msg.style.removeProperty('display');
        }
      });
    };
    window['__' + ID + '_empty_cleaner'] = setInterval(tick, 300);
    tick();
  }
  // ---------- 被动捕获命令面板 / 其他高 z 浮层类名 ----------
  if (!window['__' + ID + '_overlay_log']) window['__' + ID + '_overlay_log'] = [];
  if (!window['__' + ID + '_overlay_observer']) {
    const log = window['__' + ID + '_overlay_log'];
    const isOverlayish = (el) => {
      if (!(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      const z = parseInt(cs.zIndex);
      const cls = (el.className && el.className.toString) ? el.className.toString() : '';
      if (/palette|command|cmdk|quickCommand|quick-command|modal|overlay/i.test(cls)) return true;
      if (!isNaN(z) && z >= 1000 && (cs.position === 'fixed' || cs.position === 'absolute')) return true;
      return false;
    };
    const rec = (el) => {
      const cls = (el.className && el.className.toString) ? el.className.toString() : el.tagName;
      if (!cls || log.some(function (e) { return e.cls === cls; })) return;
      const cs = getComputedStyle(el);
      log.push({ cls: cls.slice(0, 90), bg: cs.backgroundColor, z: cs.zIndex, ts: Date.now() });
    };
    const obs = new MutationObserver(function (muts) {
      for (const m of muts) {
        m.addedNodes.forEach(function (n) {
          if (n instanceof Element && isOverlayish(n)) rec(n);
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window['__' + ID + '_overlay_observer'] = obs;
  }
  // ---------- 标记"发送/强调"按钮 -> 加 MARKER class ----------
  const key = '__' + ID + '_send_marker';
  if (window[key]) clearInterval(window[key]);
  const fnKey = '__' + ID + '_send_markFn';
  if (window[fnKey]) {
    document.removeEventListener('focusin', window[fnKey], true);
    document.removeEventListener('input', window[fnKey], true);
  }
  {
    const isTeal = (rgb) => {
      if (!rgb || rgb === 'none' || rgb === 'transparent') return false;
      const m = rgb.match(/\\d+/g); if (!m || m.length < 3) return false;
      const r = +m[0], g = +m[1], b = +m[2];
      return g > 120 && r < 120 && b < 180 && (g - r) > 40;
    };
    const markOnce = () => {
      document.querySelectorAll('[class*="_inputBottom"]').forEach(bar => {
        const btns = [...bar.querySelectorAll('button,[role="button"]')];
        for (let i = btns.length - 1; i >= 0; i--) {
          const b = btns[i];
          if ((b.textContent || '').replace(/\\s/g, '') === '' && b.querySelector('svg')) { b.classList.add(MARKER); break; }
        }
      });
      document.querySelectorAll('[class*="_topRightSlotStandalone"]').forEach(slot => {
        const b = slot.querySelector('button,[role="button"]');
        if (b) b.classList.add(MARKER);
      });
      document.querySelectorAll('button,[role="button"]').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.width > 40 || r.height > 40) return;
        if ((b.textContent || '').replace(/\\s/g, '') !== '') return;
        let teal = false;
        b.querySelectorAll('svg path,svg circle,svg rect,svg polygon,span,i').forEach(s => {
          const cs = getComputedStyle(s);
          if (isTeal(cs.fill) || isTeal(cs.stroke) || isTeal(cs.color) || isTeal(cs.backgroundColor)) teal = true;
        });
        if (teal) b.classList.add(MARKER);
      });
    };
    window[fnKey] = markOnce;
    window[key] = setInterval(markOnce, 800);
    markOnce();
    document.addEventListener('focusin', markOnce, true);
    document.addEventListener('input', markOnce, true);
  }
  return ID + ' skin applied, len=' + css.length;
})()
`;
}

const REMOVE_FN = `
(() => {
  document.getElementById(${JSON.stringify(SKIN_ID)})?.remove();
  document.getElementById(${JSON.stringify(GLOW_ID)})?.remove();
  return ${JSON.stringify(SKIN_ID)} + ' skin removed';
})()
`;

const INSPECT_FN = `
(() => {
  const cs = getComputedStyle(document.documentElement);
  const vars = {};
  for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (k.startsWith('--')) vars[k] = cs.getPropertyValue(k); }
  const classes = new Set();
  document.querySelectorAll('*').forEach(e => e.classList && e.classList.forEach(c => classes.add(c)));
  const interesting = [...classes].filter(c => /sidebar|panel|header|chat|message|input|button|btn|content|main|app|layout|toolbar|titlebar|editor/i.test(c)).slice(0, 80);
  return JSON.stringify({
    title: document.title,
    url: location.href,
    bodyClass: document.body.className,
    rootVarsCount: Object.keys(vars).length,
    sampleVars: Object.fromEntries(Object.entries(vars).slice(0, 40)),
    interestingClasses: interesting
  }, null, 2);
})()
`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function connectAndRun(expr) {
  console.log(`[inject] 连接 127.0.0.1:${PORT} ...`);
  const targets = await getTargets();
  const target = pickTarget(targets);
  if (!target) throw new Error('未找到 page 类型调试目标');
  console.log(`[inject] 目标窗口: ${target.title || target.url}`);

  const cdp = cdpConnect(target.webSocketDebuggerUrl);
  await cdp.waitOpen();
  await cdp.send('Runtime.enable');

  const res = await cdp.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails) {
    console.error('[inject] 执行出错:', res.result.exceptionDetails);
  } else if (mode === 'inspect') {
    console.log('[inject] 真实 DOM / 变量快照:\n' + res.result?.result?.value);
  } else {
    console.log('[inject]', res.result?.result?.value);
  }
  cdp.close();
}

async function main() {
  const fnMap = { inject: () => buildInjectFn(readFileSync(CSS_PATH, 'utf8')), remove: () => REMOVE_FN, inspect: () => INSPECT_FN };
  const expr = (fnMap[mode] || (() => { throw new Error('未知模式: ' + mode); }))();

  // WorkBuddy 拉起后 CDP HTTP 服务可能晚几秒才就绪; 做重试避免一把 fetch failed
  const MAX = 40, WAIT = 1000;
  let lastErr;
  for (let i = 1; i <= MAX; i++) {
    try {
      await connectAndRun(expr);
      return;
    } catch (e) {
      lastErr = e;
      if (i < MAX) {
        console.log(`[inject] 端口尚未就绪 (${e.message}), ${WAIT / 1000}s 后重试 (${i}/${MAX})...`);
        await sleep(WAIT);
      }
    }
  }
  throw lastErr;
}

main().catch((e) => {
  console.error('[inject] 失败:', e.message);
  console.error(`提示: 确认 WorkBuddy 已用 --remote-debugging-port=${PORT} 启动, 且本机可访问 127.0.0.1:${PORT}`);
  process.exit(1);
});
