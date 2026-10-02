/**
 * Byte-level audit of a text file. Written because a PowerShell console renders
 * UTF-8 CJK as mojibake, which has repeatedly looked like file corruption when
 * the file was fine. This reads bytes and reports facts only.
 */

import { readFileSync } from 'node:fs'

const files = process.argv.slice(2)
let fail = 0

for (const p of files) {
  const b = readFileSync(p)
  const text = b.toString('utf8')
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf
  const crlf = b.includes(Buffer.from('\r\n'))
  const replacement = (text.match(/\uFFFD/g) || []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const lines = text.split('\n').length
  const lastLine = text.replace(/\n+$/, '').split('\n').pop()

  // Mojibake from a GBK misread leaves byte sequences that decode to rare
  // CJK blocks. A naive character list produces false positives (路 and 语言
  // are ordinary text), so match only codepoints that essentially never occur
  // in real Chinese or Japanese prose: the "mojibake alphabet" lives in
  // CJK Unified Ideographs Extension A and the compatibility block.
  const mojibakeHits = (text.match(/[\u3400-\u4DBF\uF900-\uFAFF]/g) || []).length

  console.log('  ' + p.split(/[\\/]/).pop())
  console.log(`    字节 ${b.length}  字符 ${text.length}  行 ${lines}`)
  console.log(`    BOM ${bom}  CRLF ${crlf}  U+FFFD ${replacement}  汉字 ${cjk}`)
  console.log(`    乱码特征字符 ${mojibakeHits}`)
  console.log(`    末行: ${lastLine.slice(0, 90)}`)
  const bad = bom || crlf || replacement > 0 || mojibakeHits > 0
  if (bad) fail++
  console.log(`    ${bad ? 'FAIL' : 'PASS'}`)
  console.log('')
}
console.log(fail === 0 ? '  全部干净' : '  ' + fail + ' 个文件有问题')
if (fail) process.exit(1)
