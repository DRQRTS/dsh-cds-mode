/**
 * 插件层校验：源码契约 + patch 结构 + 同伴频道接线 + 真实装载。
 *
 * 零外部依赖：patch 结构用自带的 `_patch-reader.mjs` 读，不用 `yaml` 包——
 * 那个包在本 profile 的 node_modules 里解析不到，绝对 store 路径又是机器相关的。
 *
 * 用法：node _verify3.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRows, flatten } from './_patch-reader.mjs'

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))
const DIR = PACKAGE_DIR + '/'
const CORPUS = join(PACKAGE_DIR, 'cds') + '/'

const raw = readFileSync(DIR + 'cordis.patch.yml', 'utf8')
const src = readFileSync(DIR + 'index.js', 'utf8')

let fail = 0
const check = (ok, label) => {
  if (!ok) fail++
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label)
}

console.log('=== A. patch 编码 ===')
check(raw.charCodeAt(0) !== 0xfeff, '无 BOM')
check(!/锛|鈹|涓|鐨|璁|鏂|鎻|妗|绔|鍏|寮|婧|鈥|瀛|鏁|宸|叿|閲/.test(raw), '无乱码')

// ── A2. 语料路径存在性：改名后静默失效的防线 ────────────────────────────────
console.log('')
console.log('=== A2. 语料路径存在性 ===')
const grab = (name) => {
  const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\]'))
  return m ? [...m[1].matchAll(/\['([^']+)',/g)].map((x) => x[1]) : null
}
const injected = grab('INJECTED')
const onDemand = grab('ON_DEMAND')
check(Array.isArray(injected) && injected.length > 0, 'INJECTED 可解析（' + (injected?.length ?? 0) + ' 条）')
check(Array.isArray(onDemand) && onDemand.length > 0, 'ON_DEMAND 可解析（' + (onDemand?.length ?? 0) + ' 条）')
const missingFiles = [...(injected ?? []), ...(onDemand ?? [])].filter((p) => !existsSync(CORPUS + p))
check(missingFiles.length === 0, '所有语料路径都存在' + (missingFiles.length ? ' → 缺失: ' + missingFiles.join(', ') : ''))

const PERSONA_FILES = [
  'A1-官方派调查者.md','A2-复用派调查者.md','A3-个性化派调查者.md','A4-汇总验证者.md',
  'B1-古怪奇想者.md','B2-务实者.md','B3-美观与人因者.md','B4-汇总收口人.md',
  'C1-前端.md','C2-后端.md','C3-细节与修bug.md','C4-安全层.md',
  'D1-代码级跑测.md','D2-实机体验测试.md','D3-长远bug寻找者.md',
  'D4-AI味猎手.md','D5-安全层红队.md','D6-分类汇总者.md',
  'E1-文员.md','E2-演示文稿.md','E3-宣传片视频.md'
]
const personaOnDemand = (onDemand ?? []).filter((p) => p.startsWith('personas/') && !p.startsWith('personas/web/'))
check(personaOnDemand.length === PERSONA_FILES.length, 'ON_DEMAND 含 ' + PERSONA_FILES.length + ' 份主模式人格委任书（实际 ' + personaOnDemand.length + '）')
const missingPersona = PERSONA_FILES.filter((f) => !(onDemand ?? []).includes('personas/' + f))
check(missingPersona.length === 0, '委任书文件名逐个匹配' + (missingPersona.length ? ' → 缺: ' + missingPersona.join(', ') : ''))
check((injected ?? []).includes('personas/chen.md'), 'chen.md 在 INJECTED（晨是本人格）')
const personaInjected = (injected ?? []).filter((p) => p.startsWith('personas/') && !p.startsWith('personas/group-') && p !== 'personas/chen.md')
check(personaInjected.length === 0, '委任书未混入 INJECTED' + (personaInjected.length ? ' → ' + personaInjected.join(', ') : ''))
// 磁盘上主模式人格文件 = 21 份委任书 + chen.md（web/ 子目录单独算）
const onDisk = [...PERSONA_FILES, 'chen.md'].filter((f) => existsSync(CORPUS + 'personas/' + f))
check(onDisk.length === PERSONA_FILES.length + 1, '磁盘上存在 ' + (PERSONA_FILES.length + 1) + ' 份主模式人格文件（实际 ' + onDisk.length + '）')
check((onDemand ?? []).includes('questions/99-adaptive-asking.md'), 'ON_DEMAND 含提问总纲')
check(/role_text/.test(src), '裁定文本含 role_text 委任要求')
check(/ask_user_question/.test(src), '裁定文本含 ask_user_question 硬约束')

// ── A3. 编排纪律 ────────────────────────────────────────────────────────────
console.log('')
console.log('=== A3. 编排纪律（治抢活 / 乱派人 / 停不下来 / 每组只派一个）===')
check(!src.includes('只允许**一个活跃实例**'), '旧规则「只允许一个活跃实例」已移除')
check(!src.includes('A/B/C/D 组一律单实例'), '旧规则「A/B/C/D 组一律单实例」已移除')
check(src.includes('并发是默认') && src.includes('禁止串行'), '含「并发是默认，禁止串行」')
check(src.includes('slice'), '含 slice 互斥切片声明')
check(/上限 \*\*8\*\*/.test(src), '含同批并发上限 8')
check(src.includes('只有 E1 能创建带编号的下属'), 'E1 例外表述正确')
check(src.includes('不许抢活'), '含「晨不许抢活」裁定')
check(src.includes('产物作废'), '含抢活判据（产物作废）')
check(src.includes('症状') && src.includes('对照表'), '指向症状→人格对照表')
check(src.includes('该停的地方停') && src.includes('该干的地方不停'), '含停手门禁')
check(src.includes('那是骚扰'), '含「别每派完一个就汇报」')
const rulingNums = [...src.matchAll(/\*\*裁定 (\d+) ·/g)].map((m) => Number(m[1]))
const rulingDup = rulingNums.filter((n, i) => rulingNums.indexOf(n) !== i)
check(rulingDup.length === 0, '裁定编号无重号' + (rulingDup.length ? ' → ' + rulingDup.join(',') : ''))
check(rulingNums.join(',') === '1,2,3,4,5,6,7,8,9,10,11', '裁定 1..11 连续（实际 ' + rulingNums.join(',') + '）')
check(src.includes('十一条收口'), '标题写「十一条收口」')

