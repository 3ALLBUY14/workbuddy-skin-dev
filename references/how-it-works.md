# 原理简述

本 Skill 通过 **Chrome DevTools Protocol (CDP)** 给 WorkBuddy 桌面客户端换肤，核心思路是「注入」而非「修改」。

## 流程

1. WorkBuddy 以 `--remote-debugging-port=9222` 启动，暴露 CDP HTTP 端点（`http://127.0.0.1:9222/json`）。
2. `inject.mjs` 经 `Runtime.evaluate` 在渲染进程里插入一个 `<style>`（含皮肤 CSS），并附带通用修复：
   - 清理流式空气泡（empty bubble）
   - 被动捕获浮层类名（MutationObserver）
   - 给发送按钮加 marker class（用于定位与配色）
3. 全部在**内存态**，重启即失；启动器（`launch.mjs`）每次拉起时自动重注，故 WorkBuddy 更新不受影响。

## 为什么不动 app.asar

- 改 `app.asar` 有崩坏风险，且 WorkBuddy 更新会覆盖，需每次重打补丁。
- CDP 注入是零侵入方案：不碰安装目录，更新免疫，删除即还原。

## 皮肤 = 配置 + CSS

- `skin.config.json` 描述皮肤：`css`（CSS 文件路径）、`id`（注入 style 的标识）、`marker`（发送按钮 marker class）、`glow`（背景层 id）、`port`（调试端口）。
- 换皮肤只需换 CSS 文件 + 改配置，注入逻辑完全复用。

## 已知限制

- CSS Modules 哈希类名（如 `_14nyt_190`）会随 WorkBuddy 版本变化，新版本请用 `inject.mjs inspect` 复查目标类名。
- 注入为内存态，重启后需重新套用（启动器已自动处理）。
