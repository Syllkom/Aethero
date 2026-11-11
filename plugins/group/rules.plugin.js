// ./plugins/group/rules.plugin.js
import { Canvas, loadImage } from '@napi-rs/canvas'

export default {
    command: true, usePrefix: true,
    case: ['rules', 'reglas', 'normas'],
    description: 'Muestra las reglas o descripción del grupo.',
    category: 'grupo',
    usage: ['rules', 'reglas'],
    script: async (m, { sock }) => {
        if (!m.chat.isGroup) return m.sms('group')

        await m.react('wait')

        try {
            const chat = await m.chat.db()
            const settings = chat?.settings || {}

            await m.chat.metaData()
            const groupDesc = m.chat.desc || ''
            const customRules = settings.rulesText || ''

            const rulesContent = customRules || groupDesc

            if (!rulesContent || !rulesContent.trim().length) {
                await m.react('error')
                return m.reply('ⓘ Este grupo no tiene reglas ni descripción configuradas.')
            }

            const groupName = m.chat.name || 'Grupo'
            const groupPicUrl = await sock.profilePictureUrl(m.chat.id, 'image').catch(() => null)
                || await m.chat.getPhoto().catch(() => null)
                || 'https://files.catbox.moe/obz4b4.jpg'

            let thumbBuffer = Buffer.alloc(0)
            try {
                const rawImg = await sock.getBuffer(groupPicUrl)
                if (rawImg && rawImg.length) {
                    const img = await loadImage(rawImg)
                    const canvas = new Canvas(150, 150)
                    const ctx = canvas.getContext('2d')
                    const scale = Math.max(150 / img.width, 150 / img.height)
                    const x = (150 - img.width * scale) / 2
                    const y = (150 - img.height * scale) / 2
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
                    thumbBuffer = await canvas.toBuffer('image/jpeg', 70)
                }
            } catch {}

            const rawId = sock.user?.id || ''
            const botNum = rawId.split('@')[0].split(':')[0]
            const botJid = botNum ? `${botNum}@s.whatsapp.net` : '0@s.whatsapp.net'
            const fakeQ = {
                key: {
                    remoteJid: m.chat.id,
                    fromMe: false,
                    id: 'HK_RULES_' + Date.now().toString(36),
                    participant: botJid
                },
                message: {
                    orderMessage: {
                        orderId: 'HK_RULES',
                        thumbnail: thumbBuffer,
                        itemCount: 1,
                        status: 1,
                        surface: 1,
                        message: 'Reglas del Grupo',
                        orderTitle: groupName,
                        sellerJid: botJid,
                        totalAmount1000: 0,
                        totalCurrencyCode: 'USD'
                    }
                }
            }

            await m.reply(rulesContent.trim(), { quoted: fakeQ })
            await m.react('done')

        } catch (e) {
            console.error('Rules Plugin Error:', e)
            await m.react('error')
            return m.reply('ⓘ Error al obtener las reglas del grupo: ' + e.message)
        }
    }
}