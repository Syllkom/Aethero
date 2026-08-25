// ./plugins/search/bing.plugin.js
import { Canvas, Path2D } from '@napi-rs/canvas'

let cachedBingLogo = null

const P1 = new Path2D('M342.444 322.924c-18.874 2.193-33.268 17.521-34.606 36.851-.577 8.329-.396 8.894 18.483 57.475 42.952 110.53 53.358 137.132 55.108 140.876 4.24 9.067 10.202 17.597 17.651 25.253 5.716 5.875 9.486 9.034 15.862 13.293 11.206 7.484 16.767 9.553 60.372 22.464 42.476 12.577 65.682 20.936 85.679 30.861 25.906 12.858 43.981 27.484 55.414 44.838 8.203 12.452 15.468 34.781 18.629 57.258 1.236 8.786 1.244 28.208.015 36.151-2.667 17.239-7.994 31.685-16.143 43.774-4.334 6.429-2.826 5.353 3.475-2.482 17.832-22.171 35.997-60.064 45.266-94.426 11.217-41.587 12.743-86.244 4.391-128.511-16.265-82.309-68.226-153.342-141.408-193.31-4.598-2.512-22.112-11.692-45.856-24.037a4043.836 4043.836 0 01-10.918-5.7 3538.72 3538.72 0 00-10.918-5.7c-3.603-1.873-13.975-7.277-23.049-12.008l-22.563-11.765a15928.295 15928.295 0 01-22.079-11.527c-23.528-12.317-33.487-17.296-36.326-18.16-2.978-.906-10.543-2.069-12.441-1.913-.4.033-2.217.233-4.038.445z')
const P2 = new Path2D('M393.737 735.544c-1.304.772-3.134 1.89-4.068 2.483-.935.594-3.009 1.883-4.61 2.866a22001.025 22001.025 0 00-34.938 21.529 7534.492 7534.492 0 00-21.35 13.22c-4.004 2.484-8.262 5.102-9.463 5.818-1.201.716-6.332 3.876-11.403 7.022a7015.049 7015.049 0 01-19.652 12.132c-5.738 3.526-16.001 9.857-22.806 14.068a7967.29 7967.29 0 01-19.895 12.268c-4.137 2.536-7.958 4.986-8.492 5.444-.793.68-37.585 23.471-56.046 34.718-14.021 8.541-30.241 14.254-46.845 16.498-7.73 1.044-22.358 1.048-30.066.006-20.9-2.822-40.155-10.617-56.645-22.929-6.469-4.83-18.646-16.998-23.302-23.284-10.97-14.811-18.068-30.698-21.743-48.674-.846-4.137-1.646-7.63-1.778-7.764-.343-.347.277 5.902 1.397 14.072 1.164 8.497 3.644 20.787 6.316 31.298C29.023 907.68 87.856 973.842 167.5 1005.32c22.934 9.06 46.077 14.77 71.258 17.57 9.462 1.06 36.245 1.48 46.12.73 45.287-3.43 84.719-16.76 125.171-42.325 3.603-2.277 10.372-6.545 15.042-9.486 4.671-2.94 10.566-6.678 13.102-8.305 2.535-1.628 5.592-3.551 6.793-4.273a241.596 241.596 0 005.338-3.355c1.735-1.122 9.159-5.818 16.498-10.435l29.348-18.537 10.077-6.365.363-.229 1.11-.701.528-.334 7.419-4.686 25.64-16.195c32.67-20.529 42.412-27.736 57.59-42.604 6.328-6.197 15.868-16.777 16.342-18.12.096-.273 1.792-2.889 3.768-5.813 8.032-11.885 13.388-26.444 16.044-43.613 1.229-7.943 1.221-27.365-.015-36.151-2.389-16.987-7.817-36.255-13.669-48.524-9.597-20.118-30.041-38.398-59.41-53.12-8.109-4.065-16.483-7.785-17.418-7.736-.443.023-27.773 16.728-60.733 37.124-32.96 20.396-61.566 38.099-63.567 39.341a761.04 761.04 0 01-7.643 4.668l-18.859 11.698z')
const P3 = new Path2D('M.141 637.697l.141 142.055 1.839 8.249c5.75 25.791 15.71 44.386 33.027 61.657 8.145 8.124 14.374 13.022 23.2 18.245 18.678 11.053 38.78 16.506 60.798 16.496 23.061-.012 43.01-5.764 63.567-18.329 3.469-2.12 17.062-10.489 30.206-18.598l23.898-14.743V495.643l-.007-154.186c-.005-98.368-.185-156.787-.496-161.37-1.96-28.801-14.005-55.278-34.259-75.305-6.216-6.146-11.527-10.251-27.349-21.14a76496.27 76496.27 0 01-32.026-22.056l-35.665-24.577C97.14 30.206 83.056 20.5 75.717 15.44 60.427 4.896 59.23 4.162 54.609 2.508 48.597.36 42.226-.43 36.169.224 18.517 2.13 4.386 14.876.712 32.204.14 34.9.034 70.78.027 265.516L.02 495.643H0l.141 142.054z')

