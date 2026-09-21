# Codex 开发 Prompt

在当前仓库实现 Arbor v0.1：一个纯前端、可部署 GitHub Pages 的树状 AI 学习工具。

请先阅读本交付包中的：
- `docs/01_PRODUCT_AND_UI_DESIGN.md`
- `docs/02_TECHNICAL_DESIGN.md`
- `docs/03_DEVELOPMENT_RULES.md`
- `prototype/`

然后直接实现，不要重新设计产品。

核心要求：

1. React + TypeScript + Vite，纯前端。
2. 首页直接进入 ChatGPT 式聊天页，不做欢迎页。
3. 支持多个 Provider：
   - Anthropic
   - OpenAI Responses
   - Chat Completions
   可配置 name、base URL、API key、model，并测试连接、切换 active provider。
4. Provider 必须通过统一 Adapter 实现，业务层不得直接依赖各 API 原始格式。
5. AI 回答使用结构化 `intro + sections[] + outro`。
6. section 视觉上保持文章式排版，点击后成为 Anchor；发送追问时创建新的 Conversation Node。
7. Conversation 使用 `parentNodeId` 形成树。当前聊天区只展示 root 到 currentNode 的当前 Path。
8. Tree 使用右侧抽屉树形目录，可切换任意分支；不要做 Canvas 脑图。
9. 构建模型上下文时只发送当前 Path。若子节点有 anchorSectionId，则父回答只带相关 section，而不是所有兄弟 section。
10. IndexedDB 保存 conversations、nodes、providers、preferences。
11. 支持流式输出、中止、重试、错误状态。
12. 支持 Light / Dark / System。
13. 支持 User System Prompt、回答详细度、Section 粒度。
14. 支持单会话导出和全量 JSON 备份/恢复；默认不导出 API key。
15. 使用 Hash Router，保证 GitHub Pages 子路径部署正常。
16. 桌面优先，移动端基本可用。
17. UI 按 prototype 和文档实现：白/黑/灰为主，少量蓝色，不用渐变、玻璃拟态、发光和大面积卡片。
18. 对 `buildPath`、`buildContext`、structured answer parser、Provider URL/error mapping 写单元测试。

第一版不要加入 RAG、文件上传、Agent、Web Search、Quiz、Flashcard、账号、云同步、Canvas 图谱。

实现顺序：
数据模型 → IndexedDB → Provider Adapter → Chat → Structured Answer/Anchor → Tree → Settings → Import/Export → 测试 → GitHub Pages workflow。

完成后：
- 运行 lint/typecheck/test/build；
- 修复问题；
- 更新 README，写明本地开发、Provider 配置、GitHub Pages 部署、纯前端 API Key/CORS 限制。
