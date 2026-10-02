import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 注意：本文件用 write 工具写入（非 PowerShell here-string），
// 否则反斜杠转义会在 shell 层被吃掉——上一版就是这么误报 22 次 FAIL 的。
//
// 校验对象是**包内语料**（发布态）。若作者机的源语料库同时存在，额外做一次
// 漂移检查，防止改了工作区语料却忘了 `node _sync-corpus.mjs`。

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))
const C = join(PACKAGE_DIR, 'cds') + '/'
const P = C + 'personas/'

/** 作者机源语料库；发布后不存在，此时跳过漂移检查。 */
const AUTHORING = join(PACKAGE_DIR, '..', '..', 'cds')
const HAS_AUTHORING = existsSync(join(AUTHORING, 'CORE.md'))

let fail = 0
const check = (ok, label) => { if (!ok) fail++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label) }

console.log('=== 0. 校验对象 ===')
console.log('  包内语料: ' + C)
console.log('  源语料库: ' + (HAS_AUTHORING ? AUTHORING + '（存在，将做漂移检查）' : '不存在（发布态，跳过漂移检查）'))

const PERSONAS = {
  A1: 'A1-官方派调查者.md', A2: 'A2-复用派调查者.md', A3: 'A3-个性化派调查者.md', A4: 'A4-汇总验证者.md',
  B1: 'B1-古怪奇想者.md', B2: 'B2-务实者.md', B3: 'B3-美观与人因者.md', B4: 'B4-汇总收口人.md',
  C1: 'C1-前端.md', C2: 'C2-后端.md', C3: 'C3-细节与修bug.md', C4: 'C4-安全层.md',
  D1: 'D1-代码级跑测.md', D2: 'D2-实机体验测试.md', D3: 'D3-长远bug寻找者.md',
  D4: 'D4-AI味猎手.md', D5: 'D5-安全层红队.md', D6: 'D6-分类汇总者.md',
  E1: 'E1-文员.md', E2: 'E2-演示文稿.md', E3: 'E3-宣传片视频.md'
}

const FM = /^---\n([\s\S]*?)\n---\n/
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u

console.log('=== 1. 21 份「被委任者」委任书的结构 ===')
const REQUIRED = [
  ['front-matter', (t) => FM.test(t)],
  ['声明 agent', (t) => /^agent:\s*\S+/m.test(FM.exec(t)?.[1] ?? '')],
  ['声明 role', (t) => /^role:\s*\S+/m.test(FM.exec(t)?.[1] ?? '')],
  ['声明 artifacts', (t) => /^artifacts:/m.test(FM.exec(t)?.[1] ?? '')],
  ['委任书警示', (t) => t.includes('本文件是「委任书」')],
  ['身份声明 # 你是', (t) => /^# 你是/m.test(t)],
  ['交付纪律段', (t) => t.includes('## 交付纪律')],
  ['无 emoji', (t) => !EMOJI.test(t)]
]
for (const [id, file] of Object.entries(PERSONAS)) {
  const path = P + file
  if (!existsSync(path)) { check(false, id + ' ' + file + ' 不存在'); continue }
  const t = readFileSync(path, 'utf8')
  const bad = REQUIRED.filter(([, fn]) => !fn(t)).map(([n]) => n)
  check(bad.length === 0, id.padEnd(3) + ' ' + file.padEnd(24) + (bad.length ? '缺: ' + bad.join(' / ') : '八要素齐备'))
}

console.log('')
console.log('=== 2. chen.md 是「委任者」，纪律不同但要素仍须齐备 ===')
const chen = readFileSync(P + 'chen.md', 'utf8')
check(FM.test(chen), '有 front-matter')
check(/^agent:\s*chen/m.test(FM.exec(chen)?.[1] ?? ''), '声明 agent: chen')
check(chen.includes('本文件是「委任书」'), '有委任书警示')
check(/^# 你是晨/m.test(chen), '身份声明 # 你是晨')
check(chen.includes('## 交付纪律'), '有交付纪律段（委任者版）')
check(!EMOJI.test(chen), '无 emoji')

console.log('')
console.log('=== 3. chen.md 的编号→路径对照表：21 条完整可复制路径 ===')
const refs = [...chen.matchAll(/`personas\/([^`]+\.md)`/g)].map((m) => m[1])
check(refs.length === 21, '列出 21 条（实际 ' + refs.length + '）')
const missing = refs.filter((f) => !existsSync(P + f))
check(missing.length === 0, '对照表无死链' + (missing.length ? ' → ' + missing.join(', ') : ''))
const allFiles = new Set(Object.values(PERSONAS))
const notListed = [...allFiles].filter((f) => !refs.includes(f))
check(notListed.length === 0, '磁盘上 21 份全部被列出' + (notListed.length ? ' → 未列: ' + notListed.join(', ') : ''))
check(!chen.includes('personas/chen.md`'), 'chen.md 未把自己列为被委任者')

console.log('')
console.log('=== 4. 组索引：链接无死链 + 声明是索引 ===')
for (const g of ['group-a-research.md','group-b-design.md','group-c-dev.md','group-d-test.md','group-e-misc.md']) {
  const t = readFileSync(P + g, 'utf8')
  const links = [...t.matchAll(/\]\(([A-Z][0-9]-[^)]+\.md)\)/g)].map((m) => m[1])
  const dead = links.filter((l) => !existsSync(P + l))
  check(links.length > 0 && dead.length === 0, g.padEnd(22) + links.length + ' 链接，死链 ' + dead.length)
  check(t.includes('本文件是索引，不是人格卡'), g.padEnd(22) + '声明为索引')
}

