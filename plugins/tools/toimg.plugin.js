// ./plugins/tools/toimg.plugin.js
import { Canvas, loadImage } from '@napi-rs/canvas'
import webp from 'node-webpmux'
import { generateWAMessageContent } from '@whiskeysockets/baileys'

async function cleanWebpExif(buffer) {
    try {
        const img = new webp.Image()
        await img.load(buffer)
        img.exif = null
        return await img.save(null)
    } catch {
        return buffer
    }
}

async function getFirstFrameWebp(buffer) {
    try {
        const img = new webp.Image()
        await img.load(buffer)
        const frames = await img.demux({ buffers: true })
        if (Array.isArray(frames) && frames.length > 0) {
            return frames[0]
        }
    } catch {}
    return buffer
}

async function webpToImage(buffer) {
    const cleanBuff = await cleanWebpExif(buffer)
    const img = await loadImage(cleanBuff)
    const canvas = new Canvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return await canvas.toBuffer('image/png')
}

export default {
    command: true, usePrefix: true,
    case: ['toimg', 'toimage'],
    description: 'Convierte stickers a imagen (PNG/JPG) con Bait Thumbnail (extrae Frame 1 si es animado).',
    category: 'herramientas',
    usage: ['toimg ‹citar sticker›'],
    script: async (m, { sock }) => {
        if (!m.quoted || m.quoted.type !== 'stickerMessage') {
            return m.reply('ⓘ Responde a un sticker para convertirlo a imagen.')
        }

        await m.react('wait')

        try {
            const rawQuoted = m.quoted.raw || { key: m.quoted.key, message: m.quoted.message }
            const stickerBuffer = await sock.downloadMedia(rawQuoted)

            if (!stickerBuffer || !stickerBuffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el sticker citado.')
            }

            const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const ppBuffer = await sock.getBuffer(ppUrl)
            const baitThumbnail = await sock.resizePhoto({ image: ppBuffer, scale: 120, result: 'buffer' })

            const isAnimated = m.quoted.message?.stickerMessage?.isAnimated 
                || m.quoted.raw?.message?.stickerMessage?.isAnimated 
                || stickerBuffer.includes(Buffer.from('ANIM'))

            let processBuffer = stickerBuffer
            let captionText = ''

            if (isAnimated) {
                processBuffer = await getFirstFrameWebp(stickerBuffer)
                captionText = 'ⓘ Este sticker es animado. Usa *.tovid* si deseas obtener el video completo.'
            }

            const imgBuffer = await webpToImage(processBuffer)

            const imgContent = await generateWAMessageContent({
                image: imgBuffer
            }, { upload: sock.waUploadToServer })

            imgContent.imageMessage.jpegThumbnail = baitThumbnail
            imgContent.imageMessage.caption = captionText

            await sock.relayMessage(m.chat.id, {
                imageMessage: imgContent.imageMessage
            }, { 
                messageId: `HK_BAIT_${Date.now()}`,
                quoted: m.raw 
            })

            await m.react('done')

        } catch (e) {
            console.error('ToImg Error:', e)
            await m.react('error')
            m.reply(`ⓘ Ocurrió un error al convertir el sticker: ${e.message}`)
        }
    }
}