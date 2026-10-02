/**
 * Verify the three READMEs are in sync across the three places they live:
 * the authoring workspace, the built bundle, and the git working tree.
 *
 * They diverge easily — the Chinese source is PLUGIN-README.md while its
 * shipped name is README.md, so a copy loop can silently ship a stale file.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [WORK, BUNDLE, REPO] = process.argv.slice(2)
const PLACES = [['工作区', WORK], ['包内', BUNDLE], ['仓库', REPO]]

/** Authoring source -> shipped name. */
const MAP = [
  ['PLUGIN-README.md', 'README.md'],
  ['README.en.md', 'README.en.md'],
  ['README.ja.md', 'README.ja.md'],
]

let fail = 0
for (const [src, shipped] of MAP) {
  console.log(`  ${shipped}   （工作区源文件名：${src}）`)
  const contents = []
  for (const [label, dir] of PLACES) {
    // The workspace names the Chinese source PLUGIN-README.md; the bundle and
    // the repo ship it as README.md. Pick whichever exists.
    const candidates = [join(dir, shipped), join(dir, src)]
    const from = candidates.find((c) => existsSync(c))
    if (!from) { console.log(`    ${label}: 缺（找过 ${candidates.join(' / ')}）`); fail++; contents.push(null); continue }
    const t = readFileSync(from, 'utf8')
    const refs = [...t.matchAll(/(?:srcset|src)="([^"]+\.(?:png|svg))"/g)].map((m) => m[1])
    const pic = t.includes('<picture>')
    const sections = (t.match(/^## /gm) || []).length
    console.log(`    ${label.padEnd(4)} picture=${pic ? 'Y' : 'N'}  图片引用=${refs.length}  章节=${sections}  ${t.length} 字符`)
    contents.push(t)
  }
  const allSame = contents.every((c) => c !== null && c === contents[0])
  const hasPicture = contents.every((c) => c?.includes('<picture>'))
  console.log(`    三处一致: ${allSame ? '是' : '否'}   均含 logo: ${hasPicture ? '是' : '否'}`)
  if (!allSame || !hasPicture) fail++
  console.log('')
}
console.log(fail === 0 ? '  全部一致且均含 logo' : '  ' + fail + ' 份不一致或缺 logo')
if (fail) process.exit(1)
