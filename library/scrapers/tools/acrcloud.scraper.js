// ./library/scrapers/tools/acrcloud.scraper.js
import acrcloud from 'acrcloud'
import yts from 'yt-search'

const getAcrConfig = () => ({
    host: (process.env.ACR_HOST || process.env.HOST || '').trim(),
    access_key: (process.env.ACR_ACCESS_KEY || process.env.ACCESS_KEY || '').trim(),
    access_secret: (process.env.ACR_ACCESS_SECRET || process.env.ACCESS_SECRET || '').trim()
})

export async function identify(buffer) {
    const config = getAcrConfig()
    if (!config.host || !config.access_key || !config.access_secret) {
        return { status: false, msg: 'Credenciales de ACRCloud no configuradas en .env.' }
    }

    try {
        const acr = new acrcloud(config)
        const data = await acr.identify(buffer)

        const { code, msg } = data.status || {}
        if (code !== 0) return { status: false, msg: msg || 'No se encontraron coincidencias.' }

        if (!data.metadata || !data.metadata.music || !data.metadata.music.length) {
            return { status: false, msg: 'Sin datos musicales encontrados.' }
        }

        const song = data.metadata.music[0]
        const title = song.title || 'Desconocido'
        const artist = song.artists ? song.artists.map(a => a.name).join(', ') : 'Desconocido'
        const album = song.album?.name || null
        const date = song.release_date || null
        const genres = song.genres ? song.genres.map(g => g.name).join(', ') : null
        
        let spotifyLink = null
        if (song.external_metadata?.spotify?.track?.id) {
            spotifyLink = `https://open.spotify.com/track/${song.external_metadata.spotify.track.id}`
        }

        const searchQuery = `${title} ${artist}`
        const ytResult = await yts(searchQuery)
        
        let thumb = 'https://files.catbox.moe/obz4b4.jpg'
        let ytLink = null

        if (ytResult && ytResult.videos.length > 0) {
            const bestMatch = ytResult.videos[0]
            thumb = bestMatch.thumbnail
            ytLink = `https://youtu.be/${bestMatch.videoId}`
        }

        return {
            status: true,
            result: {
                title,
                artist,
                album,
                genres,
                date,
                thumbnail: thumb,
                ytLink: ytLink,
                spLink: spotifyLink,
                score: song.score || 100
            }
        }

    } catch (e) {
        return { status: false, msg: e.message }
    }
}

export default {
    identify
}