// ── A4. C-WEB 网络安全工作流的接线 ──────────────────────────────────────────
console.log('')
console.log('=== A4. C-WEB 网络安全工作流 ===')
check(src.includes('裁定 11'), '含裁定 11（C-WEB 豁免边界）')
check(src.includes('只问授权向的六类') || src.includes('授权向的六类'), '裁定 11 写明只问授权向六类')
check(src.includes('豁免严格限于网络安全任务'), '裁定 11 写明豁免范围')
check(src.includes('D-web1 策略门不可绕过') || src.includes('策略门不可绕过'), '裁定 11 写明策略门不可绕过')
check(src.includes('范围判定的依据变化时也要停'), '裁定 11 写明越界即停含依据变化')
check(src.includes('不能把犯罪行为变成合法行为'), '裁定 11 写明绝对不做清单的性质')
check(injected.includes('web/00-组索引.md'), 'C-WEB 组索引已进 INJECTED')
const webPersonas = onDemand.filter((p) => p.startsWith('personas/web/'))
check(webPersonas.length === 36, 'ON_DEMAND 含 36 份 C-WEB 委任书（实际 ' + webPersonas.length + '）')
check(webPersonas.includes('personas/web/chen-web.md'), 'chen-web 委任书在册')
check(webPersonas.includes('personas/web/I-web5-反击执行员.md'), 'I-web5 委任书在册')
const webDocs = onDemand.filter((p) => p.startsWith('web/'))
// 7 份支撑文档在 ON_DEMAND；第 8 份（00-组索引.md）在 INJECTED，见上面 A4 第一条
check(webDocs.length === 7, 'ON_DEMAND 含 7 份 C-WEB 支撑文档（实际 ' + webDocs.length + '）')
check(injected.includes('web/00-组索引.md') && webDocs.length === 7, 'C-WEB 的 8 份文档 = 1 注入 + 7 按需')
check(onDemand.includes('workflow/05-web-security.md'), 'C-WEB 附属工作流在册')
check(injected.filter((p) => p.includes('web/')).length === 1, 'C-WEB 只有组索引进 INJECTED（委任书不注入）')

// ── B. 结构（自带 reader，零外部依赖）───────────────────────────────────────
// 注意：reader 把嵌套 `config` 里的字段上提到行上（它没有嵌套映射模型），
// 所以预设行上 `name` 是显示名、`id` 可能被 `config.id` 覆盖。按行 id 定位。
const allTop = readRows(raw)
const flatIds = (rows) => flatten(rows).map((r) => r.id)
const rowsOf = (row) => (Array.isArray(row.children) ? row.children : [])
const findPreset = (lineId, presetId) =>
  allTop.find((r) => r.id === lineId || (Array.isArray(r.children) && r.id === presetId))
