// ./plugins/search/anime.plugin.js
import got from 'got'

const ANILIST_API = 'https://graphql.anilist.co'

const GQL_QUERY = `
query ($search: String) {
  Media (search: $search, type: ANIME, sort: POPULARITY_DESC) {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
    }
    description(asHtml: false)
    format
    status
    episodes
    duration
    seasonYear
    averageScore
    genres
    studios(isMain: true) {
      nodes {
        name
      }
    }
    trailer {
      id
      site
    }
    siteUrl
  }
}
`

const STATUS_MAP = {
    'FINISHED': 'Finalizado',
    'RELEASING': 'En Emisión',
    'NOT_YET_RELEASED': 'Próximamente',
    'CANCELLED': 'Cancelado',
    'HIATUS': 'En Pausa'
}

const GENRES_MAP = {
    'Action': 'Acción',
    'Adventure': 'Aventura',
    'Comedy': 'Comedia',
    'Drama': 'Drama',
    'Ecchi': 'Ecchi',
    'Fantasy': 'Fantasía',
    'Hentai': 'Hentai',
    'Horror': 'Terror',
    'Mahou Shoujo': 'Chicas Mágicas',
    'Mecha': 'Mecha',
    'Music': 'Música',
    'Mystery': 'Misterio',
    'Psychological': 'Psicológico',
    'Romance': 'Romance',
    'Sci-Fi': 'Ciencia Ficción',
    'Slice of Life': 'Recuentos de la vida',
    'Sports': 'Deportes',
    'Supernatural': 'Sobrenatural',
    'Thriller': 'Suspenso'
}

async function translateToSpanish(text) {
    if (!text || text === 'Sin sinopsis disponible.') return text
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`
        const data = await got(url, {
            responseType: 'json',
            timeout: { request: 6000 }
        }).json()

        if (Array.isArray(data) && Array.isArray(data[0])) {
            return data[0].map(item => item[0]).join('').trim()
        }
        return text
    } catch {
        return text
    }
}

export default {
    command: true, usePrefix: true,
    case: ['anime', 'anilist', 'animedl', 'animesearch'],
    description: 'Busca información detallada de animes traducida al español con portada HD y botones inline.',
    category: 'search',
    usage: ['anime ‹nombre del anime›'],
    script: async (m, { sock }) => {
        if (!m.text) {
            return m.reply('ⓘ Ingresa el nombre del anime que deseas buscar.\n- Ejemplo: .anime Jujutsu Kaisen\n- Ejemplo: .anime Shingeki no Kyojin')
        }

        const queryText = m.text.trim()
        await m.react('wait')

        try {
            const response = await got.post(ANILIST_API, {
                json: {
                    query: GQL_QUERY,
                    variables: { search: queryText }
                },
                responseType: 'json',
                timeout: { request: 12000 }
            }).json()

            const anime = response?.data?.Media
            if (!anime) {
                await m.react('error')
                return m.reply(`ⓘ No se encontró ningún anime con el nombre "${queryText}".`)
            }

            const title = anime.title.romaji || anime.title.english || anime.title.native
            const status = STATUS_MAP[anime.status] || anime.status || 'Desconocido'
            const score = anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)} / 10 ⭐` : 'N/A'
            const studio = anime.studios?.nodes?.[0]?.name || 'Desconocido'
            
            const genres = (anime.genres || []).map(g => GENRES_MAP[g] || g).join(', ') || 'N/A'
            const cover = anime.coverImage?.extraLarge || anime.coverImage?.large
            
            const trailerUrl = anime.trailer?.site === 'youtube' 
                ? `https://youtu.be/${anime.trailer.id}` 
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' official trailer')}`

            const cleanDesc = (anime.description || 'Sin sinopsis disponible.')
                .replace(/<[^>]*>/g, '')
                .replace(/\n\s*\n/g, '\n\n')
                .trim()

            const translatedDesc = await translateToSpanish(cleanDesc)
            const synopsis = translatedDesc.length > 460 ? translatedDesc.substring(0, 440) + '...' : translatedDesc

            const bodyText = [
                `╭○ *Anime Info: ${title}*`,
                `╵ ✧ Japonés: ${anime.title.native || 'N/A'}`,
                `╵ ✦ Calificación: ${score}`,
                `╵ ✎ Estudio: ${studio}`,
                `╵ 𖦹 Géneros: ${genres}`,
                `╵ 📺 Formato: ${anime.format || 'TV'} · Año: ${anime.seasonYear || 'N/A'}`,
                `╵ ⏱ Episodios: ${anime.episodes || '?'} (${anime.duration || '?'} min/ep)`,
                `╵ 📅 Estado: ${status}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                '— *Sinopsis:*',
                `_${synopsis}_`
            ].join('\n')

            const buttons = [
                {
                    type: 'url',
                    text: 'AniList',
                    url: anime.siteUrl || `https://anilist.co/anime/${anime.id}`,
                    inline: true
                },
                {
                    type: 'url',
                    text: 'Trailer',
                    url: trailerUrl,
                    inline: true
                }
            ]

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    image: cover,
                    title: title,
                    subtitle: `${anime.format || 'TV'} · ${status}`,
                    body: bodyText,
                    footer: '© 2026 AniList & Aethero Engine',
                    inline: true,
                    buttons: buttons
                }
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('AniList Plugin Error:', e)
            await m.react('error')
            const errMsg = e.response?.body?.errors?.[0]?.message || e.message
            return m.reply(`ⓘ Error al buscar en AniList: ${errMsg}`)
        }
    }
}