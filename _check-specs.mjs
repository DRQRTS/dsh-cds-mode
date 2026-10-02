/**
 * Verify which install-spec forms actually resolve for THIS repository, using
 * the same rules the official `install-spec.js` applies.
 *
 * The rules are reproduced here (not imported) because the package is not
 * resolvable from this directory; they are copied verbatim from
 * @deepseek-ai/dsh-plugin-manager/lib/types/install-spec.js so the check
 * reflects the real parser rather than an assumption.
 */

import { isAbsolute } from 'node:path'

const GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/i
const GIT_URL = /^git(?:\+[a-z]+)?:\/\/|^git@[^:]+:/i
const HOSTED_REPOSITORY_URL = /^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/i
const TARBALL_SPEC = /\.(?:tgz|tar\.gz)(?:#.*)?$/i
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const PACKAGE_NAME_MAX_LENGTH = 214

function parseInstallSpec(raw) {
  const spec = raw.trim()
  if (spec === '') return { kind: 'invalid', reason: 'the package spec must not be empty' }
  const path = spec.replace(/^(?:file|link):/, '')
  if (path !== spec || isAbsolute(path)) {
    if (!isAbsolute(path)) return { kind: 'invalid', reason: 'a local path must be absolute' }
    return TARBALL_SPEC.test(path) ? { kind: 'tarball', spec, path } : { kind: 'path', spec, path }
  }
  if (/^\.{1,2}(?:[\\/]|$)/.test(spec)) return { kind: 'invalid', reason: 'a local path must be absolute' }
  const git = GIT_SHORTHAND.test(spec) || GIT_URL.test(spec) || HOSTED_REPOSITORY_URL.test(spec)
  if (git && !TARBALL_SPEC.test(spec)) return { kind: 'git', spec }
  if (/^https?:\/\//i.test(spec)) {
    if (TARBALL_SPEC.test(spec)) return { kind: 'tarball', spec }
    return { kind: 'invalid', reason: 'a URL must point at a git repository or a tarball' }
  }
  const at = spec.indexOf('@', 1)
  const name = at === -1 ? spec : spec.slice(0, at)
  if (name.length > PACKAGE_NAME_MAX_LENGTH || !PACKAGE_NAME.test(name)) {
    return { kind: 'invalid', reason: 'not a package name the registry accepts' }
  }
  return { kind: 'registry', spec, name }
}

const CASES = [
  // —— 我们仓库的真实写法 ——
  ['github:DRQRTS/dsh', 'git shorthand'],
  ['https://github.com/DRQRTS/dsh', 'hosted repo URL'],
  ['https://github.com/DRQRTS/dsh.git', 'hosted repo URL with .git'],
  ['git+https://github.com/DRQRTS/dsh.git', 'git+https form'],
  ['D:\\SuperAI Power\\dsh-repo', 'Windows absolute path'],
  ['D:/SuperAI Power/dsh-repo', 'Windows path, forward slashes'],
  ['/home/me/dsh', 'POSIX absolute path'],
  ['file:D:\\SuperAI Power\\dsh-repo', 'file: prefix'],
  ['link:D:\\SuperAI Power\\dsh-repo', 'link: prefix'],
  ['D:\\SuperAI Power\\dsh-plugin\\cds-mode\\dist\\local-dsh-cds-mode-1.5.0.tgz', 'local tarball'],
  ['https://example.com/x/local-dsh-cds-mode-1.5.0.tgz', 'remote tarball'],
  // —— 名字形式 ——
  ['@local/dsh-cds-mode', 'current package name'],
  ['dsh-cds-mode', 'unscoped name'],
  ['@drqrts/cds-mode', 'scoped name (if published)'],
  ['@drqrts/cds-mode@1.5.0', 'scoped name with version'],
  // —— 应被拒 ——
  ['./relative', 'relative path (rejected)'],
  ['../up', 'parent-relative (rejected)'],
  ['https://github.com/DRQRTS', 'URL too short (rejected)'],
  ['Not A Name', 'invalid package name (rejected)'],
]

let bad = 0
for (const [spec, label] of CASES) {
  const r = parseInstallSpec(spec)
  const expectReject = label.includes('rejected')
  const ok = expectReject ? r.kind === 'invalid' : r.kind !== 'invalid'
  if (!ok) bad++
  console.log(
    '  ' + (ok ? 'PASS' : 'FAIL') + '  ' + r.kind.padEnd(9) + ' ' + label.padEnd(30) + ' ' + spec +
      (r.kind === 'invalid' ? '   ← ' + r.reason : '')
  )
}
console.log('')
console.log(bad === 0 ? '  全部符合预期' : '  ' + bad + ' 项不符合预期')
