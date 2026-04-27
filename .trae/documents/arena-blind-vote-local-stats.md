# Arena 盲测投票 + 本地战绩 实现计划

## 概述

在现有 Arena 对决功能基础上，增加盲测模式（隐藏模型身份）、投票机制、本地战绩持久化和 Elo 统计。

---

## 一、类型与数据结构变更

### 1.1 扩展 `ChatMessage` 类型（`app/store/chat.ts`）

在现有 `arenaId` 和 `arenaProviderName` 基础上新增：

```typescript
export type ChatMessage = RequestMessage & {
  // ... 现有字段
  arenaId?: string;
  arenaProviderName?: string;
  // 新增
  arenaLabel?: string;        // 盲测标签: "A" | "B" | "C" | "D"
  arenaVote?: "up" | "down";  // 该回答的投票结果
};
```

- `arenaLabel`：盲测模式下显示的标签，按模型顺序分配 A/B/C/D
- `arenaVote`：记录用户对该回答的投票，防止重复计分

### 1.2 新增 Arena Store 数据结构（`app/store/arena.ts`）

```typescript
// 对决记录
export type ArenaRecord = {
  arenaId: string;
  timestamp: number;
  prompt: string;              // 用户输入
  models: ArenaModelResult[];  // 参与模型及结果
  voted: boolean;              // 是否已投票
};

// 单个模型结果
export type ArenaModelResult = {
  model: string;
  providerName: string;
  label: string;               // A/B/C/D
  vote?: "up" | "down";
};

// Pairwise 战绩
export type PairwiseRecord = {
  modelA: string;              // "model@provider"
  modelB: string;
  winsA: number;
  winsB: number;
  draws: number;
};

// Elo 条目
export type EloEntry = {
  model: string;               // "model@provider"
  rating: number;
  battles: number;
};

// Store 状态
type ArenaStoreState = {
  records: ArenaRecord[];
  pairwise: Record<string, PairwiseRecord>;  // key: "modelA|modelB"
  elo: Record<string, EloEntry>;             // key: "model@provider"
  blindMode: boolean;                        // 盲测模式开关
};
```

### 1.3 新增 StoreKey（`app/constant.ts`）

```typescript
export enum StoreKey {
  // ... 现有
  Arena = "arena-store",
}
```

---

## 二、Arena Store 实现（`app/store/arena.ts`）

使用项目已有的 `createPersistStore` 模式，存储到 IndexedDB。

### 2.1 核心方法

| 方法 | 功能 |
|------|------|
| `addRecord(record)` | 新增对决记录 |
| `vote(arenaId, modelKey, vote)` | 投票，更新 record + pairwise + elo |
| `hasVoted(arenaId)` | 检查某回合是否已投票 |
| `toggleBlindMode()` | 切换盲测模式 |
| `getStats()` | 获取统计摘要 |

### 2.2 投票策略

- 每个 `arenaId` 只能投票一次（`voted` 标记）
- 投票时：被投 👍 的模型 vs 其余模型形成 pairwise 对，👍 方胜 +1
- 投票时：被投 👎 的模型 vs 其余模型形成 pairwise 对，👎 方负 +1
- 重复投票调用直接忽略，不重复计分

### 2.3 Elo 计算纯函数（`app/utils/elo.ts`）

```typescript
const K = 32;           // K 因子
const INITIAL_RATING = 1000;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateElo(ratingA: number, ratingB: number, scoreA: number): [number, number] {
  const eA = expectedScore(ratingA, ratingB);
  const eB = 1 - eA;
  const scoreB = 1 - scoreA;
  return [
    ratingA + K * (scoreA - eA),
    ratingB + K * (scoreB - eB),
  ];
}
```

- `scoreA = 1` 表示 A 胜，`scoreA = 0` 表示 B 胜，`scoreA = 0.5` 平局
- 初始分 1000，纯函数无副作用

### 2.4 统计纯函数（`app/utils/arena-stats.ts`）

```typescript
function getModelWinRate(elo: Record<string, EloEntry>, modelKey: string): number;
function getModelBattleCount(elo: Record<string, EloEntry>, modelKey: string): number;
function getPairwiseRecord(pairwise: Record<string, PairwiseRecord>, a: string, b: string): PairwiseRecord;
function getLeaderboard(elo: Record<string, EloEntry>): EloEntry[];
```

---

## 三、盲测模式 UI 变更

### 3.1 `ArenaToggle` 组件增强（`app/components/arena.tsx`）

在现有 Arena 开关旁增加盲测模式开关：

