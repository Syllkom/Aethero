// ./plugins/downloader/instagram.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['instagram', 'ig', 'igdl', 'reel'],
    description: 'Descarga fotos, reels y carruseles de Instagram.',
    category: 'downloader',
    usage: 'instagram ‹url›',
    script: async (m, { sock, scrapers }) => {
        const args = m.args || []
        const url = args.find(a => /instagram\.com/i.test(a)) || m.text.trim()

        if (!url || !/instagram\.com/i.test(url)) {
            return m.reply('ⓘ Ingresa un enlace valido de Instagram.\n\n*Uso:*\n.ig ‹url›')
        }

        await m.react('wait')

        try {
            const igScraper = scrapers.file('downloader/instagram.scraper.js')
            if (!igScraper) {
                await m.react('error')
                return m.reply('ⓘ Modulo scraper de Instagram no disponible.')
            }

            const res = await igScraper.download(url)
            if (!res.status || !res.result?.length) {
                await m.react('error')
                return m.reply(`ⓘ ${res.msg || 'No se pudo descargar el contenido de este enlace.'}`)
            }

            const items = res.result

            if (items.length > 1) {
                const albumMedias = items.map(item => {
                    return item.isVideo
                        ? { video: { url: item.url } }
                        : { image: { url: item.url } }
                })

                await sock.sendMessage(m.chat.id, {
                    album: albumMedias
                }, { quoted: m.raw })
            } else {
                const item = items[0]
                if (item.isVideo) {
                    await sock.sendMessage(m.chat.id, {
                        video: { url: item.url }
                    }, { quoted: m.raw })
                } else {
                    await sock.sendMessage(m.chat.id, {
                        image: { url: item.url }
                    }, { quoted: m.raw })
                }
            }

            await m.react('done')

        } catch (err) {
            console.error('[Instagram Downloader Error]:', err)
            await m.react('error')
            return m.reply('ⓘ Error al procesar el enlace.')
        }
    }
}