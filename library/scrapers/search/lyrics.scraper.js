// ./library/scrapers/tools/lyrics.scraper.js
import got from 'got'
import yts from 'yt-search'

const slug = s => s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]+/g, "")
    .replace(/^-+|-+$/g, "")

const cleanTitle = (str) => {
    return str
        .replace(/[\(\[](official|video|lyric|audio|hd|hq|letra).*?[\)\]]/gi, '')
        .replace(/ft\.|feat\./gi, '')
        .trim()
}

export async function searchTracks(query) {
    try {
        const search = await yts(query)
        return (search.videos || []).filter(v => v.seconds < 600).map(v => ({
            ...v,
            shortUrl: `https://youtu.be/${v.videoId}`
        }))
    } catch {
        return []
    }
}

export async function getLyricsData(track) {
    try {
        const artist = track.author.name.replace(' - Topic', '').replace('VEVO', '').replace('Official', '').trim()
        const title = cleanTitle(track.title.replace(new RegExp(`^${artist}\\s*[-:]\\s*`, 'i'), ''))

        const artistSlug = slug(artist)
        const titleSlug = slug(title)

        const url = `https://www.letras.com/${artistSlug}/${titleSlug}/`

        const html = await got(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
            timeout: { request: 10000 }
        }).text()

        const regex = /(?<=<p>).*?(?=<\/p>)/gs
        const matches = html.match(regex) || []

        const rawLyrics = matches
            .map(p => p.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim())
            .filter(t => t && !t.toLowerCase().includes("paga una vez"))
            .join("\n\n")

        if (!rawLyrics || rawLyrics.length < 30) throw new Error("Letra no encontrada")

        return {
            status: true,
            title: title,
            artist: artist,
            lyrics: rawLyrics.substring(0, 4000),
            thumb: track.thumbnail,
            link: url,
            ytLink: `https://youtu.be/${track.videoId}`,
            duration: track.timestamp,
            ago: track.ago
        }

    } catch (e) {
        return { 
            status: false, 
            error: "Letra no encontrada en Letras.com",
            title: track.title,
            ytLink: `https://youtu.be/${track.videoId}`
        }
    }
}

export default {
    searchTracks,
    getLyricsData
}