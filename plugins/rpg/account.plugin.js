// ./plugins/rpg/account.plugin.js
import moment from 'moment-timezone'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { Canvas, Image, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

const downloadImg = async (url) => {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 })
        return res.status === 200 ? res.data : null
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

const drawTechFrame = (ctx, x, y, w, h, color, thickness = 3) => {
    const len = 20
    ctx.strokeStyle = color
    ctx.lineWidth = thickness
    ctx.beginPath()
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y)
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len)
    ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h)
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len)
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
            const txt = `▢ *Registro Completado*\n\n- Nombre: ${name}\n- Edad: ${age}\n- Fecha: ${localDate}\n\nⓘ Recompensa:\n- 1000 Soles 𖤓\n- 7 Diamantes ✦\n- 500 EXP ⊹₊⋆`
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

            const fontMain = fontsLoaded ? 'NunitoSans, sans-serif' : 'sans-serif'
            const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'

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

            const A1 = '#a855f7', A2 = '#d8b4fe', A3 = '#94a3b8', A4 = '#e2e8f0'
            const width = 1200, height = 750
            const canvas = new Canvas(width, height)
            const ctx = canvas.getContext('2d')

            ctx.fillStyle = '#07060e'
            ctx.fillRect(0, 0, width, height)

            const vigGrad = ctx.createRadialGradient(width/2, height/2, 80, width/2, height/2, 820)
            vigGrad.addColorStop(0, 'rgba(168,85,247,0.09)')
            vigGrad.addColorStop(0.5, 'rgba(168,85,247,0.04)')
            vigGrad.addColorStop(1, 'rgba(0,0,0,0.45)')
            ctx.fillStyle = vigGrad
            ctx.fillRect(0, 0, width, height)

            ctx.save()
            ctx.fillStyle = 'rgba(168,85,247,0.04)'
            ctx.font = `bold 320px ${fontTitle}`
            ctx.textAlign = 'left'
            ctx.fillText('USER', 40, 520)
            ctx.restore()

            const ax = 100, ay = 150, aSize = 320
            const tiltRad = 5 * Math.PI / 180

            if (avatarBuffer) {
                try {
                    const img = await loadImage(avatarBuffer)
                    ctx.save()
                    ctx.translate(ax + aSize/2, ay + aSize/2)
                    ctx.rotate(tiltRad)
                    ctx.beginPath(); ctx.rect(-aSize/2, -aSize/2, aSize, aSize); ctx.clip()
                    ctx.drawImage(img, -aSize/2, -aSize/2, aSize, aSize)
                    ctx.restore()
                } catch(e) {}
            }

            const TX = 480
            ctx.fillStyle = A1
            ctx.fillRect(TX, 150, 6, 95)

            ctx.fillStyle = '#ffffff'
            ctx.font = `68px ${fontTitle}`
            ctx.textAlign = 'left'
            ctx.fillText(user.name.substring(0,16).toUpperCase(), TX + 14, 208)

            ctx.fillStyle = A3
            ctx.font = '22px monospace'
            ctx.fillText(`[ ROLE: ${user.role.toUpperCase()} ]   //   [ LVL: ${user.level} ]`, TX + 16, 242)

            const moneyFormatted = rpg.formatMoney(user.money, m.sender.id).split(' ')[0]
            const BOX_W = 282, BOX_H = 104

            const drawDataBox = (x, y, title, value, accentColor) => {
                ctx.fillStyle = 'rgba(255,255,255,0.03)'
                ctx.fillRect(x, y, BOX_W, BOX_H)
                ctx.strokeStyle = 'rgba(148,163,184,0.12)'
                ctx.lineWidth = 1
                ctx.strokeRect(x, y, BOX_W, BOX_H)

                ctx.fillStyle = accentColor
                ctx.fillRect(x, y + 10, 3, BOX_H - 20)

                ctx.fillStyle = A3
                ctx.font = '14px monospace'
                ctx.fillText(title, x + 18, y + 30)

                ctx.fillStyle = '#ffffff'
                ctx.font = `bold 36px ${fontTitle}`
                ctx.fillText(value, x + 18, y + 76)
            }

            drawDataBox(TX, 300, 'SOLES', `$${moneyFormatted}`, A1)
            drawDataBox(TX + 308, 300, 'ORO', `${user.gold || 0}`, A2)
            drawDataBox(TX, 420, 'DIAMANTES', `${user.diamond || 0}`, A1)
            drawDataBox(TX + 308, 420, 'WAIFUS', `${waifuCount}`, A2)

            const buffer = await canvas.toBuffer('image/jpeg')
            const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            
            const txt = `\`\`\`╭ ✦ Perfil / Usuario
╵ Nombre: ${user.name} (${user.age})
╵ Rango: ${user.role} (Lvl ${user.level})
╵ Dinero: ${rpg.formatMoney(user.money, m.sender.id)} 𖤓
╵ Diamantes: ${user.diamond} ✦
╵ Oro: ${user.gold} ⛃
╰╶╴──────╶╴─╶╴◯
            
╭ ✦ Detalles
╵ Género: ${user.gender || 'No definido'}
╵ Cumpleaños: ${user.birthday || 'No definido'}
╵ Hobby: ${user.hobby || 'No definido'}
╵ Registro: ${user.regDate || 'Desconocido'}
╵ Pareja: ${partnerName}
╵ Waifus: ${waifuCount} Coleccionadas
╰╶╴──────╶╴─╶╴◯\`\`\``

            await sock.sendMessage(m.chat.id, { image: buffer, caption: txt }, { quoted: await sock.fakeOrder(m.chat.id, { image: pp, message: `ⓘ ESTADO: ➟ ${user.money < 0 ? 'ENDEUDADO' : 'SOLVENTE'}`, orderTitle: m.sender.name, price: 374, currency: 'USD' }) })
            await m.react('done')
        }
    }
}