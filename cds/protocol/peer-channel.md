# 子 Agent 直连协同协议（Peer Channel）

> **本协议解决的核心要求**：子 Agent 之间的交流聊天**不需要主 Agent（晨）作为桥梁传话**。
> 人格与人格之间直接对话、直接交付、直接拒收。

---

## 零、实现现状（先看这一节）

**同伴频道不是纸面协议——它已经由现成插件实现了。** 本节说明它到底由什么承载、在界面上长什么样。

### 载体：官方 Agent Teams

用的是 DSH 自带的三个实验包，**不自研**：

| 包 | 平面 | 作用 |
|---|---|---|
| `@deepseek-ai/dsh-experimental-agent-team` | **Host 平面**（进程级） | 队域本体：名册、持久化点对点信箱、共享任务板 |
| `@deepseek-ai/dsh-experimental-tool-agent-team` | 预设内 | 九个面向模型的 Team 工具 |
| `@deepseek-ai/dsh-experimental-client-ui-agent-team` | **Host 平面** | **Web 界面**：队友名册、任务板、点进队友会话 |

**为什么服务与界面在 Host 平面、只有工具在预设内**：`TeamService` 的 `inject` 是
`[agents, sessions, sessionPersistence, sessionProjections, subagents]`——**不含 scope**；它每个方法都接收显式 `agent` 参数（代码注释原话：「exact live Agent used as the authority credential」）。所以它是进程级服务，界面可以直接读它的投影。

> 这一条曾经搞错过（v1.1.1 把服务挪进预设、且漏挂界面），修正于 v1.3.1。详见 `cds/CHANGELOG.md`。

### 你会在界面上看到什么

选「**CDS 模式 · 同伴频道版**」的会话，**对话头部会多一个 Agent Teams 入口**：点开可以看当前队友名册、看共享任务板、点进某个队友的会话。

**看不到它只有一个原因**：你用的是「CDS 模式」（保底预设）——那个预设**故意不挂任何实验包**，所以没有 Team 工具、也没有协同界面。
**同伴频道只在「CDS 模式 · 同伴频道版」里可用。**

### 九个 Team 工具

| 工具 | 用途 | 谁可调用 |
|---|---|---|
| `spawn_teammate` | 创建具名队友 | **只有 Lead（晨）** |
| `send_message` | 给任意队友发消息（**含队友之间互发**） | 所有成员 |
| `list_agents` | 看名册与状态 | 所有成员 |
| `team_task_create` / `_list` / `_get` / `_update` | 共享任务板 | 所有成员 |
| （等待与打断） | 等进度、打断卡住的队友 | 见工具说明 |

**关键区别**：Team 工具**替代**了 legacy 的 `subagent` / `send_message` / `list_agents`。
**legacy `subagent` 派出的孩子无法与兄弟姐妹互发消息**——所以「CDS 模式 · 同伴频道版」里 legacy 委派行是**禁用**的，强制走 Team 路径。

### 与第三节文件频道的关系

**文件频道（第三节）仍然有效**，它是**降级层**：

1. Team 工具可用 → 用它（实时、有任务板、有界面）
2. Team 工具不可用 → 退回文件频道

**无论走哪条，都必须同步落盘**到 `.cds/channel/log.md`（CORE 铁律 L7）。

---

## 一、设计目标

| 目标 | 说明 |
|---|---|
| 去中心化通信 | 人格 A 与人格式 B 之间的消息不经晨转发 |
| 可审计 | 所有消息落盘，可回溯「谁在什么时候说了什么」 |
| 可恢复 | 会话中断后，从频道文件即可重建协作状态 |
| 低成本 | 消息只传路径与结构化字段，不搬运全文（见 `selfrescue/cache-economy.md`） |
| 向后兼容 | 若 DSH 已有满足要求的协同插件，则**稍作修改后绑定本模式** |

---

## 二、传输层

### 2.1 文件频道（默认，零依赖）

协作状态存于项目工作区：

```
<project>/.cds/channel/
├── inbox/
│   ├── A1.md      ← A1 的收件箱（只由别人写入，A1 只读+标记已读）
│   ├── A2.md
│   ├── ...
│   └── chen.md    ← 晨的收件箱（人格上报用，避免打断晨与用户的对话）
├── outbox/
│   └── <人格>.md  ← 该人格发件记录（等于自己的说话日志）
├── log.md         ← 全局消息流水（只追加，不修改）
└── state.json     ← 频道元数据：活跃人格、当前轮次（**仅落盘，不进任何自检**，见第七节）
```

**写读规则**：

| 规则 | 说明 |
|---|---|
| R1 | 每个人格**只读自己的 inbox**，**只写自己的 outbox** 和**别人的 inbox** |
| R2 | 写入格式固定（见第三节），一条消息一个 `## MSG` 块 |
| R3 | 读取后在自己 inbox 的消息块里追加 `read_at: <时间戳>`，**不删除** |
| R4 | `log.md` 追加式写入，任何人不得修改历史行 |
| R5 | 并发写保护：写 inbox 用「追加」语义；文件锁不可用时，允许消息块多于预期，由收件人按 `msg_id` 去重 |