const cdsRow = findPreset('preset-cds', 'cds')
const teamRow = findPreset('preset-cds-team', 'cds-team')

console.log('')
console.log('=== B. 结构解析 ===')
check(cdsRow !== undefined, '读到 preset-cds 行')
check(teamRow !== undefined, '读到 preset-cds-team 行')
check(cdsRow !== teamRow, '两个预设解析为不同行')
const cds = cdsRow ? rowsOf(cdsRow) : []
const team = teamRow ? rowsOf(teamRow) : []
check(cds.length > 0, 'preset-cds 解析出 ' + cds.length + ' 个子行')
check(team.length > 0, 'preset-cds-team 解析出 ' + team.length + ' 个子行')
check(cds.length !== team.length, '两预设子行数不同（cds=' + cds.length + ' / team=' + team.length + '）')

// ── B2. 工具重名审计 ────────────────────────────────────────────────────────
console.log('')
console.log('=== B2. 工具重名审计 ===')
const TOOL_OF_ROW = {
  'tool-pwsh': 'pwsh',
  'tool-bash': 'bash',
  'tool-pwsh-persistent': 'pwsh',
  'tool-bash-persistent': 'bash',
  'persistent-pwsh': 'pwsh',
  'persistent-bash': 'bash',
  'tool-fs': 'read,write,edit',
  'tool-fs-search': 'glob,grep',
  'tool-jobs': 'job_output,job_list,job_kill',
  'tool-skill': 'skill',
  'tool-goal': 'get_goal,create_goal,update_goal',
  'tool-subagent': 'subagent',
  'tool-subagent-fork': 'subagent_fork',
  'tool-subagent-control': 'send_message,interrupt_agent',
  'tool-subagent-list-agents': 'list_agents',
  'tool-workflow': 'workflow',
  'tool-ask-user': 'ask_user_question',
  'tool-todo': 'todo_write',
  'tool-web': 'web_search,web_fetch',
  'present': 'present',
  'cds-mode': '(prompt section)',
  'plan-mode': '(prompt section)',
  'command-goal': '(command)',
  'compaction-basic': '(service)',
  'command-compact': '(command)',
  'tool-result-pruner': '(service)',
  'workflow-ptc': '(service)',
  'skill-filesystem': '(provider)',
  'agent-team': '(service)',
  'tool-agent-team': 'spawn_teammate,send_message,list_agents,team_task_*',
}
for (const [label, rows] of [['preset-cds', cds], ['preset-cds-team', team]]) {
  const seen = new Map()
  const dups = []
  for (const r of flatten(rows).filter((x) => x.disabled === undefined)) {
    const t = TOOL_OF_ROW[r.id]
    // 只有真正的工具名参与比较；带括号的是"注册别的东西"的说明
    if (!t || t.startsWith('(')) continue
    for (const name of t.split(',').filter((n) => n && !n.includes('*'))) {
      if (seen.has(name)) dups.push(name + ' ← ' + seen.get(name) + ' + ' + r.id)
      else seen.set(name, r.id)
    }
  }
  check(dups.length === 0, label + ' 无工具重名' + (dups.length ? ' → ' + dups.join('; ') : ''))
}

