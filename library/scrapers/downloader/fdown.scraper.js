// ./library/scrapers/tools/fdown.scraper.js
import got from 'got'

const BASE_URL = 'https://fdown.vn'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

async function getSessionContext() {
    const response = await got(`${BASE_URL}/en`, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: { request: 12000 }
    })

    const rawCookies = response.headers['set-cookie'] || []
    const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ')

    const xsrfCookieMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfCookieMatch ? decodeURIComponent(xsrfCookieMatch[1]) : ''

    const csrfMatch = response.body.match(/<meta\s+name=["']csrf-token["']\s+content=["'](.*?)["']/i)
        || response.body.match(/name=["']_token["']\s+value=["'](.*?)["']/i)
    const csrfToken = csrfMatch ? csrfMatch[1] : ''

    return {
        cookieHeader,
        xsrfToken,
        csrfToken
    }
}

function parseDownloadHtml(html) {
    if (!html || typeof html !== 'string') return null

    const thumbMatch = html.match(/class=["']media-result__thumb["'][^>]*src=["'](.*?)["']/i)
    const thumbnail = thumbMatch ? thumbMatch[1].replace(/&amp;/g, '&') : ''

    const titleMatch = html.match(/class=["']media-result__title["'][^>]*>(.*?)<\/h3>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Facebook Video'

    const durationMatch = html.match(/class=["']media-result__duration["'][^>]*>(.*?)<\/span>/i)
    const duration = durationMatch ? durationMatch[1].trim() : ''

    const items = html.split(/<div class=["']media-item\s*["']/).slice(1)
    const downloads = []

    for (const block of items) {
        const badgeMatch = block.match(/<span class=["']badge[^"']*["']>([\s\S]*?)<\/span>/i)
        const resolution = badgeMatch ? badgeMatch[1].replace(/<[^>]+>/g, '').trim() : ''

        const qualityMatch = block.match(/class=["']media-item__quality["'][^>]*>(.*?)<\/span>/i)
        const quality = qualityMatch ? qualityMatch[1].trim() : ''

        const extMatch = block.match(/class=["']media-item__ext["'][^>]*>(.*?)<\/span>/i)
        const format = extMatch ? extMatch[1].trim() : 'MP4'

        const streamMatch = block.match(/href=["'](https?:\/\/fdown\.vn\/media\/stream\/[^"']+)["']/i)

        const renderMatch = block.match(/data-download-url=["']([^"']+)["']/i)

        if (streamMatch) {
            downloads.push({
                resolution,
                quality,
                format,
                url: streamMatch[1].replace(/&amp;/g, '&'),
                isRender: false
            })
        } else if (renderMatch) {
            downloads.push({
                resolution,
                quality,
                format,
                renderToken: renderMatch[1],
                isRender: true
            })
        }
    }

    return {
        title,
        duration,
        thumbnail,
        downloads
    }
}

export async function download(fbUrl) {
    if (!fbUrl) throw new Error('[!] Se requiere la URL del video de Facebook.')

    const session = await getSessionContext()

    const response = await got.post(`${BASE_URL}/api/download`, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': session.csrfToken,
            'X-XSRF-TOKEN': session.xsrfToken,
            'X-Locale': 'en',
            'Cookie': session.cookieHeader,
            'Origin': BASE_URL,
            'Referer': `${BASE_URL}/en`
        },
        json: { url: fbUrl },
        responseType: 'json',
        timeout: { request: 20000 }
    }).json()

    if (!response?.success || !response?.html) {
        throw new Error('[!] No se pudo obtener la informacion del video.')
    }

    const parsed = parseDownloadHtml(response.html)
    if (!parsed || !parsed.downloads.length) {
        throw new Error('[!] No se encontraron enlaces de descarga disponibles.')
    }

    return parsed
}


export default {
    download,
    getSessionContext,
    export: {
        download,
        getSessionContext
    }
}