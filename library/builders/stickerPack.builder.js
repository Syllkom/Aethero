import crypto from 'crypto'
import https from 'https'
import JSZip from 'jszip'
import { imageWebp } from '../media/mediaConverter.js'

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
    if (typeof value === 'string') return Buffer.from(value, 'base64')
    throw new Error('Formato de buffer no valido')
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest()
}

function toB64Url(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
}

function isWebP(buffer) {
    return buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
}

function isAnimatedWebP(buffer) {
    if (!isWebP(buffer)) return false
    let offset = 12
    while (offset < buffer.length - 8) {
        const chunk = buffer.toString('ascii', offset, offset + 4)
        const size = buffer.readUInt32LE(offset + 4)
        if (chunk === 'VP8X' && (buffer[offset + 8] & 0x02)) return true
        if (chunk === 'ANIM' || chunk === 'ANMF') return true
        offset += 8 + size + (size % 2)
    }
    return false
}

function classifySticker(buffer, isLottie = false) {
    if (isLottie) {
        return { ext: 'json', mimetype: 'application/json', isAnimated: true, isLottie: true }
    }
    return { ext: 'webp', mimetype: 'image/webp', isAnimated: isAnimatedWebP(buffer), isLottie: false }
}

async function makeTrayWebp(sock, buffer) {
    const resizedJpg = await sock.resizePhoto({ image: buffer, scale: 252, result: 'buffer' })
    return await imageWebp(resizedJpg)
}

async function makeBlankTrayWebp() {
    const { Jimp } = await import('jimp')
    const bg = new Jimp({ width: 252, height: 252, color: 0x00000000 })
    const buf = await bg.getBuffer('image/png')
    return await imageWebp(buf)
}

async function makeThumbnailJpeg(sock, buffer) {
    return await sock.resizePhoto({ image: buffer, scale: 252, result: 'buffer' })
}

async function uploadToServer(sock, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
    const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112)
    )

    const iv = expanded.subarray(0, 16)
    const cipherKey = expanded.subarray(16, 48)
    const macKey = expanded.subarray(48, 80)

    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])

    const mac = crypto
        .createHmac('sha256', macKey)
        .update(iv)
        .update(encrypted)
        .digest()
        .subarray(0, 10)

    const encBuffer = Buffer.concat([encrypted, mac])
    const fileSha256 = sha256(buffer)
    const fileEncSha256 = sha256(encBuffer)

    const iq = await sock.query({
        tag: 'iq',
        attrs: {
            id: Date.now().toString(),
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:m'
        },
        content: [{ tag: 'media_conn', attrs: {} }]
    })

    const mediaConn = iq.content?.find(v => v.tag === 'media_conn')
    if (!mediaConn) throw new Error('media_conn no encontrado')

    const auth = mediaConn.attrs?.auth
    if (!auth) throw new Error('auth media_conn no encontrado')

    const hosts = (mediaConn.content || [])
        .filter(v => v.tag === 'host')
        .map(v => v.attrs?.hostname)
        .filter(Boolean)

    if (!hosts.length) throw new Error('host upload no encontrado')

    const token = encodeURIComponent(
        fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    )

    let lastError

    for (const host of hosts) {
        try {
            const json = await new Promise((resolve, reject) => {
                const url = new URL(
                    `https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`
                )

                const req = https.request(
                    {
                        hostname: url.hostname,
                        port: 443,
                        path: url.pathname + url.search,
                        method: 'POST',
                        headers: {
                            Origin: 'https://web.whatsapp.com',
                            Referer: 'https://web.whatsapp.com/',
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': encBuffer.length
                        }
                    },
                    (res) => {
                        let body = ''
                        res.on('data', c => body += c)
                        res.on('end', () => {
                            if (res.statusCode < 200 || res.statusCode >= 300) {
                                return reject(new Error(`Upload fallo ${res.statusCode}: ${body}`))
                            }
                            try {
                                resolve(JSON.parse(body))
                            } catch {
                                reject(new Error(`Respuesta no valida: ${body}`))
                            }
                        })
                    }
                )

                req.on('error', reject)
                req.write(encBuffer)
                req.end()
            })

            const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path
            if (!directPath) throw new Error('directPath no encontrado')

            return {
                mediaKey,
                fileLength: buffer.length,
                fileSha256,
                fileEncSha256,
                directPath,
                ...json
            }
        } catch (e) {
            lastError = e
        }
    }

    throw lastError ?? new Error('Todos los hosts fallaron')
}

