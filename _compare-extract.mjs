/**
 * Compare an extracted archive against this package's shipping list, file by
 * file, byte for byte.
 *
 *   node _compare-extract.mjs <extracted-package-dir>
 *
 * Used to prove a built archive really carries what the verifiers checked —
 * with an extractor OTHER than the one that wrote it.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(fileURLToPath(import.meta.url))
const EX = process.argv[2]
if (!EX) {
  console.error('用法: node _compare-extract.mjs <解压出的 package 目录>')
  process.exit(2)
}

const manifest = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))

const flat = []
const walk = (d) => {
  for (const n of readdirSync(d).sort()) {
    const f = join(d, n)
    const rel = relative(PKG, f).split('\\').join('/')
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue
    if (statSync(f).isDirectory()) walk(f)
    else flat.push(rel)
  }
}
walk(PKG)

const keep = new Set()
for (const p of manifest.files) {
  const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
  for (const f of flat) if (re.test(f)) keep.add(f)
}

let ok = 0
const bad = []
const miss = []
for (const rel of keep) {
  const src = readFileSync(join(PKG, rel))
  const other = join(EX, rel)
  if (!existsSync(other)) { miss.push(rel); continue }
  if (src.equals(readFileSync(other))) ok++
  else bad.push(rel)
}

console.log('  清单文件数  : ' + keep.size)
console.log('  逐字节一致  : ' + ok)
console.log('  内容不一致  : ' + bad.length + (bad.length ? ' → ' + bad.slice(0, 3).join(', ') : ''))
console.log('  缺失        : ' + miss.length + (miss.length ? ' → ' + miss.slice(0, 3).join(', ') : ''))
const pass = bad.length === 0 && miss.length === 0 && ok === keep.size
console.log('  结论        : ' + (pass ? 'PASS — 内容与源完全一致' : 'FAIL'))
if (!pass) process.exit(1)
