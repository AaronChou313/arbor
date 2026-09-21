# Arbor v0.1 产品与 UI 设计文档

## 1. 产品定位

Arbor 是一个树状 AI 学习工具。

普通 AI Chat 的上下文是单链：

`问题 → 回答 → 追问 → 回答 → 追问`

Arbor 的上下文是树：

```text
问题
├─ 基于回答整体继续追问
├─ 基于知识模块 A 追问
│  ├─ 基于 A1 继续追问
│  └─ 基于 A2 继续追问
└─ 基于知识模块 B 追问
```

产品目标：
- 保留 ChatGPT 式自然聊天体验；
- 让 AI 回答天然成为下一步学习入口；
- 允许用户在多个知识分支之间来回探索；
- 只把当前分支发送给模型，避免无关上下文膨胀；
- 保持纯前端、轻量、可自托管。

---

## 2. 产品名称

**Arbor**

副标语可选：

`Branch your learning.`

中文非正式称呼可用“知枝”，但产品主品牌建议只显示 Arbor。

---

## 3. v0.1 页面结构

只有两个一级页面：

1. Chat
2. Settings

Tree 不是独立页面，而是 Chat 内右侧抽屉。

### Chat

```text
┌───────────────┬────────────────────────────────────────────┐
│ Arbor         │ 当前会话标题                      Tree ◐   │
│ + New chat    │                                            │
│               │ User                                       │
│ Today         │ 最小二乘法有哪些类别？                      │
│ 最小二乘法    │                                            │
│ 卡尔曼滤波    │ Assistant                                  │
│              │ 概述……                                     │
│ Previous     │                                            │
│ CNN          │ 普通最小二乘                              ↗ │
│              │ 内容……                                     │
│              │                                            │
│              │ 总最小二乘                                ↗ │
│              │ 内容……                                     │
│              │                                            │
│ ⚙ Settings   │ [ 基于：总最小二乘 × ]                     │
│              │ Ask anything...                      Send   │
└───────────────┴────────────────────────────────────────────┘
```

### Settings

左侧保持主导航，右侧设置页采用垂直 section：

- Providers
- Response
- System Prompt
- Appearance
- Data

不做二级路由也可以；v0.1 一页完成。

---

## 4. 核心交互

### 4.1 新建会话

点击 `New chat`：
- 立即创建空草稿会话，或在用户真正发送第一条消息时落盘；
- 主区域清空；
- 输入框自动聚焦；
- 不出现欢迎页、引导页、模板选择页。

空状态只显示一行极简提示：

`Ask anything`

可在下方显示当前 Provider，但不要做大卡片。

---

### 4.2 AI 回答结构

回答由两部分组成：

```ts
type StructuredAnswer = {
  intro?: string;
  sections: AnswerSection[];
  outro?: string;
};

type AnswerSection = {
  id: string;
  title: string;
  content: string;
};
```

渲染原则：
- 视觉上仍然是一篇连续文章；
- section 不默认显示成大卡片；
- 默认仅通过标题、间距、hover 边框体现可点击；
- hover 时出现 `↗` 或“从这里继续”；
- section 可选中，但不能嵌套继续生成 subsection 树。

### 为什么 section 只允许一层

Arbor 已经有“对话树”。

如果 AI 回答内部继续创建多层结构树，会形成：
- 回答结构树；
- 对话分支树；

两套层级混在一起，用户会失去方向感。

因此：
- AI 可以使用普通 Markdown 小标题/列表；
- 只有顶层 `sections[]` 是“可作为 Anchor 的知识模块”。

---

## 5. Anchor：基于模块提问

### 5.1 选中

用户点击某个 section 后：

输入框上方出现：

`基于：总最小二乘 ×`

输入框继续保持可编辑。

此时还没有创建新节点。

### 5.2 发送

用户输入：

`TLS 具体怎么求解？`

发送后创建新的 Conversation Node：

```ts
{
  parentNodeId: "...",
  anchorSectionId: "tls",
  userMessage: "TLS 具体怎么求解？"
}
```

