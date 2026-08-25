// ./library/scrapers/search/pinterest.scraper.js
import got from 'got'

let cachedSession = {
    cookie: '',
    csrf: '1234567890abcdef1234567890abcdef',
    expiresAt: 0
}

const HEADERS_BASE = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
}

async function getPinterestSession() {
    const now = Date.now()
    if (cachedSession.cookie && cachedSession.expiresAt > now) {
        return cachedSession
    }

    try {
        const res = await got('https://www.pinterest.com/', {
            headers: HEADERS_BASE,
            timeout: { request: 10000 }
        })

        const setCookies = res.headers['set-cookie'] || []
        let cookieHeader = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ')
        let csrftoken = '1234567890abcdef1234567890abcdef'

        const csrfMatch = cookieHeader.match(/csrftoken=([^;]+)/)
        if (csrfMatch) csrftoken = csrfMatch[1]

        cachedSession = {
            cookie: cookieHeader,
            csrf: csrftoken,
            expiresAt: now + (1000 * 60 * 30)
        }

        return cachedSession
    } catch {
        return cachedSession
    }
}

function extractVideoUrls(item) {
    let downloadUrl = null
    let videoThumbnail = null

    function processVideoList(vlist) {
        if (!vlist || typeof vlist !== 'object') return
        for (const [, vdata] of Object.entries(vlist)) {
            if (!vdata || !vdata.url) continue
            if (vdata.thumbnail && !videoThumbnail) videoThumbnail = vdata.thumbnail

            if (vdata.url.endsWith('.mp4')) {
                downloadUrl = vdata.url
                break
            } else if (vdata.url.includes('/hls/')) {
                const match = vdata.url.match(/\/hls\/(.+)\.m3u8/)
                if (match) {
                    downloadUrl = `https://v1.pinimg.com/videos/iht/expMp4/${match[1]}_720w.mp4`
                    break
                }
            }
        }
    }

    if (item.videos?.video_list) processVideoList(item.videos.video_list)
    if (!downloadUrl && item.story_pin_data?.pages) {
        for (const page of item.story_pin_data.pages) {
            if (page.blocks) {
                for (const block of page.blocks) {
                    if (block.video?.video_list) {
                        processVideoList(block.video.video_list)
                        if (downloadUrl) break
                    }
                }
            }
            if (downloadUrl) break
        }
    }

    return {
        has_video: Boolean(downloadUrl),
        download_url: downloadUrl,
        thumbnail: videoThumbnail
    }
}

export async function search(query, options = {}) {
    const q = String(query || '').trim()
    if (!q) return { status: false, msg: 'Ingresa un término de búsqueda.' }

    const rawType = (options.type || 'all').toLowerCase()
    const filterType = (rawType === 'image' || rawType === 'foto') ? 'image' : (rawType === 'video' || rawType === 'vid') ? 'video' : 'all'
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 30)

    try {
        const session = await getPinterestSession()
        const searchUrl = 'https://www.pinterest.com/resource/BaseSearchResource/get/'

        const requestPageSize = filterType === 'all' ? limit : Math.min(limit * 3, 50)
        const requestOptions = { query: q, scope: 'pins', page_size: requestPageSize, no_fetch_context_on_resource: false }

        const dataPayload = { options: requestOptions, context: {} }
        const searchParams = {
            source_url: `/search/pins/?q=${encodeURIComponent(q)}&rs=typed`,
            data: JSON.stringify(dataPayload),
            _: Date.now().toString()
        }

        const res = await got(searchUrl, {
            searchParams,
            headers: {
                ...HEADERS_BASE,
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': session.csrf,
                'X-Pinterest-AppState': 'active',
                'X-Pinterest-PWS-Handler': 'www/[username].js',
                'Referer': `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`,
                'Cookie': session.cookie
            },
            responseType: 'json',
            timeout: { request: 12000 }
        }).json()

        const rawResults = res.resource_response?.data?.results || []
        const formattedList = []

        for (const item of rawResults) {
            const origImage = item.images?.orig?.url || item.images?.['736x']?.url || item.images?.['474x']?.url || null
            const thumbnailImage = item.images?.['236x']?.url || item.images?.['170x']?.url || origImage
            
            const videoData = extractVideoUrls(item)
            const isVideo = Boolean(item.is_video || videoData.has_video)
            const itemType = isVideo ? 'video' : 'image'

            if (filterType === 'image' && isVideo) continue
            if (filterType === 'video' && !isVideo) continue

            const directMediaUrl = isVideo ? videoData.download_url : origImage
            const thumb = isVideo ? (videoData.thumbnail || thumbnailImage) : thumbnailImage

            if (!directMediaUrl) continue

            formattedList.push({
                id: item.id,
                title: item.title || item.grid_title || 'Pinterest Media',
                type: itemType,
                url: directMediaUrl,
                thumbnail: thumb,
                pinUrl: item.id ? `https://www.pinterest.com/pin/${item.id}/` : null,
                author: item.pinner?.full_name || item.pinner?.username || 'Pinterest User'
            })

            if (formattedList.length >= limit) break
        }

        return {
            status: formattedList.length > 0,
            query: q,
            type: filterType,
            total: formattedList.length,
            results: formattedList
        }

    } catch (e) {
        return { status: false, msg: `Error en Pinterest Search: ${e.message}`, results: [] }
    }
}

