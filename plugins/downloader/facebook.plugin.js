// ./plugins/download/facebook.plugin.js

export default {
    command: true, usePrefix: true,
    category: 'download',
    case: ['fb', 'facebook', 'fbdl'],
    description: 'Descarga videos de Facebook en calidad HD y SD.',
    usage: ['fb ‹enlace de facebook›'],
    script: async (m, { sock, scrapers }) => {
        const url = (m.args[0] || m.text || '').trim()
        if (!url || !/facebook\.com|fb\.watch|fb\.gg/i.test(url)) {
            return m.reply('[!] Ingresa un enlace valido de Facebook.')
        }

        await m.react('wait')

        try {
            const fdown = scrapers.file('downloader/fdown.scraper.js')
            const result = await fdown.download(url)

            const bestQuality = result.downloads.find(d => !d.isRender && /720p|hd/i.test(d.resolution))
                || result.downloads.find(d => !d.isRender)
                || result.downloads[0]

            if (!bestQuality?.url) {
                await m.react('error')
                return m.reply('[!] No se encontro un enlace de transmision directa.')
            }

            /*const captionText = [
                `✦ *Facebook Downloader*`,
                `- *Titulo:* ${result.title}`,
                `- *Duracion:* ${result.duration || 'N/A'}`,
                `- *Calidad:* ${bestQuality.resolution} (${bestQuality.quality})`,
                `- *Formato:* ${bestQuality.format}`,
                '',
                `_Powered by Aethero Framework_`
            ].join('\n')*/

            await sock.sendMessage(m.chat.id, {
                video: { url: bestQuality.url },
                // caption: captionText
            }, { quoted: m.raw })

            await m.react('done')

        } catch (err) {
            console.error('[FB Plugin Error]:', err)
            await m.react('error')
            return m.reply(`[!] Error al descargar el video: ${err.message}`)
        }
    }
}