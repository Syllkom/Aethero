// ./plugins/rpg/shop.plugin.js
import { Canvas, Image, loadImage, GlobalFonts, Path2D } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import got from 'got'

const RATES = {
    gold:    { cost: 1000, currency: 'money', label: 'Soles',  name: 'Oro'       },
    diamond: { cost: 10,   currency: 'gold',  label: 'Oro',    name: 'Diamantes' }
}

const ICONS = {
    sol: new Path2D('M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7'),
    oro: new Path2D('M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1 M12 7v10'),
    diamante: new Path2D('M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5 M10 12l-2 -2.2l.6 -1')
}


let fontsLoaded = false
async function initFonts() {
    if (fontsLoaded) return
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const fontsToLoad = [
        { name: 'NotoSansBold', url: global.font?.NotoSans?.Bold,   file: 'NotoSans-Bold.ttf'   },
        { name: 'AntonRegular', url: global.font?.Anton?.Regular,    file: 'Anton-Regular.ttf'   },
        { name: 'NunitoSans',   url: global.font?.NunitoSans?.Bold,  file: 'NunitoSans-Bold.ttf' }
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
    } catch (e) {}
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

const drawSvgIcon = (ctx, pathObj, x, y, size = 36, color = '#ffffff') => {
    ctx.save()
    ctx.translate(x, y)
    const scale = size / 24
    ctx.scale(scale, scale)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(pathObj)
    ctx.restore()
}

export default {
    command: true, usePrefix: true,
    case: ['shop', 'tienda', 'store'],
    description: 'Tienda global RPG: compra y venta de divisas (Oro/Diamantes) y mercado de personajes.',
    category: 'RPG',
    usage: ['shop', 'shop list', 'shop buy ‹item› ‹cant›', 'shop sell ‹item› ‹cant›'],

    script: async (m, { sock, plugin }) => {
        const rpg   = plugin.import('@rpg')
        const gacha = plugin.import('@gacha')
        const { user } = await rpg.getUser(m.sender.id)
        const db = await global.db.open('@rpg')
        db.gacha ||= { global: {} }

        const subCmd = m.args[0]?.toLowerCase()

        if (subCmd === 'list' || subCmd === 'market') {
            const marketItems = []
            for (const [id, data] of Object.entries(db.gacha.global)) {
                if (typeof data === 'object' && data.forSale) {
                    const char = await gacha.getById(id)
                    if (char) marketItems.push({ ...char, price: data.price })
                }
            }
            if (marketItems.length === 0) return m.reply('ⓘ El mercado de personajes está vacío por ahora.')
            const page       = Math.max(1, parseInt(m.args[1]) || 1)
            const limit      = 10
            const totalPages = Math.ceil(marketItems.length / limit)
            if (page > totalPages) return m.reply(`⚠ Página no encontrada. Total: ${totalPages}`)
            const view = marketItems.slice((page - 1) * limit, page * limit)
            let txt = `▢ *MERCADO DE PERSONAJES* (Pág ${page}/${totalPages})\n\n`
            view.forEach(item => {
                const meta = gacha.meta(item.rarity)
                txt += `- ID: ${item.id} | ${item.name} (${item.source})\n`
                txt += `  Precio: ${item.price} Soles | Rareza: ${meta.name}\n\n`
            })
            txt += `ⓘ Para comprar: .shop buy ‹id›`
            return m.reply(txt)
        }

        if (['buy', 'comprar', 'sell', 'vender'].includes(subCmd)) {
            const itemInput = m.args[1]?.toLowerCase()
            const amount    = parseInt(m.args[2]) || 1
            const isBuying  = ['buy', 'comprar'].includes(subCmd)
            if (!['oro', 'gold', 'diamante', 'diamond'].includes(itemInput))
                return m.reply('⚠ Solo puedes comerciar divisas con: oro, diamante.')
            const type     = (itemInput === 'oro' || itemInput === 'gold') ? 'gold' : 'diamond'
            const rate     = RATES[type]
            const totalVal = rate.cost * amount
            if (isBuying) {
                if (user[rate.currency] < totalVal)
                    return m.reply(`⚠ Fondos insuficientes.\n- Requieres: ${totalVal} ${rate.label}\n- Tienes: ${user[rate.currency]} ${rate.label}`)
                user[rate.currency] -= totalVal
                user[type]          += amount
                return m.reply(`✓ *Compra exitosa.*\n- Gastaste: ${totalVal} ${rate.label}\n- Recibiste: ${amount} ${rate.name}`)
            } else {
                if (user[type] < amount)
                    return m.reply(`⚠ No tienes suficientes ${rate.name} para vender.`)
                user[type]          -= amount
                user[rate.currency] += totalVal
                return m.reply(`✓ *Venta exitosa.*\n- Vendiste: ${amount} ${rate.name}\n- Recibiste: ${totalVal} ${rate.label}`)
            }
        }

        await m.react('wait')
        await initFonts()
        const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'
        const fontMono  = 'monospace'

        const W = 1200, H = 580
        const canvas = new Canvas(W, H)
        const ctx    = canvas.getContext('2d')

        const C_BG   = '#050409'
        const C_CARD = '#0d0b17'
        const C1     = '#f5b942' // Soles (Ámbar)
        const C2     = '#2dd4bf' // Oro (Teal)
        const C3     = '#7dd3fc' // Diamantes (Celeste)
        const C_SUB  = '#94a3b8'
        const C_LINE = 'rgba(148, 163, 184, 0.16)'

        ctx.fillStyle = C_BG
        ctx.fillRect(0, 0, W, H)

        const cardX = 35, cardY = 35, cardW = W - 70, cardH = H - 70
        
        ctx.save()
        roundRect(ctx, cardX, cardY, cardW, cardH, 20)
        ctx.fillStyle = C_CARD
        ctx.fill()
        ctx.strokeStyle = C_LINE
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.clip()

        const radGrad = ctx.createRadialGradient(W / 2, cardY + 60, 20, W / 2, cardY + 60, 520)
        radGrad.addColorStop(0, 'rgba(245, 185, 66, 0.14)')
        radGrad.addColorStop(0.55, 'rgba(245, 185, 66, 0.03)')
        radGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = radGrad
        ctx.fillRect(cardX, cardY, cardW, cardH)

        ctx.fillStyle = 'rgba(245, 185, 66, 0.035)'
        ctx.font = `bold 190px ${fontTitle}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('MERCADO', W / 2, H / 2)
        ctx.textBaseline = 'alphabetic'
        ctx.restore()

        const tagText = 'CASA DE CAMBIO · RPG'
        ctx.font = `bold 13px ${fontMono}`
        ctx.textAlign = 'center'
        ctx.fillStyle = C1
        ctx.fillText(tagText, W / 2, cardY + 58)

        const tagW = ctx.measureText(tagText).width
        ctx.fillStyle = 'rgba(245, 185, 66, 0.6)'
        ctx.fillRect((W / 2) - (tagW / 2) - 40, cardY + 53, 26, 1.5)
        ctx.fillRect((W / 2) + (tagW / 2) + 14, cardY + 53, 26, 1.5)

        ctx.save()
        ctx.font = `bold 76px ${fontTitle}`
        ctx.textAlign = 'center'
        const titleText = 'MERCADO'
        const titleW = ctx.measureText(titleText).width
        
        const titleGrad = ctx.createLinearGradient((W / 2) - (titleW / 2), 0, (W / 2) + (titleW / 2), 0)
        titleGrad.addColorStop(0, C1)
        titleGrad.addColorStop(0.48, '#ffffff')
        titleGrad.addColorStop(1, C3)
        ctx.fillStyle = titleGrad
        ctx.fillText(titleText, W / 2, cardY + 132)
        ctx.restore()

        const chipW = 320, chipH = 100, chipGap = 20
        const totalChipsW = (chipW * 3) + (chipGap * 2)
        const startX = (W - totalChipsW) / 2
        const chipsY = cardY + 165

        const drawBalanceChip = (x, y, iconPath, iconColor, value, label) => {
            ctx.save()

            roundRect(ctx, x, y, chipW, chipH, 12)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
            ctx.fill()
            ctx.strokeStyle = C_LINE
            ctx.lineWidth = 1.2
            ctx.stroke()

            drawSvgIcon(ctx, iconPath, x + 20, y + 31, 38, iconColor)

            ctx.fillStyle = '#ffffff'
            ctx.font = `bold 32px ${fontTitle}`
            ctx.textAlign = 'left'
            ctx.fillText(String(value), x + 74, y + 50)

            ctx.fillStyle = C_SUB
            ctx.font = `12px ${fontMono}`
            ctx.fillText(label.toUpperCase(), x + 76, y + 74)
            ctx.restore()
        }

        drawBalanceChip(startX, chipsY, ICONS.sol, C1, (user.money || 0).toLocaleString('es-ES'), 'Soles')
        drawBalanceChip(startX + chipW + chipGap, chipsY, ICONS.oro, C2, (user.gold || 0).toLocaleString('es-ES'), 'Oro')
        drawBalanceChip(startX + (chipW + chipGap) * 2, chipsY, ICONS.diamante, C3, (user.diamond || 0).toLocaleString('es-ES'), 'Diamantes')

        const pillY = chipsY + chipH + 42
        const drawMarketPill = (x, y, w, dotColor, label) => {
            ctx.save()
            roundRect(ctx, x, y, w, 38, 19)
            ctx.strokeStyle = C_LINE
            ctx.lineWidth = 1.2
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(x + 20, y + 19, 3.5, 0, Math.PI * 2)
            ctx.fillStyle = dotColor
            ctx.fill()

            ctx.fillStyle = C_SUB
            ctx.font = `13px ${fontMono}`
            ctx.textAlign = 'left'
            ctx.fillText(label, x + 34, y + 24)
            ctx.restore()
        }

        const pill1W = 210, pill2W = 205, pillGap = 16
        const startPillX = (W - (pill1W + pill2W + pillGap)) / 2

        drawMarketPill(startPillX, pillY, pill1W, C1, 'Mercado de Divisas')
        drawMarketPill(startPillX + pill1W + pillGap, pillY, pill2W, C3, 'Mercado de Waifus')

        const footY = H - 54
        ctx.font = `12px ${fontMono}`
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)'
        ctx.textAlign = 'left'
        ctx.fillText(`ID_REF: ${m.sender.number || m.sender.id.split('@')[0]}`, cardX + 24, footY)

        ctx.textAlign = 'right'
        ctx.fillText('Aethero Advanced Engine', cardX + cardW - 24, footY)
        ctx.textAlign = 'left'

        const buffer = await canvas.toBuffer('image/jpeg')
        const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')

        const txt = [
            '╭○ *Tu Saldo:* ๑ 🌟 ୧',
            `﹕𖤓 ${user.money} Soles`,
            `﹕⛃ ${user.gold || 0} Oro`,
            `﹕✦ ${user.diamond || 0} Diamantes`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            '╭○ *Mercado De Divisas*',
            '╵ Comprar: .shop buy ‹item› ‹cant›',
            '╵ Vender: .shop sell ‹item› ‹cant›',
            '╰╶╴──────╶╴─╶╴◯',
            '',
            '╭○ *Mercado De Waifus*',
            '╵ Ver lista: .shop list',
            '╵ Vender: .shop sell ‹id› ‹precio›',
            '╵ Comprar: .shop buy ‹id›',
            '╰╶╴──────╶╴─╶╴◯'
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