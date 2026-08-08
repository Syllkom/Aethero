// ./plugins/tools/sticker.plugin.js
import { stickerWebp } from '../../library/media/mediaConverter.js'
import axios from 'axios'

const DEFAULTS = { pack: 'Aethero', author: 'Aethero powered by Syllkom' }

export default {
    command: true, usePrefix: true,
    case: ['sticker', 's', 'wm', 'setsticker', 'qc', 'quote'],
    description: 'Crea stickers personalizados, modifica packname/author y genera stickers tipo QC.',
    category: 'herramientas',
    usage: ['sticker (media)', 'qc ‹texto›', 'setsticker ‹pack›|‹autor›'],
    script: async (m, { sock }) => {
        const db = await global.db.open('sticker_config')
        db['@users'] ||= {}
        const userConf = db['@users'][m.sender.id] || {}
        const options = { 
            packname: userConf.packname ?? DEFAULTS.pack, 
            author: userConf.author ?? DEFAULTS.author 
        }

        if (['wm', 'setsticker'].includes(m.command)) {
            try {
                const args = m.text.trim()
                
                if (args.toLowerCase() === 'reset') {
                    if (db['@users'][m.sender.id]) delete db['@users'][m.sender.id]
                    return m.reply(`Configuración restaurada.\n- Pack: ${DEFAULTS.pack}\n- Autor: ${DEFAULTS.author}`)
                }

                if (!args.includes('|')) {
                    return m.reply(`Configuración Actual:\n- Pack: ${options.packname}\n- Autor: ${options.author}\n\nPara cambiar usa: .setsticker Pack | Autor\nPara reiniciar: .setsticker reset`)
                }

                const [p, a] = args.split('|').map(s => s.trim())
                if (p === '' && a === '') return m.reply('Debes definir al menos un valor.')
                db['@users'][m.sender.id] = { packname: p, author: a }
                return m.reply(`Configuración guardada.\n- Pack: ${p}\n- Autor: ${a}`)

            } catch (e) {
                console.error(e)
                return m.reply('Error al guardar configuración.')
            }
        }

        await m.react('wait')

        if (['qc', 'quote'].includes(m.command)) {
            try {
                const text = m.text || m.quoted?.content?.text
                if (!text) return m.reply('Ingresa texto o responde a un mensaje.')
                if (text.length > 50) return m.reply('Máximo 50 caracteres.')

                const target = m.quoted ? m.quoted.sender : m.sender
                const pp = await sock.profilePictureUrl(target.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
                
                const obj = {
                    type: "quote", format: "png", backgroundColor: "#0F0F0F",
                    width: 512, height: 768, scale: 2,
                    messages: [{
                        entities: [], avatar: true,
                        from: { id: 1, name: target.name || 'User', photo: { url: pp } },
                        text: text, replyMessage: {}
                    }]
                }

                const { data } = await axios.post('https://bot.lyo.su/quote/generate', obj)
                const imgBuffer = Buffer.from(data.result.image, 'base64')
                await sock.sendSticker(m.chat.id, { sticker: imgBuffer, mediaType: 'image' }, m.raw, options)
                await m.react('done')
                return 

            } catch (e) {
                console.error(e)
                await m.react('error')
                return m.reply('Error al generar QC.')
            }
        }

        try {
            const target = (m.quoted && m.quoted.content?.media) ? m.quoted : (m.content?.media ? m : null)
            if (!target) { await m.react('error'); return m.reply('Responde a una imagen, video o sticker.') }

            const type = target.type
            const media = await target.content.media.download()

            if (type === 'imageMessage') {
                await sock.sendSticker(m.chat.id, { sticker: media, mediaType: 'image' }, m.raw, options)
            } else if (type === 'videoMessage') {
                const seconds = target.message?.videoMessage?.seconds || 0
                if (seconds > 10) return m.reply('El video debe durar máximo 10 segundos.')
                await sock.sendSticker(m.chat.id, { sticker: media, mediaType: 'video' }, m.raw, options)
            } else if (type === 'stickerMessage') {
                const newSticker = await stickerWebp(media, options)
                await sock.sendMessage(m.chat.id, { sticker: newSticker }, { quoted: m.raw })
            } else {
                return m.reply('Formato de archivo no soportado.')
            }

            await m.react('done')

        } catch (e) {
            console.error(e)
            await m.react('error')
            m.reply('Error al procesar el sticker.')
        }
    }
}