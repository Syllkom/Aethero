// ./plugins/main/stubtype.plugin.js
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import moment from 'moment-timezone'
import { Canvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

global.TIMEZONES = { 'AF': 'Asia/Kabul', 'AL': 'Europe/Tirane', 'DZ': 'Africa/Algiers', 'AD': 'Europe/Andorra', 'AO': 'Africa/Luanda', 'AR': 'America/Argentina/Buenos_Aires', 'AM': 'Asia/Yerevan', 'AU': 'Australia/Sydney', 'AT': 'Europe/Vienna', 'AZ': 'Asia/Baku', 'BH': 'Asia/Bahrain', 'BD': 'Asia/Dhaka', 'BY': 'Europe/Minsk', 'BE': 'Europe/Brussels', 'BZ': 'America/Belize', 'BJ': 'Africa/Porto-Novo', 'BO': 'America/La_Paz', 'BR': 'America/Sao_Paulo', 'BG': 'Europe/Sofia', 'CA': 'America/Toronto', 'CL': 'America/Santiago', 'CN': 'Asia/Shanghai', 'CO': 'America/Bogota', 'CR': 'America/Costa_Rica', 'CU': 'America/Havana', 'CY': 'Asia/Nicosia', 'CZ': 'Europe/Prague', 'DK': 'Europe/Copenhagen', 'DO': 'America/Santo_Domingo', 'EC': 'America/Guayaquil', 'EG': 'Africa/Cairo', 'SV': 'America/El_Salvador', 'EE': 'Europe/Tallinn', 'FI': 'Europe/Helsinki', 'FR': 'Europe/Paris', 'DE': 'Europe/Berlin', 'GR': 'Europe/Athens', 'GT': 'America/Guatemala', 'HN': 'America/Tegucigalpa', 'HK': 'Asia/Hong_Kong', 'HU': 'Europe/Budapest', 'IS': 'Atlantic/Reykjavik', 'IN': 'Asia/Kolkata', 'ID': 'Asia/Jakarta', 'IR': 'Asia/Tehran', 'IQ': 'Asia/Baghdad', 'IE': 'Europe/Dublin', 'IL': 'Asia/Jerusalem', 'IT': 'Europe/Rome', 'JP': 'Asia/Tokyo', 'KZ': 'Asia/Almaty', 'KE': 'Africa/Nairobi', 'KR': 'Asia/Seoul', 'KW': 'Asia/Kuwait', 'LV': 'Europe/Riga', 'LB': 'Asia/Beirut', 'LY': 'Africa/Tripoli', 'LT': 'Europe/Vilnius', 'LU': 'Europe/Luxembourg', 'MY': 'Asia/Kuala_Lumpur', 'MX': 'America/Mexico_City', 'MA': 'Africa/Casablanca', 'NL': 'Europe/Amsterdam', 'NZ': 'Pacific/Auckland', 'NI': 'America/Managua', 'NG': 'Africa/Lagos', 'NO': 'Europe/Oslo', 'PK': 'Asia/Karachi', 'PA': 'America/Panama', 'PY': 'America/Asuncion', 'PE': 'America/Lima', 'PH': 'Asia/Manila', 'PL': 'Europe/Warsaw', 'PT': 'Europe/Lisbon', 'PR': 'America/Puerto_Rico', 'QA': 'Asia/Qatar', 'RO': 'Europe/Bucharest', 'RU': 'Europe/Moscow', 'SA': 'Asia/Riyadh', 'SN': 'Africa/Dakar', 'RS': 'Europe/Belgrade', 'SG': 'Asia/Singapore', 'ZA': 'Africa/Johannesburg', 'ES': 'Europe/Madrid', 'SE': 'Europe/Stockholm', 'CH': 'Europe/Zurich', 'TH': 'Asia/Bangkok', 'TN': 'Africa/Tunis', 'TR': 'Europe/Istanbul', 'UA': 'Europe/Kyiv', 'AE': 'Asia/Dubai', 'GB': 'Europe/London', 'US': 'America/New_York', 'UY': 'America/Montevideo', 'VE': 'America/Caracas', 'VN': 'Asia/Ho_Chi_Minh', 'YE': 'Asia/Aden', 'ZW': 'Africa/Harare' }

const LATAM_PREFIXES = [
    '51', '52', '54', '55', '56', '57', '58', 
    '591', '593', '595', '598',               
    '501', '502', '503', '504', '505', '506', '507', 
    '53', '1787', '1939', '1809', '1829', '1849'     
]

function getUserLocation(jid) {
    try {
        const number = '+' + jid.split('@')[0]
        const phoneNumber = parsePhoneNumberFromString(number)
        const countryCode = phoneNumber ? phoneNumber.country : null
        const timeZone = (global.TIMEZONES && countryCode && global.TIMEZONES[countryCode])
            ? global.TIMEZONES[countryCode]
            : Intl.DateTimeFormat().resolvedOptions().timeZone
        
        let countryName = 'Desconocido'
        if (countryCode) {
            const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })
            countryName = regionNames.of(countryCode)
        }
        return { timeZone, countryName }
    } catch {
        return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, countryName: 'Desconocido' }
    }
}

