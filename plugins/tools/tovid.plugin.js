// ./plugins/tools/tovid.plugin.js
import { Canvas, loadImage } from '@napi-rs/canvas'
import ff from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import webp from 'node-webpmux'
import fs from 'fs'
import path from 'path'
import got from 'got'
import { execSync } from 'child_process'
import { generateWAMessageContent } from '@whiskeysockets/baileys'

async function ensureFFmpeg() {
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        ff.setFfmpegPath(ffmpegStatic)
        return ffmpegStatic
    }

    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    
    const localBin = path.join(tempDir, 'ffmpeg')
    if (fs.existsSync(localBin)) {
        ff.setFfmpegPath(localBin)
        return localBin
    }

    try {
        execSync('ffmpeg -version', { stdio: 'ignore' })
        return 'ffmpeg'
    } catch {}

    try {
        const url = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64'
        const binBuffer = await got(url, { timeout: { request: 45000 } }).buffer()
        fs.writeFileSync(localBin, binBuffer)
        fs.chmodSync(localBin, 0o755)
        ff.setFfmpegPath(localBin)
        return localBin
    } catch (e) {
        return null
    }
}

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

async function webpToMp4(buffer) {
    await ensureFFmpeg()
    const cleanBuff = await cleanWebpExif(buffer)

    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const animDir = path.join(tempDir, `anim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    fs.mkdirSync(animDir, { recursive: true })

    const tempOutput = path.join(tempDir, `webp_out_${Date.now()}.mp4`)

    try {
        const img = new webp.Image()
        await img.load(cleanBuff)

        let frameBuffers = []
        try {
            frameBuffers = await img.demux({ buffers: true })
        } catch {
            if (typeof img.demuxToBuffers === 'function') {
                frameBuffers = await img.demuxToBuffers()
            }
        }

        if (!Array.isArray(frameBuffers) || !frameBuffers.length) {
            throw new Error('No se pudieron extraer los cuadros del sticker animado.')
        }

        for (let i = 0; i < frameBuffers.length; i++) {
            const canvasImg = await loadImage(frameBuffers[i])

            const canvas = new Canvas(512, 512)
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, 512, 512)

            const scale = Math.min(512 / canvasImg.width, 512 / canvasImg.height)
            const w = canvasImg.width * scale
            const h = canvasImg.height * scale
            ctx.drawImage(canvasImg, (512 - w) / 2, (512 - h) / 2, w, h)

            const pngBuff = await canvas.toBuffer('image/png')
            const pngTarget = path.join(animDir, `frame_${String(i).padStart(4, '0')}.png`)
            fs.writeFileSync(pngTarget, pngBuff)
        }

        return await new Promise((resolve, reject) => {
            ff()
                .input(path.join(animDir, 'frame_%04d.png'))
                .inputOptions(['-framerate', '15'])
                .outputOptions([
                    '-y',
                    '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p',
                    '-preset', 'ultrafast',
                    '-movflags', '+faststart',
                    '-an',
                    '-f', 'mp4'
                ])
                .on('error', (err) => {
                    reject(err)
                })
                .on('end', () => {
                    try {
                        const outBuffer = fs.readFileSync(tempOutput)
                        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
                        resolve(outBuffer)
                    } catch (e) {
                        reject(e)
                    }
                })
                .save(tempOutput)
        })

    } finally {
        if (fs.existsSync(animDir)) {
            fs.rmSync(animDir, { recursive: true, force: true })
        }
    }
}

export default {
    command: true, usePrefix: true,
    case: ['tovid', 'tovideo'],
    description: 'Convierte stickers animados a video (MP4) con Bait Thumbnail.',
    category: 'herramientas',
    usage: ['tovid ‹citar sticker animado›'],
    script: async (m, { sock }) => {
        if (!m.quoted || m.quoted.type !== 'stickerMessage') {
            return m.reply('ⓘ Responde a un sticker animado para convertirlo a video.')
        }

        await m.react('wait')

        try {
            const rawQuoted = m.quoted.raw || { key: m.quoted.key, message: m.quoted.message }
            const stickerBuffer = await sock.downloadMedia(rawQuoted)

            if (!stickerBuffer || !stickerBuffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el sticker citado.')
            }

            const isAnimated = m.quoted.message?.stickerMessage?.isAnimated 
                || m.quoted.raw?.message?.stickerMessage?.isAnimated 
                || stickerBuffer.includes(Buffer.from('ANIM'))

            if (!isAnimated) {
                await m.react('error')
                return m.reply('ⓘ Este sticker es estático (foto). Usa *.toimg* para convertirlo a imagen.')
            }

            const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const ppBuffer = await sock.getBuffer(ppUrl)
            const baitThumbnail = await sock.resizePhoto({ image: ppBuffer, scale: 120, result: 'buffer' })

            const videoBuffer = await webpToMp4(stickerBuffer)

            const vidContent = await generateWAMessageContent({
                video: videoBuffer,
                gifPlayback: true
            }, { upload: sock.waUploadToServer })

            vidContent.videoMessage.jpegThumbnail = baitThumbnail
            vidContent.videoMessage.caption = ''

            await sock.relayMessage(m.chat.id, {
                videoMessage: vidContent.videoMessage
            }, { 
                messageId: `HK_BAIT_${Date.now()}`,
                quoted: m.raw 
            })

            await m.react('done')

        } catch (e) {
            console.error('ToVid Error:', e)
            await m.react('error')
            m.reply(`ⓘ Ocurrió un error al convertir el sticker animado: ${e.message}`)
        }
    }
}