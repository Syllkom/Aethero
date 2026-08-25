// ./plugins/downloader/ytmp3.plugin.js
import got from 'got'
import yts from 'yt-search'

export default {
    command: true, usePrefix: true,
    case: ['yta', 'ytmp3', 'myaudio', 'audio'],
    description: 'Descarga audios MP3 de YouTube en alta calidad desde un enlace o término de búsqueda.',
    category: 'downloader',
    usage: 'yta ‹url/busqueda›',
    script: async (m, { sock }) => {
        let input = m.text.trim()
        if (!input) return m.reply('ⓘ Ingresa un enlace o nombre del video de YouTube.\n\n*Ejemplo:*\n.yta Cartoon On & On')

        await m.react('wait')

        try {
            if (!/youtu(\.be|be\.com)/i.test(input)) {
                const search = await yts(input)
                const videos = (search.videos || []).filter(v => v && v.videoId && !v.type?.includes('channel'))
                if (!videos.length) {
                    await m.react('error')
                    return m.reply('ⓘ No se encontraron resultados en YouTube.')
                }
                input = videos[0].url || `https://www.youtube.com/watch?v=${videos[0].videoId}`
            }

            const apiUrl = `https://api.azbry.com/api/download/ytmp3?url=${encodeURIComponent(input)}`
            const { body } = await got(apiUrl, { responseType: 'json', timeout: { request: 25000 }, retry: { limit: 2 } })

            if (!body || !body.status || !body.result?.download) {
                await m.react('error')
                return m.reply('ⓘ No se pudo obtener el audio de este enlace.')
            }

            const audioUrl = body.result.download

            await sock.sendMessage(m.chat.id, {
                audio: { url: audioUrl },
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('YTA Downloader Error:', e.message)
            await m.react('error')
            await m.reply('ⓘ Error al descargar el audio de YouTube.')
        }
    }
}