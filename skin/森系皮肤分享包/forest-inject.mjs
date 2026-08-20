// forest-inject.mjs
// 通过 Chrome DevTools Protocol 把东方森系皮肤注入 WorkBuddy 渲染进程。
// 依赖: Node 22+ (全局 WebSocket)。零第三方包。
//
// 用法 (在 WorkBuddy 以 --remote-debugging-port=9222 启动后运行):
//   node forest-inject.mjs inject    # 注入森系皮肤
//   node forest-inject.mjs inspect   # 只读: 打印真实 CSS 变量/类名, 用于精修
//   node forest-inject.mjs remove    # 移除已注入皮肤

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = process.env.WB_DEBUG_PORT || 9222;
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, 'forest-theme-skin.css');
const mode = process.argv[2] || 'inject';

// ---- 极简 CDP 客户端 (基于 Node 全局 WebSocket) ----
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
    waitOpen: () =>
      new Promise((res) => (opened ? res() : ws.addEventListener('open', res))),
  };
}

async function getTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json`);
  if (!r.ok) throw new Error(`无法连接调试端口 ${PORT} (HTTP ${r.status})`);
  return r.json();
}

function pickTarget(targets) {
  const pages = targets.filter((t) => t.type === 'page');
  // 排除 devtools 前端自身
  const app = pages.find((t) => t.url && !/devtools\.frontend|chrome-devtools/.test(t.url));
  return app || pages[0];
}

const INJECT_FN = `
(() => {
  const ID = 'forest-theme-skin';
  const GLOW = 'forest-theme-bg';
  const css = ${JSON.stringify(readFileSync(CSS_PATH, 'utf8'))};
  let el = document.getElementById(ID);
  if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el); }
  el.textContent = css;
  let glow = document.getElementById(GLOW);
  if (!glow) { glow = document.createElement('div'); glow.id = GLOW; document.body.appendChild(glow); }
  // 清掉任何残留的内联样式(如诊断时临时换的蓝色渐变), 让 <style> 里的规则接管
  glow.removeAttribute('style');
  glow.style.cssText = '';
  // 清除气泡/输入栏上可能被应用写入的内联 background, 确保半透明规则生效
  const strip = [
    '._assistantMessage_14nyt_190', '._assistantMessageContent_14nyt_202',
    '._assistantTextContent_14nyt_207', '._editable_5t975_1',
    '._input-area-container_1akz6_19'
  ];
  strip.forEach(s => document.querySelectorAll(s).forEach(el => {
    el.style.removeProperty('background-color');
    el.style.removeProperty('background');
    el.style.removeProperty('background-image');
  }));
  // ---------- 清理流式生成残留的空 AI 消息气泡 ----------
  // WorkBuddy 流式回复时, 每收到一段会先 push 一条空 message 壳子等下一 chunk 填内容.
  // 异常情况下这些壳子没填上也没清, 残留成 1px 高的 "空气泡", 我设的半透明+玉边让它们
  // 显现为多条细横线. 周期性扫描: 内部内容完全空 且 高度<=2px 的就 display:none,
  // 一旦有 chunk 填入(textContent 变化)自动解除隐藏, 不破坏流式生成.
  if (!window.__forest_empty_cleaner) {
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
    window.__forest_empty_cleaner = setInterval(tick, 300);
    tick();
  }
  // ---------- 被动捕获命令面板 / 其他高 z 浮层类名 ----------
  // Ctrl+K 等由 Electron 全局快捷键在渲染进程外触发, CDP 无法复现; 这里用 MutationObserver
  // 在用户真实操作时记录浮层类名到 window.__forest_overlay_log, 供后续精修 CSS。
  // 只检查"被新增的节点自身"(不扫描后代), 避免聊天流式写入时高频回调拖慢渲染。
  if (!window.__forest_overlay_log) window.__forest_overlay_log = [];
  if (!window.__forest_overlay_observer) {
    const log = window.__forest_overlay_log;
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
    window.__forest_overlay_observer = obs;
  }
  // ---------- 标记"发送"按钮 -> 泛光玉色 ----------
  // 用"结构"而非"图标颜色"识别: 发送图标在输入框为空时常变灰(teal 为启用态),
  // 若按颜色标记, 空输入时会被取消标记、圆角框回弹, 不符合需求.
  // 1) 对话底部输入框: ._inputBottom_* 内最右侧"纯图标无文字"的 button/[role=button]
  // 2) 欢迎页/新建任务: ._topRightSlotStandalone_* 内唯一 button
  // 3) 兜底: 含 teal 图标 + 小尺寸 + 无文字(覆盖结构微调)
  // 仅添加、绝不移除, 保证空输入/有内容各状态都保持泛光玉色.
  // 重注入时清理旧实例(否则旧 interval / 旧监听器仍跑旧逻辑, 导致标记被撤销)
  if (window.__forest_send_marker) clearInterval(window.__forest_send_marker);
  if (window.__forest_send_markFn) {
    document.removeEventListener('focusin', window.__forest_send_markFn, true);
    document.removeEventListener('input', window.__forest_send_markFn, true);
  }
  {
    const isTeal = (rgb) => {
      if (!rgb || rgb === 'none' || rgb === 'transparent') return false;
      const m = rgb.match(/\\d+/g); if (!m || m.length < 3) return false;
      const r = +m[0], g = +m[1], b = +m[2];
      return g > 120 && r < 120 && b < 180 && (g - r) > 40;
    };
    const markOnce = () => {
      // 1) 对话底部输入框发送按钮(最右侧纯图标按钮)
      document.querySelectorAll('[class*="_inputBottom"]').forEach(bar => {
        const btns = [...bar.querySelectorAll('button,[role="button"]')];
        for (let i = btns.length - 1; i >= 0; i--) {
          const b = btns[i];
          if ((b.textContent || '').replace(/\\s/g, '') === '' && b.querySelector('svg')) { b.classList.add('__forest_send'); break; }
        }
      });
      // 2) 欢迎页/新建任务 发送按钮
      document.querySelectorAll('[class*="_topRightSlotStandalone"]').forEach(slot => {
        const b = slot.querySelector('button,[role="button"]');
        if (b) b.classList.add('__forest_send');
      });
      // 3) 兜底: teal 图标 + 小尺寸 + 无文字
      document.querySelectorAll('button,[role="button"]').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.width > 40 || r.height > 40) return;
        if ((b.textContent || '').replace(/\\s/g, '') !== '') return;
        let teal = false;
        b.querySelectorAll('svg path,svg circle,svg rect,svg polygon,span,i').forEach(s => {
          const cs = getComputedStyle(s);
          if (isTeal(cs.fill) || isTeal(cs.stroke) || isTeal(cs.color) || isTeal(cs.backgroundColor)) teal = true;
        });
        if (teal) b.classList.add('__forest_send');
      });
    };
    window.__forest_send_markFn = markOnce;
    window.__forest_send_marker = setInterval(markOnce, 800);
    markOnce();
    document.addEventListener('focusin', markOnce, true);
    document.addEventListener('input', markOnce, true);
  }
  return 'forest-theme skin applied, len=' + css.length;
})()
`;

const REMOVE_FN = `
(() => {
  document.getElementById('forest-theme-skin')?.remove();
  document.getElementById('forest-theme-bg')?.remove();
  return 'forest-theme skin removed';
})()
`;

const INSPECT_FN = `
(() => {
  const cs = getComputedStyle(document.documentElement);
  const vars = {};
  for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (k.startsWith('--')) vars[k] = cs.getPropertyValue(k); }
  const classes = new Set();
  document.querySelectorAll('*').forEach(e => e.classList && e.classList.forEach(c => classes.add(c)));
  // 取前 60 个看起来像布局/面板的类名
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connectAndInject() {
  console.log(`[forest-theme] 连接 127.0.0.1:${PORT} ...`);
  const targets = await getTargets();
  const target = pickTarget(targets);
  if (!target) throw new Error('未找到 page 类型调试目标');
  console.log(`[forest-theme] 目标窗口: ${target.title || target.url}`);

  const cdp = cdpConnect(target.webSocketDebuggerUrl);
  await cdp.waitOpen();
  await cdp.send('Runtime.enable');

  const fnMap = { inject: INJECT_FN, remove: REMOVE_FN, inspect: INSPECT_FN };
  const expr = fnMap[mode];
  if (!expr) throw new Error('未知模式: ' + mode + ' (用 inject|inspect|remove)');

  const res = await cdp.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails) {
    console.error('[forest-theme] 执行出错:', res.result.exceptionDetails);
  } else if (mode === 'inspect') {
    console.log('[forest-theme] 真实 DOM / 变量快照:\n' + res.result?.result?.value);
  } else {
    console.log('[forest-theme]', res.result?.result?.value);
  }
  cdp.close();
}

async function main() {
  // WorkBuddy 拉起后 CDP HTTP 服务可能晚几秒才就绪; 这里做重试,
  // 避免 bat 的端口探测在"端口刚 bind 但 HTTP 未开"时误判已开导致一把 fetch failed。
  const MAX = 40;   // 最多 40 次
  const WAIT = 1000; // 每次间隔 1s → 最长等待 ~40s
  let lastErr;
  for (let i = 1; i <= MAX; i++) {
    try {
      await connectAndInject();
      return;
    } catch (e) {
      lastErr = e;
      if (i < MAX) {
        console.log(`[forest-theme] 端口尚未就绪 (${e.message}), ${WAIT / 1000}s 后重试 (${i}/${MAX})...`);
        await sleep(WAIT);
      }
    }
  }
  throw lastErr;
}

main().catch((e) => {
  console.error('[forest-theme] 失败:', e.message);
  console.error('提示: 确认 WorkBuddy 已用 --remote-debugging-port=' + PORT + ' 启动, 且本机可访问 127.0.0.1:' + PORT);
  process.exit(1);
});
