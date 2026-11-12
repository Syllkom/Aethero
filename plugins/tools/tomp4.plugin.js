// ./plugins/tools/tomp4.plugin.js
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
        proc.stderr.on('data', (chunk) => stderr += chunk.toString())
        proc.on('close', (code) => code === 0 ? resolve(true) : reject(new Error(`FFmpeg (${code}): ${stderr.slice(-250)}`)))
        proc.on('error', (err) => reject(err))
    })
}

async function getGlobalBoundingBox(frameBuffers, width, height, padding = 4) {
    const canvas = new Canvas(width, height)
    const ctx = canvas.getContext('2d')
    let minX = width, minY = height, maxX = 0, maxY = 0
    let hasContent = false

    for (const buf of frameBuffers) {
        const img = await loadImage(buf)
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, width, height).data

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > 15) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    hasContent = true
                }
            }
        }
    }

    if (!hasContent) return { x: 0, y: 0, width: width % 2 === 0 ? width : width - 1, height: height % 2 === 0 ? height : height - 1 }

    minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding)
    maxX = Math.min(width, maxX + padding); maxY = Math.min(height, maxY + padding)
    let cropW = maxX - minX; let cropH = maxY - minY
    if (cropW % 2 !== 0) cropW += 1; if (cropH % 2 !== 0) cropH += 1

    return { x: minX, y: minY, width: cropW, height: cropH }
}

