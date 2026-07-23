# WorkBuddy DOM 目标参考

皮肤靠这些类名定位元素。**注意**: WorkBuddy 使用 CSS Modules,类名带内容哈希
(如 `_14nyt_190`),会随版本变化。下表是"森系皮肤"开发时(某版本)抓到的真实目标,
仅供起步;新版本请用 `node inject.mjs inspect` 复核。

## 布局 / 容器
| 选择器 | 含义 |
|--------|------|
| `.teams-container` / `.teams-content-wrapper` / `.teams-main-content` | 团队视图根容器 |
| `.main-content` / `.main-content--chat` | 主内容区 |
| `.chat-container` / `.wb-cb-chat` / `._cbChat_1akz6_7` | 聊天容器 |
| `.conversation-sidebar` | 左侧会话栏 |
| `.conversation-list` / `.conversation-list-header` / `.conversation-list-content` | 会话列表及头部 |
| `.conversation-section-content` / `.collapsible-section-content` | 折叠分区 |
| `.workbuddy-topbar` / `.workbuddy-topbar-option` | 顶部菜单栏 |

## 消息气泡
| 选择器 | 含义 |
|--------|------|
| `._gridViewItem_48kdk_14` | 首页/欢迎页网格项(包裹气泡) |
| `._assistantMessage_14nyt_190` | AI 消息气泡(外层) |
| `._assistantMessageContent_14nyt_202` / `._assistantTextContent_14nyt_207` | 气泡内容块 |
| `._assistantRow_14nyt_184` | AI 消息行 |
| `._chatMessageContainer_14nyt_72` / `._chatMessage_14nyt_72` / `._chatMessageBox_14nyt_114` | 消息容器 |

## 输入区 / 发送
| 选择器 | 含义 |
|--------|------|
| `._input-area-container_1akz6_19` | 对话底部输入区 |
| `[class*="_inputBottom"]` | 输入栏(发送按钮所在) |
| `[class*="_topRightSlotStandalone"]` | 欢迎页/新建任务 右上发送位 |
| `._editable_5t975_1` | 可编辑输入框 |

## 产物 / 浮层
| 选择器 | 含义 |
|--------|------|
| `.artifact-slot-panel` / `.artifact-slot-panel__actions` | 产物区及操作条 |
| `*[class*="modal"]` / `*[class*="overlay"]` / `*[class*="palette"]` / `*[class*="command"]` | 命令面板 / 弹窗浮层(注入器被动捕获,见 `window.__<id>_overlay_log`) |

## 注入器自动加的 class(供皮肤样式)
| class | 何时出现 | 用途 |
|-------|----------|------|
| `.__forest_send`(默认 marker) | 发送/强调按钮 | 上"泛光强调"样式,皮肤只管给它上色 |
| `#<id>-bg`(或 `glow` 配置) | 背景层 | 固定背景/氛围渐变,`position:fixed; inset:0; z-index:-1` |

## 复核命令
```
node inject.mjs inspect
```
输出 `interestingClasses`(按关键词过滤的类名)与 `sampleVars`(`:root` CSS 变量)。
把变化后的类名回填到 CSS 即可。