// ── B3. 同伴频道接线：治"未发现有协同功能" / "协同做的不好" ─────────────────
console.log('')
console.log('=== B3. 同伴频道接线 ===')
const hostRows = allTop.filter((r) => !Array.isArray(r.children))
const hostIds = hostRows.map((r) => r.id)
const hostNames = hostRows.map((r) => r.name ?? '')
check(hostIds.includes('agent-team'), '主机平面有 agent-team 服务行（不在预设内部）')
check(hostNames.includes('@deepseek-ai/dsh-experimental-agent-team'), 'agent-team 指向正确包')
check(hostIds.includes('ui-agent-team'), '主机平面有 ui-agent-team 界面行（名册/任务板/导航）')
check(hostNames.includes('@deepseek-ai/dsh-experimental-client-ui-agent-team'), 'ui-agent-team 指向正确包')
check(!flatIds(cds).includes('agent-team'), 'preset-cds 内部无 agent-team（应在主机平面）')
check(!flatIds(team).includes('agent-team'), 'preset-cds-team 内部无 agent-team（应在主机平面）')
check(flatIds(team).includes('tool-agent-team'), 'preset-cds-team 挂了 tool-agent-team')
check(team.some((p) => p.id === 'tool-agent-team'), 'tool-agent-team 在 cds-team 顶层行')
const LEGACY_DELEG = ['tool-subagent', 'tool-subagent-fork', 'tool-subagent-control', 'tool-subagent-list-agents']
const teamDeleg = flatten(team).filter((r) => LEGACY_DELEG.includes(r.id))
check(teamDeleg.filter((r) => r.disabled === true).length >= 2, 'preset-cds-team 禁用了 legacy 委派行（至少 subagent / subagent_fork）')
check(!teamDeleg.some((r) => r.disabled === undefined), 'legacy 委派行没有残留 enabled 状态')
check(!cds.some((p) => /experimental/.test(p.name ?? '')), 'preset-cds 零实验依赖（保底）')
check(flatIds(cds).includes('tool-subagent'), 'preset-cds 保留 legacy 委派（它不挂 Team 工具，必须留一条路）')
const teamWf = flatten(team).find((r) => r.id === 'workflow-ptc')
check(teamWf !== undefined && teamWf.disabled === undefined, 'workflow-ptc 未被误禁（不是委派工具冲突项）')
check(!flatIds(cds).includes('persistent-pwsh'), 'preset-cds 已移除 persistent-pwsh')
check(!flatIds(team).includes('persistent-pwsh'), 'preset-cds-team 已移除 persistent-pwsh')
check(flatIds(cds).includes('tool-pwsh'), 'preset-cds 保留 tool-pwsh')
check(flatIds(team).includes('tool-pwsh'), 'preset-cds-team 保留 tool-pwsh')

// ── B4. 可移植性：不许有作者机的绝对路径 ──────────────────────────────────
console.log('')
console.log('=== B4. 可移植性（打包给别人用）===')
check(!/D:\\\\SuperAI Power|D:\/SuperAI Power/.test(raw), 'patch 里无作者机绝对路径')
check(!/D:\\\\SuperAI Power|D:\/SuperAI Power/.test(src), 'index.js 里无作者机绝对路径')
check(/fileURLToPath\(import\.meta\.url\)/.test(src), '语料路径由 import.meta.url 解析（跟包走）')
check(!/^\s*corpusDir:/m.test(raw), 'patch 未设置 corpusDir（用包内默认）')
check(src.includes("join(PACKAGE_DIR, 'cds')"), '默认语料指向包内 ./cds')

// ── B5. ZIP 写入器自测（曾因位运算符号问题两次构建失败）────────────────────
console.log('')
console.log('=== B5. ZIP 写入器自测 ===')
{
  const { makeZip } = await import('./_zip.mjs')
  const { deflateRawSync } = await import('node:zlib')
  const payload = '中文内容 test\n' + 'x'.repeat(5000)
  const zip = makeZip([
    { name: 'package/a.txt', data: Buffer.from('hello', 'utf8') },
    { name: 'package/子目录/中文名.md', data: Buffer.from(payload, 'utf8') },
  ])
  check(Buffer.isBuffer(zip) && zip.length > 0, 'makeZip 返回非空 Buffer（' + zip.length + ' 字节）')
  check(zip.readUInt32LE(0) === 0x04034b50, '首条为本地文件头签名')
  let eocd = -1
  for (let i = zip.length - 22; i >= 0; i--) if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  check(eocd >= 0, '有 EOCD 记录')
  check(zip.readUInt16LE(eocd + 10) === 2, 'EOCD 条目数 = 2（实际 ' + zip.readUInt16LE(eocd + 10) + '）')
  const cdOff = zip.readUInt32LE(eocd + 16)
  check(zip.readUInt32LE(cdOff) === 0x02014b50, '中央目录首条签名正确')
  // CRC 必须无符号：CRC32("hello") = 0x3610a686
  const crc0 = zip.readUInt32LE(14)
  check(crc0 === 0x3610a686, 'CRC32("hello") = 0x3610a686（实际 0x' + crc0.toString(16) + '）')
  // 外部属性必须无符号写入（曾是 -2119958528 的崩点）
  check(zip.readUInt32LE(cdOff + 38) === ((0o100644 << 16) >>> 0), '外部属性按无符号写入')
  const raw = Buffer.from(payload, 'utf8')
  check(deflateRawSync(raw).length < raw.length, 'deflate 对可压缩内容确实变小')
}