export async function sendStickerPack(sock, jid, data = {}, options = {}) {
    const rawStickers = Array.isArray(data) ? data : (data.stickers || [])
    if (!rawStickers.length) throw new Error('No hay stickers en el pack')

    const zip = new JSZip()
    const stickersMetadata = []

    const hydrated = []
    for (const item of rawStickers) {
        let buf = null
        if (Buffer.isBuffer(item)) buf = item
        else if (typeof item === 'string') buf = item.startsWith('http') ? await sock.getBuffer(item) : toBuffer(item)
        else if (item?.buffer) buf = toBuffer(item.buffer)
        else if (item?.url) buf = await sock.getBuffer(item.url)

        if (buf && buf.length) {
            const classification = classifySticker(buf, item?.isLottie)
            hydrated.push({ buffer: buf, ...classification, emojis: item?.emojis || [''] })
        }
    }

    if (!hydrated.length) throw new Error('No se pudo procesar ningun buffer de sticker valido')

    for (const item of hydrated) {
        const fileName = `${toB64Url(sha256(item.buffer))}.${item.ext}`
        zip.file(fileName, item.buffer)
        stickersMetadata.push({
            fileName,
            isAnimated: item.isAnimated,
            emojis: item.emojis || [''],
            accessibilityLabel: '',
            isLottie: item.isLottie,
            mimetype: item.mimetype
        })
    }

    const trayIconFileName = 'tray_icon.webp'
    let traySource = data.tray ? (Buffer.isBuffer(data.tray) ? data.tray : await sock.getBuffer(data.tray)) : null
    if (!traySource) {
        traySource = hydrated.find(v => !v.isLottie)?.buffer
    }

    const trayBuffer = traySource
        ? await makeTrayWebp(sock, traySource)
        : await makeBlankTrayWebp()

    zip.file(trayIconFileName, trayBuffer)

    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

    const packUpload = await uploadToServer(sock, archive, {
        hkdf: 'WhatsApp Sticker Pack Keys',
        mediaPath: '/mms/sticker-pack'
    })

    const thumbnailBuffer = await makeThumbnailJpeg(sock, trayBuffer)

    const thumbUpload = await uploadToServer(sock, thumbnailBuffer, {
        hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
        mediaPath: '/mms/thumbnail-sticker-pack',
        mediaKey: packUpload.mediaKey
    })

    const message = {
        messageContextInfo: {
            messageSecret: crypto.randomBytes(32)
        },
        stickerPackMessage: {
            stickerPackId: data.id || ('Pack_' + crypto.randomBytes(8).toString('hex')),
            name: data.name || 'Aethero Pack',
            publisher: data.publisher || (sock.user?.name || 'Aethero Engine'),
            packDescription: data.description || 'Sticker pack creado con Aethero Framework',
            stickers: stickersMetadata,
            fileLength: packUpload.fileLength,
            fileSha256: packUpload.fileSha256,
            fileEncSha256: packUpload.fileEncSha256,
            mediaKey: packUpload.mediaKey,
            directPath: packUpload.directPath,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000),
            stickerPackSize: packUpload.fileLength,
            stickerPackOrigin: 2,
            trayIconFileName,
            thumbnailDirectPath: thumbUpload.directPath,
            thumbnailSha256: thumbUpload.fileSha256,
            thumbnailEncSha256: thumbUpload.fileEncSha256,
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: thumbUpload.fileSha256.toString('base64')
        }
    }

    return await sock.relayMessage(jid, message, {
        quoted: options.quoted?.raw || options.quoted
    })
}