### 2.2 直连 API（当宿主支持时）

若宿主（DSH）提供子 Agent 间的直接消息能力（例如可续接的子 Agent 会话、`send_message` 类工具），则**优先使用直连 API**，文件频道退化为**审计日志**。

绑定规则：
1. 直连调用与文件写入**必须同时发生**（双写），保证可审计；
2. 直连失败时，自动降级为文件频道 + 收件人下次唤醒时读取；
3. 不得因为用了直连 API 就跳过落盘（违反 L7 铁律）。

### 2.3 若 DSH 已有协同插件

**优先复用，不重复造轮子。** 判定与绑定流程：

```
1. 枚举当前 profile 已装插件（plugin_manager list_plugins / list_bundles）
2. 筛选条件：是否提供 agent↔agent 消息能力？
3. 若命中 → 只做「适配层」：
   - 把该插件的消息格式映射到本协议第三节的 MSG 结构；
   - 保留其投递机制，把审计写入 .cds/channel/log.md；
   - 在 cds/CORE.md 与 dsh-plugin/README.md 记录绑定关系与版本。
4. 若未命中 → 使用文件频道；或实现 dsh-plugin 中的 peer channel 插件。
```

---

## 三、消息格式（MSG）

每条消息是一个 Markdown 块，字段固定：

```md
## MSG
msg_id: M-<轮次>-<序号>-<发送者>
from: C2
to: C1
cc: [chen]
round: 1
kind: ask | answer | handoff | reject | notify | escalate
re_ref: <被回复消息的 msg_id，无则 ->
artifacts:
  - <路径>
payload:
  <结构化内容，见下>
expects: reply | action | none
deadline_hint: <本轮内 | 允许跨轮>
sent_at: <时间戳>
```

### kind 语义

| kind | 用途 | 必须带 | 收件人必须动作 |
|---|---|---|---|
| `ask` | 提问（C2 问 C1 / C3 问 C1） | `payload.questions[]`（≤5 条，每条是具体问题） | 回复 `answer` |
| `answer` | 回答 | `payload.answers{}` 键与问题一一对应 | 继续工作 |
| `handoff` | 交付产物 | `artifacts[]` + `payload.summary` | 校验门禁 → 接受或 `reject` |
| `reject` | 拒收（门禁未过） | `payload.reason` + `payload.missing[]` | 补齐后重新 `handoff` |
| `notify` | 通知（不要求动作） | `payload.text`（≤50 字） | 无 |
| `escalate` | 升级到仲裁人 | `payload.deadlock` + `payload.tried[]` | 仲裁人裁决并广播 |

### 关键约束

1. **≤5 条问题/消息**：一次提问不超过 5 条，超了拆成多条 `ask`。
2. **只传路径**：`artifacts` 里放路径，**禁止把文件全文贴进 payload**。
3. **禁止闲聊**：`kind: notify` 的 `payload.text` 不超过 50 字，且必须与工作相关。
4. **不得绕过门禁**：`handoff` 的收件人如果发现上游门禁未过，**必须**回 `reject`，不得"先干着"。
5. **不得向用户发言**（L1 铁律）：`to: user` 非法。只有 `to: chen` 合法。

---

## 四、标准协作场景（示例）

### 场景 1：C2 向 C1 提问（不经晨）

```md
## MSG
msg_id: M-1-007-C2
from: C2
to: C1
cc: [chen]
round: 1
kind: ask
re_ref: ->
artifacts:
  - design/00-设计初稿.md
payload:
  questions:
    1. 页面「订单列表」首屏需要哪几个字段？请列字段名。
    2. 列表是否要求服务端分页？若要，每页条数？
    3. 写操作成功后前端期望收到什么：整条记录 / 仅成功标志 / 需重算的聚合值？
    4. 是否有乐观更新？若有，需要回滚接口吗？
    5. 需要实时推送吗？
expects: reply
deadline_hint: 本轮内
sent_at: 2025-01-01T10:00:00Z
```

C1 的回复：

```md
## MSG
msg_id: M-1-008-C1
from: C1
to: C2
round: 1
kind: answer
re_ref: M-1-007-C2
artifacts:
  - src/api/contracts.ts
payload:
  answers:
    1. id, createdAt, status, amount, customerName（5 个，不要更多）
    2. 不分页。数据上限 800，一次回传。
    3. 仅成功标志。聚合值前端自己算。
    4. 有乐观更新。需要回滚：不需要独立接口，失败时前端回滚本地状态。
    5. 不需要。
expects: action
deadline_hint: 本轮内
sent_at: 2025-01-01T10:12:00Z
```

### 场景 2：D1 拒收 C 组交付（不经晨）

