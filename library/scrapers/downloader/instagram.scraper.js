// ./library/scrapers/downloader/instagram.scraper.js
import got from 'got'

const SNAPVIDEO_HOME = 'https://snapvideo.app/en'
const SNAPVIDEO_SEARCH = 'https://snapvideo.app/api/ajaxSearch'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
const DOWNLOAD_URL_PATTERN = /(download|dl|cdn|instagram|fbcdn|snapvideo|i-1-cdn)/i
const MEDIA_BLOCK_PATTERN = /<li\b[\s\S]*?<\/li>/gi
const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
const OPTION_PATTERN = /<option\b[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi

const htmlEntity = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#039': "'"
}

const decodeHtml = value =>
    String(value || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&([a-zA-Z0-9#]+);/g, (_, entity) => htmlEntity[entity] || `&${entity};`)

const stripTags = value =>
    decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

const isUrl = value => /^https?:\/\//i.test(value)

const getTokenPayload = url => {
    const token = String(url || '').match(/[?&]token=([^&]+)/)
    if (!token) return null

    const parts = token[1].split('.')
    if (parts.length < 2) return null

    try {
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = payload + '==='.slice((payload.length + 3) % 4)
        return JSON.parse(Buffer.from(padded, 'base64').toString())
    } catch {
        return null
    }
}

const inferMediaType = (url, text) => {
    const payload = getTokenPayload(url)
    const filename = payload?.filename || ''
    const sourceUrl = payload?.url || ''
    const value = `${url} ${filename} ${sourceUrl} ${text || ''}`.toLowerCase()

    if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(value) || value.includes('photo')) {
        return 'photo'
    }
    if (/\.(mp4|mov|webm)(\?|$)/.test(value) || value.includes('video')) {
        return 'video'
    }
    return 'media'
}

const filenameFromUrl = (url, index, type) => {
    const payload = getTokenPayload(url)
    if (payload?.filename) return payload.filename

    try {
        const pathname = new URL(url).pathname
        const name = pathname.split('/').filter(Boolean).pop()
        if (name && /\.[a-z0-9]{2,5}$/i.test(name)) return name
    } catch {}

    return `instagram-${index + 1}.${type === 'photo' ? 'jpg' : 'mp4'}`
}

const createMedia = (url, text, index) => {
    const type = inferMediaType(url, text)
    return {
        url,
        type,
        isVideo: type === 'video',
        filename: filenameFromUrl(url, index, type)
    }
}

const collectMedia = html => {
    const candidates = []

    const collect = pattern => {
        let match
        pattern.lastIndex = 0
        while ((match = pattern.exec(html))) {
            const url = decodeHtml(match[1])
            const text = stripTags(match[2])

            if (!isUrl(url)) continue
            if (!DOWNLOAD_URL_PATTERN.test(url + text)) continue

            candidates.push(createMedia(url, text, candidates.length))
        }
    }

    collect(LINK_PATTERN)
    collect(OPTION_PATTERN)
    return candidates
}

const selectMainMedia = candidates => {
    const videos = candidates.filter(item => item.type === 'video')
    const photos = candidates.filter(item => item.type === 'photo')

    if (videos.length) return videos
    if (photos.length) return [photos[0]]
    return candidates.slice(0, 1)
}

const addUnique = (media, seen, item) => {
    if (seen[item.url]) return
    seen[item.url] = true
    media.push(item)
}

const parseMedia = html => {
    const media = []
    const seen = {}
    const blocks = String(html || '').match(MEDIA_BLOCK_PATTERN) || []
    const usableBlocks = blocks.filter(block => block.includes('download-items'))

    if (!usableBlocks.length) {
        collectMedia(html).forEach(item => addUnique(media, seen, item))
        return media
    }

    usableBlocks.forEach(block => {
        selectMainMedia(collectMedia(block)).forEach(item => addUnique(media, seen, item))
    })

    return media
}

async function getSnapVideoConfig() {
    const res = await got(SNAPVIDEO_HOME, {
        headers: { 'user-agent': USER_AGENT },
        timeout: { request: 12000 }
    }).text()

    const exp = res.match(/k_exp="([^"]+)"/)
    const token = res.match(/k_token="([^"]+)"/)

    if (!exp || !token) {
        throw new Error('No se pudo obtener el token de SnapVideo')
    }

    return { exp: exp[1], token: token[1] }
}

export async function download(url) {
    try {
        const config = await getSnapVideoConfig()

        const res = await got.post(SNAPVIDEO_SEARCH, {
            form: {
                k_exp: config.exp,
                k_token: config.token,
                q: url,
                t: 'media',
                lang: 'en',
                v: 'v2',
                html: ''
            },
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'origin': 'https://snapvideo.app',
                'referer': SNAPVIDEO_HOME,
                'user-agent': USER_AGENT,
                'x-requested-with': 'XMLHttpRequest'
            },
            responseType: 'json',
            timeout: { request: 15000 }
        }).json()

        if (res.status !== 'ok') {
            return { status: false, msg: res.mess || 'No se pudo procesar este enlace de Instagram' }
        }

        const media = parseMedia(res.data || '')
        if (!media.length) {
            return { status: false, msg: 'No se encontro contenido descargable' }
        }

        return {
            status: true,
            result: media
        }

    } catch (e) {
        return { status: false, msg: e.message }
    }
}

export default { download }