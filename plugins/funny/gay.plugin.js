// ./plugins/fun/gay.plugin.js
import { Canvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

const FLAGS = {
    gay: ['#FF0018', '#FFA52C', '#FFFF41', '#008018', '#0000F9', '#86007D'],
    lesbiana: ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'],
    trans: ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'],
    bi: ['#D60270', '#9B4F96', '#0038A8'],
    asexual: ['#000000', '#A3A3A3', '#FFFFFF', '#800080']
}

const getRoast = (percent, type) => {
    if (percent < 20) return 'Tienes la personalidad de un ladrillo y el carisma de un cadáver.'
    if (percent < 40) return 'Deja de hacerte el hetero, se te nota la pluma a kilómetros.'
    if (percent < 60) return 'Ya no puedes ocultarlo, acéptalo de una vez.'
    if (percent < 80) return 'Deja de fingir, eres más llamativo que una bandera en pleno desfile.'
    
    if (type === 'gay') return '🏳️‍🌈 ¡TROLO! Actúas más que tu madre y eres tan puto que ni siquiera sabes quién eres.'
    if (type === 'lesbiana') return '✂️ Vas por la vida con cara de asco y actitud de tigre, pero eres puro drama por dentro.'
    if (type === 'bi') return '👫👬 ¿Indeciso? No decides con quién ponerte a llorar.'
    if (type === 'trans') return '⚧️ ¿A qué te sirve el cambio si tu mente sigue siendo la misma?'
    if (type === 'asexual') return '🌵 Más frío y apagado que un témpano de hielo en el polo norte.'
    
    return 'Simplemente un pendejo inútil. Qué desperdicio de oxígeno.'
}

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
    case: ['gay', 'lesbiana', 'trans', 'bi', 'asexual'],
    description: 'Escanea el porcentaje de orientación sexual con banderas en Canvas.',
    category: 'funny',
    usage: ['gay ‹@usuario opcional›', 'lesbiana', 'trans', 'bi', 'asexual'],
    script: async (m, { sock }) => {
        await m.react('wait')
        await initFont()
        const fontTitle = fontLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'

        const target = m.sender.mentioned[0] || m.quoted?.sender?.id || m.sender.id
        const percent = Math.floor(Math.random() * 101)
        const comment = getRoast(percent, m.command)

        const canvas = new Canvas(512, 512)
        const ctx = canvas.getContext('2d')

        const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        const ppBuff = await downloadBuffer(ppUrl)
        
        if (!ppBuff) {
            await m.react('error')
            return m.reply('ⓘ No se pudo descargar la foto de perfil del usuario.')
        }

        try {
            const avatar = await loadImage(ppBuff)
            ctx.drawImage(avatar, 0, 0, 512, 512)
        } catch {}

        ctx.globalAlpha = 0.52
        const colors = FLAGS[m.command] || FLAGS['gay']
        const stripeHeight = 512 / colors.length
        colors.forEach((color, i) => {
            ctx.fillStyle = color
            ctx.fillRect(0, i * stripeHeight, 512, stripeHeight)
        })
        ctx.globalAlpha = 1.0

        if (percent > 88) {
            ctx.font = `bold 64px ${fontTitle}`
            ctx.textAlign = 'center'
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 10
            ctx.fillStyle = '#ffffff'
            ctx.strokeText('¡LO SUPONIA!', 256, 470)
            ctx.fillText('¡LO SUPONIA!', 256, 470)
        }

        ctx.font = `bold 88px ${fontTitle}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 12
        ctx.fillStyle = percent > 50 ? '#22c55e' : '#ffffff'
        ctx.strokeText(`${percent}%`, 256, 256)
        ctx.fillText(`${percent}%`, 256, 256)

        const finalBuff = await canvas.toBuffer('image/jpeg')

        const caption = [
            `╭○ *Scanner: ${m.command.toUpperCase()}*`,
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