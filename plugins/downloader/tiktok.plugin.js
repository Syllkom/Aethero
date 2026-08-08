// ./plugins/downloader/tiktok.plugin.js
import { ttdl } from 'btch-downloader'

export default {
    command: true, usePrefix: true,
    case: ['tiktok', 'tt', 'ttdl', 'vt'],
    description: 'Descarga videos, carruseles de fotos y audios de TikTok sin marcas de agua.',
    category: 'downloader',
    usage: 'tiktok ‹url›',
    script: async (m, { sock }) => {
        const url = m.text.trim()
        if (!url) return m.reply('ⓘ Ingresa un enlace de TikTok.\n\n*Ejemplo:*\n.tiktok https://vm.tiktok.com/...')

        if (!/tiktok\.com/i.test(url)) {
            return m.reply('ⓘ El enlace ingresado no es válido para TikTok.')
        }

        await m.react('wait')

        try {
            const data = await ttdl(url)

            if (!data || !data.status) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el contenido de este enlace.')
            }

            const videos = Array.isArray(data.video) ? data.video : (data.video ? [data.video] : [])
            const images = Array.isArray(data.images) ? data.images : (data.images ? [data.images] : [])
            const audioUrl = Array.isArray(data.audio) ? data.audio[0] : data.audio

            if (images.length > 1) {
                const albumImages = images.map(img => ({ image: { url: img } }))
                await sock.sendMessage(m.chat.id, {
                    album: albumImages
                }, { quoted: m.raw })
            } else if (videos.length > 1) {
                const albumVideos = videos.map(vid => ({ video: { url: vid } }))
                await sock.sendMessage(m.chat.id, {
                    album: albumVideos
                }, { quoted: m.raw })
            } else if (videos.length === 1) {
                await sock.sendMessage(m.chat.id, {
                    video: { url: videos[0] }
                }, { quoted: m.raw })
            } else if (images.length === 1) {
                await sock.sendMessage(m.chat.id, {
                    image: { url: images[0] }
                }, { quoted: m.raw })
            }

            if (audioUrl) {
                await sock.sendMessage(m.chat.id, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mp4',
                    ptt: false
                }, { quoted: m.raw })
            }

            await m.react('done')

        } catch (e) {
            console.error('TikTok Downloader Error:', e)
            await m.react('error')
            await m.reply('ⓘ Error al procesar el enlace de TikTok.')
        }
    }
}