export async function download(url) {
    const inputUrl = String(url || '').trim()
    if (!inputUrl) return { status: false, msg: 'Ingresa una URL de Pinterest.' }

    try {
        const session = await getPinterestSession()

        const response = await got(inputUrl, {
            headers: { ...HEADERS_BASE, 'Cookie': session.cookie },
            followRedirect: true,
            timeout: { request: 12000 }
        })

        const finalUrl = response.url
        const html = response.body

        const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
        const title = titleMatch ? titleMatch[1].replace(' | Pinterest', '').trim() : 'Pinterest Media'

        const mp4Links = html.match(/https:\/\/[^"]+\.mp4/g)
        const hlsMatches = html.match(/\/videos\/iht\/hls\/([^"]+)\.m3u8/)
        const origImgMatch = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"]+/)

        if (mp4Links && mp4Links.length > 0) {
            const uniqueLinks = [...new Set(mp4Links)]
            const bestLink = uniqueLinks.find(link => link.includes('720p') || link.includes('720w')) || uniqueLinks[uniqueLinks.length - 1]
            return { status: true, type: 'video', title, url: bestLink, quality: '720p (HD)' }
        }

        if (hlsMatches) {
            const bestLink = `https://v1.pinimg.com/videos/iht/expMp4/${hlsMatches[1]}_720w.mp4`
            return { status: true, type: 'video', title, url: bestLink, quality: '720p (HD)' }
        }

        if (origImgMatch) {
            return { status: true, type: 'image', title, url: origImgMatch[0], quality: 'Original HD' }
        }

        const pinIdMatch = finalUrl.match(/\/pin\/(\d+)/)
        if (pinIdMatch) {
            const pinId = pinIdMatch[1]
            const resourceUrl = `https://www.pinterest.com/resource/PinResource/get/?data=${encodeURIComponent(JSON.stringify({ options: { id: pinId, field_set_key: "detailed" }, context: {} }))}`
            
            const pinRes = await got(resourceUrl, {
                headers: {
                    ...HEADERS_BASE,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': session.csrf,
                    'Cookie': session.cookie
                },
                responseType: 'json',
                timeout: { request: 10000 }
            }).json()

            const item = pinRes.resource_response?.data
            if (item) {
                const videoData = extractVideoUrls(item)
                const origImage = item.images?.orig?.url || item.images?.['736x']?.url || null

                if (videoData.has_video) {
                    return { status: true, type: 'video', title: item.title || title, url: videoData.download_url, thumbnail: videoData.thumbnail, quality: '720p (HD)' }
                }
                if (origImage) {
                    return { status: true, type: 'image', title: item.title || title, url: origImage, quality: 'Original HD' }
                }
            }
        }

        return { status: false, msg: 'No se encontró archivo multimedia en el enlace.' }

    } catch (e) {
        return { status: false, msg: `Error en Pinterest Downloader: ${e.message}` }
    }
}

export default {
    search,
    download
}