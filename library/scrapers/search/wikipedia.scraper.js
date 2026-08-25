// ./library/scrapers/search/wikipedia.scraper.js
import got from 'got'

export async function process(query, lang = 'es') {
    try {
        if (!query) return { status: false, msg: 'Ingresa un término de búsqueda.' }

        const endpoint = `https://${lang}.wikipedia.org/w/api.php`
        
        const data = await got(endpoint, {
            searchParams: {
                action: 'query',
                format: 'json',
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                generator: 'search',
                gsrsearch: query,
                gsrlimit: 5
            },
            headers: {
                'User-Agent': 'Aethero/1.0 (Syllkom)'
            },
            responseType: 'json',
            timeout: { request: 10000 }
        }).json()

        if (!data?.query?.pages) {
            return { status: false, msg: 'No se encontraron resultados exactos en Wikipedia.' }
        }

        const pages = Object.values(data.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0))
        const topResult = pages[0]

        return {
            status: true,
            title: topResult.title,
            extract: topResult.extract,
            url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(topResult.title.replace(/ /g, '_'))}`,
            related: pages.slice(1).map(p => p.title)
        }

    } catch (e) {
        return { status: false, msg: `Error en Wikipedia API: ${e.message}` }
    }
}

export default {
    process
}