# Arbor v0.1 设计交付包

Arbor 是一个纯前端、可部署到 GitHub Pages 的树状 AI 学习工具。

核心不是“把聊天画成脑图”，而是把每次 AI 回答拆成可继续追问的知识模块：
- 用户可以基于整条回答继续提问；
- 也可以选中某个知识模块作为锚点继续提问；
- 每次追问形成新的树枝；
- 当前聊天区始终只展示当前路径，保持 ChatGPT 式阅读体验；
- Tree 面板只负责回看、切换和定位分支。

## 目录

- `docs/01_PRODUCT_AND_UI_DESIGN.md`
  - v0.1 产品目标
  - 页面结构
  - 核心交互
  - 状态设计
  - 数据模型
  - 第一版功能边界

- `docs/02_TECHNICAL_DESIGN.md`
  - 推荐技术栈
  - Provider Adapter
  - Anthropic / OpenAI Responses / Chat Completions 抽象
  - IndexedDB 数据层
  - Path Context
  - 结构化回答协议
  - GitHub Pages 部署
  - 安全与 CORS

- `docs/03_DEVELOPMENT_RULES.md`
  - 简洁开发规范
  - UI/交互约束
  - 代码组织
  - 状态与错误处理
  - 禁止事项

- `docs/04_CODEX_PROMPT.md`
  - 可直接交给 Codex 的开发 Prompt

- `prototype/index.html`
- `prototype/styles.css`
- `prototype/app.js`
  - 无框架静态交互原型
  - 可直接双击打开或作为 GitHub Pages 静态页面查看
  - 包含亮暗模式、Tree 抽屉、设置页、模块锚定、模拟继续提问

- `assets/arbor-ui-spec.svg`
  - 三个核心界面的结构效果图：聊天、Tree 抽屉、设置页

## v0.1 核心验收标准

1. 打开站点直接进入聊天页，无欢迎页。
2. 可配置多个 Provider，并切换默认 Provider。
3. 支持 Anthropic / OpenAI Responses / Chat Completions 三类协议适配。
4. 回答支持结构化 section。
5. section 可点击成为提问锚点。
6. 追问形成树状 Conversation Node。
7. 当前聊天区只展示当前 Branch/Path。
8. Tree 面板可查看与切换分支。
9. 会话、Provider、偏好设置保存在浏览器本地。
10. 支持亮/暗模式。
11. 支持流式输出、中止生成、失败重试。
12. 静态构建后可直接部署 GitHub Pages。

第一版不要加入：RAG、文件上传、Agent、Flashcard、知识库、账号系统、云同步、多人协作、复杂 Canvas 图谱。
