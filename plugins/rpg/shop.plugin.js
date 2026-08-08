// ./plugins/rpg/shop.plugin.js
import { Canvas, Image, loadImage, GlobalFonts } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

const RATES = {
    gold:    { cost: 1000, currency: 'money', label: 'Soles',  name: 'Oro'       },
    diamond: { cost: 10,   currency: 'gold',  label: 'Oro',    name: 'Diamantes' }
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
                const res = await axios.get(f.url, { responseType: 'arraybuffer' })
                fs.writeFileSync(fontPath, res.data)
            }
            if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, f.name)
        }
        fontsLoaded = true
    } catch (e) {}
}

const drawTechFrame = (ctx, x, y, w, h, color, thickness = 2.5, len = 18) => {
    ctx.save()
    ctx.strokeStyle = color; ctx.lineWidth = thickness
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y + len);          ctx.lineTo(x, y);          ctx.lineTo(x + len, y)
    ctx.moveTo(x + w - len, y);      ctx.lineTo(x + w, y);      ctx.lineTo(x + w, y + len)
    ctx.moveTo(x, y + h - len);      ctx.lineTo(x, y + h);      ctx.lineTo(x + len, y + h)
    ctx.moveTo(x + w - len, y + h);  ctx.lineTo(x + w, y + h);  ctx.lineTo(x + w, y + h - len)
    ctx.stroke()
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
        const fontMain  = fontsLoaded ? 'NunitoSans, sans-serif'  : 'sans-serif'
        const fontTitle = fontsLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'

        const W = 1200, H = 630
        const canvas = new Canvas(W, H)
        const ctx    = canvas.getContext('2d')

        const F1 = '#dc2626', F2 = '#f97316', G1 = '#ec4899', G2 = '#a855f7'

        ctx.fillStyle = '#07060a'
        ctx.fillRect(0, 0, W, H)

        const ppUrl  = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        const ppBuff = await (async () => {
            try {
                const res = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 })
                return res.status === 200 ? res.data : null
            } catch { return null }
        })()

        const UX = 820, UY = 30, UW = 300, UH = 155

        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(UX, UY, UW, UH)
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
        ctx.strokeRect(UX, UY, UW, UH)

        drawTechFrame(ctx, UX, UY, UW, UH, 'rgba(236,72,153,0.45)', 1.5, 12)

        const avS = 68, avCX = UX + 20, avCY = UY + (UH - avS) / 2
        if (ppBuff) {
            try {
                const avImg = await loadImage(ppBuff)
                ctx.save()
                ctx.beginPath(); ctx.rect(avCX, avCY, avS, avS); ctx.clip()
                ctx.drawImage(avImg, avCX, avCY, avS, avS)
                ctx.restore()
            } catch {}
        }

        const userName = m.sender?.name || m.sender?.number || 'Usuario'
        const shortName = userName.length > 14 ? userName.slice(0, 13) + '…' : userName
        ctx.textAlign = 'left'
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold 18px ${fontMain}`
        ctx.fillText(shortName, avCX + avS + 14, avCY + 8)

        const titleGrad = ctx.createLinearGradient(80, 0, 80 + 900, 0)
        titleGrad.addColorStop(0,    '#ffffff')
        titleGrad.addColorStop(0.3,  '#fca5a5')
        titleGrad.addColorStop(0.55, '#f97316')
        titleGrad.addColorStop(0.75, '#f472b6')
        titleGrad.addColorStop(1,    '#a855f7')
        ctx.fillStyle = titleGrad
        ctx.font = `bold 96px ${fontTitle}`
        ctx.textAlign = 'left'
        ctx.fillText('GLOBAL MARKET', 80, 160)

        const buffer = await canvas.toBuffer('image/jpeg')
        const txt = `▢ *TIENDA & ECONOMÍA*\n\n- Tu Saldo:\n  - ${user.money} Soles 𖤓\n  - ${user.gold || 0} Oro ⛃\n  - ${user.diamond || 0} Diamantes ✦\n\n▢ *MERCADO DE DIVISAS*\n- Comprar: .shop buy ‹item› ‹cant›\n- Vender: .shop sell ‹item› ‹cant›\n\n▢ *MERCADO DE WAIFUS*\n- Ver lista: .shop list\n- Vender: .shop sell ‹id› ‹precio›\n- Comprar: .shop buy ‹id›`

        await sock.sendMessage(m.chat.id, { image: buffer, caption: txt }, { quoted: m.raw })
        await m.react('done')
    }
}