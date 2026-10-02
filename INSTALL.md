# 安装说明（给对方看的）

**CDS 模式（Chen's DS）** — 一个装进 DeepSeek Harness 的 agent 预设。
装上之后，新建会话时预设里会多出两张卡片，选它就是「晨」。

> 这份文档只讲**怎么装、怎么验、怎么卸**。
> 模式本身的设计原理见包内 `cds/README.md` 与 `cds/CORE.md`。

---

## 0. 前置条件

| 要求 | 说明 |
|---|---|
| DeepSeek Harness（DSH） | 已装好并能跑 `dsh web`。本包按 `0.2.0-rc.2` 开发与验证 |
| 一个 DSH profile | 默认是 `web`。装到哪个 profile 就只影响那个 profile 的所有会话 |
| **不需要联网** | 本包**零外部依赖**，只用 Node 内建模块；语料随包自带 |
| 不需要 npm 登录 | 本包不发布到 registry，用本地路径安装 |

**权限提示**：`install_bundle` 需要 `danger-full-access`，或在允许审批的模式下批准那一次调用。它会执行你给的包里的代码——这是插件机制本身的性质，不是本包的特殊要求。**装之前可以自己先读一遍 `index.js`（约 400 行，只用 `node:crypto` / `node:fs` / `node:path` / `node:url`）。**

---

## 1. 安装

### 方式 A：从压缩包（推荐）

**第 1 步**，解压到一个**长期保留**的目录（不要放临时目录，删了插件就坏）：

```bash
mkdir -p ~/dsh-bundles

# .zip（给分发平台；Windows 也可直接右键解压）
unzip dsh-cds-mode-1.5.0.zip -d ~/dsh-bundles

# 或 .tgz —— 两者内容完全相同，只是压缩格式不同
tar -xzf dsh-cds-mode-1.5.0.tgz -C ~/dsh-bundles

# 两种都得到 ~/dsh-bundles/package/
```

> **`.zip` 与 `.tgz` 内容逐字节一致**，随便用哪个。
> 注意：**DSH 的 `install_bundle` 不接受 `.zip` 本身** —— 它认 registry 包、git 地址、tarball、绝对路径。所以 zip 要先解压，再把解压出的 `package` 目录指给它。

> 为什么强调"长期保留"：安装用的是 `link:`（软链接）方式，DSH 会**指向**这个目录。目录没了，插件就加载失败。

**第 2 步**，在一个 DSH 会话里，让 agent 执行：

```
plugin_manager  action: install_bundle
                target: /绝对路径/到/解压出的/package
```

`target` 必须是**绝对路径**。Windows 上形如 `C:\Users\你\dsh-bundles\package`。

**第 3 步**，**重启 `dsh web`**。

```bash
# 先找到它
# Windows:  Get-NetTCPConnection -LocalPort 3080 -State Listen | Select OwningProcess
# Linux/mac: lsof -i:3080 -sTCP:LISTEN
# 然后停掉，并重新启动
dsh web
```

**第 4 步**，**新建一个会话**，在预设里选「CDS 模式」。

### 方式 B：从目录

如果拿到的是解压好的目录，直接把 `target` 指向它，其余同上。

### 方式 C：从 git

```
plugin_manager  action: install_bundle  target: <git 地址>
```

仓库里必须**包含 `cds/` 目录**（语料）。没有 `cds/` 的仓库装完会报「内置语料缺失」。

### 关于 npm registry

本包声明为 `private: true`，不发布到 registry。若你 fork 后想发到自己的私有 registry，注意：**DSH 会校验 peer 依赖版本**，`@deepseek-ai/*` 的 peer 必须与目标 DSH 运行时版本一致，否则安装会被拒（且不会下载任何东西）。

---

## 2. 重启是必需的（最容易踩的坑）

**光刷新页面不够。**

`install_bundle` 返回 `application: applied` 只代表 bundle 被选中并写进了 profile。
**JS 模块代是进程启动时加载的**——新增或替换一个包，必须重启进程才会加载新的模块代。

**怎么确认重启真的生效**：比对进程启动时间与本包 `index.js` 的修改时间。进程启动**晚于**文件改动才算加载了新版。

如果安装时 HMR 恰好不可用，日志里会出现：

```
hmr warn  config reload at .../profiles/<profile>/package.json failed
hmr warn  Error: HMR is disposed
```

看到这两行就说明**当前进程没有接受这次改动**。

**另一个常见误解**：对**同一个已安装目标**重复 `install_bundle`，会返回

```json
{ "application": "failed", "error": { "code": "ambiguous-install" } }
```

这是**正常的**——包已经是 `link:` 指向同一目录，包管理器无事可做。**这不是安装失败，也不要靠反复安装来"生效"，重启才对。**

---

## 3. 装完会多出什么

**两个 agent 预设**：

| 预设卡 | 预设 id | 说明 |
|---|---|---|
| **CDS 模式（晨的DS）** | `cds` | **保底**。零实验依赖，一定激活。日常用这个 |
| **CDS 模式 · 同伴频道版** | `cds-team` | 多挂 Agent Teams：人格之间可直接互相说话、共享任务板 |

**同伴频道（协同功能）只在第二张卡里可用。** 第一张卡故意不挂任何实验包——实验包出问题时，CDS 主体仍然能用。

选「同伴频道版」的会话，**对话头部会多一个 Agent Teams 入口**，点开能看到队友名册、共享任务板、点进某个队友的会话。

**看不到协同入口只有一个原因：选的是第一张卡。**

**装完你得到的能力**：

