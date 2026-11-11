// ./plugins/main/menu.plugin.js
import path from 'path'
import fs from 'fs'
import got from 'got'
import moment from 'moment-timezone'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { Canvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { countTotalCommands, inspectPlugins } from '../../library/pluginInspector.js'

const QUOTED_THUMBNAIL_URL = 'https://files.catbox.moe/4j9qrv.png'

const CACHE_TTL_PLUGINS = 1000 * 60 * 2
const CACHE_TTL_DATA = 1000 * 60 * 15
const CACHE_TTL_USERS = 1000 * 60 * 2

let cachedInspection = null
let cachedMenuCaption = ''
let lastInspectionTime = 0

let cachedSabiasList = []
let lastSabiasTime = 0

let cachedTotalUsers = 0
let lastUsersTime = 0

const imageBufferCache = new Map()
let cachedQuotedThumb = null

const getImageBuffer = async (url) => {
    if (imageBufferCache.has(url)) return imageBufferCache.get(url)
    try {
        const buf = await got(url, { timeout: { request: 3000 } }).buffer()
        if (buf && buf.length) {
            imageBufferCache.set(url, buf)
            return buf
        }
    } catch {}
    return null
}

async function getQuotedThumbBuffer() {
    if (cachedQuotedThumb) return cachedQuotedThumb
    try {
        const buf = await getImageBuffer(QUOTED_THUMBNAIL_URL)
        if (buf && buf.length) {
            const img = await loadImage(buf)
            const canvas = new Canvas(150, 150)
            const ctx = canvas.getContext('2d')
            const scale = Math.max(150 / img.width, 150 / img.height)
            const x = (150 - img.width * scale) / 2
            const y = (150 - img.height * scale) / 2
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
            cachedQuotedThumb = await canvas.toBuffer('image/jpeg', 70)
            return cachedQuotedThumb
        }
    } catch {}
    return Buffer.alloc(0)
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
                const fontData = await got(f.url, { timeout: { request: 5000 } }).buffer()
                fs.writeFileSync(fPath, fontData)
            }
            GlobalFonts.registerFromPath(fPath, f.name)
        }
        fontsLoaded = true
    } catch (e) {
        console.error('Error cargando fuentes:', e.message)
    }
    return fontsLoaded
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

const IMAGES = [
    'https://files.catbox.moe/2x9g3s.jpg', 'https://files.catbox.moe/iuvlth.jpg',
    'https://files.catbox.moe/61rvv3.jpg', 'https://files.catbox.moe/0vcje1.jpg',
    'https://files.catbox.moe/iayvfu.jpeg', 'https://files.catbox.moe/d6neg0.jpeg',
    'https://files.catbox.moe/xkmhx1.jpg', 'https://files.catbox.moe/d3kcpp.jpg',
    'https://files.catbox.moe/o72kmv.jpg', 'https://files.catbox.moe/ag5vyc.jpg',
    'https://files.catbox.moe/htfn57.jpg', 'https://files.catbox.moe/8wxhia.jpg',
    'https://files.catbox.moe/tau165.jpg'
]

const DEFAULT_IMAGE = 'https://files.catbox.moe/obz4b4.jpg'
const CATEGORIES = ['main','grupo','adm','ai','servicio','herramientas','downloader','search','stalk','RPG','funny','anime','gacha','social','nsfw','owner']

