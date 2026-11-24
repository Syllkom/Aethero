import { proto } from '@whiskeysockets/baileys'
import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { getFFmpegPath } from '../media/ffmpegResolver.js'

const RAW_FIELDS = Symbol.for('aethero.protoRawFields')
const ENCODE_PATCHED = Symbol.for('aethero.protoEncodePatched')

function installRawFieldsEncoder() {
    if (proto.Message.encode[ENCODE_PATCHED]) return

    const original = proto.Message.encode
    const patched = function (message, writer) {
        const out = original.call(this, message, writer)
        const raw = message?.[RAW_FIELDS]
        if (raw) {
            for (const [field, body] of raw) out.uint32(field * 8 + 2).bytes(body)
        }
        return out
    }
    patched[ENCODE_PATCHED] = true
    proto.Message.encode = patched
}

const varint = (n) => {
    const out = []
    while (n > 127) {
        out.push((n % 128) | 128)
        n = Math.floor(n / 128)
    }
    out.push(n)
    return Buffer.from(out)
}

const ld = (field, body) => Buffer.concat([varint(field * 8 + 2), varint(body.length), body])

const mediaDomainInfo = (mediaKey) => ld(74, Buffer.concat([Buffer.from([0x08, 0x01]), ld(2, mediaKey)]))

async function toBuffer(src, label) {
    if (Buffer.isBuffer(src)) return src
    if (typeof src !== 'string' || !src) throw new TypeError(`audioSticker.${label} must be a Buffer, URL or path`)
    if (/^https?:\/\//i.test(src)) {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`audioSticker.${label}: HTTP ${res.status}`)
        return Buffer.from(await res.arrayBuffer())
    }
    return fs.readFile(src)
}

function runFFmpeg(args, input, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const proc = spawn(getFFmpegPath(), args)
        const out = []
        let err = ''
        const timer = setTimeout(() => {
            proc.kill('SIGKILL')
            reject(new Error('ffmpeg timeout'))
        }, timeoutMs)

        proc.stdout.on('data', (d) => out.push(d))
        proc.stderr.on('data', (d) => { err += d })
        proc.on('error', (e) => { clearTimeout(timer); reject(e) })
        proc.on('close', (code) => {
            clearTimeout(timer)
            if (code !== 0) return reject(new Error(`ffmpeg: ${err.slice(-300)}`))
            resolve(Buffer.concat(out))
        })
        proc.stdin.on('error', () => {})
        proc.stdin.end(input)
    })
}

const toOpus = (input) => runFFmpeg([
    '-v', 'error', '-i', 'pipe:0', '-vn', '-map_metadata', '-1',
    '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', '-f', 'ogg', 'pipe:1'
], input)

const toWebp = (input) => runFFmpeg([
    '-v', 'error', '-i', 'pipe:0', '-frames:v', '1',
    '-vf', 'format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
    '-c:v', 'libwebp', '-f', 'webp', 'pipe:1'
], input)

function parseWebp(b) {
    if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
        throw new Error('Invalid WebP')
    }
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, isAnimated: false }
    if (chunk === 'VP8L') {
        return {
            width: 1 + (b[21] | ((b[22] & 0x3f) << 8)),
            height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)),
            isAnimated: false
        }
    }
    if (chunk === 'VP8X') {
        return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), isAnimated: (b[20] & 2) !== 0 }
    }
    throw new Error('Unsupported WebP chunk')
}

const HKDF_INFO = { audio: 'WhatsApp Audio Keys', sticker: 'WhatsApp Image Keys' }

