/**
 * Minimal, dependency-free ZIP writer (deflate).
 *
 * Why hand-rolled: this package's hard rule is ZERO external dependencies —
 * `index.js` imports only `node:` builtins, and the verifiers follow the same
 * rule. Shelling out to `Compress-Archive` or `zip` would make the build depend
 * on the host's tooling and on how that tool lays out the archive.
 *
 * Format reference: PKZIP APPNOTE. We write the three records a conforming
 * reader needs — local file header + data, central directory, end-of-central-
 * directory — with deflate compression (method 8) and no ZIP64 (our archives
 * are far below the 4 GiB / 65535-entry limits).
 */

import { deflateRawSync } from 'node:zlib'

/** CRC-32 (IEEE 802.3), the polynomial ZIP requires. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  // `>>> 0` is required: `c ^ 0xffffffff` is a signed int32 in JS, and
  // Buffer.writeUInt32LE rejects negative values.
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS date/time pair, as ZIP stores it. */
function dosDateTime(date) {
  const y = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f)
  const day = ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

/**
 * Build a ZIP archive in memory.
 *
 * @param {Array<{name: string, data: Buffer|string, date?: Date}>} entries
 *   `name` uses forward slashes and is the path INSIDE the archive.
 * @returns {Buffer}
 */
export function makeZip(entries) {
  const now = new Date()
  const { time, day } = dosDateTime(now)

  const locals = []
  const centrals = []
  let offset = 0

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8')
    const deflated = deflateRawSync(data, { level: 9 })

    // Store uncompressed when deflate would not help (tiny or incompressible).
    const useDeflate = deflated.length < data.length
    const payload = useDeflate ? deflated : data
    const method = useDeflate ? 8 : 0
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed to extract (2.0 = deflate)
    local.writeUInt16LE(0x0800, 6) // general purpose flags: UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18) // compressed size
    local.writeUInt32LE(data.length, 22) // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra field length
    locals.push(local, nameBuf, payload)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central directory signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed to extract
    central.writeUInt16LE(0x0800, 8) // flags: UTF-8 names
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra field length
    central.writeUInt16LE(0, 32) // comment length
    central.writeUInt16LE(0, 34) // disk number start
    central.writeUInt16LE(0, 36) // internal attributes
    // External file attributes. ZIP stores Unix mode in the HIGH 16 bits.
    // `0o100644 << 16` is a SIGNED int32 in JS (0x81A40000 has the top bit
    // set), and writeUInt32LE rejects negatives — hence `>>> 0`.
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42) // offset of local header
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + payload.length
  }

  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  eocd.writeUInt16LE(0, 4) // this disk
  eocd.writeUInt16LE(0, 6) // disk with central directory
  eocd.writeUInt16LE(entries.length, 8) // entries on this disk
  eocd.writeUInt16LE(entries.length, 10) // total entries
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16) // central directory offset
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...locals, centralBuf, eocd])
}
