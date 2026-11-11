// ./plugins/tools/tovid.plugin.js
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import webp from 'node-webpmux'
import { Canvas, loadImage } from '@napi-rs/canvas'
import { generateWAMessageContent } from '@whiskeysockets/baileys'
import { getFFmpegPath } from '../../library/media/ffmpegResolver.js'

const BG_COLOR = '#ffffff'

function runFFmpeg(ffmpegBin, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBin, args)
        let stderr = ''

        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        proc.on('close', (code) => {
            if (code === 0) resolve(true)
            else reject(new Error(`FFmpeg (${code}): ${stderr.slice(-250)}`))
        })

        proc.on('error', (err) => reject(err))
    })
}

function calculateBoundingBox(canvas, width, height, padding = 4) {
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let hasContent = false

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3]
            if (alpha > 15) {
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
                hasContent = true
            }
        }
    }

    if (!hasContent) {
        return {
            x: 0,
            y: 0,
            width: width % 2 === 0 ? width : width - 1,
            height: height % 2 === 0 ? height : height - 1
        }
    }

    minX = Math.max(0, minX - padding)
    minY = Math.max(0, minY - padding)
    maxX = Math.min(width, maxX + padding)
    maxY = Math.min(height, maxY + padding)

    let cropW = maxX - minX
    let cropH = maxY - minY

    if (cropW % 2 !== 0) cropW += 1
    if (cropH % 2 !== 0) cropH += 1

    if (minX + cropW > width) minX = Math.max(0, width - cropW)
    if (minY + cropH > height) minY = Math.max(0, height - cropH)

    return { x: minX, y: minY, width: cropW, height: cropH }
}

