// ./library/builders/richLink.builder.js
import crypto from 'crypto'
import https from 'https'
import { Canvas, loadImage } from '@napi-rs/canvas'

async function uploadMmsLinkThumbnail(sock, buffer) {
    const mediaKey = crypto.randomBytes(32)
    const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from('WhatsApp Link Thumbnail Keys'), 112)
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
    const fileSha256 = crypto.createHash('sha256').update(buffer).digest()
    const fileEncSha256 = crypto.createHash('sha256').update(encBuffer).digest()

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
    const auth = mediaConn?.attrs?.auth
    const hosts = (mediaConn?.content || [])
        .filter(v => v.tag === 'host')
        .map(v => v.attrs?.hostname)
        .filter(Boolean)

    if (!hosts.length || !auth) {
        throw new Error('No se pudo obtener host MMS de WhatsApp')
    }

    const token = encodeURIComponent(
        fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    )

    for (const host of hosts) {
        try {
            const json = await new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: host,
                    port: 443,
                    path: `/mms/image/${token}?auth=${encodeURIComponent(auth)}&token=${token}`,
                    method: 'POST',
                    headers: {
                        'Origin': 'https://web.whatsapp.com',
                        'Referer': 'https://web.whatsapp.com/',
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': encBuffer.length
                    }
                }, (res) => {
                    let body = ''
                    res.on('data', d => body += d)
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try { resolve(JSON.parse(body)) } catch { reject(new Error('Respuesta JSON invalida')) }
                        } else {
                            reject(new Error(`HTTP MMS ${res.statusCode}: ${body}`))
                        }
                    })
                })

                req.on('error', reject)
                req.write(encBuffer)
                req.end()
            })

            const directPath = json.direct_path || json.directPath
            if (!directPath) continue

            return {
                mediaKey,
                fileSha256,
                fileEncSha256,
                directPath
            }
        } catch {}
    }

    throw new Error('Fallo la subida a todos los hosts MMS disponibles')
}

async function generateLowResThumb(buffer, width = 80) {
    const img = await loadImage(buffer)
    const aspect = img.height / img.width
    const height = Math.max(1, Math.round(width * aspect))
    const canvas = new Canvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)
    return {
        buffer: await canvas.toBuffer('image/jpeg', 70),
        width: img.width,
        height: img.height
    }
}

export async function buildRichLink(sock, jid, data = {}, options = {}) {
    const rawUrl = data.url || data.link || 'https://orwyth.site'
    const cleanUrl = rawUrl.trim()
    const customText = (data.text || data.body || data.caption || '').trim()

    const hideUrl = data.hideUrl !== false
    const displayText = hideUrl
        ? (customText ? `${cleanUrl}\n${customText}` : cleanUrl)
        : (customText ? `${customText}\n\n${cleanUrl}` : cleanUrl)

    const rawBanner = data.banner || data.image || data.thumbnail
    if (!rawBanner) throw new Error('El banner o imagen es requerido para richLink')

    const bannerBuffer = await sock.getBuffer(rawBanner)
    if (!bannerBuffer.length) throw new Error('No se pudo obtener el buffer del banner')

    const bannerUploaded = await uploadMmsLinkThumbnail(sock, bannerBuffer)
    const thumbInfo = await generateLowResThumb(bannerBuffer)

    let faviconMMSMetadata = undefined
    const rawFavicon = data.favicon || data.icon
    if (rawFavicon) {
        try {
            const faviconBuffer = await sock.getBuffer(rawFavicon)
            if (faviconBuffer.length) {
                const favUploaded = await uploadMmsLinkThumbnail(sock, faviconBuffer)
                faviconMMSMetadata = {
                    thumbnailDirectPath: favUploaded.directPath,
                    thumbnailSha256: favUploaded.fileSha256,
                    thumbnailEncSha256: favUploaded.fileEncSha256,
                    mediaKey: favUploaded.mediaKey,
                    mediaKeyTimestamp: Math.floor(Date.now() / 1000),
                    thumbnailHeight: 32,
                    thumbnailWidth: 32
                }
            }
        } catch (e) {
            console.warn('[richLink.builder] No se pudo procesar el favicon:', e.message)
        }
    }

    let ctxInfo = {
        mentionedJid: options.mentions || data.mentions || [],
        remoteJid: jid,
        ...(options.contextInfo || {})
    }

    if (options.quoted) {
        const q = options.quoted?.raw || options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        extendedTextMessage: {
            text: displayText,
            matchedText: cleanUrl,
            title: data.title || '',
            description: data.description || data.desc || '',
            previewType: 0,
            jpegThumbnail: thumbInfo.buffer,
            thumbnailDirectPath: bannerUploaded.directPath,
            thumbnailSha256: bannerUploaded.fileSha256,
            thumbnailEncSha256: bannerUploaded.fileEncSha256,
            mediaKey: bannerUploaded.mediaKey,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000),
            thumbnailHeight: data.height || thumbInfo.height,
            thumbnailWidth: data.width || thumbInfo.width,
            inviteLinkGroupTypeV2: 0,
            ...(faviconMMSMetadata ? { faviconMMSMetadata } : {}),
            contextInfo: ctxInfo
        }
    }

    return { message, nodes: [] }
}