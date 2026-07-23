---
name: workbuddy-skin-dev
description: "Build, preview, and share custom themes (skins) for the WorkBuddy desktop client without modifying its install directory or app.asar. Use when the user wants to create a WorkBuddy skin, restyle the WorkBuddy UI, inject CSS into the WorkBuddy renderer process, package a shareable WorkBuddy theme, or mentions WorkBuddy 皮肤 / 换肤 / 主题 / CDP 注入 / forest theme. Provides a generic CDP injector (inject / remove / inspect), a cross-platform auto-launcher, a one-command scaffold for new skins, and a bundled, proven 东方森系 reference skin."
agent_created: true
version: 1.0.0
---

# WorkBuddy 皮肤开发

给 WorkBuddy 桌面客户端做皮肤的一套可复用方法。核心:**通过 Chrome DevTools Protocol (CDP)
把一段 CSS 注入渲染进程**,不修改安装目录、不碰 `app.asar`。重启即失,但启动器每次自动重注,
因此 WorkBuddy 更新免疫。

## 何时使用
- 用户想给 WorkBuddy 换肤 / 做主题 / 改界面外观。
- 用户提到"皮肤""换肤""主题""CDP 注入""forest theme"。
- 用户想把自己做的皮肤打包分享给别人(双击即用、绿色卸载)。

## 工具 (scripts/)
全部零第三方依赖,仅需 Node 22+(全局 WebSocket / fetch)。

- `scripts/inject.mjs` — 通用 CDP 注入器。三模式:
  - `node inject.mjs inject` 注入(读 `skin.config.json`,幂等可覆盖)
  - `node inject.mjs remove` 还原官方皮肤
  - `node inject.mjs inspect` 只读打印真实 CSS 变量/类名,用于精修
  - 支持 `--css / --id / --marker / --port` 覆盖配置。
- `scripts/launch.mjs` — 跨平台启动器。自动探测 WorkBuddy 与 node,拉起带
  `--remote-debugging-port` 的实例,等端口就绪后注入(已运行则直接注入,幂等)。
- `scripts/scaffold.mjs` — 一键生成自包含新皮肤项目:`node scaffold.mjs 皮肤名 [目录]`。
- `scripts/gen-share.mjs` — 为皮肤文件夹生成双击即用入口(按当前系统:Windows `.vbs`/`.bat`,
  macOS `launch.command`, Linux `launch.sh`)。

## 内置资源 (assets/ + 根)
- `skin.config.json` — 当前皮肤配置。技能自带指向 `assets/forest-theme-skin.css`(森系参考皮肤)。
- `assets/forest-theme-skin.css` — 已验证的"东方森系"皮肤(含背景图),开箱即用。
- `assets/template.css` — 极简起步皮肤(占位符 `__SKIN_ID__` / `__SKIN_MARKER__`)。

## 标准工作流 (四步循环)
1. **Inspect** — `node inject.mjs inspect` 抓真实类名 / CSS 变量。
2. **Author** — 写 name.css,用抓到的类名覆盖样式(半透明面板、统一 `--accent` 强调色)。
3. **Inject** — `node inject.mjs inject` 实时预览;`remove` 还原。
4. **Share** — `node scaffold.mjs 皮肤名` 生成可分享文件夹,对方双击入口即用。

完整说明见 `references/workflow.md`;类名随版本变化的应对见 `references/dom-targets.md`;
`.bat` 编码、端口等待、node 路径等坑见 `references/pitfalls.md`。

## 在技能内直接套用森系皮肤
技能根目录已配好 `skin.config.json`(指向森系皮肤)。在本技能目录下:
```
node launch.mjs
```
自动启动 WorkBuddy 并注入森系皮肤。

## 关键约定
- 发送/强调按钮由注入器自动加一个 marker class(默认 `__forest_send`,可配),**皮肤只管给它上样式**,
  不要靠颜色识别(空输入时常变灰)。
- 全屏根容器设 `transparent`,氛围交给固定背景层(`#id-bg` 或配置里的 `glow`)。
- 类名带哈希,大版本更新后重跑 `inspect` 复核。