async function getBingLogoBuffer() {
    if (cachedBingLogo) return cachedBingLogo

    const W = 512, H = 512
    const canvas = new Canvas(W, H)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const targetH = 390
    const scale = targetH / 1024
    const targetW = 678 * scale
    const offX = (W - targetW) / 2
    const offY = (H - targetH) / 2

    ctx.save()
    ctx.translate(offX, offY)
    ctx.scale(scale, scale)

    const g1 = ctx.createLinearGradient(300, 300, 600, 700)
    g1.addColorStop(0, '#00CACC')
    g1.addColorStop(1, '#048FCE')
    ctx.fillStyle = g1
    ctx.fill(P1, 'evenodd')

    const g2 = ctx.createLinearGradient(200, 700, 500, 1000)
    g2.addColorStop(0, '#00BBEC')
    g2.addColorStop(1, '#2756A9')
    ctx.fillStyle = g2
    ctx.fill(P2)

    const g3 = ctx.createLinearGradient(0, 0, 0, 884)
    g3.addColorStop(0, '#00BBEC')
    g3.addColorStop(1, '#2756A9')
    ctx.fillStyle = g3
    ctx.fill(P3)

    ctx.restore()

    cachedBingLogo = await canvas.toBuffer('image/jpeg')
    return cachedBingLogo
}

export default {
    command: true, usePrefix: true,
    case: ['bing', 'bsearch', 'buscar', 'google'],
    description: 'Buscador web oficial de Bing con resultados, enlaces y sugerencias.',
    category: 'search',
    usage: ['bing ‹búsqueda›', 'buscar ‹término›'],
    script: async (m, { sock, scrapers }) => {
        if (!m.text) {
            return m.reply('ⓘ Ingresa el término o pregunta que deseas buscar.\n- Ejemplo: .bing Novedades de Node.js\n- Ejemplo: .buscar Inteligencia Artificial')
        }

        const query = m.text.trim()
        await m.react('wait')

        try {
            const bing = scrapers.file('search/bing.scraper.js')
            if (!bing) {
                await m.react('error')
                return m.reply('ⓘ El módulo de Bing Search no está disponible en scrapers.')
            }

            const res = await bing.search(query, { count: 8 })
            if (!res.status || !res.results?.length) {
                await m.react('error')
                return m.reply(`ⓘ No se encontraron resultados para "${query}".`)
            }

            const top = res.results[0]
            const otherResults = res.results.slice(1, 6)

            const bodyLines = [
                `╭○ *Búsqueda Web: ${query}*`,
                `╵ ✧ Motor: Microsoft Bing`,
                `╵ ✦ Resultados: ${res.results.length}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                `📌 *Resultado Principal:*`,
                `• *${top.title}*`,
                `  🔗 ${top.url}`,
                `  💬 _${top.snippet || 'Sin descripción'}_`
            ]

            if (otherResults.length > 0) {
                bodyLines.push('', '📋 *Otros hallazgos:*')
                otherResults.forEach((r, i) => {
                    bodyLines.push(`${i + 2}. *${r.title}*\n   🔗 ${r.url}`)
                })
            }

            const buttons = [
                {
                    type: 'url',
                    text: 'Abrir 1er Resultado',
                    url: top.url
                }
            ]

            const listSections = []

            if (otherResults.length > 0) {
                listSections.push({
                    title: 'Otros Resultados',
                    rows: otherResults.map((r) => {
                        const cleanT = r.title.trim()
                        return {
                            title: cleanT.length > 24 ? cleanT.substring(0, 21) + '...' : cleanT,
                            description: (r.snippet || r.url).substring(0, 70),
                            id: `.bing ${cleanT}`
                        }
                    })
                })
            }

            if (res.related && res.related.length > 0) {
                listSections.push({
                    title: 'Búsquedas Relacionadas',
                    rows: res.related.slice(0, 6).map((rel) => {
                        const cleanRel = rel.trim()
                        return {
                            title: cleanRel.length > 24 ? cleanRel.substring(0, 21) + '...' : cleanRel,
                            description: `Buscar "${cleanRel}" en Bing`,
                            id: `.bing ${cleanRel}`
                        }
                    })
                })
            }

            if (listSections.length > 0) {
                buttons.unshift({
                    type: 'list',
                    text: 'Más Resultados / Sugerencias',
                    sections: listSections
                })
            }

            const bingLogo = await getBingLogoBuffer()
            const fakeQ = await sock.fakeOrder(m.chat.id, {
                image: bingLogo,
                orderTitle: `Bing: ${query}`.substring(0, 25),
                itemCount: res.results.length,
                message: 'ⓘ Bing Search: Resultados Web',
                price: 0,
                currency: 'USD'
            })

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    title: `Búsqueda: ${query}`,
                    subtitle: 'Microsoft Bing',
                    body: bodyLines.join('\n'),
                    footer: '© 2026 Microsoft Bing Search',
                    buttons: buttons
                }
            }, { quoted: fakeQ })

            await m.react('done')

        } catch (e) {
            console.error('Bing Plugin Error:', e)
            await m.react('error')
            return m.reply(`ⓘ Ocurrió un error en la búsqueda: ${e.message}`)
        }
    }
}