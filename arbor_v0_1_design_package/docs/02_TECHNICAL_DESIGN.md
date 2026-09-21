# Arbor v0.1 技术设计

## 1. 推荐技术栈

建议：

- React
- TypeScript
- Vite
- React Router
- Zustand（仅 UI/会话运行态）
- IndexedDB（持久化）
- `idb` 或等价轻量封装
- Markdown renderer
- KaTeX
- ESLint + Prettier
- Vitest
- Playwright（核心交互 E2E）

不要引入大型 UI 框架。

理由：
- Arbor 的视觉需要高度接近原生 ChatGPT 式简洁布局；
- 大型组件库容易带来明显“模板感”；
- 自定义 CSS + 少量无头组件更容易控制。

---

## 2. 推荐目录

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  └─ providers.tsx
│
├─ pages/
│  ├─ ChatPage/
│  └─ SettingsPage/
│
├─ components/
│  ├─ layout/
│  ├─ chat/
│  ├─ tree/
│  ├─ settings/
│  └─ common/
│
├─ features/
│  ├─ conversations/
│  ├─ generation/
│  ├─ providers/
│  ├─ structured-answer/
│  └─ preferences/
│
├─ lib/
│  ├─ db/
│  ├─ provider-adapters/
│  ├─ context/
│  ├─ export/
│  └─ utils/
│
├─ styles/
│  ├─ tokens.css
│  ├─ globals.css
│  └─ markdown.css
│
└─ types/
```

---

## 3. Provider Adapter

UI 和会话逻辑绝对不能直接依赖某个 API。

统一接口：

```ts
export type GenerateInput = {
  systemPrompt: string;
  messages: CanonicalMessage[];
  model: string;
  signal?: AbortSignal;
};

export type StreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "done" };

export interface ProviderAdapter {
  test(config: ProviderConfig): Promise<TestResult>;

  stream(
    config: ProviderConfig,
    input: GenerateInput
  ): AsyncGenerator<StreamEvent>;
}
```

实现：

```text
AnthropicAdapter
OpenAIResponsesAdapter
ChatCompletionsAdapter
```

页面只调用：

`providerService.stream(...)`

---

## 4. Canonical Message

先把 Arbor 自己的 Path Context 转成统一消息：

```ts
type CanonicalMessage = {
  role: "user" | "assistant";
  content: string;
};
```

再由 Adapter 映射到具体协议。

不要在 Conversation Node 中保存各家 API 原始 request body。

---

## 5. ProviderConfig

```ts
type ProviderProtocol =
  | "anthropic"
  | "openai-responses"
  | "chat-completions";

type ProviderConfig = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};
```

Provider 可加：

```ts
extraHeaders?: Record<string, string>;
```

但 v0.1 UI 不主动展示复杂 Header 编辑器。
可以放到 Advanced JSON 中作为后续兼容点。

---

## 6. Base URL

不要硬编码成只能用官方地址。

每种协议提供默认值占位提示，但用户可完全修改。

URL 拼接必须集中到 Adapter 内。

例如不要在 UI 写：

```ts
fetch(`${baseUrl}/v1/messages`)
```

统一使用：

```ts
normalizeBaseUrl()
joinApiPath()
```

处理：
- 尾部 `/`
- 用户填到 `/v1`
- 用户直接填完整 endpoint
- 自定义中转站

建议 Provider 配置同时保存：

```ts
baseUrlMode: "base" | "endpoint"
```

若第一版不想增加 UI，可先明确约定：
- Base URL 只填写协议根地址；
- Adapter 负责补 path。

---

## 7. API Key

纯前端无法真正隐藏用户 API Key。

原则：

- 默认仅当前设备使用；
- UI 明确提示“密钥直接从当前浏览器发送到你配置的模型服务”；
- 不上传 Arbor 自有服务，因为 v0.1 不存在 Arbor 后端；
- 列表和日志中不得输出 key；
- 导出数据默认不包含 key；
- “包含 Provider 密钥”必须是用户主动开启的高级选项；
- 错误日志必须做 secret redaction。

本地存储可支持两种：

```text
Session only
Remember on this device
```

Session only：
- sessionStorage 或内存。

Remember：
- IndexedDB。

不要声称浏览器存储等于安全保险箱。

---

## 8. CORS

纯前端应用必须把 CORS 当成正式产品状态，而不是“网络错误”。

Test Connection 结果建议：

```ts
type TestResult = {
  ok: boolean;
  stage:
    | "network"
    | "cors"
    | "auth"
    | "model"
    | "unknown";
  message: string;
};
```

UI 示例：

```text
Connection test

