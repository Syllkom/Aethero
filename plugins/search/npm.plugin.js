// ./plugins/search/npm.plugin.js
import got from 'got'
import { Canvas, Path2D } from '@napi-rs/canvas'

let cachedNpmLogo = null

async function getNpmLogoBuffer() {
    if (cachedNpmLogo) return cachedNpmLogo

    const canvas = new Canvas(512, 512)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#c12127'
    ctx.fillRect(0, 0, 512, 512)

    ctx.fillStyle = '#ffffff'
    const npmPath = new Path2D('M102.874 102.874h306.25v306.25h-61.25v-245h-91.875v245H102.874v-306.25z')
    ctx.fill(npmPath)

    cachedNpmLogo = await canvas.toBuffer('image/jpeg')
    return cachedNpmLogo
}

export default {
    command: true, usePrefix: true,
    case: ['npmdl', 'npm'],
    description: 'Busca y descarga el paquete (tarball .tgz) desde NPM con tarjeta fakeOrder.',
    category: 'search',
    usage: ['npm ‹paquete›', 'npmdl ‹paquete›'],
    script: async (m, { sock }) => {
        if (!m.text) return m.reply('ⓘ Ingresa el nombre de un paquete NPM.\n- Ejemplo: .npm axios\n- Ejemplo: .npm @whiskeysockets/baileys')

        const pkgName = m.text.trim()
        await m.react('wait')

        try {
            const registryPkg = encodeURIComponent(pkgName).replace(/^%40/, '@')
            const url = `https://registry.npmjs.org/${registryPkg}`

            const info = await got(url, {
                responseType: 'json',
                timeout: { request: 10000 }
            }).json()

            const version = info['dist-tags']?.latest
            if (!version) {
                await m.react('error')
                return m.reply(`ⓘ No se encontró la versión estable del paquete "${pkgName}".`)
            }

            const meta = info.versions?.[version] || await got(`${url}/${version}`, { responseType: 'json' }).json()
            const tarballUrl = meta?.dist?.tarball

            if (!tarballUrl) {
                await m.react('error')
                return m.reply('ⓘ No se encontró el enlace tarball de descarga para este paquete.')
            }

            const buffer = await got(tarballUrl, {
                timeout: { request: 30000 }
            }).buffer()

            const caption = [
                '╭○ *Descarga de NPM*',
                `╵ ✧ Paquete: ${pkgName}`,
                `╵ ✦ Versión: ${version}`,
                `╵ ✎ Licencia: ${meta.license || 'N/A'}`,
                `╵ Ⰶ Tamaño: ${(buffer.length / 1024).toFixed(2)} KB`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n')

            const safeFileName = `${pkgName.replace(/[\/@]/g, '_')}-${version}.tgz`

            const npmLogo = await getNpmLogoBuffer()

            const milena = await sock.fakeOrder(m.chat.id, {
                image: npmLogo,
                orderTitle: pkgName.length > 25 ? pkgName.substring(0, 22) + '...' : pkgName,
                itemCount: 1,
                message: `ⓘ NPM registry: v${version}`,
                price: 0,
                currency: 'USD'
            })

            await sock.sendMessage(m.chat.id, {
                document: buffer,
                mimetype: 'application/gzip',
                fileName: safeFileName,
                caption: caption
            }, { quoted: milena })

            await m.react('done')

        } catch (e) {
            console.error('NPM DL Error:', e.message)
            await m.react('error')

            if (e.response?.statusCode === 404) {
                return m.reply(`ⓘ El paquete "${pkgName}" no existe en el registro de NPM.`)
            }
            return m.reply(`ⓘ Error al procesar el paquete: ${e.message}`)
        }
    }
}