let fontsLoaded = false
async function initFonts() {
    if (fontsLoaded) return true
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const fontsToLoad = [
        { name: 'NotoSansBold', url: global.font?.NotoSans?.Bold, file: 'NotoSans-Bold.ttf' },
        { name: 'AntonRegular', url: global.font?.Anton?.Regular, file: 'Anton-Regular.ttf' },
        { name: 'NunitoSans', url: global.font?.NunitoSans?.Bold, file: 'NunitoSans-Bold.ttf' }
    ]

    try {
        for (const f of fontsToLoad) {
            if (!f.url) continue
            const fontPath = path.join(tempDir, f.file)
            if (!fs.existsSync(fontPath)) {
                const fontData = await got(f.url, { timeout: { request: 10000 } }).buffer()
                fs.writeFileSync(fontPath, fontData)
            }
            if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, f.name)
        }
        fontsLoaded = true
        return true
    } catch (e) {
        console.error('Font Error:', e)
        return false
    }
}

const downloadImg = async (url) => {
    try {
        return await got(url, { timeout: { request: 5000 } }).buffer()
    } catch { return null }
}

const roundRect = (ctx, x, y, w, h, r) => {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

const drawHudCorners = (ctx, x, y, w, h, color = '#d8b4fe', offset = 7, len = 22, thickness = 2.5) => {
    ctx.strokeStyle = color
    ctx.lineWidth = thickness
    ctx.beginPath()

    // Top-Left
    ctx.moveTo(x - offset, y - offset + len)
    ctx.lineTo(x - offset, y - offset)
    ctx.lineTo(x - offset + len, y - offset)

    // Top-Right
    ctx.moveTo(x + w + offset - len, y - offset)
    ctx.lineTo(x + w + offset, y - offset)
    ctx.lineTo(x + w + offset, y - offset + len)

    // Bottom-Left
    ctx.moveTo(x - offset, y + h + offset - len)
    ctx.lineTo(x - offset, y + h + offset)
    ctx.lineTo(x - offset + len, y + h + offset)

    // Bottom-Right
    ctx.moveTo(x + w + offset - len, y + h + offset)
    ctx.lineTo(x + w + offset, y + h + offset)
    ctx.lineTo(x + w + offset, y + h + offset - len)

    ctx.stroke()
}

const FALLBACK_IMG = 'https://files.catbox.moe/obz4b4.jpg'
const eventQueue = new Map()

async function renderAndSendIndividual(user, isWelcome, m, sock, settings, metadata) {
    const { timeZone, countryName } = getUserLocation(user)
    const date = moment().tz(timeZone).format('DD/MM/YYYY · HH:mm')
    
    const [userPpUrl, groupPpUrl] = await Promise.all([
        sock.profilePictureUrl(user, 'image').catch(() => FALLBACK_IMG),
        sock.profilePictureUrl(m.chat.id, 'image').catch(() => FALLBACK_IMG)
    ])

    const [userBuff, groupBuff] = await Promise.all([
        downloadImg(userPpUrl),
        downloadImg(groupPpUrl)
    ])

    await initFonts()
    const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'
    const fontMono = 'monospace'
    
    const width = 1200, height = 520
    const canvas = new Canvas(width, height)
    const ctx = canvas.getContext('2d')

    const C_BG = '#050409'
    const C_CARD = '#0d0b17'
    const A1 = isWelcome ? '#a855f7' : '#94a3b8'
    const A2 = isWelcome ? '#d8b4fe' : '#cbd5e1'
    const A3 = '#94a3b8'
    const A4 = '#e2e8f0'
    const C_LINE = 'rgba(148, 163, 184, 0.16)'

    ctx.fillStyle = C_BG
    ctx.fillRect(0, 0, width, height)

    const cardX = 30, cardY = 30, cardW = width - 60, cardH = height - 60
    
    ctx.save()
    roundRect(ctx, cardX, cardY, cardW, cardH, 18)
    ctx.fillStyle = C_CARD
    ctx.fill()
    ctx.strokeStyle = C_LINE
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.clip()

    const glowX = isWelcome ? cardX + 180 : cardX + cardW - 180
    const radGrad = ctx.createRadialGradient(glowX, cardY + 120, 20, glowX, cardY + 120, 500)
    radGrad.addColorStop(0, isWelcome ? 'rgba(168, 85, 247, 0.16)' : 'rgba(148, 163, 184, 0.12)')
    radGrad.addColorStop(0.55, isWelcome ? 'rgba(168, 85, 247, 0.03)' : 'rgba(148, 163, 184, 0.02)')
    radGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = radGrad
    ctx.fillRect(cardX, cardY, cardW, cardH)

    ctx.fillStyle = isWelcome ? 'rgba(168, 85, 247, 0.035)' : 'rgba(148, 163, 184, 0.04)'
    ctx.font = `bold 180px ${fontTitle}`
    if (isWelcome) {
        ctx.textAlign = 'left'
        ctx.fillText('WELCOME', cardX - 5, cardY + cardH + 20)
    } else {
        ctx.textAlign = 'right'
        ctx.fillText('BYE', cardX + cardW + 10, cardY + cardH + 20)
    }
    ctx.restore()

    const avX = 75, avY = 80, avSize = 220

    ctx.save()
    roundRect(ctx, avX, avY, avSize, avSize, 12)
    ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.clip()

    if (userBuff) {
        try {
            const uImg = await loadImage(userBuff)
            ctx.drawImage(uImg, avX, avY, avSize, avSize)
        } catch(e) {}
    }
    ctx.restore()

    drawHudCorners(ctx, avX, avY, avSize, avSize, A2, 7, 22, 2.5)

    const badgeX = avX + avSize - 2
    const badgeY = avY + avSize - 2
    const badgeR = 34

    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeR + 4, 0, Math.PI * 2)
    ctx.fillStyle = C_CARD
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
    ctx.clip()
    if (groupBuff) {
        try {
            const gImg = await loadImage(groupBuff)
            ctx.drawImage(gImg, badgeX - badgeR, badgeY - badgeR, badgeR * 2, badgeR * 2)
        } catch(e) {
            ctx.fillStyle = '#1b1730'
            ctx.fillRect(badgeX - badgeR, badgeY - badgeR, badgeR * 2, badgeR * 2)
        }
    } else {
        ctx.fillStyle = '#1b1730'
        ctx.fillRect(badgeX - badgeR, badgeY - badgeR, badgeR * 2, badgeR * 2)
    }
    ctx.restore()

    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
    ctx.strokeStyle = A1
    ctx.lineWidth = 2
    ctx.stroke()

    const rawGroupName = metadata.subject || 'Grupo'
    const groupName = rawGroupName.length > 20 ? rawGroupName.substring(0, 18) + '...' : rawGroupName
    ctx.font = `14px ${fontMono}`
    ctx.textAlign = 'left'
    ctx.fillStyle = A3
    ctx.fillText('GRUPO ⌁ ', avX, avY + avSize + 48)
    const tagW = ctx.measureText('GRUPO ⌁ ').width
    ctx.fillStyle = A2
    ctx.font = `bold 14px ${fontMono}`
    ctx.fillText(groupName, avX + tagW, avY + avSize + 48)

    const rX = 355, rY = 85
    const rightW = width - rX - 75

    ctx.fillStyle = A1
    ctx.fillRect(rX, rY + 8, 22, 2)
    ctx.font = `bold 13px ${fontMono}`
    ctx.fillText(isWelcome ? 'NUEVO MIEMBRO' : 'MIEMBRO SE RETIRÓ', rX + 32, rY + 14)

    ctx.save()
    ctx.font = `bold 54px ${fontTitle}`
    ctx.textAlign = 'left'
    const titleTxt = isWelcome ? '¡BIENVENID@!' : 'HASTA PRONTO'
    
    const titleGrad = ctx.createLinearGradient(rX, 0, rX + ctx.measureText(titleTxt).width, 0)
    titleGrad.addColorStop(0, '#ffffff')
    titleGrad.addColorStop(0.55, A2)
    titleGrad.addColorStop(1, A1)
    ctx.fillStyle = titleGrad
    ctx.fillText(titleTxt, rX, rY + 70)
    ctx.restore()

    const userNameText = user.split('@')[0]
    ctx.font = `bold 26px ${fontTitle}`
    ctx.fillStyle = A4
    ctx.fillText(userNameText, rX, rY + 110)
    const uNameW = ctx.measureText(userNameText).width

    ctx.fillStyle = A2
    ctx.font = `18px ${fontMono}`
    ctx.fillText(` @${userNameText}`, rX + uNameW + 8, rY + 108)

    ctx.font = `14px ${fontMono}`
    ctx.fillStyle = A3
    const subtitleTxt = isWelcome 
        ? '// Lee las reglas del grupo con .reglas antes de participar'
        : '// Gracias por haber sido parte de la aventura'
    ctx.fillText(subtitleTxt, rX, rY + 148)

    const statBoxY = rY + 175
    const statBoxW = 240, statBoxH = 75

    ctx.save()
    roundRect(ctx, rX, statBoxY, statBoxW, statBoxH, 8)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
    ctx.fill()
    ctx.strokeStyle = C_LINE
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = A1
    roundRect(ctx, rX + 2, statBoxY + 8, 3.5, statBoxH - 16, 2)
    ctx.fill()

    ctx.fillStyle = A3
    ctx.font = `11px ${fontMono}`
    ctx.fillText(isWelcome ? 'POSICIÓN' : 'QUEDAN', rX + 16, statBoxY + 26)

    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 26px ${fontTitle}`
    const statValTxt = isWelcome ? `#${metadata.participants.length}` : `${metadata.participants.length} miembros`
    ctx.fillText(statValTxt, rX + 16, statBoxY + 60)
    ctx.restore()

    const footY = height - 50
    ctx.font = `12px ${fontMono}`
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.fillText(`${date} · ${countryName}`, cardX + 24, footY)

    ctx.textAlign = 'right'
    ctx.fillText('Aethero Advanced Engine', cardX + cardW - 24, footY)
    ctx.textAlign = 'left'

    const bannerBuffer = await canvas.toBuffer('image/jpeg')

    let txt = ''
    const nameFormat = `@${userNameText}`
    
    if (isWelcome) {
        const defaultWelcome = [
            '— *Bienvenido(a)!* ๑ 🌸 ୧',
            '╭✰ Usuario: {user}',
            '﹕✤ Grupo: {group}',
            '﹕⚲ Región: {country}',
            '﹕⌗ Identificador: #{count}',
            '╰𝄜 Fecha: {date}',
            '',
            '👋🏻 Hola {user}, bienvenido al grupo.'
       ].join('\n')
       txt = settings.welcomeText || defaultWelcome
    } else {
        const defaultBye = [
            '— *Adiós!* ๑ 👋 ୧',
            '╭✰ Usuario: {user}',
            '﹕✤ Grupo: {group}',
            '﹕⚲ Región: {country}',
            '﹕⌗ Identificador: #{count}',
            '╰𝄜 Salida: {date}',
            '',
            '🛫 {user} ha dejado el grupo.'
       ].join('\n')
       txt = settings.byeText || defaultBye
    }

    txt = txt.replace(/{user}/g, nameFormat)
             .replace(/{group}/g, metadata.subject)
             .replace(/{country}/g, countryName)
             .replace(/{count}/g, metadata.participants.length)
             .replace(/{date}/g, date)
             .replace(/{desc}/g, metadata.desc?.toString() || '')

    await sock.sendMessage(m.chat.id, { 
        image: bannerBuffer, 
        caption: txt, 
        mentions: [user] 
    })
}

