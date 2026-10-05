# 产物契约（Artifacts）

> 铁律 L7：**产物必须落盘。人格之间的结论以文件为准，不以对话记忆为准。**
> 本文件规定：谁写、写到哪、叫什么名字、必须包含什么。

---

## 一、目录总表

```
<project>/
├── .cds/                          【晨】
│   ├── state.json                  状态机（机器可读）
│   ├── state.md                    状态机（人类可读快照）
│   ├── requirement.md              需求全集（问答原文 + 结论 + 编号 R-xxx）
│   ├── frozen-list.md              不可动清单【接手项目专用】
│   ├── decisions.md                关键决策台账
│   ├── bugs.md                     bug 总台账（唯一真相源）
│   ├── changelog.md                变更记录
│   └── channel/                    同伴频道（见 peer-channel.md）
│
├── research/                      【A 组】
│   ├── A1-official.md
│   ├── A2-reuse.md
│   ├── A3-individual.md
│   ├── A2-takeover-inventory.md   【接手项目专用】
│   ├── C3-modifiability.md        【接手项目专用，由 C3 写】
│   └── 00-整合资料.md              ← A4 产物，B 组的主要输入
│
├── design/                        【B 组】
│   ├── 00-设计初稿.md              ← B4 产物，C 组的主要输入
│   ├── 01-增量设计.md             【接手项目专用】
│   ├── fix-plan-<轮次>.md         ← B4 在 TRIAGE 的三合一方案
│   └── v<n>/                      历史版本归档（不覆盖）
│
├── src/                           【C 组】
│   └── ...                        实际代码
├── build-report.md                【C 组】构建报告（每轮一份，带轮次）
├── security-report.md             【C4】安全层报告
│
├── tests/                         【D 组】
│   ├── D5-redteam-entry.md        【C4 写，D5 读】红队入口说明（不含源码）
│   ├── bugs-D1-<轮次>.md
│   ├── bugs-D2-<轮次>.md
│   ├── bugs-D3-<轮次>.md
│   ├── bugs-D4-<轮次>.md
│   ├── bugs-D5-<轮次>.md
│   └── 00-bug-summary-<轮次>.md   ← D6 产物
│
└── docs/                          【E 组按需】
    ├── E1-<用途>.md
    ├── E2-<用途>.md
    └── E3-<用途>.md
```

---

## 二、产物责任矩阵

| 产物 | 唯一作者 | 读者 | 可被谁修改 |
|---|---|---|---|
| `.cds/state.json` / `.md` | 晨 | 全员 | **仅晨** |
| `.cds/requirement.md` | 晨 | 全员 | 仅晨（追加式，不覆盖） |
| `.cds/frozen-list.md` | 晨（用户确认） | 全员 | 仅晨，且需重新获得用户确认 |
| `.cds/decisions.md` | **任何人格可追加** | 全员 | 追加式，**任何人不许修改他人条目** |
| `.cds/bugs.md` | D6 汇总（D1–D5 提供条目） | 全员 | 追加式；等级修正需注明理由 |
| `.cds/changelog.md` | 晨 | 全员 | 仅晨 |
| `research/A1-official.md` | A1 | A4 | 仅 A1 |
| `research/A2-reuse.md` | A2 | A4 | 仅 A2 |
| `research/A3-individual.md` | A3 | A4 | 仅 A3 |
| `research/00-整合资料.md` | A4 | B 组 | 仅 A4（B 组发现问题时回退给 A4） |
| `design/00-设计初稿.md` | B4 | C 组 | 仅 B4 |
| `design/fix-plan-<轮次>.md` | B4 | C 组 | 仅 B4 |
| `src/**` | C1/C2/C3/C4 按模块 | D 组 | C 组内部；**跨模块修改必须通过 peer channel 通知** |
| `build-report*.md` | C1 汇总（C2/C3/C4 提供分节） | D 组 | 仅 C 组 |
| `security-report.md` | C4 | D5、晨 | 仅 C4 |
| `tests/bugs-D<n>-<轮次>.md` | D<n> | D6 | 仅该人格 |
| `tests/00-bug-summary-<轮次>.md` | D6 | B4、晨 | 仅 D6 |
| `docs/E<n>-*.md` | E<n> | 晨 | 仅该人格 |

**违规修改**：任何对他人产物的静默修改均为严重违规（见 `peer-channel.md` 第六节）。

---

