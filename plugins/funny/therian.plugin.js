// ./plugins/fun/therian.plugin.js
import { Canvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

const downloadBuffer = async (url) => {
    if (!url) return null
    try {
        return await got(url, { responseType: 'buffer', timeout: { request: 6000 } }).buffer()
    } catch {
        return null
    }
}

let fontLoaded = false
async function initFont() {
    if (fontLoaded) return true
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const fontPath = path.join(tempDir, 'Anton-Regular.ttf')

    try {
        if (!fs.existsSync(fontPath) || fs.statSync(fontPath).size < 1000) {
            const fontUrl = global.font?.Anton?.Regular || 'https://tinyurl.com/Anton-Regular'
            const fontBuff = await downloadBuffer(fontUrl)
            if (fontBuff) fs.writeFileSync(fontPath, fontBuff)
        }
        if (fs.existsSync(fontPath)) {
            GlobalFonts.registerFromPath(fontPath, 'AntonRegular')
            fontLoaded = true
        }
        return fontLoaded
    } catch {
        return false
    }
}

export default {
    command: true, usePrefix: true,
    case: ['therian', 'lobo', 'furry'],
    description: 'Escanea el instinto Therian / Animal en Canvas con overlay.',
    category: 'funny',
    usage: ['therian ‹@usuario opcional›'],
    script: async (m, { sock }) => {
        await m.react('wait')
        await initFont()
        const fontTitle = fontLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'

        const target = m.sender.mentioned[0] || m.quoted?.sender?.id || m.sender.id
        const percent = Math.floor(Math.random() * 101)

        const canvas = new Canvas(512, 512)
        const ctx = canvas.getContext('2d')

        const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        const [ppBuff, overlayBuff] = await Promise.all([
            downloadBuffer(ppUrl),
            downloadBuffer('https://files.catbox.moe/8y70pi.jpg')
        ])
        
        if (!ppBuff) {
            await m.react('error')
            return m.reply('ⓘ No se pudo descargar la foto de perfil del usuario.')
        }

        try {
            const avatar = await loadImage(ppBuff)
            ctx.drawImage(avatar, 0, 0, 512, 512)
        } catch {}

        if (overlayBuff) {
            try {
                ctx.globalAlpha = 0.55
                const overlay = await loadImage(overlayBuff)
                ctx.drawImage(overlay, 0, 0, 512, 512)
                ctx.globalAlpha = 1.0
            } catch {}
        }

        if (percent > 88) {
            ctx.font = `bold 64px ${fontTitle}`
            ctx.textAlign = 'center'
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 10
            ctx.fillStyle = '#ffffff'
            ctx.strokeText('¡BESTIA TOTAL!', 256, 470)
            ctx.fillText('¡BESTIA TOTAL!', 256, 470)
        }

        ctx.font = `bold 88px ${fontTitle}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 12
        ctx.fillStyle = percent > 50 ? '#f59e0b' : '#ffffff'
        ctx.strokeText(`${percent}%`, 256, 256)
        ctx.fillText(`${percent}%`, 256, 256)

        const finalBuff = await canvas.toBuffer('image/jpeg')

        const comment = percent > 50 
            ? '🐺 ¡Eres animal o solo un perro con problemas? Anda a correr al parque, bestia sin cerebro.'
            : '100% Humano y cuerdo. Cero instintos salvajes detectados.'

        const caption = [
            `╭○ *Scanner: THERIAN*`,
            `╵ ✧ Usuario: @${target.split('@')[0]}`,
            `╵ ✦ Nivel: *${percent}%*`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            `_${comment}_`
        ].join('\n')

        await sock.sendMessage(m.chat.id, { 
            image: finalBuff, 
            caption: caption,
            mentions: [target]
        }, { quoted: m.raw })
        
        await m.react('done')
    }
}