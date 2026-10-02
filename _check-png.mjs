/**
 * Verify a PNG really carries transparency, by reading its IHDR colour type and
 * decoding the corner pixels with zlib.
 *
 * "It looks white in the preview" is not evidence: image viewers composite
 * transparent pixels onto white, so a baked-in white background and a
 * transparent one look identical until the icon sits on a dark surface.
 */

import { readFileSync, existsSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = process.argv[2] ?? dirname(fileURLToPath(import.meta.url))
if (!existsSync(DIR)) {
  console.error('  目录不存在: ' + DIR)
  process.exit(2)
}

const COLOR_TYPE = { 0: 'grayscale', 2: 'RGB', 3: 'palette', 4: 'grayscale+alpha', 6: 'RGBA' }

function inspect(file) {
  const b = readFileSync(file)
  if (b.readUInt32BE(0) !== 0x89504e47) return { file, error: 'not a PNG' }
  const width = b.readUInt32BE(16)
  const height = b.readUInt32BE(20)
  const bitDepth = b[24]
  const colorType = b[25]
  const interlace = b[28]

  // Walk the chunks, collecting IDAT
  let off = 8
  const idat = []
  while (off < b.length) {
    const len = b.readUInt32BE(off)
    const type = b.toString('ascii', off + 4, off + 8)
    if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len))
    if (type === 'IEND') break
    off += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
  if (channels === 0) return { file, width, height, bitDepth, colorType, interlace, note: 'palette/unsupported' }

  const stride = width * channels
  // Reverse the per-scanline filters (types 0-4) to reach real pixel values.
  const out = Buffer.alloc(height * stride)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const cur = Buffer.from(line)
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0
      const bb = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      switch (ft) {
        case 1: cur[i] = (cur[i] + a) & 0xff; break
        case 2: cur[i] = (cur[i] + bb) & 0xff; break
        case 3: cur[i] = (cur[i] + ((a + bb) >> 1)) & 0xff; break
        case 4: {
          const p = a + bb - c
          const pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c)
          cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c)) & 0xff
          break
        }
      }
    }
    cur.copy(out, y * stride)
    prev = cur
  }

  const px = (x, y) => {
    const i = y * stride + x * channels
    return channels === 4
      ? { r: out[i], g: out[i + 1], b: out[i + 2], a: out[i + 3] }
      : { r: out[i], g: out[i + 1] ?? out[i], b: out[i + 2] ?? out[i], a: 255 }
  }

  return {
    file, width, height, bitDepth, colorType, interlace, channels,
    corner: px(0, 0),
    corner2: px(width - 1, height - 1),
    center: px(width >> 1, height >> 1),
  }
}

let fail = 0
for (const f of ['icon.png', 'icon-dark.png', 'icon-64.png']) {
  const r = inspect(join(DIR, f))
  console.log('  ' + f)
  if (r.error) { console.log('    ' + r.error); fail++; continue }
  console.log(`    ${r.width}x${r.height}  位深 ${r.bitDepth}  类型 ${r.colorType} (${COLOR_TYPE[r.colorType]})  交错 ${r.interlace}`)
  console.log(`    左上角像素 rgba(${r.corner.r},${r.corner.g},${r.corner.b},${r.corner.a})`)
  console.log(`    右下角像素 rgba(${r.corner2.r},${r.corner2.g},${r.corner2.b},${r.corner2.a})`)
  console.log(`    中心像素   rgba(${r.center.r},${r.center.g},${r.center.b},${r.center.a})`)
  const hasAlpha = r.channels === 4
  const cornersTransparent = r.corner.a === 0 && r.corner2.a === 0
  // The hub is solid, so the centre must be opaque.
  const centerOpaque = r.center.a === 255
  if (!hasAlpha) { console.log('    FAIL 无 alpha 通道'); fail++ }
  if (!cornersTransparent) { console.log('    FAIL 角落不透明（背景被烤进去了）'); fail++ }
  if (!centerOpaque) { console.log('    FAIL 中心不透明（图形没渲染出来？）'); fail++ }
  if (hasAlpha && cornersTransparent && centerOpaque) console.log('    PASS 真透明背景 + 图形已渲染')
  console.log('')
}
console.log(fail === 0 ? '  全部通过' : '  ' + fail + ' 条失败')
if (fail) process.exit(1)