console.log('')
console.log('=== 5. 提问总纲与题库抬头 ===')
const q = readFileSync(C + 'questions/99-adaptive-asking.md', 'utf8')
check(q.includes('第一层') && q.includes('第二层') && q.includes('第三层'), '三层结构齐全')
check(q.includes('已排除项'), '含「已排除项」判定栏')
check(q.includes('ask_user_question'), '含工具要求')
check(q.includes('## 八、自检') && q.includes('## 九、反例'), '含自检清单与反例表')
for (const f of ['00-calibration.md','01-new-project-280.md','02-takeover-120.md','03-followup-10.md']) {
  const t = readFileSync(C + 'questions/' + f, 'utf8')
  check(t.includes('素材，不是脚本') && t.includes('99-adaptive-asking'), f.padEnd(24) + '已声明为素材并指向总纲')
}

console.log('')
console.log('=== 6. CORE 九条铁律与角色委任协议 ===')
const core = readFileSync(C + 'CORE.md', 'utf8')
const missingRules = ['L1','L2','L3','L4','L5','L6','L7','L8','L9'].filter((r) => !core.includes('| ' + r + ' |'))
check(missingRules.length === 0, 'L1–L9 九条铁律齐全' + (missingRules.length ? ' → 缺 ' + missingRules.join(',') : ''))
check(/L8[^|]*\|[^|]*委任必须交出人格卡正文/.test(core), 'L8 语义：委任必须交出人格卡正文')
check(/L9[^|]*\|[^|]*ask_user_question/.test(core), 'L9 语义：提问必须调用工具')
check(core.includes('## 一、九条铁律'), '第一章标题写「九条铁律」（不是七条）')
check(core.includes('## 六、角色委任协议'), '第六节已升级为角色委任协议')
check(core.includes('role_text'), '含 role_text 必填字段')
check(core.includes('委任失败'), '含委任失败判据')
check(/它没有理由成为 A1/.test(core), '含"子 Agent 为何不会自动成为人格"的机制解释')