// ── B6. 分发包的公开文档 ────────────────────────────────────────────────────
console.log('')
console.log('=== B6. 公开文档（分发包的 README / INSTALL）===')
{
  const readmePath = join(PACKAGE_DIR, 'README.md')
  const installPath = join(PACKAGE_DIR, 'INSTALL.md')
  check(existsSync(readmePath), '包内有公开 README.md')
  check(existsSync(installPath), '包内有 INSTALL.md')
  if (existsSync(readmePath)) {
    const rm = readFileSync(readmePath, 'utf8')
    // 四条官方安装路径必须都写到（依据 install-spec.js 与 ui-plugin-manager）
    check(/Plugins/.test(rm) && /Add plugin/.test(rm), 'README 写了 Web 界面安装（侧边栏 Plugins → Add plugin）')
    check(/dsh plugin --profile/.test(rm) && /add /.test(rm), 'README 写了命令行安装（dsh plugin --profile <name> add）')
    check(/install_bundle/.test(rm), 'README 写了 agent 工具安装（install_bundle）')
    check(/unzip/.test(rm) && /zip/.test(rm), 'README 写了压缩包安装')
    // install-spec.js 支持的四种 spec 形式
    check(/github:DRQRTS\/dsh/.test(rm) || /https:\/\/github\.com\/DRQRTS\/dsh/.test(rm), 'README 给了 git 地址写法')
    check(/绝对路径|absolute/i.test(rm), 'README 说明路径必须绝对')
    check(/不接受 `\.zip`|不接受 `.zip`/.test(rm), 'README 说明 install_bundle 不接受 .zip 本身')
    // 两个容易踩的点
    check(/重启/.test(rm), 'README 强调必须重启')
    check(/不会自动更新|不自动更新/.test(rm), 'README 说明插件不自动更新')
    // GitHub 可达性（本机实测不可达，必须写）
    check(/GitHub 连不上|Cannot access GitHub/.test(rm), 'README 写了 GitHub 不可达的处置')
    check(/npmmirror|镜像/.test(rm), 'README 澄清镜像解决不了 GitHub 问题')
    // 仓库地址：改名过（dsh -> dsh-cds-mode），文档必须写规范名
    check(/DRQRTS\/dsh-cds-mode/.test(rm), 'README 用规范仓库名 DRQRTS/dsh-cds-mode')
    check(!/DRQRTS\/dsh(?!-cds-mode)/.test(rm), 'README 无旧仓库地址残留')
    // 章节号不得重号
    const h2 = [...rm.matchAll(/^## ([一二三四五六七八九十]+)、/gm)].map((m) => m[1])
    const dup = h2.filter((n, i) => h2.indexOf(n) !== i)
    check(dup.length === 0, 'README 章节号无重号（共 ' + h2.length + ' 节）' + (dup.length ? ' → ' + dup.join(',') : ''))
    check(h2.join('') === '一二三四五六七八九十十一十二十三十四', 'README 章节号连续一到十四（实际 ' + h2.join('') + '）')
  }
  if (existsSync(installPath)) {
    const im = readFileSync(installPath, 'utf8')
    const secs = [...im.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]))
    check(JSON.stringify(secs) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8]), 'INSTALL 章节号 0..8 连续（实际 ' + secs.join(',') + '）')
    check(/dsh plugin --profile/.test(im), 'INSTALL 写了命令行安装')
    check(/install_bundle/.test(im), 'INSTALL 写了 agent 工具安装')
    check(/6\.1/.test(im), 'INSTALL 写了 GitHub 不可达小节')
    check(/不会自动更新|不自动更新/.test(im), 'INSTALL 说明插件不自动更新')
    check(!/130\+ 项断言/.test(im), 'INSTALL 的断言数已更新（不再是 130+）')
    check(/DRQRTS\/dsh-cds-mode/.test(im), 'INSTALL 用规范仓库名')
    check(!/DRQRTS\/dsh(?!-cds-mode)/.test(im), 'INSTALL 无旧仓库地址残留')
  }
}

