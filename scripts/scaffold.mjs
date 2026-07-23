// scaffold.mjs — 创建一个全新的、自包含的 WorkBuddy 皮肤项目
// 用法: node scaffold.mjs [皮肤名] [目标目录]
//   皮肤名  默认 my-skin (用于 css 文件名 / 皮肤 id)
//   目标目录 默认当前目录
//
// 产出 (在 <目标目录>/<皮肤名>/ 下):
//   <皮肤名>.css     皮肤样式 (从 template.css 复制, 占位符已替换)
//   skin.config.json 皮肤配置 (css / id / marker / port)
//   inject.mjs       注入器 (框架副本)
//   launch.mjs       启动器 (框架副本)
//   gen-share.mjs    分享入口生成器 (框架副本)
//   启动.bat/.vbs 或 launch.command/.sh  双击即用入口 (按当前系统)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.join(__dirname, '..');
const NODE = process.execPath;

const name = process.argv[2] || 'my-skin';
const targetDir = path.resolve(process.argv[3] || process.cwd(), name);
const id = (name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'skin');
const marker = '__skin_accent';

function copyIf(src, dst) {
  if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
  else console.log('  跳过已存在:', path.basename(dst));
}

if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length) {
  console.log('目标目录已存在且非空:', targetDir);
  console.log('如需重建, 请先清空或换一个皮肤名。已存在文件不会被覆盖 (除框架 .mjs)。');
}

fs.mkdirSync(targetDir, { recursive: true });

// 1) 框架脚本
fs.copyFileSync(path.join(__dirname, 'inject.mjs'), path.join(targetDir, 'inject.mjs'));
fs.copyFileSync(path.join(__dirname, 'launch.mjs'), path.join(targetDir, 'launch.mjs'));
fs.copyFileSync(path.join(__dirname, 'gen-share.mjs'), path.join(targetDir, 'gen-share.mjs'));

// 2) 皮肤配置
const cfgPath = path.join(targetDir, 'skin.config.json');
if (!fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, JSON.stringify({
    css: `${name}.css`,
    id,
    marker,
    port: 9222,
  }, null, 2) + '\n', 'utf8');
}

// 3) 皮肤 CSS (模板 + 占位符替换)
const cssPath = path.join(targetDir, `${name}.css`);
if (!fs.existsSync(cssPath)) {
  let tpl = fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'template.css'), 'utf8');
  tpl = tpl.replace(/__SKIN_ID__/g, id).replace(/__SKIN_MARKER__/g, marker);
  fs.writeFileSync(cssPath, tpl, 'utf8');
}

console.log('✅ 皮肤项目已创建:', targetDir);
console.log('   css   :', `${name}.css`);
console.log('   id    :', id);
console.log('   marker:', marker);
console.log('   接下来: 编辑', `${name}.css`, '调色; 用 `node inject.mjs inspect` 抓真实类名; 双击启动入口套用。');

// 4) 生成分享入口
const r = spawnSync(NODE, [path.join(targetDir, 'gen-share.mjs')], { cwd: targetDir, stdio: 'inherit' });
process.exit(r.status || 0);