- 新增 `BlindModeToggle` 组件，样式与 `ArenaToggle` 一致
- 开启盲测后，`ArenaResponseGrid` 隐藏模型名和 Provider，显示 A/B/C/D 标签
- 投票后才揭晓真实模型

### 3.2 `ArenaResponseGrid` 组件改造

**新增 props：**

```typescript
export function ArenaResponseGrid(props: {
  messages: ChatMessage[];
  sessionId: string;
  fontSize: number;
  fontFamily: string;
  parentRef?: RefObject<HTMLDivElement>;
  blindMode: boolean;          // 新增：是否盲测模式
  hasVoted: boolean;           // 新增：是否已投票
  onVote: (messageId: string, vote: "up" | "down") => void;  // 新增：投票回调
}) 
```

**盲测显示逻辑：**

| 状态 | 模型名显示 | Provider 显示 | 标签 | 投票按钮 |
|------|-----------|--------------|------|---------|
| 盲测 + 未投票 | 隐藏 | 隐藏 | A/B/C/D | 显示 |
| 盲测 + 已投票 | 显示 | 显示 | A/B/C/D | 隐藏（已投） |
| 非盲测 | 显示 | 显示 | 无 | 显示 |
| 非盲测 + 已投票 | 显示 | 显示 | 无 | 隐藏（已投） |

### 3.3 投票按钮组件

新增 `ArenaVoteButtons` 内联组件：

- 👍 按钮：`Locale.Chat.Arena.VoteUp`（"这个更好" / "This is better"）
- 👎 按钮：`Locale.Chat.Arena.VoteDown`（"不行" / "Not good"）
- 投票后按钮变为已投状态，显示揭晓动画

### 3.4 揭晓动画

投票后模型名从标签位置渐显，使用 CSS transition：

```scss
.arena-column-model-reveal {
  animation: arena-reveal 0.4s ease-out;
}

@keyframes arena-reveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 四、消息结构补强

### 4.1 `onArenaInput` 方法改造（`app/store/chat.ts`）

在创建 bot 消息时增加 `arenaLabel`：

```typescript
const LABELS = ["A", "B", "C", "D"];

const botMessages: ChatMessage[] = arenaModels.map((m, index) =>
  createMessage({
    role: "assistant",
    streaming: true,
    model: m.model,
    arenaId,
    arenaProviderName: m.providerName,
    arenaLabel: LABELS[index],  // 新增
  }),
);
```

同时在 `userMessage` 上也关联 `arenaId`，方便追溯：

```typescript
const userMessage: ChatMessage = createMessage({
  role: "user",
  content: mContent,
  arenaId,  // 新增：用户消息也带 arenaId
});
```

### 4.2 投票方法（`app/store/chat.ts`）

新增 `arenaVote` 方法：

```typescript
arenaVote(arenaId: string, messageId: string, vote: "up" | "down") {
  const session = get().currentSession();
  // 1. 检查是否已投票（同 arenaId 内任一消息有 arenaVote 即视为已投票）
  // 2. 更新对应消息的 arenaVote 字段
  // 3. 调用 arenaStore.vote() 更新战绩
}
```

---

## 五、chat.tsx 集成变更

### 5.1 状态管理

```typescript
const arenaStore = useArenaStore();

// 传递给 ArenaResponseGrid
<ArenaResponseGrid
  messages={group.messages}
  sessionId={session.id}
  fontSize={fontSize}
  fontFamily={fontFamily}
  parentRef={scrollRef}
  blindMode={arenaStore.blindMode}
  hasVoted={arenaStore.hasVoted(group.messages[0]?.arenaId)}
  onVote={(messageId, vote) => chatStore.arenaVote(arenaId, messageId, vote)}
