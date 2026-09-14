// ./plugins/tools/tovid.plugin.js
import ff from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import got from 'got'
import { getFFmpegPath } from '../../library/media/ffmpegResolver.js'

const ffmpegBinary = getFFmpegPath()
if (ffmpegBinary) {
    ff.setFfmpegPath(ffmpegBinary)
}

function isAnimatedWebP(buffer) {
    if (!buffer || buffer.length < 16) return false
    return buffer.includes(Buffer.from('ANIM')) || buffer.includes(Buffer.from('ANMF'))
}

function stripWebpExif(buffer) {
    if (!buffer || buffer.length < 16) return buffer
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
        return buffer
    }

    const chunks = []
    let offset = 12
    while (offset < buffer.length - 8) {
        const fourCC = buffer.toString('ascii', offset, offset + 4)
        const size = buffer.readUInt32LE(offset + 4)
        const chunkSize = 8 + size + (size % 2)

        if (offset + chunkSize > buffer.length) {
            chunks.push(buffer.subarray(offset))
            break
        }

        if (fourCC !== 'EXIF' && fourCC !== 'XMP ') {
            chunks.push(buffer.subarray(offset, offset + chunkSize))
        }

        offset += chunkSize
    }

    const payload = Buffer.concat(chunks)
    const header = Buffer.alloc(12)
    header.write('RIFF', 0)
    header.writeUInt32LE(payload.length + 4, 4)
    header.write('WEBP', 8)

    return Buffer.concat([header, payload])
}

async function onlineWebpToMp4(buffer) {
    const form = new FormData()
    form.append('new-image-url', '')
    form.append('new-image', new Blob([buffer], { type: 'image/webp' }), 'sticker.webp')

    const res1 = await got.post('https://s6.ezgif.com/webp-to-mp4', {
        body: form,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: { request: 8000 }
    }).text()

    const fileMatch = res1.match(/name="file"\s+value="([^"]+)"/)
    if (!fileMatch) throw new Error('Error en servidor de conversion')

    const formConvert = new FormData()
    formConvert.append('file', fileMatch[1])
    formConvert.append('convert', 'Convert WebP to MP4!')

    const res2 = await got.post(`https://ezgif.com/webp-to-mp4/${fileMatch[1]}`, {
        body: formConvert,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: { request: 8000 }
    }).text()

    const videoMatch = res2.match(/<source\s+src="([^"]+)"\s+type="video\/mp4"/)
    if (!videoMatch) throw new Error('No se pudo obtener enlace de video')

    const videoUrl = videoMatch[1].startsWith('http') ? videoMatch[1] : `https:${videoMatch[1]}`
    return await got(videoUrl, { timeout: { request: 8000 } }).buffer()
}

async function webpToMp4(rawBuffer) {
    const tempDir = path.resolve('./storage/temp', `tovid_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    await fs.promises.mkdir(tempDir, { recursive: true })

    const cleanBuffer = stripWebpExif(rawBuffer)
    const isAnimated = isAnimatedWebP(cleanBuffer)

    const inputPath = path.join(tempDir, 'input.webp')
    const outputPath = path.join(tempDir, 'output.mp4')

    try {
        await fs.promises.writeFile(inputPath, cleanBuffer)

        return await new Promise((resolve, reject) => {
            const cmd = ff(inputPath)

            if (!isAnimated) {
                cmd.inputOptions(['-loop 1'])
                cmd.outputOptions(['-t 5'])
            }

            cmd
                .outputOptions([
                    '-vcodec', 'libx264',
                    '-pix_fmt', 'yuv420p',
                    '-crf', '22',
                    '-preset', 'fast',
                    '-movflags', '+faststart',
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
                ])
                .toFormat('mp4')
                .on('error', async (err) => {
                    try {
                        const fallbackBuffer = await onlineWebpToMp4(rawBuffer)
                        resolve(fallbackBuffer)
                    } catch {
                        reject(err)
                    }
                })
                .on('end', async () => {
                    try {
                        const buf = await fs.promises.readFile(outputPath)
                        resolve(buf)
                    } catch (e) {
                        reject(e)
                    }
                })
                .save(outputPath)
        })
    } finally {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true })
        } catch {}
    }
}

export default {
    command: true, usePrefix: true,
    case: ['tovid', 'tovideo', 'tomp4'],
    description: 'Convierte stickers animados o estaticos a video MP4.',
    category: 'herramientas',
    usage: ['tovid (citando sticker)'],
    script: async (m, { sock }) => {
        const targetRaw = (m.quoted && (m.quoted.raw || m.quoted)) || m.raw
        const targetMsg = targetRaw.message?.ephemeralMessage?.message
            || targetRaw.message?.viewOnceMessage?.message
            || targetRaw.message?.documentWithCaptionMessage?.message
            || targetRaw.message
            || {}

        const isSticker = !!targetMsg.stickerMessage
        if (!isSticker) {
            return m.reply('Responde a un sticker.')
        }

        await m.react('wait')

        try {
            const buffer = await sock.downloadMedia(targetRaw)
            if (!buffer || !buffer.length) {
                await m.react('error')
                return m.reply('No se pudo descargar el sticker.')
            }

            const videoBuffer = await webpToMp4(buffer)
            if (!videoBuffer || !videoBuffer.length) {
                await m.react('error')
                return m.reply('Error al procesar la conversion de video.')
            }

            await sock.sendMessage(m.chat.id, {
                video: videoBuffer,
                caption: 'Video convertido exitosamente',
                gifPlayback: true
            }, { quoted: m.raw })

            await m.react('done')
        } catch (e) {
            await m.react('error')
            return m.reply('Error al convertir sticker a video: ' + e.message)
        }
    }
}