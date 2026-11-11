// ./plugins/tools/whatmusic.plugin.js
import { Canvas, Path2D } from '@napi-rs/canvas'

let cachedShazamLogo = null

async function getShazamLogoBuffer() {
    if (cachedShazamLogo) return cachedShazamLogo

    const canvas = new Canvas(512, 512)
    const ctx = canvas.getContext('2d')

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 512)
    bgGrad.addColorStop(0, '#00aaff')
    bgGrad.addColorStop(1, '#2255ff')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 512, 512)

    const shazamPath = new Path2D('M386.486 352.218c-23.724 26.168-66.25 66.875-68.056 68.625a28.821 28.821 0 01-19.93 7.993c-7.645 0-15.22-3-20.895-8.93-11.037-11.563-10.612-29.832.913-40.876.419-.419 42.831-41.012 65.156-65.68 10.556-11.657 15.869-26.62 14.925-42.063-1-16.363-8.887-31.719-22.237-43.238-17.52-15.15-52.125-18.518-73.769.907-12.887 11.543-28.506 28.543-28.65 28.712-10.837 11.744-29.087 12.506-40.837 1.725-11.732-10.8-12.532-29.1-1.719-40.856.719-.788 17.656-19.219 32.65-32.65 41.106-36.894 108.437-37.625 150.1-1.606 25.224 21.793 40.174 51.468 42.137 83.506 1.9 31.112-8.706 61.112-29.788 84.43zm-174.674 2.062c-26.75 0-53.456-8.85-73.956-26.58-25.219-21.788-40.169-51.438-42.144-83.5-1.869-31.1 8.694-61.094 29.819-84.4 23.7-26.194 66.231-66.907 68.018-68.632 11.532-11.043 29.8-10.6 40.838.932 11.019 11.55 10.625 29.843-.913 40.875-.43.418-42.818 41-65.156 65.65-10.55 11.7-15.875 26.63-14.93 42.056 1.005 16.38 8.893 31.737 22.224 43.268 17.544 15.188 52.144 18.5 73.787-.887 12.882-11.575 28.513-28.563 28.669-28.731 10.794-11.763 29.087-12.52 40.812-1.7 11.744 10.787 12.525 29.1 1.725 40.856-.718.743-17.675 19.168-32.65 32.618-20.874 18.75-48.524 28.175-76.143 28.175z')
    ctx.fillStyle = '#ffffff'
    ctx.fill(shazamPath)

    cachedShazamLogo = await canvas.toBuffer('image/jpeg')
    return cachedShazamLogo
}

export default {
    command: true, usePrefix: true,
    case: ['shazam', 'whatmusic', 'quemusica', 'idmusic', 'reconocer'],
    description: 'Reconoce canciones a partir de un audio o video citado con ACRCloud.',
    category: 'herramientas',
    usage: ['whatmusic ‹citar audio/video›', 'shazam ‹citar audio/video›'],
    script: async (m, { sock, scrapers }) => {
        const isMediaQuoted = m.quoted?.content?.isMedia || ['audioMessage', 'videoMessage', 'documentMessage', 'ptvMessage'].includes(m.quoted?.type)
        if (!m.quoted || !isMediaQuoted) {
            return m.reply('ⓘ Responde a una nota de voz, audio o video corto para identificar la música.')
        }

        await m.react('wait')

        try {
            const rawQuoted = m.quoted.raw || { key: m.quoted.key, message: m.quoted.message }
            const mediaBuffer = await sock.downloadMedia(rawQuoted)

            if (!mediaBuffer || !mediaBuffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el audio para el análisis.')
            }

            const acrScraper = scrapers.file('tools/acrcloud.scraper.js')
            if (!acrScraper) {
                await m.react('error')
                return m.reply('ⓘ El módulo de reconocimiento de música no está disponible en scrapers.')
            }

            const res = await acrScraper.identify(mediaBuffer)
            if (!res.status || !res.result) {
                await m.react('error')
                return m.reply(`ⓘ ${res.msg || 'No se pudo identificar ninguna canción en el audio.'}`)
            }

            const data = res.result

            const bodyText = [
                `╭○ *Reconocimiento*`,
                `╵ 𝄞 Canción: ${data.title}`,
                `╵ ✦ Artista: ${data.artist}`,
                `╵ ✎ Álbum: ${data.album || 'Single'}`,
                `╵ 𖦹 Género: ${data.genres || 'Desconocido'}`,
                `╵ 𝄜 Lanzamiento: ${data.date || 'Desconocido'}`,
                `╵ ▶︎ Coincidencia: ${data.score}%`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n')

            const ytTarget = data.ytLink || `${data.title} ${data.artist}`
            const buttons = [
                {
                    type: 'reply',
                    text: 'Audio',
                    id: `.ytmp3 ${ytTarget}`
                },
                {
                    type: 'reply',
                    text: 'Video',
                    id: `.ytmp4 ${ytTarget}`
                }
            ]

            const shazamLogo = await getShazamLogoBuffer()
            const fakeQ = await sock.fakeOrder(m.chat.id, {
                image: shazamLogo,
                orderTitle: `${data.title} - ${data.artist}`.substring(0, 25),
                itemCount: 1,
                message: 'ⓘ Shazam: Music Recognized',
                price: 0,
                currency: 'USD'
            })

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    image: data.thumbnail,
                    title: data.title,
                    subtitle: data.artist,
                    body: bodyText,
                    footer: '© 2026 Shazam & Aethero Engine',
                    inline: true,
                    buttons: buttons
                }
            }, { quoted: fakeQ })

            await m.react('done')

        } catch (e) {
            console.error('WhatMusic Error:', e)
            await m.react('error')
            m.reply(`ⓘ Error al procesar el audio: ${e.message}`)
        }
    }
}