// ── C. 源码契约 ─────────────────────────────────────────────────────────────
console.log('')
console.log('=== C. 插件源码契约 ===')
// 语法检查用动态 import 做（不是 `new Function` —— 那个不能解析 ESM 的 import，
// 会一律报错）。曾经踩过：在 RULINGS 模板字面量里写了未转义的反引号，直接把
// 模板字符串截断，整个 index.js 语法错误。这一步把它变成硬门禁。
let mod = null
let importError = null
try {
  mod = await import('file:///' + DIR.replace(/\\/g, '/') + 'index.js')
} catch (e) {
  importError = e
}
check(mod !== null, 'index.js 可 import' + (importError ? ' → ' + importError.message.split('\n')[0] : ''))
const rulingsMatch = src.match(/const RULINGS = `([\s\S]*?)`\r?\n/)
check(rulingsMatch !== null && rulingsMatch[1].includes('裁定 11'), 'RULINGS 模板未被提前截断（取到裁定 11）')
const imps = [...src.matchAll(/^import\s.+from\s+'([^']+)'/gm)].map((m) => m[1])
check(imps.every((s) => s.startsWith('node:')), '只有 node: 内建依赖（实际: ' + imps.join(', ') + '）')
check(!/^export const Config/m.test(src), '不导出 Config（普通对象会让 cordis 校验炸掉）')

if (mod === null) {
  console.log('  （import 失败，后续需要模块的断言无法执行）')
} else {
  console.log('  exports: ' + Object.keys(mod).join(', '))
  check(mod.Config === undefined, 'Config 确实未导出')
  check(Array.isArray(mod.inject) && mod.inject.includes('systemPrompt'), 'inject 含 systemPrompt')
  check(typeof mod.apply === 'function', 'apply 是函数')
}

// ── D. 真实装载 ─────────────────────────────────────────────────────────────
console.log('')
console.log('=== D. 真实装载 ===')
const mount = (o) => {
  const cap = {}
  const logs = []
  const ctx = {
    effect(fn) { cap.dispose = fn() },
    systemPrompt: { section(s) { cap.section = s; return () => {} } },
    logger: { info: (m) => logs.push('INFO ' + m), warn: (m) => logs.push('WARN ' + m) },
  }
  mod.apply(ctx, Object.assign({ maxChars: 200000, liveReload: false }, o))
  return { section: cap.section, logs, dispose: cap.dispose }
}
const a = mount({})
a.logs.forEach((l) => console.log('  ' + l))
check(a.section !== undefined, '装载后拿到 section')
check(a.section.name === 'deployment:persona-prefix', 'section.name 正确（字面量，无包依赖）')
check(a.section.order === 0, 'order = 0')
check(a.section.interpolate === false, 'interpolate = false')
check(a.section.text.length > 40000, '注入字符数 ' + a.section.text.length + '（应 > 40000）')
const notInPrompt = (injected ?? []).filter((p) => !a.section.text.includes(p))
check(notInPrompt.length === 0, 'INJECTED 全部进了提示词' + (notInPrompt.length ? ' → 缺: ' + notInPrompt.join(', ') : ''))
const leaked = (onDemand ?? []).filter((p) => p.startsWith('personas/') && a.section.text.includes('### 语料：' + p))
check(leaked.length === 0, '按需委任书未泄漏进提示词' + (leaked.length ? ' → ' + leaked.join(', ') : ''))
check([1,2,3,4,5,6,7,8,9,10].every((n) => a.section.text.includes('裁定 ' + n)), '含十条裁定')
check(a.section.text.includes('L8') && a.section.text.includes('L9'), '提示词含铁律 L8 / L9')
check(a.section.text.includes('角色委任协议'), '提示词含角色委任协议')
check(a.section.text.includes('role_text'), '提示词含 role_text 字段要求')
check(a.section.text.includes('题库是素材，不是脚本'), '提示词含「题库是素材不是脚本」')
check(a.section.text.includes('99-adaptive-asking.md'), '提示词指向提问总纲')
check(mount({}).section.text === a.section.text, '两次装载逐字节一致（缓存前缀稳定）')

// ── E. 故障模式 ─────────────────────────────────────────────────────────────
console.log('')
console.log('=== E. 故障模式 ===')
try { mount({ corpusDir: 'D:/nope' }); check(false, '语料缺失应抛错') }
catch (e) { check(true, '语料缺失抛错: ' + e.message.split('\n')[0]) }
try { mount({ maxChars: 500 }); check(false, '超预算应抛错') }
catch (e) { check(true, '超预算抛错: ' + e.message.split('\n')[0]) }
try {
  mod.apply({ effect(f) { f() }, systemPrompt: { section() { return () => {} } }, logger: {} }, undefined)
  check(true, 'config 为 undefined 时不崩')
} catch (e) { check(false, 'config 为 undefined 时崩了: ' + e.message) }
a.dispose()
check(true, 'disposer 可调用')

console.log('')
console.log(fail === 0 ? '全部通过' : fail + ' 条失败')
if (fail !== 0) process.exitCode = 1
