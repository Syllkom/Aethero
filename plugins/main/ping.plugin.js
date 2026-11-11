// ./plugins/main/ping.plugin.js
import { performance } from 'perf_hooks'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

let pingFontsLoaded = false
async function loadPingFonts() {
    if (pingFontsLoaded) return true
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const fonts = [
        { name: 'RalewayExtraBold', url: global.font?.Raleway?.ExtraBold, file: 'Raleway-ExtraBold.ttf' },
        { name: 'MontserratItalic', url: global.font?.Montserrat?.Italic, file: 'Montserrat-LightItalic.ttf' }
    ]

    try {
        for (const f of fonts) {
            if (!f.url) continue
            const fPath = path.join(tempDir, f.file)
            if (!fs.existsSync(fPath)) {
                const fontData = await got(f.url, { timeout: { request: 10000 } }).buffer()
                fs.writeFileSync(fPath, fontData)
            }
            GlobalFonts.registerFromPath(fPath, f.name)
        }
        pingFontsLoaded = true
    } catch (e) {
        console.error('[ping] Font error:', e.message)
    }
    return pingFontsLoaded
}

export default {
    command: true, usePrefix: true,
    case: ['ping', 'speed', 'latencia'],
    category: 'main',
    description: 'Mide la latencia del bot y genera una tarjeta visual con diseño de monitor de pulso.',
    usage: 'ping',
    script: async (m, { sock }) => {
        const t0 = performance.now()
        await m.react('wait')
        const latency = (performance.now() - t0).toFixed(0)

        const ms = parseInt(latency)
        const statusColor = ms < 200 ? '#10b981' : ms < 500 ? '#f59e0b' : '#ef4444'

        await loadPingFonts()
        const fBold = pingFontsLoaded ? 'RalewayExtraBold, sans-serif' : 'sans-serif'

        const W = 850, H = 340
        const canvas = new Canvas(W, H)
        const ctx = canvas.getContext('2d')

        ctx.clearRect(0, 0, W, H)

        const cardX = 25, cardY = 25, cardW = 800, cardH = 290, cardR = 45
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, cardR)
        else ctx.rect(cardX, cardY, cardW, cardH)
        ctx.fillStyle = '#0f1013'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1b1d24'
        ctx.stroke()

        const cx = 230, cy = 170, R = 85

        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.lineWidth = 10
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
        ctx.stroke()

        const startAngle = Math.PI * 0.75
        const maxSweep = Math.PI * 1.5
        const barFill = Math.min(Math.max(1 - (ms / 800), 0.15), 1)
        const sweepAngle = maxSweep * barFill
        const endAngle = startAngle + sweepAngle

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, R, startAngle, endAngle)
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.strokeStyle = statusColor
        ctx.shadowColor = statusColor
        ctx.shadowBlur = 18
        ctx.stroke()
        ctx.restore()

        const dotX = cx + R * Math.cos(endAngle)
        const dotY = cy + R * Math.sin(endAngle)
        ctx.save()
        ctx.beginPath()
        ctx.arc(dotX, dotY, 7, 0, Math.PI * 2)
        ctx.fillStyle = statusColor
        ctx.shadowColor = statusColor
        ctx.shadowBlur = 15
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cx - 45, cy)
        ctx.lineTo(cx - 24, cy)
        ctx.lineTo(cx - 16, cy + 12)
        ctx.lineTo(cx - 6,  cy - 30)
        ctx.lineTo(cx + 6,  cy + 25)
        ctx.lineTo(cx + 16, cy - 10)
        ctx.lineTo(cx + 24, cy)
        ctx.lineTo(cx + 45, cy)
        ctx.strokeStyle = statusColor
        ctx.lineWidth = 4.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = statusColor
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        ctx.moveTo(415, 75)
        ctx.lineTo(415, 265)
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.stroke()

        const textX = 475
        const numY = 205

        ctx.textAlign = 'left'
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold 125px ${fBold}`
        ctx.fillText(latency, textX, numY)

        const numWidth = ctx.measureText(latency).width
        ctx.save()
        ctx.font = `bold 45px ${fBold}`
        ctx.fillStyle = statusColor
        ctx.shadowColor = statusColor
        ctx.shadowBlur = 10
        ctx.fillText('ms', textX + numWidth + 14, numY - 20)
        ctx.restore()

        ctx.font = `600 24px ${fBold}`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)'
        ctx.fillText('LATENCIA', textX, numY + 50)

        const buffer = await canvas.toBuffer('image/jpeg')

        await sock.sendMessage(m.chat.id, {
            image: buffer,
            caption: ''
        }, { quoted: m.raw })

        await m.react('done')
    }
}