✓ Endpoint reachable
✓ Authentication accepted
✓ Model available
```

失败示例：

```text
Browser request was blocked by CORS.
This endpoint cannot currently be used directly from GitHub Pages.
```

不要把所有失败都显示成 `Invalid API key`。

---

## 9. IndexedDB

建议数据库：

```text
arbor
```

Stores：

```text
conversations
nodes
providers
preferences
```

索引：

```text
nodes.conversationId
nodes.parentNodeId
conversations.updatedAt
```

Provider 的 session-only key 不入库。

---

## 10. Conversation Tree

不要把整棵树嵌套存成一个巨大 JSON。

使用扁平节点表：

```ts
nodes[id] = {
  id,
  parentNodeId,
  ...
}
```

优势：
- 更新单节点容易；
- IndexedDB 查询简单；
- 不需要深层不可变更新；
- 导出时再组树。

---

## 11. 获取当前 Path

```ts
async function getPath(currentNodeId: string) {
  const path = [];
  let node = await nodeRepo.get(currentNodeId);

  while (node) {
    path.push(node);
    node = node.parentNodeId
      ? await nodeRepo.get(node.parentNodeId)
      : null;
  }

  return path.reverse();
}
```

如节点很多，可在 store 中缓存当前 conversation 的 nodes map。

---

## 12. 构建 Path Context

```ts
buildContext(path)
```

规则：

对路径中每个 Node：

1. 添加 userMessage；
2. 如果该 Node 的 child 是基于某个 anchor 进入：
   - assistant 只放 intro + 被选 section；
3. 如果 child 没 anchor：
   - assistant 放完整结构化回答；
4. 当前最后一个 Node：
   - assistant 不存在时只放 userMessage。

注意 anchor 实际存储在“子 Node”上，因此构建父回答时要查看 `nextNode.anchorSectionId`。

---

## 13. Structured Answer

推荐让模型返回稳定的机器可解析格式。

可以使用：

```json
{
  "intro": "...",
  "sections": [
    {
      "id": "unique-short-id",
      "title": "...",
      "content": "Markdown..."
    }
  ],
  "outro": "..."
}
```

### 解析策略

第一版优先稳定性：

1. streaming 时先显示实时文本；
2. 完成后解析 JSON；
3. 成功：渲染为 sections；
4. 失败：fallback 为普通 Markdown 回答；
5. fallback 回答不可 section-anchor，或由前端根据一级标题做临时 section。

不要因为结构化解析失败让整次回答丢失。

---

## 14. System Prompt 组成

```text
[Arbor structural system prompt]
[User custom system prompt]
[Response preferences]
```

Arbor structural prompt 负责：
- 输出格式；
- section 数量；
- section 粒度；
- 标题短；
- content 可包含 Markdown/LaTeX；
- 不输出多层结构化 section。

Response preferences 映射：

```text
Concise -> 2-4 sections
Balanced -> 3-6 sections
Detailed -> 4-8 sections
```

只是目标，不要求模型机械凑数。

---

## 15. 流式策略

生成流程：

```text
send
→ create pending node
→ call adapter.stream
→ status=streaming
→ append rawText
→ done
→ parse structured answer
→ status=done
→ persist
```

Stop：

```text
AbortController.abort()
→ status=aborted
→ persist current rawText
```

Retry：
- 不新建 sibling；
- 默认重新生成当前 Node 的 assistant；
- 用户若修改问题后再发，则创建新节点。

---

## 16. 错误模型

统一：

```ts
type AppErrorCode =
  | "NETWORK"
  | "CORS"
  | "AUTH"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMIT"
  | "BAD_RESPONSE"
  | "ABORTED"
  | "UNKNOWN";
```

Adapter 负责把各 API 错误映射到 AppError。

组件禁止直接解析供应商错误格式。

---

## 17. Tree 计算

通过扁平 nodes 构建 children map：

```ts
Map<parentNodeId, ConversationNode[]>
```

Tree 展示标题：
优先：
1. userMessage 截断；
2. 如果 Node 是 anchor 提问，可显示 anchor title 作为次信息。

不要使用 section 本身直接作为 Node。
Section 是 Anchor，不是 Conversation Node。

---

## 18. 导入导出

### 单会话导出

```json
{
  "schemaVersion": 1,
  "conversation": {},
  "nodes": []
}
```

### 全量备份

```json
{
  "schemaVersion": 1,
  "exportedAt": 0,
  "conversations": [],
  "nodes": [],
  "providers": [],
  "preferences": {}
}
```

默认 Provider 中：

```text
apiKey = omitted
```

导入必须：
- 校验 schemaVersion；
- id 冲突时重新生成或询问覆盖；
- 不执行任何导入文件中的代码。

---

## 19. GitHub Pages

应用必须支持：
- 静态构建；
- 相对资源路径；
- repository 子路径部署；
- 刷新路由不 404。

最简单方式：
- 使用 Hash Router；
或
- GitHub Pages 404 fallback。

v0.1 推荐 Hash Router，减少部署复杂度。

例如：

```text
/#/
/#/settings
```

若以后绑定自定义域名，可再换 History Router。

---

## 20. 响应式

桌面优先。

### >= 1024
- 固定左侧栏；
- 中间 Chat；
- Tree 右抽屉。

### 768–1023
- 左侧栏可折叠；
- Tree overlay。

### < 768
- 左侧栏 drawer；
- Tree 全高 overlay；
- 输入区贴底；
- section hover 行为改为明确的小图标按钮。

---

## 21. 可测试的核心逻辑

单元测试至少覆盖：

- `buildPath()`
- `buildContext()`
- Anchor context 裁剪
- Provider URL normalize
- Provider error mapping
- structured answer parser
- import schema validator

E2E 至少覆盖：

1. 配 Provider；
2. 新建聊天；
3. 发送问题；
4. 点击 section；
5. Anchor 追问；
6. Tree 返回父节点；
7. 另一 section 建第二分支；
8. 刷新后数据仍存在；
9. Dark mode；
10. 导出 JSON。

---

## 22. 第一版技术取舍

优先顺序：

```text
稳定聊天
> 分支正确
> Provider 兼容
> 本地持久化
> 视觉细节
> 高级功能
```

Arbor 最不能出错的是：
- 用户到底在哪条 Branch；
- 当前问题基于哪个 Anchor；
- 发给模型的 Path Context 是否正确。

这三个比动画和视觉效果重要得多。
