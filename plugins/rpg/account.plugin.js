// ./plugins/rpg/account.plugin.js
import moment from 'moment-timezone'
import got from 'got'
import fs from 'fs'
import path from 'path'
import { Canvas, Image, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

const downloadImg = async (url) => {
    try {
        return await got(url, { timeout: { request: 5000 } }).buffer()
    } catch { return null }
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
            if (!fs.existsSync(fontPath) || fs.statSync(fontPath).size < 1000) {
                const fontBuff = await downloadImg(f.url)
                if (fontBuff) fs.writeFileSync(fontPath, fontBuff)
            }
            if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, f.name)
        }
        fontsLoaded = true
        return true
    } catch (e) {
        console.error("Font Error:", e)
        return false
    }
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

const drawHudCorners = (ctx, x, y, w, h, color = '#d8b4fe', offset = 8, len = 26, thickness = 3) => {
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

export default {
    command: true, usePrefix: true, 
    case: ['reg', 'perfil', 'autolvl', 'lvl', 'levelup', 'sethobby', 'setbirth', 'setgender'], 
    description: 'Gestión de cuenta RPG: registro, perfil visual en Canvas, auto-level y personalización.',
    category: 'RPG',
    usage: ['reg', 'perfil', 'autolvl', 'lvl', 'levelup', 'sethobby', 'setbirth', 'setgender'],
    script: async (m, { sock, plugin }) => {
        const rpg = plugin.import('@rpg')
        const { user } = await rpg.getUser(m.sender.id)
        
        if (m.command === 'reg') {
            if (user.registered) return m.reply('ⓘ Ya estás registrado.')
            const args = m.text.trim().split(/\s+/)
            const age = parseInt(args.pop())
            const name = args.join(" ")
            
            if (!name || isNaN(age)) return m.reply('ⓘ Formato incorrecto.\n- Uso: .reg Nombre Edad\n- Ej: .reg David Perez 16')
            if (age < 14 || age > 57) return m.reply('⚠ Edad no permitida (14-57 años).')

            let localDate = 'Unknown'
            try {
                const pNumber = parsePhoneNumberFromString('+' + m.sender.number)
                const country = pNumber ? pNumber.country : null
                const tz = global.TIMEZONES?.[country] || 'UTC'
                localDate = moment().tz(tz).format('DD/MM/YYYY')
            } catch {}

            user.name = name
            user.age = age
            user.regDate = localDate
            user.registered = true
            user.money = (user.money || 0) + 1000
            user.diamond = (user.diamond || 0) + 7
            user.exp = (user.exp || 0) + 500
            
            const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const txt = [
                '╭○ *Registro Completado*',
                `╵✧ Nombre: ${name}`,
                `╵✦ Edad: ${age}`,
                `╵✎ Fecha: ${localDate}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                '╭ *Ⰶ Recompensas*',
                '╵ 𖤓 Soles      ·  +1,000',
                '╵ ✦ Diamantes  ·  +7',
                '╵ ⊹₊⋆ EXP       ·  +500',
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n')
            return await sock.sendMessage(m.chat.id, { image: { url: pp }, caption: txt }, { quoted: m.raw })
        }

        if (!user.registered) return m.reply('⚠ Debes registrarte primero usando .reg ‹nombre› ‹edad›')

        if (['lvl', 'levelup'].includes(m.command)) {
            const isAll = m.args[0]?.toLowerCase() === 'all'
            let needed = rpg.xpForLevel(user.level)
            
            if (user.exp < needed) {
                return m.reply(`ⓘ Te falta *${needed - user.exp} EXP* para subir al Nivel ${user.level + 1}.`)
            }

            let levelsGained = 0
            if (isAll) {
                while (user.exp >= needed) {
                    user.exp -= needed
                    user.level++
                    levelsGained++
                    needed = rpg.xpForLevel(user.level)
                }
            } else {
                user.exp -= needed
                user.level++
                levelsGained = 1
            }

            user.role = rpg.getRole(user.level)
            const type = isAll ? 'MAX LEVEL UP' : 'LEVEL UP'
            return m.reply(`▢ *${type}*\n\n- Has subido *${levelsGained}* nivel(es).\n- Nivel Actual: ${user.level}\n- Rango: ${user.role}`)
        }

        if (m.command === 'autolvl') {
            user.autolvl = !user.autolvl
            return m.reply(`ⓘ Auto-Level ahora está: ${user.autolvl ? 'ACTIVADO' : 'DESACTIVADO'}`)
        }

        if (m.command === 'sethobby') {
            if (!m.text) return m.reply('ⓘ Escribe tu hobby.')
            const words = m.text.trim().split(/\s+/)
            if (words.length > 15) return m.reply(`⚠ ¡Mucho texto! Resume tu hobby en máximo 15 palabras.`)

            user.hobby = m.text.trim()
            return m.reply('✓ Hobby actualizado correctamente.')
        }
        
        if (m.command === 'setgender') {
            const input = m.text.trim().toLowerCase()
            if (!input) return m.reply('ⓘ Escribe tu género (Masculino/Femenino).')

            const normal = ['masculino', 'femenino', 'hombre', 'mujer']
            const lgbt = ['gay', 'lesbiana', 'homosexual', 'bisexual', 'trans', 'no binario', 'bl', 'gl']

            if (normal.includes(input)) {
                user.gender = (input === 'hombre' || input === 'masculino') ? 'Masculino' : 'Femenino'
                return m.reply(`✓ Género establecido como: ${user.gender}`)
            } else if (lgbt.includes(input)) {
                user.gender = m.text.trim()
                const burlas = ['Ah, con que te gusta morder la almohada...', 'Uy, saliste del clóset.', 'Qué gei.', '¿En serio?', 'Detectado usuario con gustos raros.']
                return m.reply(burlas[Math.floor(Math.random() * burlas.length)])
            } else {
                return m.reply('⚠ Género no válido.')
            }
        }

        if (m.command === 'setbirth') {
            if (!m.text) return m.reply('ⓘ Escribe tu cumpleaños (DD/MM).')
            const regex = /^\d{1,2}\/\d{1,2}$/
            if (!regex.test(m.text.trim())) return m.reply('⚠ Formato inválido. Usa DD/MM (Ej: 25/12).')
            
            user.birthday = m.text.trim()
            return m.reply('✓ Cumpleaños actualizado.')
        }

        if (m.command === 'perfil') {
            await m.react('wait')
            await initFonts()

            const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'
            const fontMono = 'monospace'

            const need = rpg.xpForLevel(user.level)
            const progress = Math.min(1, Math.max(0, user.exp / need))
            const percentStr = Math.floor(progress * 100) + '%'
            const waifuCount = user.inventory ? user.inventory.length : 0
            
            let partnerName = 'Soltero(a)'
            if (user.partner) {
                const { user: partnerData } = await rpg.getUser(user.partner)
                partnerName = partnerData.name || '@' + user.partner.split('@')[0]
            }

            const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const avatarBuffer = await downloadImg(ppUrl)

            let badgeUrl = null
            if (m.chat?.isGroup) {
                badgeUrl = await sock.profilePictureUrl(m.chat.id, 'image').catch(() => null)
            } else {
                const botJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : null
                if (botJid) badgeUrl = await sock.profilePictureUrl(botJid, 'image').catch(() => null)
            }
            if (!badgeUrl) badgeUrl = 'https://files.catbox.moe/obz4b4.jpg'
            const badgeBuffer = await downloadImg(badgeUrl)

            const C_BG = '#050409'
            const C_CARD = '#0d0b17'
            const A1 = '#a855f7'
            const A2 = '#d8b4fe'
            const A3 = '#94a3b8'
            const C_LINE = 'rgba(148, 163, 184, 0.16)'

            const width = 1200, height = 720
            const canvas = new Canvas(width, height)
            const ctx = canvas.getContext('2d')

            ctx.fillStyle = C_BG
            ctx.fillRect(0, 0, width, height)

            const cardX = 35, cardY = 35, cardW = width - 70, cardH = height - 70
            
            ctx.save()
            roundRect(ctx, cardX, cardY, cardW, cardH, 20)
            ctx.fillStyle = C_CARD
            ctx.fill()
            ctx.strokeStyle = C_LINE
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.clip()

            const radGrad = ctx.createRadialGradient(cardX + 240, cardY + 140, 20, cardX + 240, cardY + 140, 700)
            radGrad.addColorStop(0, 'rgba(168, 85, 247, 0.18)')
            radGrad.addColorStop(0.55, 'rgba(168, 85, 247, 0.04)')
            radGrad.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = radGrad
            ctx.fillRect(cardX, cardY, cardW, cardH)

            ctx.fillStyle = 'rgba(168, 85, 247, 0.04)'
            ctx.font = `bold 260px ${fontTitle}`
            ctx.textAlign = 'left'
            ctx.fillText('PERFIL', cardX - 10, cardY + cardH + 40)
            
            ctx.fillStyle = A2
            ctx.globalAlpha = 0.4
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 5; c++) {
                    ctx.beginPath()
                    ctx.arc(cardX + cardW - 90 + (c * 12), cardY + 35 + (r * 12), 2.2, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
            ctx.globalAlpha = 1.0
            ctx.restore()

            const avX = 75, avY = 85, avSize = 270

            ctx.save()
            roundRect(ctx, avX, avY, avSize, avSize, 14)
            ctx.fillStyle = 'rgba(168, 85, 247, 0.2)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.clip()

            if (avatarBuffer) {
                try {
                    const img = await loadImage(avatarBuffer)
                    ctx.drawImage(img, avX, avY, avSize, avSize)
                } catch(e) {}
            }
            ctx.restore()

            drawHudCorners(ctx, avX, avY, avSize, avSize, A2, 8, 26, 3)
            
            const badgeX = avX + avSize - 4
            const badgeY = avY + avSize - 4
            const badgeR = 38

            ctx.beginPath()
            ctx.arc(badgeX, badgeY, badgeR + 5, 0, Math.PI * 2)
            ctx.fillStyle = C_CARD
            ctx.fill()

            ctx.save()
            ctx.beginPath()
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
            ctx.clip()
            if (badgeBuffer) {
                try {
                    const bImg = await loadImage(badgeBuffer)
                    ctx.drawImage(bImg, badgeX - badgeR, badgeY - badgeR, badgeR * 2, badgeR * 2)
                } catch(e) {
                    ctx.fillStyle = '#1b1730'
                    ctx.fillRect(badgeX - badgeR, badgeY - badgeR, badgeR * 2, badgeR * 2)
                }
            }
            ctx.restore()

            ctx.beginPath()
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
            ctx.strokeStyle = A1
            ctx.lineWidth = 2.5
            ctx.stroke()

            const rawGroupName = m.chat?.isGroup ? (m.chat.name || 'Grupo') : 'Chat Privado'
            const groupName = rawGroupName.length > 20 ? rawGroupName.substring(0, 18) + '...' : rawGroupName
            ctx.font = `15px ${fontMono}`
            ctx.textAlign = 'left'
            ctx.fillStyle = A3
            ctx.fillText('GRUPO ⌁ ', avX, avY + avSize + 52)
            const tagW = ctx.measureText('GRUPO ⌁ ').width
            ctx.fillStyle = A2
            ctx.font = `bold 15px ${fontMono}`
            ctx.fillText(groupName, avX + tagW, avY + avSize + 52)

            const rX = 390, rY = 85
            const rightW = width - rX - 75

            ctx.save()
            ctx.font = `bold 68px ${fontTitle}`
            ctx.textAlign = 'left'
            const nameTxt = user.name.substring(0, 16).toUpperCase()
            
            const nameGrad = ctx.createLinearGradient(rX, 0, rX + ctx.measureText(nameTxt).width, 0)
            nameGrad.addColorStop(0, '#ffffff')
            nameGrad.addColorStop(0.45, A2)
            nameGrad.addColorStop(1, A1)
            ctx.fillStyle = nameGrad
            ctx.fillText(nameTxt, rX, rY + 54)
            ctx.restore()

            ctx.font = `17px ${fontMono}`
            ctx.fillStyle = A3
            ctx.fillText('[ ROL: ', rX, rY + 92)
            let curOff = rX + ctx.measureText('[ ROL: ').width

            ctx.fillStyle = A2
            ctx.font = `bold 17px ${fontMono}`
            ctx.fillText(user.role.toUpperCase(), curOff, rY + 92)
            curOff += ctx.measureText(user.role.toUpperCase()).width

            ctx.fillStyle = A3
            ctx.font = `17px ${fontMono}`
            ctx.fillText(' ]  //  [ LVL: ', curOff, rY + 92)
            curOff += ctx.measureText(' ]  //  [ LVL: ').width

            ctx.fillStyle = A2
            ctx.font = `bold 17px ${fontMono}`
            ctx.fillText(String(user.level), curOff, rY + 92)
            curOff += ctx.measureText(String(user.level)).width

            ctx.fillStyle = A3
            ctx.font = `17px ${fontMono}`
            ctx.fillText(' ]', curOff, rY + 92)

            const moneyFormatted = rpg.formatMoney(user.money, m.sender.id).split(' ')[0]
            const statBoxW = (rightW - 18) / 2
            const statBoxH = 92
            const statStartY = rY + 128

            const drawStatBox = (x, y, key, val, accentColor) => {
                ctx.save()
                roundRect(ctx, x, y, statBoxW, statBoxH, 10)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
                ctx.fill()
                ctx.strokeStyle = C_LINE
                ctx.lineWidth = 1.2
                ctx.stroke()

                ctx.fillStyle = accentColor
                roundRect(ctx, x + 3, y + 12, 4, statBoxH - 24, 2)
                ctx.fill()

                ctx.fillStyle = A3
                ctx.font = `14px ${fontMono}`
                ctx.fillText(key.toUpperCase(), x + 20, y + 30)

                ctx.fillStyle = '#ffffff'
                ctx.font = `bold 38px ${fontTitle}`
                ctx.fillText(String(val), x + 20, y + 74)
                ctx.restore()
            }

            drawStatBox(rX, statStartY, 'Soles', `$${moneyFormatted}`, A1)
            drawStatBox(rX + statBoxW + 18, statStartY, 'Oro', `${user.gold || 0}`, A2)
            drawStatBox(rX, statStartY + statBoxH + 14, 'Diamantes', `${user.diamond || 0}`, A1)
            drawStatBox(rX + statBoxW + 18, statStartY + statBoxH + 14, 'Waifus', `${waifuCount}`, A2)

            const xpY = statStartY + (statBoxH * 2) + 42

            ctx.font = `15px ${fontMono}`
            ctx.fillStyle = A3
            ctx.fillText('EXPERIENCE LOG', rX, xpY)

            const xpValTxt = `${user.exp.toLocaleString()} / ${need.toLocaleString()} [${percentStr}]`
            ctx.textAlign = 'right'
            ctx.fillStyle = A2
            ctx.font = `bold 15px ${fontMono}`
            ctx.fillText(xpValTxt, rX + rightW, xpY)
            ctx.textAlign = 'left'

            const barH = 26
            const barY = xpY + 12
            ctx.save()
            roundRect(ctx, rX, barY, rightW, barH, 6)
            ctx.fillStyle = 'rgba(168, 85, 247, 0.08)'
            ctx.fill()
            ctx.strokeStyle = C_LINE
            ctx.lineWidth = 1.2
            ctx.stroke()
            ctx.clip()

            const fillW = Math.max(10, rightW * progress)
            const fillGrad = ctx.createLinearGradient(rX, 0, rX + fillW, 0)
            fillGrad.addColorStop(0, A1)
            fillGrad.addColorStop(1, A2)
            ctx.fillStyle = fillGrad
            roundRect(ctx, rX, barY, fillW, barH, 6)
            ctx.fill()
            ctx.restore()

            const footY = barY + barH + 48
            ctx.font = `13px ${fontMono}`
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
            ctx.fillText(`ID_REF: ${m.sender.number || m.sender.id.split('@')[0]}`, rX, footY)

            ctx.textAlign = 'right'
            ctx.fillText('Aethero Advanced Engine', rX + rightW, footY)
            ctx.textAlign = 'left'

            const buffer = await canvas.toBuffer('image/jpeg')
            const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            
            const gender = user.gender || 'No definido'
            const birthday = user.birthday || 'No definido'
            const hobby = user.hobby || 'No definido'

            const txt = [
                '```╭○ Perfil / Usuario',
                `╵✧ Nombre: ${user.name} (${user.age})`,
                `╵✦ Rango: ${user.role} (Lvl ${user.level})`,
                `╵✎ Registro: ${user.regDate || 'Desconocido'}`,
                `╵⚲ Pareja: ${partnerName}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                '— Inventario! ๑ 🍥 ୧',
                `╭✰ 𖤓 Soles: ${rpg.formatMoney(user.money, m.sender.id)}`,
                `﹕✦ Diamantes: ${user.diamond || 0}`,
                `﹕⛃ Oro: ${user.gold || 0}`,
                `╰🜲 Waifus: ${waifuCount} Coleccionadas`,
                '',
                `ⓘ Género: ${gender} | Cumple: ${birthday} | Hobby: ${hobby}\`\`\``
            ].join('\n')

            await sock.sendMessage(m.chat.id, { 
               image: buffer, 
               caption: txt 
            }, { 
               quoted: await sock.fakeOrder(m.chat.id, { 
                  image: pp, 
                  message: `ⓘ ESTADO: ➟ ${user.money < 0 ? 'ENDEUDADO' : 'SOLVENTE'}`, 
                  orderTitle: m.sender.name, 
                  price: 374, 
                  currency: 'USD' 
               }) 
            })

            await m.react('done')
        }
    }
}