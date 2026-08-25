// ./library/scrapers/search/bing.scraper.js
import got from 'got'

const BaseUrl = 'https://www.bing.com'

const Defaults = {
  count: 10,
  page: 1,
  market: 'es-ES',
  lang: 'es',
  safe: 'moderate',
  timeout: 12000,
  retries: 1,
  suggest: true,
  snippetMax: 0
}

const Agent = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
]

const SafeCookie = {
  off: 'SRCHHPGUSR=ADLT=OFF',
  moderate: 'SRCHHPGUSR=ADLT=DEMOTE',
  strict: 'SRCHHPGUSR=ADLT=STRICT'
}

const headersFor = (o, extra = {}) => ({
  'User-Agent': Agent[Math.floor(Math.random() * Agent.length)],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': `${o.market},${o.lang};q=0.9,en;q=0.8`,
  'Cookie': SafeCookie[o.safe] || SafeCookie.moderate,
  ...extra
})

const decode = (s = '') => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')

const text = (html = '') => decode(
  String(html)
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim()

const attr = (tag = '', name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s">]+))`, 'i'))
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null
}

const grab = (html, re) => { const m = html.match(re); return m ? m[1] : null }

function unwrapBing(raw) {
  if (!raw) return null
  try {
    const u = new URL(raw, BaseUrl)
    if (/(^|\.)bing\.com$/i.test(u.hostname) && /\/ck\/a/i.test(u.pathname)) {
      const enc = u.searchParams.get('u')
      if (enc) {
        const p = enc.startsWith('a1') ? enc.slice(2) : enc
        const b64 = p.replace(/-/g, '+').replace(/_/g, '/')
        const dec = Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8')
        if (/^https?:\/\//i.test(dec)) return dec
      }
      const r = u.searchParams.get('r') || u.searchParams.get('url')
      if (r && /^https?:\/\//i.test(r)) return r
      return null
    }
    return u.href
  } catch { return null }
}

function splitAlgo(html) {
  const results = html.slice(html.indexOf('id="b_results"') >= 0 ? html.indexOf('id="b_results"') : 0)
  const stopAt = (() => {
    for (const marker of ['class="b_pag"', '<li class="b_pag', '</ol>']) {
      const i = results.indexOf(marker)
      if (i > 0) return i
    }
    return results.length
  })()
  const zone = results.slice(0, stopAt)

  const idx = []
  for (const m of zone.matchAll(/<li\b[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>/gi)) idx.push(m.index)
  return idx.map((s, i) => zone.slice(s, i + 1 < idx.length ? idx[i + 1] : zone.length))
}

function parseResult(block, rank) {
  const h2 = grab(block, /<h2\b[^>]*>([\s\S]*?)<\/h2>/i) || ''
  const aTag = (h2.match(/<a\b[^>]*>/i) || [''])[0]
  const rawHref = attr(aTag, 'href')
  const url = unwrapBing(rawHref)
  const title = text(h2)
  if (!url || !title) return null

  let snippet = text(
    grab(block, /<p\b[^>]*class="[^"]*\bb_lineclamp\d*\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || grab(block, /<div\b[^>]*class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)
    || ''
  )

  let domain = null
  try { domain = new URL(url).hostname.replace(/^www\./i, '') } catch {}

  return {
    rank,
    title,
    url,
    domain,
    snippet: snippet || null
  }
}

async function fetchSuggestions(query, o) {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&market=${encodeURIComponent(o.market)}`
  try {
    const data = await got(url, { responseType: 'json', timeout: { request: 4000 } }).json()
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : []
    return list.map((s) => String(s)).filter(Boolean).slice(0, 10)
  } catch {
    return []
  }
}

export async function search(query, options = {}) {
  const q = String(query ?? '').trim()
  if (!q) return { status: false, msg: 'Ingresa un término de búsqueda.' }
  
  const o = { ...Defaults, ...options }
  o.page = Math.max(1, Number(o.page) || 1)
  o.count = Math.min(30, Math.max(1, Number(o.count) || 10))

  try {
    const first = (o.page - 1) * o.count + 1
    const p = new URLSearchParams({
      q: q,
      count: String(o.count),
      first: String(first),
      mkt: o.market,
      setlang: o.lang,
      FORM: 'PERE'
    })

    const html = await got(`${BaseUrl}/search?${p}`, {
      headers: headersFor(o),
      timeout: { request: o.timeout },
      retry: { limit: o.retries }
    }).text()

    const results = []
    for (const block of splitAlgo(html)) {
      const r = parseResult(block, results.length + 1)
      if (!r) continue
      if (results.some((x) => x.url === r.url)) continue
      results.push(r)
    }

    const suggestions = o.suggest ? await fetchSuggestions(q, o) : []

    return {
      status: results.length > 0,
      query: q,
      results,
      related: suggestions
    }

  } catch (e) {
    return { status: false, msg: `Error en Bing Search: ${e.message}`, results: [] }
  }
}

export default { search }