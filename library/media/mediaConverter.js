// ./library/media/mediaConverter.js
import ff from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import webp from 'node-webpmux'
import fs from 'fs'
import path from 'path'
import { Canvas, loadImage } from '@napi-rs/canvas'

if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    ff.setFfmpegPath(ffmpegStatic)
}

async function imageBufferToWebp(mediaBuffer) {
    const img = await loadImage(mediaBuffer)
    const canvas = new Canvas(512, 512)
    const ctx = canvas.getContext('2d')

    const scale = Math.min(512 / img.width, 512 / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (512 - w) / 2
    const y = (512 - h) / 2

    ctx.drawImage(img, x, y, w, h)
    return await canvas.toBuffer('image/webp')
}

async function videoBufferToWebp(mediaBuffer) {
    return new Promise((resolve, reject) => {
        const tempDir = path.join(process.cwd(), 'storage', 'temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const tempInputFile = path.join(tempDir, `temp_in_${Date.now()}.mp4`)
        const tempOutputFile = path.join(tempDir, `temp_out_${Date.now()}.webp`)

        fs.writeFileSync(tempInputFile, mediaBuffer)

        const videoFilter = 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'

        ff(tempInputFile)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', videoFilter,
                '-loop', '0',
                '-ss', '00:00:00',
                '-t', '00:00:05',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ])
            .toFormat('webp')
            .on('error', (err) => {
                if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile)
                if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile)
                reject(err)
            })
            .on('end', () => {
                try {
                    const outputBuffer = fs.readFileSync(tempOutputFile)
                    if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile)
                    if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile)
                    resolve(outputBuffer)
                } catch (e) {
                    reject(e)
                }
            })
            .save(tempOutputFile)
    })
}

async function writeExif(mediaBuffer, metadata = {}, isVideo = false) {
    try {
        const webpBuffer = isVideo 
            ? await videoBufferToWebp(mediaBuffer) 
            : await imageBufferToWebp(mediaBuffer)

        const packname = metadata.packname ?? 'Aethero'
        const author = metadata.author ?? 'Engine'
        const categories = metadata.categories || ['🤖']

        const img = new webp.Image()
        const json = {
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            'emojis': categories
        }

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
            0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ])

        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)

        await img.load(webpBuffer)
        img.exif = exif

        return await img.save(null)

    } catch (error) {
        console.error('Error en writeExif:', error)
        throw error
    }
}

async function stickerWebp(stickerBuffer, metadata = {}) {
    try {
        const packname = metadata.packname ?? 'Aethero'
        const author = metadata.author ?? 'Engine'
        const categories = metadata.categories || ['🤖']

        const img = new webp.Image()
        const json = {
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            'emojis': categories
        }

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
            0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ])

        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)

        await img.load(stickerBuffer)
        img.exif = exif

        return await img.save(null)

    } catch (error) {
        console.error('Error en stickerWebp:', error)
        throw error
    }
}

const imageWebp = async (media, metadata = {}) => await writeExif(media, metadata, false)
const videoWebp = async (media, metadata = {}) => await writeExif(media, metadata, true)

export { imageWebp, videoWebp, stickerWebp }