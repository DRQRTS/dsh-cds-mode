/**
 * Validate the icon SVG: well-formed XML, geometry inside the viewBox, and the
 * claims made in its own comment block actually hold.
 *
 * Node has no DOM, so this parses with a small tag scanner and checks the
 * numbers. That is enough for a 20-line hand-written icon and avoids adding a
 * dependency to a package whose whole point is having none.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(PKG, 'icon.svg'), 'utf8')

let fail = 0
const check = (ok, label) => { if (!ok) fail++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label) }

console.log('=== SVG 结构 ===')
check(/^<svg[\s>]/.test(svg.trim()), '根元素是 <svg>')
check(svg.includes('xmlns="http://www.w3.org/2000/svg"'), '声明了 xmlns（必需，否则浏览器拒绝渲染）')
check(/viewBox="0 0 64 64"/.test(svg), 'viewBox 为 0 0 64 64')
check(svg.includes('currentColor'), '用 currentColor（跟随主题）')
check(!/#[0-9a-fA-F]{3,6}/.test(svg), '无硬编码颜色（跟随主题的前提）')
check(svg.includes('role="img"') && svg.includes('aria-label'), '有无障碍属性')
check(/<\/svg>\s*$/.test(svg), '闭合标签完整')

// 标签配对
const open = [...svg.matchAll(/<([a-zA-Z][\w-]*)(?:\s[^>]*)?(?<!\/)>/g)].map((m) => m[1]).filter((t) => t !== 'svg' ? true : true)
const close = [...svg.matchAll(/<\/([a-zA-Z][\w-]*)>/g)].map((m) => m[1])
check(JSON.stringify(open.filter((t) => t === 'g')) === JSON.stringify(close.filter((t) => t === 'g')), '<g> 标签配对')
// 标签配对：收集所有开放标签名（排除自闭合）与所有闭合标签名，两者必须一致
const selfClosing = new Set()
for (const m of svg.matchAll(/<([a-zA-Z][\w-]*)(?:\s[^>]*?)?\/>/g)) selfClosing.add(m[1])
const opened = [...svg.matchAll(/<([a-zA-Z][\w-]*)(?:\s[^>]*?)?>/g)].map((m) => m[1]).filter((t) => !svg.includes(`<${t}`) || true)
const openedReal = []
for (const m of svg.matchAll(/<([a-zA-Z][\w-]*)(\s[^>]*)?>/g)) {
  const tag = m[1]
  if (m[0].endsWith('/>')) continue
  openedReal.push(tag)
}
const closedReal = [...svg.matchAll(/<\/([a-zA-Z][\w-]*)>/g)].map((m) => m[1])
const openedSorted = [...openedReal].sort()
const closedSorted = [...closedReal].sort()
check(JSON.stringify(openedSorted) === JSON.stringify(closedSorted),
  '每个非自闭合标签都有闭合（开 ' + openedReal.length + ' / 闭 ' + closedReal.length + '）' +
  (JSON.stringify(openedSorted) === JSON.stringify(closedSorted) ? '' : ' → 开:' + openedSorted.join(',') + ' 闭:' + closedSorted.join(',')))

console.log('')
console.log('=== 几何：所有形状必须在 0..64 内 ===')
const nums = (re, src = svg) => [...src.matchAll(re)].map((m) => Number(m[1]))

const circles = [...svg.matchAll(/<circle\s+cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g)]
  .map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3] }))
check(circles.length === 6, '共 6 个圆（盘 1 + 枢纽 1 + 卫星 4），实际 ' + circles.length)

let out = []
for (const c of circles) {
  const lo = Math.min(c.cx - c.r, c.cy - c.r)
  const hi = Math.max(c.cx + c.r, c.cy + c.r)
  if (lo < 0 || hi > 64) out.push(`cx=${c.cx} cy=${c.cy} r=${c.r}`)
}
check(out.length === 0, '所有圆完全落在 0..64 内' + (out.length ? ' → 越界: ' + out.join('; ') : ''))

// 盘 = 以 32,32 为心且 r 最大者；枢纽 = 中心且 r 次大；卫星 = 其余
const atCenter = circles.filter((c) => c.cx === 32 && c.cy === 32)
const plate = atCenter.find((c) => c.r === Math.max(...atCenter.map((x) => x.r)))
const hub = atCenter.find((c) => c !== plate)
const sats = circles.filter((c) => c !== plate && c !== hub)
check(sats.length === 4, '识别出 4 颗卫星，实际 ' + sats.length)
check(hub !== undefined && hub.r === 8, '枢纽半径 8（实际 ' + (hub ? hub.r : '未找到') + '）')
const far = Math.max(...sats.map((c) => Math.hypot(c.cx - 32, c.cy - 32) + c.r))
check(far < plate.r, `卫星最远点 ${far} < 盘半径 ${plate.r}（在盘内）`)

// 卫星两两不重叠
let overlap = []
for (let i = 0; i < sats.length; i++) {
  for (let j = i + 1; j < sats.length; j++) {
    const d = Math.hypot(sats[i].cx - sats[j].cx, sats[i].cy - sats[j].cy)
    if (d < sats[i].r + sats[j].r) overlap.push(`${i}-${j} 间距 ${d.toFixed(1)} < ${sats[i].r + sats[j].r}`)
  }
}
check(overlap.length === 0, '4 个卫星互不重叠' + (overlap.length ? ' → ' + overlap.join('; ') : ''))

// 卫星最小间距（可读性）：16px 下要有可见白缝
const minGap = Math.min(...sats.flatMap((a, i) => sats.slice(i + 1).map((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r)))
check(minGap > 8, `卫星最小间隙 ${minGap.toFixed(1)} 单位（16px 下约 ${(minGap / 4).toFixed(1)} px 白缝）`)

// 枢纽与卫星不重叠
const minHub = Math.min(...sats.map((c) => Math.hypot(c.cx - 32, c.cy - 32) - c.r - 8))
check(minHub > 0, `枢纽与卫星最小间隙 ${minHub.toFixed(1)} 单位`)

console.log('')
console.log('=== 辐条：不得穿过枢纽或卫星 ===')
const lines = [...svg.matchAll(/<line\s+x1="([\d.]+)"\s+y1="([\d.]+)"\s+x2="([\d.]+)"\s+y2="([\d.]+)"/g)]
  .map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }))
check(lines.length === 4, '有 4 条辐条，实际 ' + lines.length)
const badLine = lines.filter((l) => {
  const a = Math.hypot(l.x1 - 32, l.y1 - 32)
  const b = Math.hypot(l.x2 - 32, l.y2 - 32)
  // 内端应在枢纽边缘(8)，外端应在卫星边缘(16.5)
  return Math.abs(a - 8) > 0.01 || Math.abs(b - 16.5) > 0.01
})
check(badLine.length === 0, '每条辐条内端=8、外端=16.5（不穿入形状）' + (badLine.length ? ' → ' + JSON.stringify(badLine) : ''))

console.log('')
console.log(fail === 0 ? '全部通过' : fail + ' 条失败')
if (fail !== 0) process.exit(1)
