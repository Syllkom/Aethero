// ./plugins/main/menu.plugin.js
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import moment from 'moment-timezone'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { Canvas, Image, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { inspectPlugins, countTotalCommands } from '../../library/pluginInspector.js'

const downloadImg = async (url) => {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 })
        if (res.status === 200) return res.data
    } catch {}
    return null
}

let fontsLoaded = false
async function loadFonts() {
    if (fontsLoaded) return true
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const fonts = [
        { name: 'MontserratItalic', url: global.font.Montserrat.Italic, file: 'Montserrat-LightItalic.ttf' },
        { name: 'RalewayExtraBold', url: global.font.Raleway.ExtraBold, file: 'Raleway-ExtraBold.ttf' }
    ]

    try {
        for (const f of fonts) {
            const fPath = path.join(tempDir, f.file)
            if (!fs.existsSync(fPath)) {
                const { data } = await axios.get(f.url, { responseType: 'arraybuffer' })
                fs.writeFileSync(fPath, data)
            }
            GlobalFonts.registerFromPath(fPath, f.name)
        }
        fontsLoaded = true
    } catch (e) { console.error('Error cargando fuentes:', e) }
    return fontsLoaded
}

function getRealJid(message, isGroup, sockUser) {
    if (message?.key?.fromMe && sockUser?.id) {
        return sockUser.id.replace(/:\d+@/, '@')
    }

    if (isGroup) {
        const alt = message?.key?.participantAlt
        if (alt && alt.includes('@s.whatsapp.net')) return alt
        return message?.key?.participant || ''
    } else {
        const alt = message?.key?.remoteJidAlt
        if (alt && alt.includes('@s.whatsapp.net')) return alt
        return message?.key?.remoteJid || ''
    }
}

function getUserLocation(senderNumber) {
    try {
        if (!senderNumber) return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, countryName: 'Desconocido' }
        const number = senderNumber.startsWith('+') ? senderNumber : '+' + senderNumber
        const phoneNumber = parsePhoneNumberFromString(number)
        const countryCode = phoneNumber ? phoneNumber.country : null

        let countryName = 'Desconocido'
        if (countryCode) {
            const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })
            countryName = regionNames.of(countryCode)
        }

        const timeZone = (global.TIMEZONES && countryCode && global.TIMEZONES[countryCode])
            ? global.TIMEZONES[countryCode]
            : Intl.DateTimeFormat().resolvedOptions().timeZone

        return { timeZone, countryName }
    } catch {
        return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, countryName: 'Desconocido' }
    }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let currentY = y
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' '
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY)
            line = words[n] + ' '
            currentY += lineHeight
        } else {
            line = testLine
        }
    }
    ctx.fillText(line, x, currentY)
}

const formatCategoryCommands = (plugins, category) => {
    const rows = []
    const defaultPrefix = global.config.prefixes?.[0] || '.'

    for (const p of plugins) {
        const prefix = p.usePrefix ? defaultPrefix : ''

        if (p.list?.length > 0) {
            const entries = p.list.filter(item => item.category === category || item.cat === category)
            for (const entry of entries) {
                const txt = entry.usage || entry.text || entry.cmd
                rows.push(`╵${prefix}${txt}`)
            }
        } else if (p.legacyCategory?.includes(category)) {
            for (const u of p.legacyUsage) {
                rows.push(`╵${prefix}${u}`)
            }
        }
    }
    return rows.join('\n')
}