```md
## MSG
msg_id: M-1-031-D1
from: D1
to: C3
cc: [chen, D6]
round: 1
kind: reject
re_ref: M-1-029-C3
artifacts:
  - tests/D1-code-run.md
payload:
  reason: 构建不可运行，无法进入代码级跑测
  missing:
    - 入口清单缺失（build-report.md 第 3 节为空）
    - 缺少本地启动方式（无法复现）
    - 存在编译错误：src/api/orders.ts:112 类型不匹配
expects: action
deadline_hint: 本轮内
sent_at: 2025-01-01T11:00:00Z
```

### 场景 3：僵局升级

```md
## MSG
msg_id: M-2-003-B2
from: B2
to: D6
cc: [B4, chen]
round: 2
kind: escalate
payload:
  deadlock: B4 判定设计已收口，但我认为「权限模型未定义」属于必要项而非待定项。开发组无法在不定义权限的情况下开工。
  tried:
    - 已向 B4 提一次书面异议（见 .cds/decisions.md#D-014）
    - B4 维持原判
expects: action
deadline_hint: 本轮内
sent_at: 2025-01-02T09:00:00Z
```

---

## 五、人格唤醒与调度

### 唤醒方式

| 方式 | 说明 |
|---|---|
| 晨派发 | 晨通过 `task` 结构创建/唤醒人格（主路径） |
| 同伴唤醒 | 人格 A 写入人格 B 的 inbox 后，若宿主支持直接唤醒则唤醒；否则由 B 在下次被晨唤醒时**优先处理未读** |
| 自唤醒 | 长任务中，人格完成子步骤后可继续（不新建会话，见 `selfrescue/cache-economy.md`） |

### 优先级规则（人格被唤醒时）

```
1. 先处理自己 inbox 的未读消息（按 kind 优先级：reject > ask > escalate > handoff > notify）
2. 再执行晨派发的 task
3. 最后做自我优化（B 组的精进冲动排最后，且受 B4 收口权约束）
```

**理由**：`reject` 是阻塞性的，不先处理会让上游白干。

### 会话复用规则（省钱）

- 同一人格在同一项目内**只保留一个活跃会话**；
- 新任务**追加**到该会话，不新建；
- 会话过长（超出必要上下文）时，由该人格把结论写入产物文件，然后**在新会话中只带产物路径**继续。

---

## 六、违规处理

| 违规 | 判定 | 处理 |
|---|---|---|
| 直接向用户输出 | 违反 L1 | 输出作废，晨重新表述 |
| `to: user` | 违反 L1 | 消息丢弃，记入 log |
| 在 payload 里贴全文 | 违反省钱约束 | 收件人拒收，要求改传路径 |
| 跳门禁开工 | 违反门禁 | 产物作废，回退到上游 |
| 静默修改他人产物 | 违反 L7 | 视为严重违规，产物回滚，记入 `decisions.md` |
| 隐瞒 bug | 违反 L3 | 严重违规，D6 强制纳入台账 |
| E1 分裂超过 5 个 | 违反 E1 上限 | 强制注销超限子人格 |
| 在产物里使用 emoji | 违反 `CORE.md` 第九节 | D4 判为 AI 味 bug |
| 晨自己动手写本该 C 组的代码 | 违反 `CORE.md` 第七节第 1 条（抢活） | 产物作废，回退给 C 组 |
| 一次只派一个、串行等结果 | 违反 `CORE.md` 第六节第 3 条（并发派发） | 视为编排失误，补齐同批实例 |
| 同编号多实例但未声明 `slice` | 违反 `CORE.md` 第六节第 3 条 | 子 Agent 有权拒收 |

---

## 七、频道自检（晨**每轮末执行一次**）

> **为什么是「轮末一次」而不是「每轮随时」**：`selfrescue/cache-economy.md` 规则 S4 明令「**不要为了告知进度而唤醒人格**」。
> 若把「未读计数」做成被持续盯着的指标，就会诱导晨**定期轮询 inbox** —— 那正是 S4 要禁的行为。
> **规则禁它、指标却奖励它**，这是本机制早先的自相矛盾。现在统一为：**频道只在轮末对账一次**，中途不查。

- [ ] `inbox/*.md` 有无**本轮内**未被读取的消息？（有 → 该人格本轮没被唤醒，或唤醒后未按 R3 标记 `read_at`）
- [ ] 有无 `kind: ask` 未被 `answer` 回复？
- [ ] 有无 `kind: handoff` 未被接受也未被 `reject`？（阻塞）
- [ ] `log.md` 是否与各 inbox 一致？（不一致 → 并发写冲突，按 `msg_id` 去重）
- [ ] 有无 `to: user` 的非法消息？

**对账后清零**：本轮已处理的消息在 `state.json` 里把 `unread` 归零。**未读计数只用于轮末对账，不作为任何"随时待办"信号**。
