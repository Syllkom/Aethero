import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

export default {
    command: true, usePrefix: true,
    case: ['tomp3', 'toaudio'],
    category: 'tools',
    description: 'Extrae el audio de un video y lo convierte a MP3.',
    script: async (m, { sock }) => {
        if (!m.quoted || !m.quoted.content?.isMedia) return m.reply('Cita un video o audio para extraer el MP3.')
        
        await m.react('wait')
        const buffer = await m.getQuotedMedia()
        if (!buffer) return m.react('error')

        const tempDir = path.join(process.cwd(), 'storage', 'temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
        
        const inputPath = path.join(tempDir, `in_${Date.now()}.mp4`)
        const outputPath = path.join(tempDir, `out_${Date.now()}.mp3`)
        fs.writeFileSync(inputPath, buffer)

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .noVideo()
                    .audioCodec('libmp3lame')
                    .audioBitrate(128)
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject)
            })

            const outBuffer = fs.readFileSync(outputPath)
            await sock.sendMessage(m.chat.id, { audio: outBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m.raw })
            await m.react('done')
        } catch (e) {
            await m.react('error')
            m.reply(`Error al extraer audio: ${e.message}`)
        } finally {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        }
    }
}