export default {
    command: true, usePrefix: true,
    case: ['menu', 'help'],
    description: 'Muestra el menú principal interactivo del bot.',
    category: 'main',
    usage: 'menu',
    script: async (m, { sock }) => {
        try {
            await m.react('wait')

            const images = [
                "https://files.catbox.moe/2x9g3s.jpg", "https://files.catbox.moe/iuvlth.jpg",
                "https://files.catbox.moe/61rvv3.jpg", "https://files.catbox.moe/0vcje1.jpg",
                "https://files.catbox.moe/iayvfu.jpeg", "https://files.catbox.moe/d6neg0.jpeg",
                "https://files.catbox.moe/xkmhx1.jpg", "https://files.catbox.moe/d3kcpp.jpg",
                "https://files.catbox.moe/o72kmv.jpg", "https://files.catbox.moe/ag5vyc.jpg",
                "https://files.catbox.moe/htfn57.jpg", "https://files.catbox.moe/8wxhia.jpg",
                "https://files.catbox.moe/tau165.jpg",
            ]

            const pluginsDir = path.join(process.cwd(), 'plugins')
            const inspection = await inspectPlugins(pluginsDir, { includeNonPrefixed: true })
            const total = countTotalCommands(inspection.items)

            const user = m.sender?.name || m.sender?.number || 'Usuario'
            const role = m.sender.role('root') ? 'Root' : m.sender.role('owner') ? 'Owner' : m.sender.role('admin') ? 'Admin' : 'Usuario'

            const formatActiveTime = (seconds) => {
                const d = Math.floor(seconds / (3600 * 24))
                const h = Math.floor((seconds % (3600 * 24)) / 3600)
                const mn = Math.floor((seconds % 3600) / 60)
                const s = Math.floor(seconds % 60)
                if (d > 0) return `${d} (día/s)`
                if (h > 0) return `${h} (hora/s)`
                if (mn > 0) return `${mn} (minuto/s)`
                return `${s} (segundo/s)`
            }
            const active = formatActiveTime(process.uptime())

            let sabias = 'Aethero Advanced Engine'
            try {
                const { data: datosJson } = await axios.get('https://github.com/Syllkom/MyArchive/raw/refs/heads/main/main/datos.json', { timeout: 4000 })
                const arr = Array.isArray(datosJson?.vos_sabiasq) ? datosJson.vos_sabiasq : []
                if (arr.length > 0) sabias = String(arr[Math.floor(Math.random() * arr.length)] || '').trim()
            } catch {}

            const realJid = getRealJid(m.message, m.chat.isGroup, sock.user)
            const { timeZone, countryName } = getUserLocation(m.sender?.number)

            const now    = moment().tz(timeZone)
            const hora   = now.format('hh')
            const minuto = now.format('mm')
            const ampm   = now.format('A')
            const dia    = now.format('dddd')
            const fecha  = now.format('DD/MM/YYYY')

            await loadFonts()
            const fHora = fontsLoaded ? 'RalewayExtraBold, sans-serif' : 'sans-serif'
            const fDato = fontsLoaded ? 'MontserratItalic, sans-serif' : 'sans-serif'

            const width = 1280
            const height = 720
            const canvas = new Canvas(width, height)
            const ctx = canvas.getContext('2d')

            const randomUrl = images[Math.floor(Math.random() * images.length)]
            const bgBuffer = await downloadImg(randomUrl) || await downloadImg('https://files.catbox.moe/obz4b4.jpg')
            
            const bg = await loadImage(bgBuffer)
            
            const scale = Math.max(width / bg.width, height / bg.height)
            const bx = (width / 2) - (bg.width / 2) * scale
            const by = (height / 2) - (bg.height / 2) * scale
            ctx.drawImage(bg, bx, by, bg.width * scale, bg.height * scale)

            const gradV = ctx.createLinearGradient(0, height, 0, 0)
            gradV.addColorStop(0,    'rgba(0,0,0,0.92)')
            gradV.addColorStop(0.38, 'rgba(0,0,0,0.60)')
            gradV.addColorStop(0.55, 'rgba(0,0,0,0.10)')
            gradV.addColorStop(0.65, 'rgba(0,0,0,0)')
            ctx.fillStyle = gradV
            ctx.fillRect(0, 0, width, height)

            const gradH = ctx.createLinearGradient(0, 0, width, 0)
            gradH.addColorStop(0,    'rgba(0,0,0,0.45)')
            gradH.addColorStop(0.55, 'rgba(0,0,0,0.10)')
            gradH.addColorStop(0.70, 'rgba(0,0,0,0)')
            ctx.fillStyle = gradH
            ctx.fillRect(0, 0, width, height)

            ctx.textAlign = 'right'
            ctx.fillStyle = '#ffffff'

            ctx.font = `140px ${fHora}`
            ctx.fillText(hora,   1200, 200)
            ctx.fillText(minuto, 1200, 320)

            ctx.font = `100px ${fHora}`
            ctx.fillText(ampm, 1200, 440)

            ctx.font = `40px ${fHora}`
            ctx.fillStyle = '#e5e5e5'
            ctx.fillText(countryName.toUpperCase(), 1200, 500)

            ctx.textAlign = 'left'
            ctx.fillStyle = '#e5e5e5'
            ctx.font = `32px ${fDato}`
            wrapText(ctx, `"${sabias}"`, 60, height - 240, 800, 40)

            ctx.font = `22px ${fDato}`
            ctx.fillStyle = 'rgba(255,255,255,0.60)'
            ctx.fillText(`${countryName}  ·  ${dia}  ·  ${fecha}`, 60, height - 18)

            const canvasBuffer = await canvas.toBuffer('image/jpeg')

            let totalUsers = 0
            try {
                const dbUsers = await global.db.open('@users')
                totalUsers = Object.keys(dbUsers || {}).length
            } catch {}

            const header = [
                `\`\`\`╭○ ${global.config.name}`,
                `╵ Usuario: ${user}`,
                `╵ Rol: ${role}`,
                `╵ Usuarios: ${totalUsers}`,
                `╵ Comandos: ${total}`,
                `╵ Activo: ${active}`,
                '╰╶╴──────╶╴─╶╴◯```'
            ].join('\n')

            const cats = ['main','grupo','adm','ai','servicio','herramientas','downloader','search','stalk','RPG','fun','anime','gacha','social','nsfw','owner']
            const sections = []
            for (const cat of cats) {
                const body = formatCategoryCommands(inspection.items, cat)
                if (body && body.trim().length > 0)
                    sections.push(`╭  ✦ *${cat.charAt(0).toUpperCase() + cat.slice(1)}*\n${body}\n╰╶╴──────╶╴─╶╴◯`)
            }
            const menuCaption = ['*☲ Menú de Comandos:*', sections.join('\n\n')].join('\n\n')

            const mami = await sock.fakeOrder(m.chat.id, {
                image: await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg'),
                message: 'Powered by Syllkom',
                orderTitle: 'Syllkom Store',
                price: 374,
                currency: 'USD'
            })

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    image: canvasBuffer,
                    body: header,
                    footer: `${global.readMore || ''}\n` + menuCaption,
                    offer: { text: global.config.name, code: 'Syllkom', url: 'https://horekuos.vercel.app' },
                    bottomSheet: { title: `${sabias.substring(0, 774)}..`, buttonTitle: '¿Sabías que?', limit: 1 },
                    buttons: [
                        { type: 'url',    text: 'Mi GitHub',     url: 'https://github.com/Syllkom' },
                        { type: 'copy',   text: 'Copiar dato',   payload: `${sabias}` },
                        { type: 'url',    text: 'Documentación', url: 'https://horekuos.vercel.app/docs' },
                        { type: 'galaxy', text: '© 2020–2030 Syllkom. All rights reserved.', flowId: '1307913409923914' }
                    ]
                }
            }, { quoted: mami })

            await m.react('done')
        } catch (e) {
            console.error('Menu Error:', e)
            await m.react('error')
            return m.reply('ⓘ No se pudo generar el menú en este momento.')
        }
    }
}