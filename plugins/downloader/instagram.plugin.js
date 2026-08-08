// ./plugins/downloader/ig.plugin.js
import { igdl } from 'btch-downloader'

export default {
    command: true, usePrefix: true,
    case: ['ig', 'instagram', 'igdl'],
    description: 'Descarga imágenes, videos, reels o carruseles completos de Instagram.',
    category: 'downloader',
    usage: 'ig ‹url›',
    script: async (m, { sock }) => {
        const url = m.text.trim()
        if (!url) return m.reply('ⓘ Ingresa un enlace de Instagram (Reel, Post, Carrusel).\n\n*Ejemplo:*\n.ig https://www.instagram.com/reel/...')

        if (!/instagram\.com/i.test(url)) {
            return m.reply('ⓘ El enlace ingresado no es válido para Instagram.')
        }

        await m.react('wait')

        try {
            const data = await igdl(url)

            if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
                await m.react('error')
                return m.reply('ⓘ No se pudieron obtener los medios de este enlace.')
            }

            const results = data.result

            if (results.length === 1) {
                const item = results[0]
                const videoUrl = item.url
                const imageUrl = item.thumbnail || item.url

                const isVideo = videoUrl && (
                    videoUrl.includes('.mp4') || 
                    videoUrl.includes('rapidcdn') || 
                    videoUrl !== item.thumbnail
                )

                if (isVideo) {
                    await sock.sendMessage(m.chat.id, {
                        video: { url: videoUrl },
                        caption: ''
                    }, { quoted: m.raw })
                } else if (imageUrl) {
                    await sock.sendMessage(m.chat.id, {
                        image: { url: imageUrl },
                        caption: ''
                    }, { quoted: m.raw })
                }
            } 
            else {
                const albumMedias = []

                for (const item of results) {
                    const videoUrl = item.url
                    const imageUrl = item.thumbnail || item.url

                    const isVideo = videoUrl && (
                        videoUrl.includes('.mp4') || 
                        videoUrl.includes('rapidcdn') || 
                        videoUrl !== item.thumbnail
                    )

                    if (isVideo) {
                        albumMedias.push({ video: { url: videoUrl } })
                    } else if (imageUrl) {
                        albumMedias.push({ image: { url: imageUrl } })
                    }
                }

                if (albumMedias.length > 0) {
                    await sock.sendMessage(m.chat.id, {
                        album: albumMedias,
                        caption: `✓ *Instagram Carrusel* (${albumMedias.length} elementos)`
                    }, { quoted: m.raw })
                }
            }

            await m.react('done')

        } catch (e) {
            console.error('IG Downloader Error:', e)
            await m.react('error')
            await m.reply('ⓘ Error al procesar el enlace de Instagram.')
        }
    }
}