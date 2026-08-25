// ./plugins/downloader/fb.plugin.js
import got from 'got'

export default {
    command: true, usePrefix: true,
    case: ['fb', 'facebook', 'fbdl', 'fbreel'],
    description: 'Descarga videos, reels y publicaciones de Facebook en alta calidad.',
    category: 'downloader',
    usage: 'fb ‹url›',
    script: async (m, { sock }) => {
        const url = m.text.trim()
        if (!url) return m.reply('ⓘ Ingresa un enlace de Facebook (Reel, Video, Share).\n\n*Ejemplo:*\n.fb https://www.facebook.com/share/r/...')

        if (!/facebook\.com|fb\.watch|fb\.gg/i.test(url)) {
            return m.reply('ⓘ El enlace ingresado no es válido para Facebook.')
        }

        await m.react('wait')

        try {
            const apiUrl = `https://omegatech-api.dixonomega.tech/api/download/All-downloader-v2?action=download&url=${encodeURIComponent(url)}`
            const res = await got(apiUrl, { responseType: 'json', timeout: { request: 20000 } }).json()

            if (!res || !res.success || !res.data) {
                await m.react('error')
                return m.reply('ⓘ No se pudo obtener respuesta del servidor de descargas.')
            }

            const videos = res.data.videos || []
            const videoItem = videos.find(v => v.quality === 'HD' && v.url) || videos[0]
            const videoUrl = videoItem?.url

            if (!videoUrl) {
                await m.react('error')
                return m.reply('ⓘ No se encontró un enlace de video válido para descargar.')
            }

            await sock.sendMessage(m.chat.id, {
                video: { url: videoUrl },
                caption: ''
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('FB Downloader Error:', e.message)
            await m.react('error')
            await m.reply('ⓘ Error al procesar el enlace de Facebook.')
        }
    }
}