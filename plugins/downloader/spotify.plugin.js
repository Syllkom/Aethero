import { spotify } from 'btch-downloader'

const formatDuration = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

export default {
    command: true, usePrefix: true,
    case: ['spotify', 'sp', 'spotifedl'],
    description: 'Descarga música de Spotify en formato MP3 con su carátula',
    category: 'downloader',
    usage: 'spotify ‹url›',
    async script(m, { sock }) {
        const url = m.text.trim()
        const isValidUrl = /spotify\.com|spotify\.link/i.test(url)
        
        if (!url || !isValidUrl) {
            return m.reply('Por favor, proporciona una URL válida de Spotify\nEjemplo: .spotify https://open.spotify.com/track/...')
        }

        await m.react('wait')

        try {
            const data = await spotify(url)
            
            if (!data.status || !data.result || !data.result.formats || data.result.formats.length === 0) {
                await m.react('error')
                return m.reply('No se encontraron formatos de audio para esta pista. Asegúrate de que el enlace sea válido.')
            }

            const track = data.result
            const format = track.formats[0]
            
            const [audioBuffer, thumbBuffer] = await Promise.all([
                sock.getBuffer(format.url),
                sock.getBuffer(track.thumbnail)
            ])

            if (audioBuffer.length === 0) {
                await m.react('error')
                return m.reply('No se pudo descargar el audio. El enlace podría haber expirado.')
            }

            const duration = formatDuration(track.duration)
            const title = track.title || 'Spotify Track'
            const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '')
            const fileName = `${safeTitle}.mp3`

            const resizedThumb = await sock.resizePhoto({
                image: thumbBuffer,
                scale: 300,
                result: 'buffer'
            })

            await sock.sendMessage(m.chat.id, {
                document: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: fileName,
                jpegThumbnail: resizedThumb,
                caption: `*${title}*\n├ Duración: ${duration}\n├ Calidad: ${format.quality}\n╰ Tamaño: ${format.filesize}`
            }, { quoted: m.raw })

            await m.react('done')
        } catch (error) {
            console.error('[Spotify Error]:', error)
            await m.react('error')
            await m.reply('Ocurrió un error al procesar la solicitud de Spotify.')
        }
    }
}