/>
```

### 5.2 盲测开关位置

在 Arena 开关旁（`ChatActions` 组件内）添加盲测开关，仅在 `arenaMode` 为 true 时显示。

---

## 六、样式变更（`app/components/arena.module.scss`）

新增样式：

| 样式类 | 用途 |
|--------|------|
| `.arena-blind-toggle` | 盲测开关 |
| `.arena-blind-label` | A/B/C/D 标签（大号、醒目） |
| `.arena-vote-row` | 投票按钮行 |
| `.arena-vote-btn` | 投票按钮（👍/👎） |
| `.arena-vote-btn-up` | 👍 按钮样式 |
| `.arena-vote-btn-down` | 👎 按钮样式 |
| `.arena-vote-voted` | 已投票状态 |
| `.arena-model-reveal` | 揭晓动画 |
| `.arena-blind-mask` | 盲测时模型名遮罩 |

---

## 七、国际化文案（`app/locales/cn.ts` + `en.ts`）

在 `Chat.Arena` 下新增：

```typescript
Arena: {
  // ... 现有
  BlindMode: "盲测模式",           // "Blind Mode"
  BlindToggle: "盲测",             // "Blind"
  VoteUp: "👍 这个更好",           // "👍 This is better"
  VoteDown: "👎 不行",             // "👎 Not good"
  Voted: "已投票",                 // "Voted"
  Reveal: "揭晓模型",              // "Reveal Model"
  VoteFirst: "请先投票再揭晓",     // "Vote first to reveal"
  Stats: "战绩统计",               // "Battle Stats"
  WinRate: "胜率",                 // "Win Rate"
  Battles: "对决次数",             // "Battles"
  Rating: "Elo 评分",              // "Elo Rating"
  Leaderboard: "排行榜",           // "Leaderboard"
  NoRecords: "暂无对决记录",       // "No battle records yet"
  Pairwise: "对战记录",            // "Pairwise Record"
  ModelLabel: (label: string) => `模型 ${label}`,  // (label) => `Model ${label}`
}
```

---

## 八、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `app/store/chat.ts` | ChatMessage 类型扩展 + arenaVote 方法 + onArenaInput 增加 arenaLabel |
| 修改 | `app/constant.ts` | 新增 StoreKey.Arena |
| 修改 | `app/store/index.ts` | 导出 arenaStore |
| 新建 | `app/store/arena.ts` | Arena Store（createPersistStore） |
| 新建 | `app/utils/elo.ts` | Elo 计算纯函数 |
| 新建 | `app/utils/arena-stats.ts` | 统计纯函数 |
| 修改 | `app/components/arena.tsx` | BlindModeToggle + ArenaResponseGrid 盲测/投票逻辑 + ArenaVoteButtons |
| 修改 | `app/components/arena.module.scss` | 新增盲测/投票/揭晓样式 |
| 修改 | `app/components/chat.tsx` | 集成盲测开关、投票回调、hasVoted 判断 |
| 修改 | `app/locales/cn.ts` | 新增 Arena 盲测/投票/统计中文文案 |
| 修改 | `app/locales/en.ts` | 新增 Arena 盲测/投票/统计英文文案 |
| 新建 | `test/arena-blind-vote.test.ts` | 盲测/投票/统计测试 |

---

## 九、测试覆盖（`test/arena-blind-vote.test.ts`）

### 9.1 盲测显示/揭晓逻辑

- 盲测模式下模型名和 Provider 不出现在渲染数据中
- 非盲测模式正常显示模型名
- 投票后揭晓真实模型信息
- arenaLabel 正确分配为 A/B/C/D

### 9.2 重复投票不重复计分

- 同一 arenaId 第二次投票被忽略
- pairwise 胜负计数不变
- Elo 分不变

### 9.3 Pairwise 胜负统计

- 2 模型对决：👍 A → A vs B: winsA+1
- 3 模型对决：👍 A → A vs B: winsA+1, A vs C: winsA+1
- 4 模型对决：👍 B → B vs A: winsB+1, B vs C: winsB+1, B vs D: winsB+1
- 👎 投票：被投模型在所有 pairwise 对中负 +1

### 9.4 Elo 计算

- 初始分 1000
- A(1000) 胜 B(1000) → A 约 1016, B 约 984
- 连续多次胜率计算正确
- 高分赢低分涨幅小，低分赢高分涨幅大

### 9.5 旧 Arena 消息兼容

- 无 arenaLabel 的旧消息不崩溃，默认显示模型名（非盲测行为）
- 无 arenaVote 的旧消息可正常投票
- 无 arenaId 的 user 消息不影响分组逻辑

---

## 十、实施顺序

1. **类型与常量**：扩展 ChatMessage、新增 StoreKey
2. **纯函数工具**：elo.ts、arena-stats.ts
3. **Arena Store**：arena.ts（持久化、投票、统计）
4. **chat.ts Store 变更**：onArenaInput 增加 arenaLabel、新增 arenaVote 方法
5. **组件变更**：arena.tsx（盲测开关、投票按钮、揭晓逻辑）
6. **样式变更**：arena.module.scss
7. **chat.tsx 集成**：传递 blindMode/hasVoted/onVote
8. **国际化**：cn.ts、en.ts
9. **测试**：arena-blind-vote.test.ts
10. **验证**：运行 lint + typecheck + test