## 三、命名规范

| 类型 | 规则 | 示例 |
|---|---|---|
| 阶段产物 | 两位数字前缀表顺序 | `00-整合资料.md`、`01-增量设计.md` |
| 轮次产物 | `<名称>-<轮次>` | `bugs-D1-3.md`、`fix-plan-3.md` |
| 轮次产物（首轮） | 首轮**不带**轮次后缀；后续轮带 | 首轮 `build-report.md` → 第 2 轮起 `build-report-2.md` |
| 人格原始产物 | `<人格编号>-<主题>` | `A1-official.md` |
| 历史归档 | 目录 `v<n>/` | `design/v1/00-设计初稿.md` |
| 需求项 | `R-<三位序号>` | `R-014` |
| 设计决定 | `D-<三位序号>` | `D-007`（在 decisions.md 内） |
| Bug | `BUG-<四位序号>` | `BUG-0031` |
| 回归 Bug | `REG-<四位序号>` | `REG-0004` |
| 任务 | `T-<节点>-<三位序号>` | `T-RESEARCH-001` |
| 消息 | `M-<轮次>-<序号>-<发送者>` | `M-1-007-C2` |
| 不可动项 | `F-<二位序号>` | `F-01` |

**语言规范**：
- **文件名**：**标识符部分用 ASCII**（如人格编号 `A1`、序号 `R-014`、轮次 `-3`、前缀 `00-`），**描述性词语可本地化**——因此 `00-整合资料.md` 合规（前缀 `00-` 是标识符，`整合资料` 是描述词），`A1-official.md` 也合规。
- **标识符**（消息编号、bug 编号、任务编号等机器读取的字段）**一律 ASCII**，不得出现中文。
- **文件内容**使用用户的语言。

> 判据：**这个字符串会不会被别的人格用程序或精确匹配去读？** 会 → 必须 ASCII。只是给人看的标题 → 可本地化。

---

## 四、文件头（Front-matter）规范

所有 `.md` 产物**必须**以此开头：

```yaml
---
artifact: <产物类型，如 research-integrated / design-draft / bug-report>
author: <人格编号>
round: <轮次>
node: <RESEARCH|DESIGN|BUILD|TEST|TRIAGE>
task_id: <T-xxx>
status: draft | final | superseded
inputs:
  - <本产物读取过的文件路径>
generated_at: <时间戳>
---
```

**用途**：
1. 可追溯（谁在什么轮次基于什么产出）；
2. 增量更新时只重读必要输入（**省钱**：见 `selfrescue/cache-economy.md`）；
3. 陈旧检测：若 `inputs` 中任一文件的 `generated_at` 晚于本文件，本文件标记为 `stale`。

---

## 五、产物完整性要求

### 每个产物必须包含

| 项 | 说明 |
|---|---|
| 结论前置 | 开头 ≤200 字给出结论清单（读者只看这一段也能get到） |
| 可追溯 | 每条关键结论标注来源（文件/行号/实测/推断） |
| 未决项 | 明确列出未解决的问题（不许藏） |
| 移交说明 | 结尾 ≤10 条给下游的行动要点 |
| 代价 | 任何建议都要写代价 |

### 禁止项

- 禁止 emoji；
- 禁止"首先/其次/最后"空转结构；
- 禁止无来源断言；
- 禁止"待定"而不指派人与截止节点；
- 禁止把长文件全文复制进另一份文件（应引用路径）。

---

## 六、产物生命周期

```
draft ──(作者自检通过)──> final ──(上游变更)──> superseded
                              │
                              └──(进入归档)──> v<n>/ 目录
```

规则：
1. `final` 的产物**不原地修改**；需要变更时出新文件，旧文件标 `superseded`；
2. 版本变更时，**整个阶段目录**归档进 `v<n>/`；
3. `.cds/bugs.md` 与 `.cds/decisions.md` 是**例外**：它们是追加式台账，永不归档、永不覆盖。

---

## 七、产物自检清单（任何人格交付前）

- [ ] front-matter 完整？
- [ ] 结论前置在 200 字内？
- [ ] 每条关键结论可追溯？
- [ ] 未决项已列出？
- [ ] 移交说明 ≤10 条？
- [ ] 每个建议都写了代价？
- [ ] 无 emoji？
- [ ] 没有把长文件全文贴进来（只引用路径）？
- [ ] 我改动的产品都在我的责任矩阵内？