export default {
    stubtype: true,
    case: [
        'GROUP_PARTICIPANT_ADD', 
        'GROUP_PARTICIPANT_LEAVE', 
        'GROUP_PARTICIPANT_REMOVE', 
        'GROUP_PARTICIPANT_INVITE',
        'GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD'
    ],
    script: async (m, { sock, parameters, even }) => {
        const db = await global.db.open(`@chat:${m.chat.id}`)
        const settings = db.settings || {}

        if (settings.sololatam) {
            let userJid = ''
            if (even === 'GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD') {
                userJid = parameters[0]?.pn || parameters[0] 
            } else if (even === 'GROUP_PARTICIPANT_ADD') {
                userJid = parameters[0]
            }

            if (userJid && typeof userJid === 'string') {
                const number = userJid.split('@')[0]
                const isLatam = LATAM_PREFIXES.some(prefix => number.startsWith(prefix))

                if (even === 'GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD') {
                    if (isLatam) {
                        await sock.groupRequestParticipantsUpdate(m.chat.id, [userJid], 'approve')
                    } else {
                        await sock.groupRequestParticipantsUpdate(m.chat.id, [userJid], 'reject')
                        return
                    }
                } else if (even === 'GROUP_PARTICIPANT_ADD' && !isLatam) {
                    await sock.groupParticipantsUpdate(m.chat.id, [userJid], 'remove')
                    return
                }
            }
        }

        if (even === 'GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD') return

        const isWelcome = (even === 'GROUP_PARTICIPANT_ADD' || even === 'GROUP_PARTICIPANT_INVITE')
        
        if (isWelcome && !settings.welcome) return
        if (!isWelcome && !settings.bye) return

        const qKey = `${m.chat.id}_${isWelcome ? 'in' : 'out'}`

        if (!eventQueue.has(qKey)) {
            eventQueue.set(qKey, { users: new Set(), timer: null, m: m })
        }

        const q = eventQueue.get(qKey)
        q.m = m

        parameters.forEach(p => {
            const u = p?.phoneNumber || p
            if (typeof u === 'string') q.users.add(u)
        })

        if (q.timer) clearTimeout(q.timer)

        q.timer = setTimeout(async () => {
            const usersList = Array.from(q.users)
            const lastM = q.m
            eventQueue.delete(qKey)

            if (usersList.length === 0) return

            const metadata = await sock.groupMetadata(lastM.chat.id)

            if (usersList.length >= 4) {
                let txt = `▢ *${isWelcome ? 'INGRESO' : 'SALIDA'} MASIVA DETECTADA*\n\n`
                
                usersList.forEach(u => {
                    const { timeZone, countryName } = getUserLocation(u)
                    const time = moment().tz(timeZone).format('hh:mm A')
                    txt += `- @${u.split('@')[0]} (${countryName}) ${time}\n`
                })

                const globalDate = moment().tz(Intl.DateTimeFormat().resolvedOptions().timeZone).format('DD/MM/YYYY')
                txt += `\n${isWelcome ? '[+] Bienvenidos a' : '[-] Salieron de'} ${metadata.subject}, ${globalDate}`

                await sock.sendMessage(lastM.chat.id, {
                    text: txt,
                    mentions: usersList
                })
            } 
            else {
                for (const u of usersList) {
                    await renderAndSendIndividual(u, isWelcome, lastM, sock, settings, metadata)
                    await new Promise(resolve => setTimeout(resolve, 800))
                }
            }
        }, 2000)
    }
}