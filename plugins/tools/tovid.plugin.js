import { getFFmpegPath } from '../../library/media/ffmpegResolver.js'
import ff from 'fluent-ffmpeg'

const ffmpegPath = getFFmpegPath()
if (ffmpegPath) {
    ff.setFfmpegPath(ffmpegPath)
}

export default {
    command: true,
    usePrefix: true,
    case: ['tovid', 'tovideo'],
    description: 'Convierte stickers animados a formato video.',
    category: 'herramientas',
    usage: ['tovid (citando sticker animado)'],
    script: async (m, { sock }) => {
        if (!m.quoted) return m.reply('Responde a un sticker animado.')
        await m.react('wait')
        try {
            const buffer = await m.getQuotedMedia()
            if (!buffer || !buffer.length) return m.reply('No se pudo descargar el sticker.')
            const { gifToMp4 } = await import('../../library/media/giftConverter.js')
            const videoBuffer = await gifToMp4(buffer)
            await sock.sendMessage(m.chat.id, { video: videoBuffer, caption: 'Video convertido exitosamente' }, { quoted: m.raw })
            await m.react('done')
        } catch (e) {
            await m.react('error')
            return m.reply('Error al convertir sticker a video: ' + e.message)
        }
    }
}