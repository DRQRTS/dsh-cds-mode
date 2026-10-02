/**
 * Inspect the locale JSON files as bytes, so mojibake cannot hide behind a
 * console that re-encodes.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(fileURLToPath(import.meta.url))
const dir = join(PKG, 'locale')

for (const f of readdirSync(dir).sort()) {
  const bytes = readFileSync(join(dir, f))
  const text = bytes.toString('utf8')
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const crlf = bytes.includes(Buffer.from('\r\n'))
  // Replacement char means the bytes were not valid UTF-8 at some point.
  const replacement = text.includes('\uFFFD')
  // CJK ideographs present?
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  // Mojibake tell-tales: the Latin-1/GBK misread produces these runs.
  const mojibake = /[锛鈥鐨勬櫒瀹夎涓荤鏄紝]/.test(text)

  console.log(`  ${f}`)
  console.log(`    字节 ${bytes.length}  BOM=${bom} CRLF=${crlf}`)
  console.log(`    替换字符 U+FFFD: ${replacement}`)
  console.log(`    中日韩汉字数: ${cjk}`)
  console.log(`    乱码特征: ${mojibake}`)
  let json = null
  try {
    json = JSON.parse(text)
    console.log(`    JSON 可解析: 是`)
    if (json.title) console.log(`    title: ${json.title}`)
  } catch (e) {
    console.log(`    JSON 可解析: 否 —— ${e.message}`)
  }
  console.log('')
}
