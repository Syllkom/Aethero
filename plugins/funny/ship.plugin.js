// ./plugins/fun/ship.plugin.js
import { Canvas, loadImage, GlobalFonts, Path2D } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

const PATH_HEART = new Path2D('M57.7,25.54c4.09-4.34,7.49-7.9,14.4-8.69a20,20,0,0,1,11.3,2,21,21,0,0,1,4.87,3.36,26.1,26.1,0,0,1,4.11,5.18,18.1,18.1,0,0,1,2.07,6.69,18.49,18.49,0,0,1-2,10.5A36.53,36.53,0,0,1,88.2,51c-1.75,2.18-3.79,4.42-5.93,6.64-3,3.05-6.07,6-8.88,8.73-1.65,1.57-3.18,3-4.48,4.33l-9.77,9.69-1.37,1.36-1.39-1.33-8.07-7.78c-1.48-1.42-3.19-3-5-4.6C33.71,59.28,22.1,48.69,21.63,35.58c0-.32,0-.65,0-1A17.29,17.29,0,0,1,27.08,21.9a19.27,19.27,0,0,1,12.48-5c.33,0,.67,0,1,0,8.33.11,12.14,3.76,17.11,8.64Zm-26.8,8.4a1.34,1.34,0,1,1-2.52-.9,14.34,14.34,0,0,1,1.55-3.11,14.74,14.74,0,0,1,2.25-2.66,15.27,15.27,0,0,1,2.87-2.11,16.47,16.47,0,0,1,3.33-1.43,1.34,1.34,0,0,1,.78,2.56,13.49,13.49,0,0,0-2.78,1.2A12.68,12.68,0,0,0,34,29.23a12.43,12.43,0,0,0-1.84,2.18,11.53,11.53,0,0,0-1.27,2.53Z')
const PATH_SHINE = new Path2D('M30.9,33.94a1.34,1.34,0,1,1-2.52-.9,14.34,14.34,0,0,1,1.55-3.11,14.74,14.74,0,0,1,2.25-2.66,15.27,15.27,0,0,1,2.87-2.11,16.47,16.47,0,0,1,3.33-1.43,1.34,1.34,0,0,1,.78,2.56,13.49,13.49,0,0,0-2.78,1.2A12.68,12.68,0,0,0,34,29.23a12.43,12.43,0,0,0-1.84,2.18,11.53,11.53,0,0,0-1.27,2.53Z')
const PATH_ARROW = new Path2D('M16.76,61.32l8.56-5,3.13,3.63-9.16,5,5.9,4.13,1.09.76c1.66,1.16,1.82,3.23-.55,3.06l-24.28,1A1.51,1.51,0,0,1,.12,73,2.19,2.19,0,0,1,0,71.88C.26,70,10.82,55.6,12.69,52.89c1.27-1.83,3.63-4.46,3.81-.09l.26,8.52ZM58.54,45.11l-2-3.36L92.43,21.41l-.59-10.74L110.55.2c1.13-.41,1.94-.21,2.29.86l1,10.87a90.64,90.64,0,0,1,8.52,5.9,1.47,1.47,0,0,1,.44,1.75,2.24,2.24,0,0,1-1.13,1.14l-14.06,8.22c-1.24.73-2.76,1.88-4.23,1.78a3.51,3.51,0,0,1-1.86-.74l-7-5.06-36,20.19Z')

