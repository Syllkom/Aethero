// ./plugins/search/yts.plugin.js
import yts from 'yt-search'

const toShort = (url) => {
    if (!url) return 'Desconocido'
    const id = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1]
    return id ? `https://youtu.be/${id}` : url
}

export default {
    command: true, usePrefix: true,
    case: ['yts', 'ytsearch', 'ytssearch', 'buscaryt'],
    description: 'Busca múltiples resultados en YouTube y los envía agrupados en un álbum interactivo.',
    category: 'search',
    usage: 'yts ‹busqueda›',
    script: async (m, { sock }) => {
        const query = m.text.trim()
        if (!query) return m.reply('ⓘ Ingresa el término de búsqueda para YouTube.\n\n*Ejemplo:*\n.yts electro music 2026')

        await m.react('🔍')

        try {
            const search = await yts(query)
            
            const videos = (search.videos || search.all || []).filter(v => 
                v && v.videoId && 
                (v.type === 'video' || !v.type) && 
                !v.type?.includes('channel') && 
                !v.type?.includes('playlist')
            )

            if (!videos.length) {
                await m.react('error')
                return m.reply('ⓘ No se encontraron resultados en YouTube.')
            }

            const topVideos = videos.slice(0, 4)

            const albumItems = topVideos.map(vid => {
                const title = vid.title || 'Video de YouTube'
                const channel = vid.author?.name || 'Desconocido'
                const duration = vid.timestamp || vid.duration?.timestamp || 'Desconocido'
                const views = vid.views ? Number(vid.views).toLocaleString('es-ES') : 'Desconocido'
                const published = vid.ago || vid.uploadDate || 'Desconocida'
                const rawUrl = vid.url || `https://youtube.com/watch?v=${vid.videoId}`
                const shortUrl = toShort(rawUrl)
                
                let thumbnail = vid.thumbnail || vid.image || ''
                if (!thumbnail || thumbnail.includes('custom_')) {
                    thumbnail = `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`
                }

                const captionText = [
                    `*${title}*`,
                    `╭🔎 *Canal:* ${channel}`,
                    `﹕⏳ *Duración:* ${duration}`,
                    `﹕👀 *Vistas:* ${views}`,
                    `╰📅 *Publicación:* ${published}`,
                    '',
                    `${shortUrl}`
                ].join('\n')

                return {
                    image: { url: thumbnail },
                    caption: captionText
                }
            })

            await sock.sendMessage(m.chat.id, {
                album: albumItems
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('YTS Command Error:', e)
            await m.react('error')
            await m.reply('ⓘ Error al realizar la búsqueda en YouTube.')
        }
    }
}