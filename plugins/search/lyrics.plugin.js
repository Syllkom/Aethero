// ./plugins/search/lyrics.plugin.js
import { Canvas, Path2D } from '@napi-rs/canvas'

let cachedLetrasLogo = null

async function getLetrasLogoBuffer() {
    if (cachedLetrasLogo) return cachedLetrasLogo

    const canvas = new Canvas(400, 400)
    const ctx = canvas.getContext('2d')

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 400)
    bgGrad.addColorStop(0, '#d4e600')
    bgGrad.addColorStop(1, '#c9d400')
    
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 400, 400)

    const starPath = new Path2D('M175,70 C177,66 183,66 185,70 L214,132 C215,135 218,137 221,137 L288,132 C293,132 296,138 292,142 L241,192 C239,194 238,198 239,201 L262,265 C264,270 259,275 254,272 L197,236 C194,234 190,234 187,236 L130,272 C125,275 120,270 122,265 L145,201 C146,198 145,194 143,192 L92,142 C88,138 91,132 96,132 L163,137 C166,137 169,135 170,132 Z')

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 26
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(starPath)

    cachedLetrasLogo = await canvas.toBuffer('image/jpeg')
    return cachedLetrasLogo
}

export default {
    command: true, usePrefix: true,
    case: ['letra', 'lyrics'],
    description: 'Busca y extrae la letra de una canción desde Letras.com con tarjeta fakeOrder temática.',
    category: 'search',
    usage: ['letra ‹canción / artista›'],
    script: async (m, { sock, scrapers }) => {
        if (!m.text) {
            return m.reply('ⓘ Ingresa el nombre de una canción o artista.\n- Ejemplo: .letra Coldplay Yellow\n- Ejemplo: .letra Queen Bohemian Rhapsody')
        }

        const query = m.text.trim()
        await m.react('wait')

        try {
            const lyricsScraper = scrapers.file('search/lyrics.scraper.js')
            if (!lyricsScraper) {
                await m.react('error')
                return m.reply('ⓘ El módulo de lyrics no está disponible en scrapers.')
            }
            
            const tracks = await lyricsScraper.searchTracks(query)
            if (!tracks.length) {
                await m.react('error')
                return m.reply(`ⓘ No se encontraron canciones para "${query}".`)
            }

            const data = await lyricsScraper.getLyricsData(tracks[0])
            if (!data.status) {
                await m.react('error')
                return m.reply(`ⓘ No se encontró la letra de *${tracks[0].title}* en Letras.com.\n\n☍ YouTube: ${tracks[0].shortUrl || tracks[0].url}`)
            }

            const caption = [
                '╭○ *Lyrics / Letra*',
                `╵ ✧ Título: ${data.title}`,
                `╵ ✦ Artista: ${data.artist}`,
                `╵ ⌛︎ Duración: ${data.duration}`,
                `╵ 𝄜 Publicado: ${data.ago || 'Desconocido'}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                '— *Letra:*',
                data.lyrics,
                '',
                `☍ *Fuente:* ${data.link}`
            ].join('\n')

            const logoBuffer = await getLetrasLogoBuffer()
            
            const fakeQ = await sock.fakeOrder(m.chat.id, {
                image: logoBuffer,
                orderTitle: `${data.title} - ${data.artist}`.substring(0, 25),
                itemCount: 1,
                message: `ⓘ letras.com: ${data.artist}`,
                price: 0,
                currency: 'USD'
            })

            if (data.thumb) {
                await sock.sendMessage(m.chat.id, {
                    image: { url: data.thumb },
                    caption: caption
                }, { quoted: fakeQ })
            } else {
                await sock.sendMessage(m.chat.id, {
                    text: caption
                }, { quoted: fakeQ })
            }

            await m.react('done')

        } catch (e) {
            console.error('Lyrics Plugin Error:', e.message)
            await m.react('error')
            return m.reply(`ⓘ Ocurrió un error al buscar la letra: ${e.message}`)
        }
    }
}