console.log('')
console.log('=== 7. CORE 编排纪律（治抢活 / 乱派人 / 停不下来 / 每组只派一个）===')
check(core.includes('## 七、晨的编排纪律'), '含第七节「晨的编排纪律」')
check(core.includes('### 7.1 晨只做编排') && core.includes('不许抢活'), '含 7.1 不许抢活')
check(core.includes('越权判据'), '含抢活越权判据')
check(core.includes('### 7.2 派谁') && core.includes('症状 → 人格对照表'), '含 7.2 症状→人格对照表')
check(core.includes('### 7.3 什么时候必须停手'), '含 7.3 停手门禁')
check(core.includes('### 7.4 编排自检'), '含 7.4 编排自检')
check(core.includes('### 6.3 并发派发'), '含 6.3 并发派发')
check(core.includes('一批里所有互相独立的任务，必须在同一批里一次派完'), '含"同批一次派完"硬规定')
check(core.includes('同批并发上限 8 个实例'), '含并发上限 8')
check(core.includes('slice'), '含 slice 互斥切片字段')
check(core.includes('can_assign_numbers'), '派发结构含 can_assign_numbers（替代旧的 can_split）')
check(!core.includes('只允许**一个活跃实例**'), '旧规则「只允许一个活跃实例」已从 CORE 移除')
check(!core.includes('仅 E1 允许'), '旧规则「仅 E1 允许」已移除')
const h2 = [...core.matchAll(/^## ([一二三四五六七八九十]+)、/gm)].map((m) => m[1])
const h2dup = h2.filter((n, i) => h2.indexOf(n) !== i)
check(h2dup.length === 0, '章节编号无重号（共 ' + h2.length + ' 节）' + (h2dup.length ? ' → 重: ' + h2dup.join(',') : ''))
check(h2.join('') === '一二三四五六七八九十十一', '章节编号连续一到十一（实际 ' + h2.join('') + '）')

console.log('')
console.log('=== 8. 工作流的并发下限（不许每组只派一个）===')
const wf = readFileSync(C + 'workflow/01-new-project.md', 'utf8')
check(wf.includes('D1–D5 五个视角必须同批一次派完'), 'TEST 阶段标明五个视角必同批')
check(wf.includes('只派 D1 就等于'), '标明"只派 D1 = 只测五分之一"')
check((wf.match(/\*\*必派\*\*/g) || []).length === 5, 'D1–D5 五行都标了「必派」（实际 ' + (wf.match(/\*\*必派\*\*/g) || []).length + '）')

console.log('')
console.log('=== 9. C-WEB 网络安全工作流 ===')
const WEB_DIR = C + 'personas/web/'
const WEB_ROSTER = {
  A: ['A-web1-边界侦察员', 'A-web2-威胁情报官', 'A-web3-OSINT调查员', 'A-web4-供应链情报员'],
  B: ['B-web1-信号检测员', 'B-web2-数字取证员', 'B-web3-漏洞分析师', 'B-web4-恶意代码分析员', 'B-web5-流量分析员'],
  C: ['C-web1-响应执行员', 'C-web2-恢复验证员', 'C-web3-遏制策略员', 'C-web4-业务连续性员'],
  D: ['D-web1-策略审计员', 'D-web2-报告复盘员', 'D-web3-合规专员', 'D-web4-隐私保护员'],
  E: ['E-web1-安全架构师', 'E-web2-应用安全工程师', 'E-web3-云安全工程师', 'E-web4-身份与访问管理员', 'E-web5-数据安全工程师', 'E-web6-密码学工程师'],
  F: ['F-web1-渗透测试员', 'F-web2-红队操作员', 'F-web3-逆向工程师', 'F-web4-漏洞研究员'],
  G: ['G-web1-检测工程师', 'G-web2-安全自动化工程师', 'G-web3-安全工具开发员'],
  I: ['I-web1-实时防御指挥', 'I-web2-攻击阻断员', 'I-web3-欺骗防御员', 'I-web4-攻击溯源员', 'I-web5-反击执行员'],
}
const WEB_TRAIT = { A: '情感冷漠', B: '求真', C: '克制', D: '固执', E: '远见', F: '攻防思维', G: '效率', I: '快、准、狠' }
const allWeb = Object.values(WEB_ROSTER).flat()
check(allWeb.length === 35, 'C-WEB 人格共 35 个（实际 ' + allWeb.length + '）')
const webMissing = allWeb.filter((n) => !existsSync(WEB_DIR + n + '.md'))
check(webMissing.length === 0, '35 份 C-WEB 委任书都在磁盘上' + (webMissing.length ? ' → 缺: ' + webMissing.slice(0, 5).join(', ') : ''))
check(existsSync(WEB_DIR + 'chen-web.md'), 'chen-web.md（晨的安全模式）存在')

// 每份必须有：front-matter、委任书警示、交付纪律、授权边界、组特质
let webBad = []
for (const [g, names] of Object.entries(WEB_ROSTER)) {
  for (const n of names) {
    const t = readFileSync(WEB_DIR + n + '.md', 'utf8')
    const missingBits = []
    if (!/^---\r?\n/.test(t)) missingBits.push('front-matter')
    if (!t.includes('本文件是「委任书」')) missingBits.push('委任书警示')
    if (!t.includes('## 交付纪律')) missingBits.push('交付纪律')
    if (!t.includes('authorization.md')) missingBits.push('授权边界')
    if (!t.includes(WEB_TRAIT[g])) missingBits.push('组特质(' + WEB_TRAIT[g] + ')')
    if (!t.includes('peer-channel.md') && n !== 'D-web1-策略审计员') missingBits.push('同伴频道')
    if (missingBits.length) webBad.push(n + ' → ' + missingBits.join('/'))
  }
}
check(webBad.length === 0, '35 份委任书要素齐备' + (webBad.length ? ' → ' + webBad.slice(0, 4).join('; ') : ''))

// 组索引：21 条主模式对照表的对应物，35 条路径必须无死链
const webIdx = readFileSync(C + 'web/00-组索引.md', 'utf8')
// 只认真实编号：以 A/B/C/D/E/F/G/I-web<数字> 开头，排除 `<编号>-<称呼>.md` 这类占位符
const idxPaths = [...webIdx.matchAll(/personas\/web\/([ABCDEFGI]-web\d-[^\s`|)]+\.md)/g)].map((m) => m[1])
const idxUnique = [...new Set(idxPaths)]
const idxDead = idxUnique.filter((p) => !existsSync(WEB_DIR + p))
check(idxUnique.length === 35, '组索引列出 35 条委任书路径（实际 ' + idxUnique.length + '）')
check(idxDead.length === 0, '组索引无死链' + (idxDead.length ? ' → ' + idxDead.join(', ') : ''))
const rosterInIdx = allWeb.filter((n) => !idxUnique.includes(n + '.md'))
check(rosterInIdx.length === 0, '35 个人格在组索引中全部被列出' + (rosterInIdx.length ? ' → 缺: ' + rosterInIdx.slice(0, 5).join(', ') : ''))
check(webIdx.includes('本文件是索引，不是人格卡'), '组索引声明自己是索引')
check(webIdx.includes('并发是默认'), '组索引写明并发是默认')

// 工作流入库 + 关键约束
const w5 = readFileSync(C + 'workflow/05-web-security.md', 'utf8')
check(w5.includes('不得跳过 D-web1') || w5.includes('不得跳过'), '工作流写明策略门不可绕过')
check(w5.includes('人类只负责给权限') || w5.includes('人类只给权限'), '工作流写明人类只给权限')
check(w5.includes('豁免') && w5.includes('只问') , '工作流写明提问机制的显式豁免')
check(w5.includes('AutoGen') && w5.includes('不适用'), '工作流纠正了原文第 7 节的插件举例')

// 策略门人格必须有"三种结果"和"不可贿赂"
const dw1 = readFileSync(WEB_DIR + 'D-web1-策略审计员.md', 'utf8')
check(dw1.includes('没有第四种结果'), 'D-web1 写明只有三种判定结果')
check(dw1.includes('不可贿赂'), 'D-web1 写明不可贿赂')
check(dw1.includes('不可被任何 Agent 绕过') || dw1.includes('包括晨'), 'D-web1 写明连晨也不可绕过')

// 反击执行员必须有"绝对不做"清单与"越界即停"
const iw5 = readFileSync(WEB_DIR + 'I-web5-反击执行员.md', 'utf8')
check(iw5.includes('绝对不做'), 'I-web5 含「绝对不做」清单')
check(iw5.includes('越界即停'), 'I-web5 含越界即停')
check(iw5.includes('准入') && iw5.includes('7 项'), 'I-web5 含准入七项')

// 隐私一票否决
const dw4 = readFileSync(WEB_DIR + 'D-web4-隐私保护员.md', 'utf8')
check(dw4.includes('一票否决'), 'D-web4 声明一票否决权')

// 8 份支撑文档
const WEB_DOCS = ['00-组索引.md', '01-实时作战.md', '02-策略门.md', '03-审计与留痕.md', '04-证据与置信度.md', '05-授权边界.md', '06-权限与审批矩阵.md', '07-落地路线.md']
const docMissing = WEB_DOCS.filter((d) => !existsSync(C + 'web/' + d))
check(docMissing.length === 0, '8 份 C-WEB 支撑文档齐全' + (docMissing.length ? ' → 缺: ' + docMissing.join(', ') : ''))

console.log('')
console.log('=== 10. 包内语料 vs 源语料（漂移检查）===')
if (!HAS_AUTHORING) {
  console.log('  发布态，跳过。')
} else {
  const { readdirSync, statSync } = await import('node:fs')
  const list = (dir, base = dir, out = []) => {
    for (const n of readdirSync(dir).sort()) {
      const full = join(dir, n)
      if (statSync(full).isDirectory()) list(full, base, out)
      else out.push(full.slice(base.length + 1).split('\\').join('/'))
    }
    return out
  }
  const src = list(AUTHORING)
  const dst = list(join(PACKAGE_DIR, 'cds'))
  const missing = src.filter((f) => !dst.includes(f))
  const extra = dst.filter((f) => !src.includes(f))
  const diff = src.filter((f) => dst.includes(f) && readFileSync(join(AUTHORING, f), 'utf8') !== readFileSync(join(PACKAGE_DIR, 'cds', f), 'utf8'))
  check(missing.length === 0, '包内不缺文件' + (missing.length ? ' → ' + missing.slice(0, 5).join(', ') : ''))
  check(extra.length === 0, '包内无多余文件' + (extra.length ? ' → ' + extra.slice(0, 5).join(', ') : ''))
  check(diff.length === 0, '内容逐字节一致（' + src.length + ' 个文件）' + (diff.length ? ' → 不一致: ' + diff.slice(0, 5).join(', ') + '  ← 跑 node _sync-corpus.mjs' : ''))
}

console.log('')
console.log(fail === 0 ? '全部通过' : fail + ' 条失败')
if (fail !== 0) process.exitCode = 1
