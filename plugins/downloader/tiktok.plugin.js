// ./plugins/downloader/tiktok.plugin.js
import got from 'got'

const TIKWM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Origin': 'https://www.tikwm.com',
    'Referer': 'https://www.tikwm.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
}

export default {
    command: true, usePrefix: true,
    case: ['tiktok', 'tt', 'ttdl', 'vt'],
    description: 'Descarga videos de TikTok o busca videos por palabra clave.',
    category: 'downloader',
    usage: ['tiktok ‹url›', 'tiktok ‹url› hd', 'tiktok ‹búsqueda›'],
    script: async (m, { sock }) => {
        const args = m.args || []
        const input = m.text.trim()

        if (!input) {
            return m.reply('ⓘ Ingresa una URL o un término de búsqueda.\n\n*Uso:*\n.tiktok ‹url›\n.tiktok ‹búsqueda›')
        }

        const isUrl = /tiktok\.com/i.test(input)

        await m.react('wait')

        try {
            if (isUrl) {
                const isHd = args.some(a => ['hd', '-hd', '--hd'].includes(a.toLowerCase()))
                const url = args.find(a => /tiktok\.com/i.test(a)) || input

                const response = await got('https://www.tikwm.com/api/', {
                    searchParams: { url, hd: isHd ? 1 : 0 },
                    headers: TIKWM_HEADERS,
                    responseType: 'json',
                    timeout: { request: 12000 }
                }).json()

                if (response.code !== 0 || !response.data) {
                    await m.react('error')
                    return m.reply('ⓘ No se pudo procesar el contenido de este enlace.')
                }

                const data = response.data
                const images = Array.isArray(data.images) ? data.images : []

                if (images.length > 1) {
                    const albumImages = images.map(img => ({ image: { url: img } }))
                    await sock.sendMessage(m.chat.id, { album: albumImages }, { quoted: m.raw })
                } else if (images.length === 1) {
                    await sock.sendMessage(m.chat.id, { image: { url: images[0] } }, { quoted: m.raw })
                } else {
                    const videoUrl = isHd ? (data.hdplay || data.play) : (data.play || data.hdplay)
                    if (videoUrl) {
                        await sock.sendMessage(m.chat.id, { video: { url: videoUrl } }, { quoted: m.raw })
                    }
                }

                if (data.music) {
                    await sock.sendMessage(m.chat.id, {
                        audio: { url: data.music },
                        mimetype: 'audio/mp4',
                        ptt: false
                    }, { quoted: m.raw })
                }

            } else {
                const response = await got('https://tikwm.com/api/feed/search', {
                    searchParams: {
                        keywords: input,
                        count: 10
                    },
                    headers: TIKWM_HEADERS,
                    responseType: 'json',
                    timeout: { request: 15000 }
                }).json()

                if (response.code !== 0 || !response.data || !response.data.videos || response.data.videos.length === 0) {
                    await m.react('error')
                    return m.reply(`ⓘ No se encontraron resultados para: "${input}"`)
                }

                const videos = response.data.videos.slice(0, 10)
                const albumImages = videos.map(v => ({
                    image: { url: v.cover }
                }))

                await sock.sendMessage(m.chat.id, {
                    album: albumImages
                }, { quoted: m.raw })
            }

            await m.react('done')

        } catch (e) {
            console.error('TikTok Plugin Error:', e)
            await m.react('error')
            
            if (e.message.includes('403')) {
                return m.reply('ⓘ El servidor de TikTok bloqueó la petición (Cloudflare 403). Intenta de nuevo en unos minutos.')
            }
            return m.reply(`ⓘ Error al procesar la solicitud: ${e.message}`)
        }
    }
}