function drawCupidHeart(ctx, x, y, width = 140) {
    ctx.save()
    const scale = width / 122.88
    const height = 81.77 * scale
    ctx.translate(x - width / 2, y - height / 2)
    ctx.scale(scale, scale)

    ctx.fillStyle = '#ed1b24'
    ctx.fill(PATH_HEART, 'evenodd')

    ctx.fillStyle = '#630000'
    ctx.fill(PATH_ARROW, 'evenodd')

    ctx.fillStyle = '#ffffff'
    ctx.fill(PATH_SHINE)

    ctx.restore()
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
    case: ['ship', 'shippear', 'match'],
    description: 'Calcula la compatibilidad entre dos usuarios con tarjeta visual Canvas.',
    category: 'funny',
    usage: ['ship @usuario'],
    script: async (m, { sock }) => {
        const user1 = m.sender.id
        const user2 = m.sender.mentioned[0] || m.quoted?.sender?.id
        
        if (!user2 || user2 === user1) {
            return m.reply('ⓘ Menciona o cita a la persona con la que deseas calcular el ship.\n- Ejemplo: .ship @usuario')
        }

        await m.react('wait')
        await initFont()
        const fontTitle = fontLoaded ? 'AntonRegular, sans-serif' : 'sans-serif'

        const sumIds = (user1 + user2).split('').reduce((a, b) => a + b.charCodeAt(0), 0)
        const percent = sumIds % 101

        const W = 700, H = 350
        const canvas = new Canvas(W, H)
        const ctx = canvas.getContext('2d')

        const bgUrl = 'https://files.catbox.moe/emy54v.jpg'
        const pp1Url = await sock.profilePictureUrl(user1, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        const pp2Url = await sock.profilePictureUrl(user2, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        
        const [bgBuff, pp1Buff, pp2Buff] = await Promise.all([
            downloadBuffer(bgUrl),
            downloadBuffer(pp1Url),
            downloadBuffer(pp2Url)
        ])

        if (bgBuff) {
            try {
                const bgImg = await loadImage(bgBuff)
                ctx.drawImage(bgImg, 0, 0, W, H)
                ctx.fillStyle = 'rgba(10, 9, 18, 0.45)'
                ctx.fillRect(0, 0, W, H)
            } catch {
                ctx.fillStyle = '#0a0912'
                ctx.fillRect(0, 0, W, H)
            }
        } else {
            ctx.fillStyle = '#0a0912'
            ctx.fillRect(0, 0, W, H)
        }

        if (pp1Buff) {
            try {
                const img1 = await loadImage(pp1Buff)
                ctx.save()
                ctx.beginPath()
                ctx.arc(150, 150, 85, 0, Math.PI * 2)
                ctx.clip()
                ctx.drawImage(img1, 65, 65, 170, 170)
                ctx.restore()
                
                ctx.beginPath()
                ctx.arc(150, 150, 85, 0, Math.PI * 2)
                ctx.strokeStyle = '#a855f7'
                ctx.lineWidth = 4
                ctx.stroke()
            } catch {}
        }

        if (pp2Buff) {
            try {
                const img2 = await loadImage(pp2Buff)
                ctx.save()
                ctx.beginPath()
                ctx.arc(550, 150, 85, 0, Math.PI * 2)
                ctx.clip()
                ctx.drawImage(img2, 465, 65, 170, 170)
                ctx.restore()

                ctx.beginPath()
                ctx.arc(550, 150, 85, 0, Math.PI * 2)
                ctx.strokeStyle = '#ec4899'
                ctx.lineWidth = 4
                ctx.stroke()
            } catch {}
        }

        drawCupidHeart(ctx, 350, 140, 145)

        ctx.font = `bold 54px ${fontTitle}`
        ctx.textAlign = 'center'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 8
        ctx.strokeText(`${percent}%`, 350, 275)

        ctx.fillStyle = '#ffffff'
        ctx.fillText(`${percent}%`, 350, 275)

        const finalBuff = await canvas.toBuffer('image/jpeg')

        await sock.sendMessage(m.chat.id, { 
            image: finalBuff, 
            caption: `╭○ *Matchmaking / Ship*\n╵ ✧ Pareja: @${user1.split('@')[0]} x @${user2.split('@')[0]}\n╵ ✦ Compatibilidad: *${percent}%*\n╰╶╴──────╶╴─╶╴◯`, 
            mentions: [user1, user2] 
        }, { quoted: m.raw })

        await m.react('done')
    }
}