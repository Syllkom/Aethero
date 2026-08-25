// ./plugins/downloader/play.plugin.js
import yts from 'yt-search'

const toShort = (url) => {
    if (!url) return 'Desconocido'
    const id = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1]
    return id ? `https://youtu.be/${id}` : url
}

export default {
    command: true, usePrefix: true,
    case: ['play', 'playvid', 'yt'],
    description: 'Busca un video en YouTube y muestra información formateada con botones de descarga.',
    category: 'downloader',
    usage: 'play ‹busqueda/url›',
    script: async (m, { sock }) => {
        const query = m.text.trim()
        if (!query) return m.reply('ⓘ Ingresa el nombre o enlace del video que deseas buscar.\n\n*Ejemplo:*\n.play Cartoon On & On')

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
                return m.reply('ⓘ No se encontraron videos válidos en YouTube para tu búsqueda.')
            }

            const vid = videos[0]
            const title = vid.title || 'Video de YouTube'
            const channel = vid.author?.name || 'Desconocido'
            const duration = vid.timestamp || vid.duration?.timestamp || 'Desconocido'
            const views = vid.views ? Number(vid.views).toLocaleString('es-ES') : 'Desconocido'
            const published = vid.ago || vid.uploadDate || 'Desconocida'
            const rawUrl = vid.url || `https://youtube.com/watch?v=${vid.videoId}`
            const shortUrl = toShort(rawUrl)
            const thumbnail = vid.thumbnail || vid.image || 'https://files.catbox.moe/obz4b4.jpg'
            const desc = vid.description ? vid.description.trim() : 'Sin descripción'

            const bodyText = [
                `*${title}*`,
                `╭🔎 *Canal:* ${channel}`,
                `﹕⏳ *Duración:* ${duration}`,
                `﹕👀 *Vistas:* ${views}`,
                `╰📅 *Publicación:* ${published}`,
                '',
                `${shortUrl}`
            ].join('\n')

            const readMore = global.readMore || String.fromCharCode(8206).repeat(850)
            const footerText = `${readMore}\n*Descripción:*\n${desc}`

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    image: thumbnail,
                    body: bodyText,
                    footer: footerText,
                    inline: true,
                    buttons: [
                        { type: 'reply', text: 'Audio', id: `.yta ${shortUrl}` },
                        { type: 'reply', text: 'Video', id: `.ytv ${shortUrl}` }
                    ]
                }
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Play Command Error:', e)
            await m.react('error')
            await m.reply('ⓘ Error al realizar la búsqueda en YouTube.')
        }
    }
}