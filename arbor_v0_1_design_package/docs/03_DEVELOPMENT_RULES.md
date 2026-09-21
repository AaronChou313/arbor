# Arbor 简洁开发规范

## 1. 产品原则

1. 进入网站直接是 Chat，不做欢迎页。
2. 主体验必须像聊天工具，不像脑图工具。
3. Tree 只做导航，不做主工作区。
4. Section 是回答锚点，不是独立页面。
5. 当前聊天只显示当前 Path。
6. 默认少选项、少按钮、少卡片。
7. 蓝色只用于关键状态和主要操作。

---

## 2. UI 规范

- 不使用渐变。
- 不使用玻璃拟态。
- 不使用发光。
- 不堆叠大圆角卡片。
- 默认圆角 8–12px。
- 默认边框 1px。
- 主内容最大宽度 820px。
- 亮色主背景白色。
- 暗色主背景深灰黑。
- 所有颜色必须来自 design token。
- 所有 hover/focus/disabled 状态必须存在。
- 键盘 focus 必须可见。

---

## 3. 组件原则

组件只做一件事。

推荐拆分：

```text
Sidebar
ChatHeader
MessagePath
AssistantAnswer
AnswerSection
AnchorChip
Composer
TreeDrawer
TreeNode
ProviderList
ProviderEditor
PreferencesForm
```

禁止单个 `ChatPage.tsx` 同时承担：
- IndexedDB
- API 请求
- Tree 计算
- Markdown 解析
- UI 渲染

---

## 4. 数据原则

- Conversation 与 Node 分开存。
- Node 使用 parentNodeId。
- Section 不是 Node。
- Anchor 存在 child Node 上。
- Provider API 原始格式不进入业务层。
- 所有持久化模型必须有明确 TypeScript 类型。
- 所有导出格式必须带 schemaVersion。

---

## 5. Provider 原则

- 所有 API 都经 Adapter。
- UI 不判断 Anthropic/OpenAI 的 response 字段。
- Base URL 不散落在组件中。
- API Key 不写入日志。
- 错误统一映射 AppError。
- Abort 必须统一支持。

---

## 6. 状态管理

Zustand/运行态只保存：
- 当前 conversationId
- currentNodeId
- draft
- selectedAnchor
- generating 状态
- drawer 状态

长期数据以 IndexedDB 为准。

不要把整个数据库镜像到一个巨型全局 Store。

---

## 7. 错误处理

不要：

`Something went wrong`

优先：

- API key rejected
- Model not found
- Browser request blocked by CORS
- Rate limit reached
- Response format could not be parsed

结构化解析失败：
- 保留原始回答；
- 回退普通 Markdown；
- 不丢回答。

---

## 8. 代码质量

- TypeScript strict。
- 禁止大范围 `any`。
- 纯函数优先。
- 路径计算和上下文构建必须有单测。
- 复杂逻辑先写类型，再写实现。
- 不提前抽象未来不存在的功能。
- 不为 v0.1 创建插件系统。

---

## 9. CSS

- Design Tokens 集中在 `tokens.css`。
- 组件禁止硬编码主题颜色。
- 不使用 `!important` 解决布局问题。
- 页面布局优先 CSS Grid / Flex。
- 动画 120–220ms。
- 尊重 `prefers-reduced-motion`。

---

## 10. Git

每个提交聚焦单一主题。

推荐：

```text
feat: add conversation tree model
feat: add chat completions adapter
fix: preserve anchor when generation retries
style: refine dark mode section hover
test: cover path context builder
```

不要把“大范围重构 + 新功能 + 样式修改”混在同一提交。

---

## 11. v0.1 禁止扩展

开发过程中不要顺手加入：

- RAG
- 文件上传
- Web search
- Agent
- Quiz
- Flashcard
- 知识库
- Canvas
- 登录
- 云同步
- 多人协作

除非核心版完成后单独开新版本。
