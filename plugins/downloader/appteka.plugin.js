// ./plugins/downloader/appteka.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['apk', 'appteka'],
    description: 'Busca y descarga aplicaciones de la tienda Appteka.',
    category: 'downloader',
    usage: [
        'apk ‹nombre de la app›',
        'apk dl ‹url o id de la app›'
    ],
    script: async (m, { sock, scrapers }) => {
        const args = m.args || []
        const subCmd = args[0]?.toLowerCase()
        const appteka = scrapers.file('downloader/appteka.scraper.js')

        if (!appteka) return m.reply('Scraper de Appteka no encontrado.')

        if (subCmd === 'dl' || subCmd === 'download') {
            const target = args[1]
            if (!target) return m.reply('Ingresa el ID o URL de la app a descargar.')

            await m.react('wait')
            try {
                const link = await appteka.download(target)
                if (!link || !link.url) throw new Error('No se pudo obtener el enlace directo.')

                await sock.sendMessage(m.chat.id, {
                    document: { url: link.url },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: link.filename
                }, { quoted: m.raw })

                await m.react('done')
            } catch (e) {
                await m.react('error')
                m.reply(`Error al descargar: ${e.message}`)
            }
            return
        }

        const query = m.text.trim()
        if (!query) return m.reply('Ingresa el nombre de la aplicacion a buscar.')

        await m.react('wait')
        try {
            const results = await appteka.search(query)
            
            if (results.length === 0) {
                await m.react('error')
                return m.reply(`No se encontraron resultados para "${query}".`)
            }

            const top5 = results.slice(0, 5)
            const mainApp = top5[0]

            try {
                const link = await appteka.download(mainApp.id)
                if (link && link.url) {
                    await sock.sendMessage(m.chat.id, {
                        document: { url: link.url },
                        mimetype: 'application/vnd.android.package-archive',
                        fileName: link.filename
                    }, { quoted: m.raw })
                }
            } catch (err) {
                console.error('Error descargando primer APK:', err.message)
            }

            if (top5.length > 1) {
                const listRows = top5.slice(1).map(app => ({
                    title: app.title,
                    description: `${app.version} | ${app.size}`,
                    id: `.apk dl ${app.id}` 
                }))

                await sock.sendMessage(m.chat.id, {
                    mediaMenu: {
                        image: mainApp.icon || 'https://files.catbox.moe/obz4b4.jpg',
                        title: 'Appteka Store',
                        body: `Resultados para: *${query}*\n\nEl primer resultado (${mainApp.title}) ya fue enviado.\nSelecciona otra opcion de la lista si lo deseas.`,
                        footer: 'Powered by Aethero',
                        buttons: [
                            {
                                type: 'list',
                                text: 'Ver otros resultados',
                                sections: [
                                    {
                                        title: 'Otras aplicaciones',
                                        rows: listRows
                                    }
                                ]
                            }
                        ]
                    }
                }, { quoted: m.raw })
            } else {
                await m.reply(`Se envio el APK de *${mainApp.title}*. No hay mas resultados.`)
            }

            await m.react('done')

        } catch (e) {
            console.error('Appteka Error:', e)
            await m.react('error')
            m.reply(`Error en la busqueda: ${e.message}`)
        }
    }
}