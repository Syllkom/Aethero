// ./plugins/tools/tourl.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['tourl', 'tolink', 'upload'],
    description: 'Sube archivos multimedia a la nube y genera un enlace directo con botón para copiar.',
    category: 'herramientas',
    usage: ['tourl ‹citar imagen/video/audio/sticker/doc›'],
    script: async (m, { sock, scrapers }) => {
        const targetRaw = (m.quoted && (m.quoted.raw || m.quoted)) || (m.content?.isMedia ? m.raw : null)
        
        if (!targetRaw) {
            return m.reply('ⓘ Responde o envía una *imagen*, *video*, *audio*, *sticker* o *documento* para subirlo a la nube.')
        }

        await m.react('wait')

        try {
            const tourlScraper = scrapers.file('tools/tourl.scraper.js')
            if (!tourlScraper) {
                await m.react('error')
                return m.reply('ⓘ El módulo de subida no está disponible en scrapers.')
            }

            const buffer = await sock.downloadMedia(targetRaw)
            if (!buffer || !buffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el archivo multimedia.')
            }

            const targetMsg = targetRaw.message?.ephemeralMessage?.message 
                || targetRaw.message?.viewOnceMessage?.message 
                || targetRaw.message?.documentWithCaptionMessage?.message 
                || targetRaw.message 
                || {}

            let ext = 'jpg'
            let isImage = false

            if (targetMsg.imageMessage) {
                ext = 'jpg'
                isImage = true
            } else if (targetMsg.videoMessage) {
                ext = 'mp4'
            } else if (targetMsg.audioMessage) {
                ext = 'mp3'
            } else if (targetMsg.stickerMessage) {
                ext = 'webp'
            } else if (targetMsg.documentMessage) {
                const origName = targetMsg.documentMessage.fileName || ''
                ext = origName.split('.').pop() || 'bin'
            }

            const fileName = `aethero_${Date.now()}.${ext}`

            const res = await tourlScraper.upload(buffer, fileName)
            if (!res.status || !res.url) {
                await m.react('error')
                return m.reply(`ⓘ ${res.msg || 'Fallo al subir el archivo a la nube.'}`)
            }

            let directUrl = res.url
            if (!directUrl.match(/\.[a-zA-Z0-9]+$/)) {
                directUrl += `.${ext}`
            }

            let quoteThumb = null
            if (isImage) {
                quoteThumb = buffer
            } else {
                const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
                quoteThumb = await sock.getBuffer(ppUrl)
            }

            const fakeQ = await sock.fakeOrder(m.chat.id, {
                image: quoteThumb,
                orderTitle: fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName,
                itemCount: 1,
                message: `ⓘ Cloud: ${res.host.toUpperCase()}`,
                price: 0,
                currency: 'USD'
            })

            const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2)
            const sizeStr = parseFloat(sizeMb) > 0 ? `${sizeMb} MB` : `${(buffer.length / 1024).toFixed(2)} KB`

            const bodyText = [
                `╭○ *Subida a la Nube (Tourl)*`,
                `╵ ☁︎ Servidor: ${res.host}`,
                `╵ ✦ Archivo: \`${fileName}\``,
                `╵ Ⰶ Tamaño: ${sizeStr}`,
                `╵ ⧉ Enlace directo:`,
                `╵ ${directUrl}`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n')

            const buttons = [
                {
                    type: 'copy',
                    text: 'Copiar',
                    payload: directUrl,
                    inline: true
                },
                {
                    type: 'url',
                    text: 'Abrir',
                    url: directUrl,
                    inline: true
                }
            ]

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    title: 'Enlace Generado con Éxito',
                    subtitle: `Alojado en ${res.host}`,
                    body: bodyText,
                    footer: '© 2026 Aethero Cloud Engine',
                    inline: true,
                    buttons: buttons
                }
            }, { quoted: fakeQ })

            await m.react('done')

        } catch (e) {
            console.error('Tourl Plugin Error:', e)
            await m.react('error')
            return m.reply(`ⓘ Error al procesar el archivo: ${e.message}`)
        }
    }
}