### 5.3 取消

点击 `×`：
- 清除 anchor；
- 后续问题基于当前整条回答继续。

---

## 6. 不选模块时的继续提问

如果用户直接输入：

`这些方法应该怎么选？`

则：

```ts
anchorSectionId = null
```

新问题仍然创建为当前 Node 的子节点，但其上下文来源是“当前回答整体”。

---

## 7. 当前 Path

用户实际阅读时，只显示当前路径。

例如树：

```text
A
├─ B
│  ├─ D
│  └─ E
└─ C
```

如果当前位于 D：

主聊天区只显示：

`A → B → D`

不会把 C、E 插到对话中。

顶部可显示轻量 Breadcrumb：

`最小二乘法 / TLS / 计算步骤`

面包屑不是必须在 v0.1 首屏永久显示，可以在存在 3 层以上时显示。

---

## 8. Tree 抽屉

点击顶部 `Tree`：

右侧滑出宽约 320–380px 的抽屉。

使用树形目录，不做自由 Canvas。

```text
最小二乘法
├─ 普通最小二乘
├─ 总最小二乘
│  └─ TLS 具体怎么求解？
│     ├─ SVD 是什么？
│     └─ 几何意义是什么？
└─ 非线性最小二乘
```

节点状态：

- 当前 Node：蓝色文字/淡蓝背景；
- 当前 Path 祖先：稍加粗；
- 其他节点：普通黑/白文字；
- hover：淡灰背景。

点击任意 Node：
- 将其设为 currentNodeId；
- 主聊天区重建该 Node 的 root-to-current path；
- Tree 抽屉可保持打开或在窄屏自动关闭。

Tree 的职责只有：
- 看见分支；
- 切换分支；
- 理解“我从哪里问到这里”。

不承担知识图谱分析。

---

## 9. 历史会话

左侧栏：
- `New chat`
- 最近会话列表
- Settings

会话标题：
- 第一条用户消息自动截取；
- AI 可异步生成短标题属于后续增强，v0.1 不依赖。

历史分组：
- Today
- Previous

不必实现复杂日期分组。

操作：
- 单击打开；
- hover 显示 `…`；
- rename；
- delete。

v0.1 不做文件夹、标签、收藏。

---

## 10. 输入区

输入区为固定底部浮动区域，最大宽度约 760–820px。

包含：
- Anchor chip；
- 多行 textarea；
- Provider/Model 轻量切换；
- Send；
- 生成中变为 Stop。

快捷键：
- Enter：发送；
- Shift+Enter：换行；
- Esc：生成时中止；未生成时清除 anchor。

---

## 11. Provider 设置

Provider 是用户自己创建的连接配置。

字段：

```text
Name
Protocol
Base URL
API Key
Model
```

Protocol：
- Anthropic
- OpenAI Responses
- Chat Completions

操作：
- Add Provider
- Test
- Save
- Set active
- Duplicate
- Delete

列表中只显示：
- Provider 名称
- 协议
- Model
- 是否 Active

API Key 永远不在列表明文显示。

---

## 12. Response 设置

第一版只保留：

### Detail
- Concise
- Balanced
- Detailed

### Section density
- Low
- Medium
- High

### Math
- Auto
- Prefer LaTeX

不要加入 temperature、top_p 等普通学习用户不理解的参数。
如需高级参数，后续放 Advanced。

---

## 13. System Prompt

两层：

### Arbor 内置系统约束
负责：
- 结构化输出；
- section 格式；
- 学习型回答风格；
- 不泄露内部 JSON 指令。

用户不可直接覆盖。

### User System Prompt
可选。

例如：

`我是测绘专业研究生，解释概念时优先结合线性代数、测量平差和机器人导航。`

最终模型上下文：

`Arbor system + User system + Path Context`

---

## 14. Appearance

- System
- Light
- Dark

视觉原则：

### Light
- 主背景白色；
- 主文字接近黑色；
- 次文字中灰；
- 边框浅灰；
- 主强调色蓝色。

