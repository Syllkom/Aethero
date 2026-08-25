// ./plugins/downloader/ytmp4.plugin.js
import got from 'got'
import yts from 'yt-search'

export default {
    command: true, usePrefix: true,
    case: ['ytv', 'ytmp4', 'myvideo', 'video'],
    description: 'Descarga videos MP4 de YouTube en alta calidad desde un enlace o término de búsqueda.',
    category: 'downloader',
    usage: 'ytv ‹url/busqueda›',
    script: async (m, { sock }) => {
        let input = m.text.trim()
        if (!input) return m.reply('ⓘ Ingresa un enlace o nombre del video de YouTube.\n\n*Ejemplo:*\n.ytv Cartoon On & On')

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

            const apiUrl = `https://api.azbry.com/api/download/ytmp4?url=${encodeURIComponent(input)}`
            const { body } = await got(apiUrl, { responseType: 'json', timeout: { request: 30000 }, retry: { limit: 2 } })

            if (!body || !body.status || !body.result?.download) {
                await m.react('error')
                return m.reply('ⓘ No se pudo obtener el video de este enlace.')
            }

            const videoUrl = body.result.download
            const quality = body.result.quality || 'HD'

            await sock.sendMessage(m.chat.id, {
                video: { url: videoUrl },
                caption: `✓ *YouTube MP4* [${quality}]`
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('YTV Downloader Error:', e.message)
            await m.react('error')
            await m.reply('ⓘ Error al descargar el video de YouTube.')
        }
    }
}