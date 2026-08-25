// ./plugins/search/pinterest.plugin.js
import { Canvas, Path2D } from '@napi-rs/canvas'

let cachedPinLogo = null

async function getPinterestLogoBuffer() {
    if (cachedPinLogo) return cachedPinLogo

    const W = 512, H = 512
    const canvas = new Canvas(W, H)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const targetSize = 420
    const scale = targetSize / 512
    const offset = (W - targetSize) / 2

    ctx.save()
    ctx.translate(offset, offset)
    ctx.scale(scale, scale)

    ctx.fillStyle = '#E60019'
    const pinPath = new Path2D('M0 256c0 109.29 68.5 202.6 164.91 239.32-2.35-19.99-4.84-52.95.53-76.07 4.63-19.89 29.89-126.68 29.89-126.68s-7.62-15.25-7.62-37.85c0-35.41 20.53-61.87 46.11-61.87 21.76 0 32.25 16.33 32.25 35.89 0 21.87-13.93 54.55-21.12 84.87-5.99 25.36 12.74 46.05 37.74 46.05 45.29 0 80.13-47.77 80.13-116.71 0-61.04-43.86-103.68-106.48-103.68-72.48 0-115.04 54.38-115.04 110.59 0 21.91 8.42 45.38 18.96 58.16a7.568 7.568 0 012.07 5.21c0 .7-.1 1.41-.29 2.09-1.94 8.07-6.26 25.37-7.08 28.9-1.13 4.65-3.69 5.66-8.54 3.4-31.82-14.81-51.71-61.34-51.71-98.71 0-80.41 58.4-154.22 168.36-154.22 88.41 0 157.13 63 157.13 147.18 0 87.83-55.37 158.53-132.25 158.53-25.84 0-50.09-13.45-58.41-29.3 0 0-12.78 48.68-15.88 60.59-6.01 23.13-22.7 52.39-33.04 69.01 23.84 7.36 49.14 11.3 75.38 11.3 141.38 0 256-114.63 256-256S397.38 0 256 0 0 114.62 0 256z')
    ctx.fill(pinPath)

    ctx.restore()

    cachedPinLogo = await canvas.toBuffer('image/jpeg')
    return cachedPinLogo
}

export default {
    command: true, usePrefix: true,
    case: ['pinterest', 'pin', 'pindl', 'pinsearch'],
    description: 'Busca imágenes en Pinterest (enviadas como álbum con filtro de cantidad y modo aleatorio) o descarga videos/fotos por enlace.',
    category: 'search',
    usage: [
        'pin ‹búsqueda›',
        'pin ‹búsqueda› | ‹cantidad›',
        'pin ‹búsqueda› | ‹cantidad› random',
        'pin ‹enlace de pinterest/pin.it›'
    ],
    script: async (m, { sock, scrapers }) => {
        if (!m.text) {
            return m.reply(
                `╭○ *Buscador & Downloader Pinterest*\n` +
                `╵ ✦ Búsqueda normal: *.pin cyberpunk*\n` +
                `╵ ✦ Con cantidad: *.pin ed maverick | 7*\n` +
                `╵ ✦ Con aleatorio: *.pin ed maverick | 7 random*\n` +
                `╵ ✦ Descargar link: *.pin https://pin.it/xxx*\n` +
                `╰╶╴──────╶╴─╶╴◯`
            )
        }

        const rawInput = m.text.trim()
        await m.react('wait')

        try {
            const pinScraper = scrapers.file('search/pinterest.scraper.js')
            if (!pinScraper) {
                await m.react('error')
                return m.reply('ⓘ El módulo de Pinterest no está disponible en scrapers.')
            }

            const isUrl = /pinterest\.com|pin\.it/i.test(rawInput)

            if (isUrl) {
                const dl = await pinScraper.download(rawInput)
                if (!dl.status || !dl.url) {
                    await m.react('error')
                    return m.reply(`ⓘ ${dl.msg || 'No se pudo descargar el medio de este enlace.'}`)
                }

                const pinLogo = await getPinterestLogoBuffer()
                const fakeQ = await sock.fakeOrder(m.chat.id, {
                    image: pinLogo,
                    orderTitle: dl.title.length > 25 ? dl.title.substring(0, 22) + '...' : dl.title,
                    itemCount: 1,
                    message: `ⓘ Pinterest: ${dl.type === 'video' ? 'Video HD' : 'Foto HD'}`,
                    price: 0,
                    currency: 'USD'
                })

                if (dl.type === 'video') {
                    await sock.sendMessage(m.chat.id, {
                        video: { url: dl.url },
                        caption: `${dl.title}`
                    }, { quoted: fakeQ })
                } else {
                    await sock.sendMessage(m.chat.id, {
                        image: { url: dl.url },
                        caption: `${dl.title}`
                    }, { quoted: fakeQ })
                }

                return await m.react('done')
            }

            let query = rawInput
            let count = 5
            let isRandom = false

            if (rawInput.includes('|')) {
                const [qPart, optsPart] = rawInput.split('|').map(s => s.trim())
                query = qPart || rawInput
                if (optsPart) {
                    const numMatch = optsPart.match(/\d+/)
                    if (numMatch) count = parseInt(numMatch[0], 10)
                    if (/random|aleatorio|rand/i.test(optsPart)) isRandom = true
                }
            }

            count = Math.min(Math.max(count || 5, 2), 10)

            const fetchLimit = isRandom ? Math.min(count * 3, 30) : count
            const searchRes = await pinScraper.search(query, { type: 'image', limit: fetchLimit })

            if (!searchRes.status || !searchRes.results?.length) {
                await m.react('error')
                return m.reply(`ⓘ No se encontraron imágenes en Pinterest para "${query}".`)
            }

            let results = searchRes.results

            if (isRandom) {
                results = results.sort(() => Math.random() - 0.5)
            }

            const finalResults = results.slice(0, count)

            const albumItems = await Promise.all(finalResults.map(async (item) => {
                const buf = await sock.getBuffer(item.url)
                return {
                    image: buf,
                    caption: item.title ? item.title.substring(0, 50) : ''
                }
            }))

            await sock.sendMessage(m.chat.id, {
                album: albumItems
            }, { 
                caption: `_${query}_ (${finalResults.length} fotos${isRandom ? ' · Aleatorias' : ''})`, 
                quoted: m.raw 
            })

            await m.react('done')

        } catch (e) {
            console.error('Pinterest Plugin Error:', e)
            await m.react('error')
            return m.reply(`ⓘ Error al procesar Pinterest: ${e.message}`)
        }
    }
}