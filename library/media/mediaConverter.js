// ./core/library/media/mediaConverter.js
import ff from 'fluent-ffmpeg'
import webp from 'node-webpmux'
import fs from 'fs'
import path from 'path'

async function bufferToWebp(mediaBuffer, isVideo = false) {
    return new Promise((resolve, reject) => {
        const tempInputFile = path.join(process.cwd(), 'storage', 'temp', `temp_in_${Date.now()}${isVideo ? '.mp4' : '.jpg'}`)
        const tempOutputFile = path.join(process.cwd(), 'storage', 'temp', `temp_out_${Date.now()}.webp`)

        const tempDir = path.dirname(tempInputFile)
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        fs.writeFileSync(tempInputFile, mediaBuffer)

        const videoFilter = isVideo
            ? 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'
            : 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'

        let command = ff(tempInputFile)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', videoFilter
            ])

        if (isVideo) {
            command.outputOptions([
                '-loop', '0',
                '-ss', '00:00:00',
                '-t', '00:00:05',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ])
        }

        command
            .toFormat('webp')
            .on('error', (err) => {
                if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile)
                reject(err)
            })
            .on('end', () => {
                const outputBuffer = fs.readFileSync(tempOutputFile)
                if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile)
                if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile)
                resolve(outputBuffer)
            })
            .save(tempOutputFile)
    })
}

async function writeExif(mediaBuffer, metadata = {}, isVideo = false) {
    try {
        const webpBuffer = await bufferToWebp(mediaBuffer, isVideo)

        const packname = metadata.packname || 'Aethero'
        const author = metadata.author || 'Engine'
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
        const packname = metadata.packname || 'Aethero'
        const author = metadata.author || 'Engine'
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