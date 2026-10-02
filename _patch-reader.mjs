/**
 * Dependency-free structural reader for THIS project's `cordis.patch.yml`.
 *
 * Why not the `yaml` package: the verifier must run on a consumer machine; a
 * bare `import 'yaml'` has nothing to resolve from in this profile's
 * `node_modules`, and an absolute pnpm-store path is machine-specific. Shipping
 * our own reader keeps the package at zero external dependencies — the same
 * rule `index.js` follows.
 *
 * It reads exactly what the verifier asserts: which rows exist, their
 * `id` / `name`, whether they are disabled, and the row lists nested under
 * `config:` (a `cordis:group`'s children) or `config.plugins:` (a preset's
 * children). It is a line scanner, not a YAML implementation.
 */

/** Leading-space count. */
const indentOf = (line) => line.length - line.trimStart().length

/** Parse `key: value` (a plain mapping line). */
function mapping(trimmed) {
  const m = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(trimmed)
  return m ? { key: m[1], value: m[2].trim() } : null
}

/** Parse `- key: value` (a sequence item that opens a mapping). */
function item(trimmed) {
  if (!trimmed.startsWith('- ')) return null
  const m = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(trimmed.slice(2))
  return m ? { key: m[1], value: m[2].trim() } : null
}

/** Unquote / coerce a scalar. Block markers and `!!js` expressions stay text. */
function scalar(v) {
  if (v === '') return ''
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+$/.test(v)) return Number(v)
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return v.slice(1, -1)
  return v
}

/** The next non-blank, non-comment line, or null. */
function nextMeaningful(lines, from) {
  for (let i = from + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('#')) continue
    return { line: lines[i], indent: indentOf(lines[i]), trimmed: t }
  }
  return null
}

/**
 * Read every row the patch contributes.
 * @param {string} text patch file contents
 * @returns {object[]}
 */
export function readRows(text) {
  const lines = text.split(/\r?\n/)
  /** @type {object[]} */ const roots = []

  /**
   * Read a row list whose `- ` items sit at `itemIndent`, from `start` up to the
   * first non-blank line indented at or below `boundaryIndent`.
   * @returns {{rows: object[], end: number}}
   */
  function readList(start, itemIndent, boundaryIndent) {
    /** @type {object[]} */ const rows = []
    let cur = null
    let i = start
    for (; i < lines.length; i++) {
      const raw = lines[i]
      const t = raw.trim()
      if (t === '' || t.startsWith('#')) continue
      const ind = indentOf(raw)
      if (ind <= boundaryIndent) break

      const it = item(t)
      if (it && ind === itemIndent) {
        cur = { [it.key]: scalar(it.value) }
        rows.push(cur)
        continue
      }
      if (!cur) continue

      const kv = mapping(t)
      if (!kv) continue

      if (kv.value === '') {
        const nxt = nextMeaningful(lines, i)
        const nxtIt = nxt ? item(nxt.trimmed) : null
        if (nxtIt && nxt.indent > ind) {
          // A nested row list. Its items sit at whatever indentation the first
          // one uses; the list ends at the first line indented at or below the
          // key that owns it.
          const res = readList(i + 1, nxt.indent, ind)
          ;(cur.children ??= []).push(...res.rows)
          i = res.end - 1
        }
        // Otherwise this is a nested MAPPING (a leaf row's `config:`, an
        // `isolate:`, a preset row's `config:` whose real list is `plugins:`
        // one level down). Skip ONLY this one line: a deeper `plugins:` list
        // still has to be reached, and it will be, because it sits at a greater
        // indent than this key and the loop keeps scanning.
        continue
      }

      if (kv.key === 'disabled') cur.disabled = scalar(kv.value)
      else if (kv.key === 'group') cur.group = scalar(kv.value) === true
      else cur[kv.key] = scalar(kv.value)
    }
    return { rows, end: i }
  }

  // Top level: `- insert:` entries, then the row list beneath each.
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('#')) continue
    if (indentOf(lines[i]) !== 0) continue
    if (!/^- insert:\s*$/.test(t)) continue
    const nxt = nextMeaningful(lines, i)
    if (!nxt) break
    const res = readList(i + 1, nxt.indent, 0)
    roots.push(...res.rows)
    i = res.end - 1
  }

  return roots
}

/** Flatten rows, recursing into nested `children` lists. */
export function flatten(rows) {
  /** @type {object[]} */ const out = []
  for (const r of rows) {
    out.push(r)
    if (Array.isArray(r.children)) out.push(...flatten(r.children))
  }
  return out
}