- **主模式**：主人格晨 + A/B/C/D/E 五组 22 份人格委任书（调查 / 设计 / 开发 / 测试 / 其他）+ 两条闭环工作流 + 生成式提问机制
- **C-WEB 网络安全附属工作流**：8 个组、**35 个网络安全人格** + 晨的安全模式委任书，共 36 份。含**策略门（D-web1，不可绕过）**、**隐私一票否决（D-web4）**、**实时防御反击（I 组）**，以及权限审批矩阵与五阶段落地路线

C-WEB 只在你做安全任务时启用，不影响日常开发。它有一处**显式豁免**：安全任务里晨**只问授权向的六类问题**，不做需求采集式的长篇提问（理由：安全任务里"问用户"本身就是风险）。

---

## 4. 装完怎么验（三步）

**第一步 · 卡片不标红**

打开「设置 → 预设模式」。两张 CDS 卡片应当**没有红色「加载失败」徽标**。

若有红徽标：把悬停/点开看到的**诊断原文**贴给发布者。那是逐行的，会直接写明哪一行、什么原因。

**第二步 · 它知道自己是谁**

新开会话选「CDS 模式」，问：

> 你是谁？

应当得到**晨**的自述（主人格、唯一对外面孔、会先问 5 道题校准专业度、其余人格是它的子 Agent）。
再问：

> 你手上的 CDS 规范里有几条铁律？第一条是什么？

应当答出 **L1–L9 九条**，第一条是「晨是唯一对用户说话的人格」。

**第三步 · 提问走工具**

随便说个需求，例如：

> 帮我做个管理学生作业的小工具。

应当看到晨**调用 `ask_user_question` 工具**（结构化选择题卡片，不是一大段散文），**每批不超过 5 题**，而且第二批发问**接得上你的回答**——你答"就我们班用"，它就不该再问支付、发票、备案。

---

## 5. 想改语料（可选）

包自带语料在 `<安装目录>/cds/`。两种做法：

**做法一：直接改包内语料**（简单）
改完**重启**。注意升级包时会覆盖。

**做法二：用自己的语料库**（推荐长期用户）
把 `cds/` 复制到别处，然后在 `cordis.patch.yml` 里的 `cds-mode` 行加一个 `corpusDir`：

```yaml
- id: cds-mode
  name: '@local/dsh-cds-mode'
  config:
    corpusDir: '/绝对路径/到你的/cds'
    maxChars: 200000
    liveReload: false
```

**`liveReload` 默认关着是有原因的**：打开它会在语料变化时改写系统提示前缀，**打掉本会话的提示词缓存**（这个模式很在意缓存命中）。改了语料就重启，别靠热重载。

**语料路径写错的表现**：预设卡片标红，诊断里写明「找不到语料：<它实际找的目录>」，并列出修法。照那个目录核对即可。

---

## 6. 常见故障

| 现象 | 原因 | 修法 |
|---|---|---|
| 预设列表里没有 CDS 卡片 | 装完没重启 | 见第 2 节 |
| 卡片标红「加载失败」 | 某一行激活失败 | 把**诊断原文**给发布者 |
| 诊断说「内置语料缺失」 | 包不完整（缺 `cds/`） | 重新解压完整 tarball；或从 git 装时确认仓库含 `cds/` |
| 诊断说「找不到语料」 | 你设了 `corpusDir` 但路径不对 | 按诊断里给出的实际目录核对，或删掉 `corpusDir` 用包内默认 |
| 诊断说超 `maxChars` | 语料变大了 | 调大 `maxChars` |
| 模型说"我是 coding agent powered by…" | 选的是别的预设 | 确认会话预设是「CDS 模式」 |
| 找不到任何协同入口 | 用的是「CDS 模式」（保底） | 换「CDS 模式 · 同伴频道版」 |
| 有 `subagent` 但没有队友互聊 | 同上 | 换「CDS 模式 · 同伴频道版」 |
| 重复 `install_bundle` 报 `ambiguous-install` | 同一目标已安装 | 正常，重启即可 |
| 缓存命中率突然变低 | 语料被改过（前缀变了） | 看 `<包>/cds/CHANGELOG.md` 的缓存影响记录 |

---

## 7. 卸载 / 升级

**卸载**：

```
plugin_manager  action: remove_bundle  target: <包名，如 @local/dsh-cds-mode>
```

卸载后预设卡片消失，系统提示恢复为部署默认。**你的项目产物不受影响**（它们在你的项目工作区里）。

**升级**：解压新版本 → 对**同一 target 路径**执行 `install_bundle` → **重启**。
若新旧目录不同，先卸载旧的再装新的，避免两个 bundle 同时挂载同名预设行而冲突。

---

## 8. 这个包可靠吗

**能保证的**：

- **零外部依赖**：`index.js` 只 import `node:` 内建。不会因为某个包解析不到而在你机器上失效（这一条是踩过坑后定死的）。
- **自带完整验证**：包内 `_verify3.mjs` 与 `_verify-corpus.mjs` 共 **130+ 项断言**，覆盖结构、接线、可移植性、真实装载。你可以自己跑：

  ```bash
  node _verify3.mjs && node _verify-corpus.mjs
  ```

- **语料可核对**：`_sync-corpus.mjs --check` 会逐字节比对包内语料与源语料。

**要如实说明的**：

- **「同伴频道版」依赖两个 DSH 实验包**（`dsh-experimental-agent-team` / `dsh-experimental-tool-agent-team`）和一个实验 UI 包。它们**无稳定性承诺**；上游若破坏性变更，那张卡可能激活失败。这不影响「CDS 模式」（保底卡）。
- **同一批并发上限 8 个实例**；`agent-team` 服务的 `maxMembers` 也是 8。这是刻意的，不是缺陷。
- 本包按 DSH `0.2.0-rc.2` 开发。换 DSH 大版本前请先跑一遍上面的验证脚本。
