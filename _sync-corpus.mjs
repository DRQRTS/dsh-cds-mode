/**
 * Sync the authoring corpus into this package, so the published bundle is
 * SELF-CONTAINED and works on any machine with zero configuration.
 *
 *   node _sync-corpus.mjs            copy authoring corpus -> ./cds
 *   node _sync-corpus.mjs --check    verify only, exit 1 on drift
 *
 * Why this exists: the corpus is authored in the workspace (`../../cds`) but the
 * bundle must CARRY it, because `install_bundle` only installs this package
 * directory. A bundle that references an absolute path outside itself is broken
 * for everyone else.
 */

import { cpSync, existsSync, readdirSync, readFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))
const DEST = join(PACKAGE_DIR, 'cds')

/** The authoring corpus. Override with `--from <dir>` if it lives elsewhere. */
const argv = process.argv.slice(2)
const fromFlag = argv.indexOf('--from')
const SRC = fromFlag !== -1 && argv[fromFlag + 1] !== undefined
  ? argv[fromFlag + 1]
  : join(PACKAGE_DIR, '..', '..', 'cds')

const CHECK_ONLY = argv.includes('--check')

/** Every file under `dir`, as paths relative to `dir`, sorted. */
function listFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) listFiles(full, base, out)
    else out.push(relative(base, full).split('\\').join('/'))
  }
  return out
}

if (!existsSync(join(SRC, 'CORE.md'))) {
  console.error(`[sync-corpus] 源语料库不合法：${SRC}（缺 CORE.md）`)
  console.error('  用 --from <dir> 指定语料库根目录。')
  process.exit(2)
}

const srcFiles = listFiles(SRC)

if (CHECK_ONLY) {
  if (!existsSync(DEST)) {
    console.error(`[sync-corpus] 包内还没有语料：${DEST}`)
    console.error('  跑 `node _sync-corpus.mjs` 同步。')
    process.exit(1)
  }
  const destFiles = listFiles(DEST)
  const problems = []
  for (const f of srcFiles) {
    if (!destFiles.includes(f)) { problems.push('缺: ' + f); continue }
    if (readFileSync(join(SRC, f), 'utf8') !== readFileSync(join(DEST, f), 'utf8')) problems.push('内容不一致: ' + f)
  }
  for (const f of destFiles) if (!srcFiles.includes(f)) problems.push('多出: ' + f)
  if (problems.length > 0) {
    console.error(`[sync-corpus] 包内语料与源语料不一致（${problems.length} 处）：`)
    for (const p of problems.slice(0, 20)) console.error('  ' + p)
    console.error('  跑 `node _sync-corpus.mjs` 重新同步。')
    process.exit(1)
  }
  console.log(`[sync-corpus] OK：${srcFiles.length} 个文件与源语料逐字节一致`)
  process.exit(0)
}

// Copy: wipe first so a renamed/deleted source file cannot linger as a stale
// extra file in the package.
if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
cpSync(SRC, DEST, { recursive: true })

const destFiles = listFiles(DEST)
const bytes = destFiles.reduce((n, f) => n + statSync(join(DEST, f)).size, 0)
console.log(`[sync-corpus] 已同步 ${destFiles.length} 个文件 / ${(bytes / 1024).toFixed(0)} KB`)
console.log(`  源  : ${SRC}`)
console.log(`  目标: ${DEST}`)
if (destFiles.length !== srcFiles.length) {
  console.error(`[sync-corpus] 数量不符：源 ${srcFiles.length} / 目标 ${destFiles.length}`)
  process.exit(1)
}