async function webpToMp4(rawBuffer) {
    const tempDir = path.resolve('./storage/temp', `tomp4_${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    const outputPath = path.join(tempDir, 'output.mp4')
    const ffmpegBin = getFFmpegPath()
    if (!ffmpegBin) throw new Error('FFmpeg no disponible')

    try {
        const img = new webp.Image()
        await img.load(rawBuffer)
        const width = img.width || 512; const height = img.height || 512

        if (!img.hasAnim || img.frameCount <= 1) {
            const staticImg = await loadImage(rawBuffer)
            const baseCanvas = new Canvas(width, height)
            baseCanvas.getContext('2d').drawImage(staticImg, 0, 0, width, height)
            const bbox = await getGlobalBoundingBox([rawBuffer], width, height)
            const cropCanvas = new Canvas(bbox.width, bbox.height)
            const cropCtx = cropCanvas.getContext('2d')
            cropCtx.fillStyle = BG_COLOR; cropCtx.fillRect(0, 0, bbox.width, bbox.height)
            cropCtx.drawImage(baseCanvas, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)
            const staticPath = path.join(tempDir, 'static.png')
            await fs.writeFile(staticPath, await cropCanvas.toBuffer('image/png'))
            await runFFmpeg(ffmpegBin, ['-y', '-loop', '1', '-i', staticPath, '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath])
            return { buffer: await fs.readFile(outputPath), width: bbox.width, height: bbox.height }
        }

        const frameBuffers = await img.demux({ buffers: true })
        const totalFrames = Math.min(frameBuffers.length, 120)
        const bbox = await getGlobalBoundingBox(frameBuffers.slice(0, totalFrames), width, height)
        const baseCanvas = new Canvas(width, height)
        const baseCtx = baseCanvas.getContext('2d')
        const cropCanvas = new Canvas(bbox.width, bbox.height)
        const cropCtx = cropCanvas.getContext('2d')
        let prevDisposeRect = null

        for (let i = 0; i < totalFrames; i++) {
            const f = img.frames[i]
            const frameImg = await loadImage(frameBuffers[i])
            if (prevDisposeRect) { baseCtx.clearRect(prevDisposeRect.x, prevDisposeRect.y, prevDisposeRect.width, prevDisposeRect.height); prevDisposeRect = null }
            if (!f.blend) baseCtx.clearRect(f.x || 0, f.y || 0, f.width || frameImg.width, f.height || frameImg.height)
            baseCtx.drawImage(frameImg, f.x || 0, f.y || 0)
            if (f.dispose) prevDisposeRect = { x: f.x || 0, y: f.y || 0, width: f.width || frameImg.width, height: f.height || frameImg.height }
            cropCtx.fillStyle = BG_COLOR; cropCtx.fillRect(0, 0, bbox.width, bbox.height)
            cropCtx.drawImage(baseCanvas, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)
            await fs.writeFile(path.join(tempDir, `f_${String(i).padStart(4, '0')}.png`), await cropCanvas.toBuffer('image/png'))
        }
        const fps = Math.min(Math.max(Math.round(1000 / (img.frames[0]?.delay || 66)), 5), 30)
        await runFFmpeg(ffmpegBin, ['-y', '-framerate', String(fps), '-i', path.join(tempDir, 'f_%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath])
        return { buffer: await fs.readFile(outputPath), width: bbox.width, height: bbox.height }
    } finally {
        try { await fs.rm(tempDir, { recursive: true, force: true }) } catch {}
    }
}

export default {
    command: true, usePrefix: true,
    case: ['tomp4', 'tovid', 'tovideo'],
    description: 'Convierte stickers a video, o fusiona imagen/video con un audio.',
    category: 'herramientas',
    usage: ['tomp4 ‹sticker›', 'tomp4 ‹imagen/video› (enviando audio 15s antes)'],
    script: async (m, { sock }) => {
        
        const isQuotedSticker = m.quoted?.type === 'stickerMessage' || Boolean(m.quoted?.message?.stickerMessage)
        const isDirectSticker = m.type === 'stickerMessage'
        
        if (isQuotedSticker || isDirectSticker) {
            await m.react('wait')
            try {
                let buffer = isQuotedSticker ? (await m.getQuotedMedia().catch(() => null)) : (await m.content?.media?.download().catch(() => null))
                if (!buffer) throw new Error('No se pudo descargar el sticker.')
                
                const { buffer: videoBuffer, width, height } = await webpToMp4(buffer)
                const videoContent = await generateWAMessageContent({ video: videoBuffer }, { upload: sock.waUploadToServer })
                
                videoContent.videoMessage.gifPlayback = true
                videoContent.videoMessage.width = width
                videoContent.videoMessage.height = height
                videoContent.videoMessage.caption = '✓ Video convertido exitosamente.'
                
                await sock.relayMessage(m.chat.id, { videoMessage: videoContent.videoMessage }, { messageId: `HK_TOMP4_${Date.now()}` })
                await m.react('done')
            } catch (e) {
                console.error('[tomp4 Sticker Error]:', e)
                await m.react('error'); m.reply(`Error: ${e.message}`)
            }
            return
        }

        const mediaType = m.type
        const quotedType = m.quoted?.type

        let mediaMsg = null
        let audioBuffer = null

        if (['imageMessage', 'videoMessage'].includes(quotedType)) {
            mediaMsg = m.quoted
        } else if (['imageMessage', 'videoMessage'].includes(mediaType)) {
            mediaMsg = m
        }

        if (m.type === 'audioMessage') {
            audioBuffer = await m.content.media.download()
        } else if (m.quoted?.type === 'audioMessage') {
            audioBuffer = await m.getQuotedMedia()
        } else {
            const cached = global._audioCache?.get(m.sender.id)
            if (cached && (Date.now() - cached.timestamp < 15 * 1000)) { 
                audioBuffer = cached.buffer
                clearTimeout(cached.timer)
                global._audioCache.delete(m.sender.id)
            }
        }

        if (mediaMsg && audioBuffer) {
            await m.react('wait')
            try {
                const mediaBuffer = mediaMsg === m ? await m.content.media.download() : await m.getQuotedMedia()
                if (!mediaBuffer) throw new Error('No se pudo descargar la imagen/video.')

                const tempDir = path.resolve('./storage/temp')
                await fs.mkdir(tempDir, { recursive: true })
                
                const isImage = mediaMsg.type === 'imageMessage'
                const mExt = isImage ? '.jpg' : '.mp4'
                const mPath = path.join(tempDir, `m_${Date.now()}${mExt}`)
                const aPath = path.join(tempDir, `a_${Date.now()}.mp3`)
                const outPath = path.join(tempDir, `out_${Date.now()}.mp4`)
                
                await fs.writeFile(mPath, mediaBuffer)
                await fs.writeFile(aPath, audioBuffer)

                const ffmpegBin = getFFmpegPath()
                
                if (isImage) {
                    await runFFmpeg(ffmpegBin, [
                        '-y', '-loop', '1', '-i', mPath, 
                        '-i', aPath, 
                        '-c:v', 'libx264', '-tune', 'stillimage', 
                        '-c:a', 'aac', '-b:a', '192k', 
                        '-pix_fmt', 'yuv420p', '-shortest', outPath
                    ])
                } else {
                    await runFFmpeg(ffmpegBin, [
                        '-y', '-i', mPath, '-i', aPath, 
                        '-c:v', 'copy', '-c:a', 'aac', 
                        '-map', '0:v:0', '-map', '1:a:0', 
                        '-shortest', outPath
                    ])
                }

                const finalBuffer = await fs.readFile(outPath)
                await sock.sendMessage(m.chat.id, { 
                    video: finalBuffer, 
                    mimetype: 'video/mp4', 
                    caption: '✓ Fusion completada.' 
                }, { quoted: m.raw })
                
                await fs.unlink(mPath).catch(() => {})
                await fs.unlink(aPath).catch(() => {})
                await fs.unlink(outPath).catch(() => {})
                await m.react('done')
            } catch (e) {
                console.error('[tomp4 Merge Error]:', e)
                await m.react('error'); m.reply(`Error al fusionar: ${e.message}`)
            }
            return
        }

        return m.reply('ⓘ Cita un sticker para convertirlo a video.\nO envía un audio y luego responde a una imagen/video con .tomp4 para fusionarlos.')
    }
  }