async function encryptAndUpload(sock, plain, kind) {
    const mediaKey = crypto.randomBytes(32)
    const keys = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), HKDF_INFO[kind], 112))
    const iv = keys.subarray(0, 16)

    const cipher = crypto.createCipheriv('aes-256-cbc', keys.subarray(16, 48), iv)
    const enc = Buffer.concat([cipher.update(plain), cipher.final()])
    const mac = crypto.createHmac('sha256', keys.subarray(48, 80)).update(iv).update(enc).digest().subarray(0, 10)

    const file = Buffer.concat([enc, mac])
    const fileEncSha256 = crypto.createHash('sha256').update(file).digest()

    // os.tmpdir() y no storage/temp: el recolector de basura vacía esa carpeta cada 60 s.
    const tmp = path.join(os.tmpdir(), `as-${kind}-${crypto.randomBytes(8).toString('hex')}.enc`)
    await fs.writeFile(tmp, file)

    try {
        const res = await sock.waUploadToServer(tmp, { fileEncSha256B64: fileEncSha256.toString('base64'), mediaType: kind })
        if (!res?.directPath) throw new Error(`${kind} upload returned no directPath`)

        return {
            url: res.mediaUrl || `https://mmg.whatsapp.net${res.directPath}`,
            directPath: res.directPath,
            mediaKey,
            fileEncSha256,
            fileSha256: crypto.createHash('sha256').update(plain).digest(),
            fileLength: plain.length,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000)
        }
    } finally {
        fs.unlink(tmp).catch(() => {})
    }
}

export async function buildAudioSticker(sock, jid, data = {}) {
    if (!data || typeof data !== 'object') throw new TypeError('audioSticker must be an object')
    if (!data.audio) throw new TypeError('audioSticker.audio is required')
    if (!data.sticker) throw new TypeError('audioSticker.sticker is required')

    installRawFieldsEncoder()

    const audioInput = await toBuffer(data.audio, 'audio')
    const isOgg = audioInput.subarray(0, 4).toString('ascii') === 'OggS'
    const audioBuf = isOgg ? audioInput : await toOpus(audioInput)
    const audioMime = 'audio/ogg; codecs=opus'

    const stickerInput = await toBuffer(data.sticker, 'sticker')
    let stickerBuf = stickerInput
    let webp
    try { webp = parseWebp(stickerInput) } catch { webp = null }
    if (!webp?.isAnimated) {
        stickerBuf = await toWebp(stickerInput)
        webp = parseWebp(stickerBuf)
    }

    const [a, s] = await Promise.all([
        encryptAndUpload(sock, audioBuf, 'audio'),
        encryptAndUpload(sock, stickerBuf, 'sticker')
    ])

    const audioBytes = Buffer.concat([
        Buffer.from(proto.Message.AudioMessage.encode(proto.Message.AudioMessage.create({
            url: a.url,
            mimetype: audioMime,
            fileSha256: a.fileSha256,
            fileEncSha256: a.fileEncSha256,
            fileLength: a.fileLength,
            mediaKey: a.mediaKey,
            directPath: a.directPath,
            mediaKeyTimestamp: a.mediaKeyTimestamp
        })).finish()),
        ld(17, mediaDomainInfo(a.mediaKey))
    ])

    const stickerBase = Buffer.concat([
        Buffer.from(proto.Message.StickerMessage.encode(proto.Message.StickerMessage.create({
            url: s.url,
            fileSha256: s.fileSha256,
            fileEncSha256: s.fileEncSha256,
            mediaKey: s.mediaKey,
            mimetype: 'image/webp',
            height: webp.height,
            width: webp.width,
            directPath: s.directPath,
            fileLength: s.fileLength,
            mediaKeyTimestamp: s.mediaKeyTimestamp,
            isAnimated: webp.isAnimated,
            stickerSentTs: Date.now()
        })).finish()),
        ld(17, Buffer.concat([mediaDomainInfo(s.mediaKey), ld(82, varint(13001))]))
    ])

    const futureProofBody = ld(1, ld(26, Buffer.concat([stickerBase, ld(26, audioBytes)])))

    const message = proto.Message.create({
        messageContextInfo: { messageSecret: crypto.randomBytes(32) }
    })
    message[RAW_FIELDS] = [[134, futureProofBody]]

    return {
        message,
        nodes: [],
        info: {
            audio: { mimetype: audioMime, size: audioBuf.length },
            sticker: { mimetype: 'image/webp', width: webp.width, height: webp.height, isAnimated: webp.isAnimated }
        }
    }
}
