// ./plugins/main/stubtype.plugin.js
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import moment from 'moment-timezone'
import { Canvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import axios from 'axios'
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
        { name: 'NotoSansBold', url: global.font.NotoSans.Bold, file: 'NotoSans-Bold.ttf' },
        { name: 'AntonRegular', url: global.font.Anton.Regular, file: 'Anton-Regular.ttf' },
        { name: 'NunitoSans', url: global.font.NunitoSans.Bold, file: 'NunitoSans-Bold.ttf' }
    ]

    try {
        for (const f of fontsToLoad) {
            const fontPath = path.join(tempDir, f.file)
            if (!fs.existsSync(fontPath)) {
                const res = await axios.get(f.url, { responseType: 'arraybuffer' })
                fs.writeFileSync(fontPath, res.data)
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
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 })
        if (res.status !== 200) return null
        return res.data
    } catch { return null }
}

const FALLBACK_IMG = 'https://files.catbox.moe/obz4b4.jpg'
const eventQueue = new Map()

async function renderAndSendIndividual(user, isWelcome, m, sock, settings, metadata) {
    const { timeZone, countryName } = getUserLocation(user)
    const date = moment().tz(timeZone).format('DD/MM/YYYY hh:mm A')
    
    const [userPpUrl, groupPpUrl] = await Promise.all([
        sock.profilePictureUrl(user, 'image').catch(() => FALLBACK_IMG),
        sock.profilePictureUrl(m.chat.id, 'image').catch(() => FALLBACK_IMG)
    ])

    const [userBuff, groupBuff] = await Promise.all([
        downloadImg(userPpUrl),
        downloadImg(groupPpUrl)
    ])

    await initFonts()
    const fontMain = fontsLoaded ? 'NunitoSans, sans-serif' : 'sans-serif'
    const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'
    
    const width = 1200, height = 500
    const canvas = new Canvas(width, height)
    const ctx = canvas.getContext('2d')

    const themeColor = isWelcome ? '#10b981' : '#f43f5e'
    const sysStatus = isWelcome ? 'CONNECTION_ESTABLISHED' : 'CONNECTION_TERMINATED'
    const watermark = isWelcome ? 'INBOUND' : 'OUTBOUND'

    ctx.fillStyle = '#050505'
    ctx.fillRect(0, 0, width, height)

    if (groupBuff) {
        try {
            const gImg = await loadImage(groupBuff)
            ctx.save()
            ctx.globalAlpha = 0.15
            ctx.beginPath()
            ctx.moveTo(700, 0)
            ctx.lineTo(1200, 0)
            ctx.lineTo(1200, 500)
            ctx.lineTo(450, 500)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(gImg, 400, -150, 800, 800)
            ctx.restore()
        } catch (e) {}
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.lineWidth = 1
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, height)
        ctx.stroke()
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(width, i)
        ctx.stroke()
    }

    ctx.save()
    ctx.font = `bold 200px ${fontTitle}`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)'
    ctx.fillText(watermark, 50, 360)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 2
    ctx.strokeText(watermark, 50, 360)
    ctx.restore()

    ctx.fillStyle = themeColor
    ctx.fillRect(0, 0, 12, height)
    ctx.fillRect(0, 0, 250, 12)

    const ax = 220, ay = 250, aSize = 130
    
    ctx.strokeStyle = '#27272a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(ax, ay, aSize + 40, 0, Math.PI * 2)
    ctx.stroke()
    
    ctx.strokeStyle = themeColor
    ctx.setLineDash([15, 10])
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(ax, ay, aSize + 20, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([]) 

    ctx.strokeStyle = themeColor
    ctx.lineWidth = 2
    const drawCross = (cx, cy) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy - 15)
        ctx.lineTo(cx, cy + 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - 15, cy)
        ctx.lineTo(cx + 15, cy)
        ctx.stroke()
    }
    drawCross(ax, ay - aSize - 40)
    drawCross(ax, ay + aSize + 40)
    drawCross(ax - aSize - 40, ay)
    drawCross(ax + aSize + 40, ay)

    try {
        const uBuffToUse = userBuff || await downloadImg(FALLBACK_IMG)
        if (uBuffToUse) {
            const uImg = await loadImage(uBuffToUse)
            ctx.save()
            ctx.beginPath()
            ctx.arc(ax, ay, aSize, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(uImg, ax - aSize, ay - aSize, aSize * 2, aSize * 2)
            ctx.restore()
        }
    } catch (e) {}

    ctx.fillStyle = themeColor
    ctx.font = `18px monospace`
    ctx.fillText(`// SYS.PROTOCOL.${sysStatus}`, 440, 120)

    const userNameText = user.split('@')[0]
    ctx.fillStyle = '#ffffff'
    ctx.font = `75px ${fontTitle}`
    ctx.fillText(userNameText.substring(0, 15).toUpperCase(), 435, 195)

    const drawTechBox = (x, y, w, h, label, val) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = '#27272a'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, w, h)
        
        ctx.fillStyle = themeColor
        ctx.fillRect(x, y, 12, 12) 

        ctx.fillStyle = '#71717a'
        ctx.font = `18px monospace`
        ctx.fillText(label, x + 25, y + 35)

        ctx.fillStyle = '#ffffff'
        ctx.font = `28px ${fontMain}`
        ctx.fillText(val, x + 25, y + 75)
    }

    drawTechBox(440, 240, 380, 100, 'DESTINATION', metadata.subject.substring(0, 22))
    drawTechBox(840, 240, 240, 100, 'MEMBER_ID', `#${metadata.participants.length}`)
    drawTechBox(440, 360, 280, 100, 'ORIGIN_REGION', countryName.substring(0, 16))

    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) {
        let bw = Math.random() * 4 + 1
        ctx.fillRect(750 + (i * 8), 380, bw, 50)
    }
    ctx.font = '14px monospace'
    ctx.fillStyle = '#71717a'
    ctx.fillText(`UID_${userNameText}_X`, 750, 450)

    const bannerBuffer = await canvas.toBuffer('image/jpeg')

    let txt = ''
    const nameFormat = `@${userNameText}`
    
    if (isWelcome) {
        const defaultWelcome = `*Bienvenido(a)*\n\n ✿ Usuario: {user}\n 𖦹 Grupo: {group}\n ⚲ Región: {country}\n ⌗ Identificador: #{count}\n 𝄜 Fecha: {date}\n\nHola {user}, bienvenido al grupo.`
        txt = settings.welcomeText || defaultWelcome
    } else {
        const defaultBye = `*Adiós*\n\n✿ Usuario: {user}\n 𖦹 Grupo: {group}\n ⚲ Región: {country}\n ⌗ Identificador: #{count}\n 𝄜 Salida: {date}\n\n{user} ha dejado el grupo.`
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