### Dark
- 主背景深灰黑；
- 主文字接近白；
- 边框深灰；
- 保留同一蓝色强调。

避免：
- 蓝紫渐变；
- 霓虹；
- 发光；
- 玻璃拟态；
- 大面积彩色背景；
- 夸张大圆角；
- Dashboard 式卡片堆叠。

---

## 15. 推荐 Design Tokens

```css
:root {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-soft: #f7f7f8;
  --text: #111111;
  --text-secondary: #6b6b6b;
  --border: #e5e5e5;
  --hover: #f4f4f4;
  --accent: #2563eb;
  --accent-soft: #eff6ff;
  --danger: #dc2626;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --sidebar-width: 248px;
  --content-width: 820px;
  --tree-width: 360px;
}
```

暗色通过同名 token 覆盖，不在组件内写两套颜色。

---

## 16. Conversation 数据模型

```ts
type Conversation = {
  id: string;
  title: string;
  rootNodeId: string | null;
  currentNodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

type ConversationNode = {
  id: string;
  conversationId: string;
  parentNodeId: string | null;
  anchorSectionId: string | null;

  userMessage: string;

  assistant: {
    rawText?: string;
    intro?: string;
    sections: {
      id: string;
      title: string;
      content: string;
    }[];
    outro?: string;
  } | null;

  providerSnapshot: {
    providerId: string;
    model: string;
  };

  status: "pending" | "streaming" | "done" | "error" | "aborted";
  error?: string;

  createdAt: number;
};
```

---

## 17. Path Context

当前 Node 为 D：

```text
A
└─ B
   └─ D
```

请求模型前，从 D 一直沿 parentNodeId 回溯到 root。

只拼接当前路径。

### Anchor 节点的上下文压缩

如果 B 是从 A 的 `TLS` section 继续：

优先发送：
- A 的 userMessage；
- A 的 intro（可选）；
- A 中被 Anchor 的 TLS section；
- B 后续路径。

不要把 A 中所有无关 section 都带给后续模型。

### 没有 Anchor

如果 B 基于 A 整体提问：
- 可发送 A 完整结构化回答；
- 超长时再做摘要/截断，v0.1 可先使用长度阈值策略。

---

## 18. 生成状态

每个 Node 有明确状态：

- pending
- streaming
- done
- error
- aborted

UI 行为：

### streaming
- section 尚未解析完成前显示普通流式 Markdown；
- 完成后转为结构化 section；
- 或者使用可增量解析的结构协议。

### error
在回答位置显示：
- 简短错误原因；
- Retry；
- 不弹全局大弹窗。

### aborted
保留已生成文本；
提供 Continue / Retry。

---

## 19. 第一版功能范围

### 必须有

- ChatGPT 式聊天布局
- 会话历史
- 新建/删除/重命名
- 三类 Provider 协议
- 多 Provider 管理
- active Provider 切换
- Test Connection
- 流式回答
- Stop generation
- 结构化 Section
- Anchor 提问
- Conversation Tree
- Tree 抽屉
- Path Context
- IndexedDB 本地持久化
- 亮/暗模式
- Response 设置
- User System Prompt
- 会话 JSON 导入/导出
- 全部数据备份/恢复
- GitHub Pages 部署

### 不做

- 登录
- 云同步
- 文件上传
- PDF
- RAG
- 向量数据库
- Agent
- Web 搜索
- Flashcards
- Quiz
- 学习计划
- Canvas 脑图
- 多用户协作

---

## 20. v0.1 完成标准

用户应该可以：

1. 第一次打开站点；
2. 设置一个 Provider；
3. 返回 Chat；
4. 提问；
5. 得到被拆分为多个可点击知识模块的回答；
6. 点击其中一个模块；
7. 输入追问；
8. 得到新的分支回答；
9. 回 Tree 切换到上一层；
10. 从另一个模块继续形成第二条分支；
11. 刷新浏览器后所有内容仍然存在；
12. 导出全部本地数据；
13. 在 GitHub Pages 上静态部署使用。

做到这里，Arbor v0.1 就已经是一个完整产品，而不是 Demo。