export default {
    command: true, usePrefix: true,
    case: ['menu', 'help'],
    description: 'Muestra el menú principal interactivo del bot.',
    category: 'main',
    usage: 'menu',
    script: async (m, { sock }) => {
        try {
            m.react('wait').catch(() => {})
            const nowMs = Date.now()

            if (!cachedInspection || nowMs - lastInspectionTime > CACHE_TTL_PLUGINS) {
                const pluginsDir = path.join(process.cwd(), 'plugins')
                const inspection = await inspectPlugins(pluginsDir, { includeNonPrefixed: true })
                const totalCmds = countTotalCommands(inspection.items)

                const sections = []
                for (const cat of CATEGORIES) {
                    const body = formatCategoryCommands(inspection.items, cat)
                    if (body && body.trim().length > 0) {
                        sections.push(`╭  ✦ *${cat.charAt(0).toUpperCase() + cat.slice(1)}*\n${body}\n╰╶╴──────╶╴─╶╴◯`)
                    }
                }

                cachedMenuCaption = ['*☲ Menú de Comandos:*', sections.join('\n\n')].join('\n\n')
                cachedInspection = { total: totalCmds }
                lastInspectionTime = nowMs
            }
            const total = cachedInspection.total

            const user = m.sender?.name || m.sender?.number || 'Usuario'
            const role = m.sender.role('root') ? 'Root' : m.sender.role('owner') ? 'Owner' : m.sender.role('admin') ? 'Admin' : 'Usuario'
            const active = formatActiveTime(process.uptime())

            if (!cachedSabiasList.length || nowMs - lastSabiasTime > CACHE_TTL_DATA) {
                try {
                    const res = await got('https://github.com/Syllkom/MyArchive/raw/refs/heads/main/main/datos.json', { responseType: 'json', timeout: { request: 2500 } }).json()
                    if (Array.isArray(res?.vos_sabiasq)) {
                        cachedSabiasList = res.vos_sabiasq
                        lastSabiasTime = nowMs
                    }
                } catch {}
            }
            const sabias = cachedSabiasList.length
                ? String(cachedSabiasList[Math.floor(Math.random() * cachedSabiasList.length)] || '').trim()
                : 'Aethero Advanced Engine'

            const { timeZone, countryName } = getUserLocation(m.sender?.number)
            const nowTime = moment().tz(timeZone)
            const hora = nowTime.format('hh')
            const minuto = nowTime.format('mm')
            const ampm = nowTime.format('A')
            const dia = nowTime.format('dddd')
            const fecha = nowTime.format('DD/MM/YYYY')

            await loadFonts()
            const fHora = fontsLoaded ? 'RalewayExtraBold, sans-serif' : 'sans-serif'
            const fDato = fontsLoaded ? 'MontserratItalic, sans-serif' : 'sans-serif'

            const width = 960
            const height = 540
            const canvas = new Canvas(width, height)
            const ctx = canvas.getContext('2d')

            const randomUrl = IMAGES[Math.floor(Math.random() * IMAGES.length)]
            const bgBuffer = await getImageBuffer(randomUrl) || await getImageBuffer(DEFAULT_IMAGE)
            const bg = await loadImage(bgBuffer)

            const scale = Math.max(width / bg.width, height / bg.height)
            const bx = (width / 2) - (bg.width / 2) * scale
            const by = (height / 2) - (bg.height / 2) * scale
            ctx.drawImage(bg, bx, by, bg.width * scale, bg.height * scale)

            const gradV = ctx.createLinearGradient(0, height, 0, 0)
            gradV.addColorStop(0, 'rgba(0,0,0,0.92)')
            gradV.addColorStop(0.38, 'rgba(0,0,0,0.60)')
            gradV.addColorStop(0.55, 'rgba(0,0,0,0.10)')
            gradV.addColorStop(0.65, 'rgba(0,0,0,0)')
            ctx.fillStyle = gradV
            ctx.fillRect(0, 0, width, height)

            const gradH = ctx.createLinearGradient(0, 0, width, 0)
            gradH.addColorStop(0, 'rgba(0,0,0,0.45)')
            gradH.addColorStop(0.55, 'rgba(0,0,0,0.10)')
            gradH.addColorStop(0.70, 'rgba(0,0,0,0)')
            ctx.fillStyle = gradH
            ctx.fillRect(0, 0, width, height)

            ctx.textAlign = 'right'
            ctx.fillStyle = '#ffffff'
            ctx.font = `105px ${fHora}`
            ctx.fillText(hora, 900, 150)
            ctx.fillText(minuto, 900, 240)

            ctx.font = `75px ${fHora}`
            ctx.fillText(ampm, 900, 330)

            ctx.font = `30px ${fHora}`
            ctx.fillStyle = '#e5e5e5'
            ctx.fillText(countryName.toUpperCase(), 900, 375)

            ctx.textAlign = 'left'
            ctx.fillStyle = '#e5e5e5'
            ctx.font = `24px ${fDato}`
            wrapText(ctx, `"${sabias}"`, 45, height - 180, 600, 30)

            ctx.font = `16px ${fDato}`
            ctx.fillStyle = 'rgba(255,255,255,0.60)'
            ctx.fillText(`${countryName}  ·  ${dia}  ·  ${fecha}`, 45, height - 14)

            const canvasBuffer = await canvas.toBuffer('image/jpeg', 75)

            if (!cachedTotalUsers || nowMs - lastUsersTime > CACHE_TTL_USERS) {
                try {
                    const dbUsers = await global.db.open('@users')
                    cachedTotalUsers = Object.keys(dbUsers || {}).length
                    lastUsersTime = nowMs
                } catch {}
            }
            const totalUsers = cachedTotalUsers

            const header = [
                `\`\`\`╭○ ${global.config.name}`,
                `╵ Usuario: ${user}`,
                `╵ Rol: ${role}`,
                `╵ Usuarios: ${totalUsers}`,
                `╵ Comandos: ${total}`,
                `╵ Activo: ${active}`,
                '╰╶╴──────╶╴─╶╴◯```'
            ].join('\n')

            const rawId = sock.user?.id || ''
            const botNum = rawId.split('@')[0].split(':')[0]
            const botJid = botNum ? `${botNum}@s.whatsapp.net` : '0@s.whatsapp.net'
            const thumbBuffer = await getQuotedThumbBuffer()

            const mami = {
                key: {
                    remoteJid: m.chat.id,
                    fromMe: false,
                    id: 'HK_QUOTE_' + Date.now().toString(36),
                    participant: botJid
                },
                message: {
                    orderMessage: {
                        orderId: 'HK_V3',
                        thumbnail: thumbBuffer,
                        itemCount: 374,
                        status: 1,
                        surface: 1,
                        message: 'Powered by Syllkom',
                        orderTitle: 'Syllkom Store',
                        sellerJid: botJid,
                        totalAmount1000: 374000,
                        totalCurrencyCode: 'USD'
                    }
                }
            }

            await sock.sendMessage(m.chat.id, {
                mediaMenu: {
                    image: canvasBuffer,
                    body: header,
                    footer: `${global.readMore || ''}\n` + cachedMenuCaption,
                    offer: { text: global.config.name, code: 'Syllkom', url: 'https://horekuos.vercel.app' },
                    bottomSheet: { title: `${sabias.substring(0, 774)}..`, buttonTitle: '¿Sabías que?', limit: 1 },
                    buttons: [
                        { type: 'url', text: 'Mi GitHub', url: 'https://github.com/Syllkom' },
                        { type: 'copy', text: 'Copiar dato', payload: `${sabias}` },
                        { type: 'url', text: 'Documentación', url: 'https://horekuos.vercel.app/docs' },
                        { type: 'galaxy', text: '© 2020–2030 Syllkom. All rights reserved.', flowId: '1307913409923914' }
                    ]
                }
            }, { quoted: mami })

            m.react('done').catch(() => {})
        } catch (e) {
            console.error('Menu Error:', e)
            m.react('error').catch(() => {})
            return m.reply('ⓘ No se pudo generar el menú en este momento.')
        }
    }
}