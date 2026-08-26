// ./library/media/giftConverter.js
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getFFmpegPath } from './ffmpegResolver.js'

function randomName(ext) {
    return Math.floor(Math.random() * 10000) + ext
}

export async function gifToMp4(buffer) {
    const filename = randomName('.gif')
    const outname = randomName('.mp4')
    const tmpDir = path.join(process.cwd(), 'storage', 'temp')

    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const input = path.join(tmpDir, filename)
    const output = path.join(tmpDir, outname)

    await fs.promises.writeFile(input, buffer)

    const ffmpegBinary = getFFmpegPath()

    return new Promise((resolve, reject) => {
        const ffm = spawn(ffmpegBinary, [
            '-y',
            '-i', input,
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-f', 'mp4',
            output
        ])

        ffm.on('close', async (code) => {
            await fs.promises.unlink(input).catch(() => {})

            if (code !== 0) {
                if (fs.existsSync(output)) await fs.promises.unlink(output).catch(() => {})
                return reject(new Error('FFmpeg conversion failed'))
            }

            try {
                const videoBuffer = await fs.promises.readFile(output)
                await fs.promises.unlink(output).catch(() => {})
                resolve(videoBuffer)
            } catch (e) {
                reject(e)
            }
        })
    })
}