async function webpToMp4(rawBuffer) {
    const tempDir = path.resolve('./storage/temp', `tovid_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tempDir, { recursive: true })

    const outputPath = path.join(tempDir, 'output.mp4')
    const ffmpegBin = getFFmpegPath()

    if (!ffmpegBin) throw new Error('FFmpeg no esta disponible en el sistema')

    try {
        const img = new webp.Image()
        await img.load(rawBuffer)

        const width = img.width || 512
        const height = img.height || 512

        if (!img.hasAnim || img.frameCount <= 1) {
            const staticPath = path.join(tempDir, 'static.png')
            const staticImg = await loadImage(rawBuffer)
            
            const baseCanvas = new Canvas(width, height)
            const baseCtx = baseCanvas.getContext('2d')
            baseCtx.drawImage(staticImg, 0, 0, width, height)

            const bbox = calculateBoundingBox(baseCanvas, width, height)

            const cropCanvas = new Canvas(bbox.width, bbox.height)
            const cropCtx = cropCanvas.getContext('2d')
            cropCtx.fillStyle = BG_COLOR
            cropCtx.fillRect(0, 0, bbox.width, bbox.height)
            cropCtx.drawImage(baseCanvas, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)

            const pngBuf = await cropCanvas.toBuffer('image/png')
            await fs.writeFile(staticPath, pngBuf)

            await runFFmpeg(ffmpegBin, [
                '-y',
                '-loop', '1',
                '-i', staticPath,
                '-t', '4',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-crf', '24',
                '-preset', 'ultrafast',
                '-movflags', '+faststart',
                outputPath
            ])

            return await fs.readFile(outputPath)
        }

        const frameBuffers = await img.demux({ buffers: true })
        const totalFrames = Math.min(frameBuffers.length, 120)

        const baseCanvas = new Canvas(width, height)
        const baseCtx = baseCanvas.getContext('2d')

        const f0 = img.frames[0]
        const f0Img = await loadImage(frameBuffers[0])
        baseCtx.drawImage(f0Img, f0.x || 0, f0.y || 0)

        const bbox = calculateBoundingBox(baseCanvas, width, height)

        baseCtx.clearRect(0, 0, width, height)

        const cropCanvas = new Canvas(bbox.width, bbox.height)
        const cropCtx = cropCanvas.getContext('2d')

        let prevDisposeRect = null

        for (let i = 0; i < totalFrames; i++) {
            const f = img.frames[i]
            const frameImg = await loadImage(frameBuffers[i])

            if (prevDisposeRect) {
                baseCtx.clearRect(prevDisposeRect.x, prevDisposeRect.y, prevDisposeRect.width, prevDisposeRect.height)
                prevDisposeRect = null
            }

            if (!f.blend) {
                baseCtx.clearRect(f.x || 0, f.y || 0, f.width || frameImg.width, f.height || frameImg.height)
            }

            baseCtx.drawImage(frameImg, f.x || 0, f.y || 0)

            if (f.dispose) {
                prevDisposeRect = {
                    x: f.x || 0,
                    y: f.y || 0,
                    width: f.width || frameImg.width,
                    height: f.height || frameImg.height
                }
            }

            cropCtx.fillStyle = BG_COLOR
            cropCtx.fillRect(0, 0, bbox.width, bbox.height)
            cropCtx.drawImage(baseCanvas, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)

            const pngBuf = await cropCanvas.toBuffer('image/png')
            await fs.writeFile(path.join(tempDir, `f_${String(i).padStart(4, '0')}.png`), pngBuf)
        }

        const delay = img.frames[0]?.delay || 66
        const fps = Math.min(Math.max(Math.round(1000 / delay), 5), 30)

        await runFFmpeg(ffmpegBin, [
            '-y',
            '-framerate', String(fps),
            '-i', path.join(tempDir, 'f_%04d.png'),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', '24',
            '-preset', 'ultrafast',
            '-movflags', '+faststart',
            outputPath
        ])

        return await fs.readFile(outputPath)

    } finally {
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {}
    }
}

export default {
    command: true, usePrefix: true,
    case: ['tovid', 'tovideo', 'tomp4'],
    description: 'Convierte stickers a video MP4 adaptando el tamaño al contenido real.',
    category: 'herramientas',
    usage: ['tovid ‹citar sticker›'],
    script: async (m, { sock }) => {
        const isQuotedSticker = m.quoted?.type === 'stickerMessage' || Boolean(m.quoted?.message?.stickerMessage)
        const isDirectSticker = m.type === 'stickerMessage'

        if (!isQuotedSticker && !isDirectSticker) {
            return m.reply('ⓘ Cita un sticker animado o estatico.')
        }

        await m.react('wait')

        try {
            let buffer = null
            if (isQuotedSticker) {
                buffer = await m.getQuotedMedia().catch(() => null)
                if (!buffer) buffer = await sock.downloadMedia(m.quoted.raw || m.quoted).catch(() => null)
            } else {
                buffer = await m.content?.media?.download().catch(() => null)
                if (!buffer) buffer = await sock.downloadMedia(m.raw).catch(() => null)
            }

            if (!buffer || !buffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el sticker.')
            }

            let baitThumbnail = Buffer.alloc(0)
            try {
                const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
                const ppBuffer = await sock.getBuffer(ppUrl)
                if (ppBuffer && ppBuffer.length) {
                    const ppImg = await loadImage(ppBuffer)
                    const thumbCanvas = new Canvas(120, 120)
                    const thumbCtx = thumbCanvas.getContext('2d')
                    const scale = Math.max(120 / ppImg.width, 120 / ppImg.height)
                    const tx = (120 - ppImg.width * scale) / 2
                    const ty = (120 - ppImg.height * scale) / 2
                    thumbCtx.drawImage(ppImg, tx, ty, ppImg.width * scale, ppImg.height * scale)
                    baitThumbnail = await thumbCanvas.toBuffer('image/jpeg', 70)
                }
            } catch {}

            const videoBuffer = await webpToMp4(buffer)
            if (!videoBuffer || !videoBuffer.length) {
                await m.react('error')
                return m.reply('ⓘ Error al procesar el video.')
            }

            const videoContent = await generateWAMessageContent({
                video: videoBuffer
            }, { upload: sock.waUploadToServer })

            videoContent.videoMessage.gifPlayback = true
            videoContent.videoMessage.caption = '✓ Video convertido exitosamente.'

            if (baitThumbnail.length) {
                videoContent.videoMessage.jpegThumbnail = baitThumbnail
            }

            await sock.relayMessage(m.chat.id, {
                videoMessage: videoContent.videoMessage
            }, {
                messageId: `HK_TOVID_${Date.now()}`,
                quoted: m.raw
            })

            await m.react('done')

        } catch (e) {
            console.error('[tovid Error]:', e)
            await m.react('error')
            return m.reply('ⓘ Error al procesar: ' + e.message)
        }
    }
}