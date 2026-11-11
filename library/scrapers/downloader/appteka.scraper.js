// ./library/scrapers/downloader/appteka.scraper.js
import got from 'got'

const BASE = 'https://appteka.store'
const idRegex = /^[0-9a-f]{3}r\d+$/i

const USER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
}

const pick = (...vals) => {
    for (const v of vals) {
        if (v !== undefined && v !== null && v !== '') return v
    }
    return ''
}

const parseId = (t) => {
    if (idRegex.test(t)) return t.toLowerCase()
    const m = String(t).match(/\/apps?\/([0-9a-f]{3}r\d+)/i)
    if (m) return m[1].toLowerCase()
    throw new Error(`Bukan app_id/URL Appteka yang valid: ${t}`)
}

const humanSize = (b) => {
    if (!Number.isFinite(b)) return null
    const u = ['B', 'KB', 'MB', 'GB']
    let i = 0, byteV = b
    while (byteV >= 1024 && i < u.length - 1) {
        byteV /= 1024; i++
    }
    return `${byteV.toFixed(i > 0 ? 2 : 0)} ${u[i]}`
}

const unescapeHtml = (s) => {
    if (s == null) return ''
    return String(s).replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

const readRSC = (html) => {
    const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
    let m, out = ''
    while ((m = re.exec(html)) !== null) {
        try { out += JSON.parse('"' + m[1] + '"') } catch {}
    }
    return out
}

const matchObject = (buf, start) => {
    let depth = 0, inStr = false, esc = false
    for (let i = start; i < buf.length; i++) {
        const c = buf[i]
        if (inStr) {
            if (esc) esc = false
            else if (c === '\\') esc = true
            else if (c === '"') inStr = false
        } else if (c === '"') {
            inStr = true
        } else if (c === '{') {
            depth++
        } else if (c === '}') {
            depth--
            if (depth === 0) return buf.substring(start, i + 1)
        }
    }
    return null
}

const stripSvg = (x) => {
    if (Array.isArray(x)) return x.map(stripSvg)
    if (x && typeof x === 'object') {
        const o = {}
        for (const k of Object.keys(x)) {
            if (typeof x[k] === 'string' && x[k].startsWith('<svg')) continue
            o[k] = stripSvg(x[k])
        }
        return o
    }
    return x
}

const normalizeApp = (o) => {
    let finalCat = null
    if (o.category?.name) finalCat = o.category.name.en || Object.values(o.category.name)[0]
    
    let aInfo = null
    if (o.author) aInfo = { id: pick(o.author.id, ''), name: pick(o.author.name, ''), url: pick(o.author.url, '') }
    
    return {
        id: pick(o.app_id, ''),
        title: pick(o.label, ''),
        package: pick(o.package, ''),
        version: pick(o.ver_name, ''),
        version_code: pick(o.ver_code, ''),
        size_bytes: pick(o.size, 0),
        size: humanSize(pick(o.size, 0)),
        downloads: pick(o.downloads, 0),
        rating: pick(o.rating, 0),
        category: finalCat,
        author: aInfo,
        abi: o.abi || [],
        exclusive: !!o.exclusive,
        updated_at: pick(o.time, 0) > 0 ? new Date(o.time * 1000).toISOString() : null,
        icon: pick(o.icon, null),
        detail_url: `${BASE}/app/${pick(o.app_id, '')}`,
        download_page: `${BASE}/apps/${pick(o.app_id, '')}/download`
    }
}

const parseSearch = (html) => {
    const buf = readRSC(html)
    const seen = [], items = []
    const re = /\{"app_id":"/g
    let m
    while ((m = re.exec(buf)) !== null) {
        const s = matchObject(buf, m.index)
        if (!s) continue
        try {
            const o = JSON.parse(s)
            if (o.app_id && !seen.includes(o.app_id)) {
                seen.push(o.app_id)
                items.push(normalizeApp(o))
            }
        } catch {}
    }
    return items
}

const parseMeta = (html) => {
    const pck = (re) => {
        const m = html.match(re)
        return m ? unescapeHtml(m[1]) : null
    }
    return {
        title: pck(/<title>(.*?)<\/title>/s),
        description: pck(/<meta name="description" content="([^"]*)"/),
        canonical: pck(/<link rel="canonical" href="([^"]*)"/),
        og_image: pck(/<meta property="og:image" content="([^"]*)"/)
    }
}

const parseDetail = (html, id) => {
    const buf = readRSC(html)
    const meta = parseMeta(html)
    const marker = `"app_id":"${id}"`
    const idx = buf.indexOf(marker)
    if (idx < 0) return { app: null, meta }

    let obj = null
    for (let i = idx; i >= 0; i--) {
        if (buf[i] === '{') {
            const s = matchObject(buf, i)
            if (s && i + s.length > idx) {
                try {
                    const parsed = JSON.parse(s)
                    if (parsed.app_id === id) { obj = parsed; break }
                } catch {}
            }
        }
    }

    if (!obj) return { app: null, meta }
    const app = normalizeApp(obj)
    app.sha1 = pick(obj.sha1, null)
    app.min_android = pick(obj.android, null)
    app.min_sdk = pick(obj.sdk_version, null)
    return { app, meta }
}

const parseDownloadLink = (html) => {
    const m = html.match(/href="((?:https?:\/\/[^"\/]+)?\/download\/\d+\/[^"]+)"/)
    if (!m) return null
    const url = new URL(unescapeHtml(m[1]), BASE)
    const e = Number(url.searchParams.get('e'))
    
    let baseN = url.pathname.split('/')
    let nRaw = decodeURIComponent(baseN[baseN.length - 1])
    let fName = nRaw.replace(/[\\/:*?"<>]/g, '_').replace(/\|/g, '_')

    return {
        url: url.href,
        filename: fName,
        expires_at: e > 0 ? new Date(e * 1000).toISOString() : null
    }
}

export async function search(query) {
    const encQ = encodeURIComponent(query).replace(/%20/g, '+')
    const res = await got(`${BASE}/search?q=${encQ}`, {
        headers: { ...USER_HEADERS, 'Referer': `${BASE}/apps`, 'Sec-Fetch-Site': 'same-origin' },
        throwHttpErrors: false
    })
    if (res.statusCode !== 200) throw new Error(`Search HTTP ${res.statusCode}`)
    return parseSearch(res.body)
}

export async function detail(target) {
    const id = parseId(target)
    const res = await got(`${BASE}/app/${id}`, {
        headers: { ...USER_HEADERS, 'Referer': `${BASE}/apps`, 'Sec-Fetch-Site': 'same-origin' },
        throwHttpErrors: false
    })
    if (res.statusCode !== 200) throw new Error(`Detail HTTP ${res.statusCode}`)
    return parseDetail(res.body, id)
}

export async function download(target) {
    const id = parseId(target)
    const res = await got(`${BASE}/apps/${id}/download`, {
        headers: { ...USER_HEADERS, 'Referer': `${BASE}/app/${id}`, 'Sec-Fetch-Site': 'same-origin' },
        throwHttpErrors: false
    })
    if (res.statusCode !== 200) throw new Error(`Download HTTP ${res.statusCode}`)
    return parseDownloadLink(res.body)
}

export default { search, detail, download }