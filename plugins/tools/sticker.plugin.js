// ./plugins/tools/sticker.plugin.js
import { imageWebp, videoWebp, stickerWebp } from '../../library/media/mediaConverter.js'

const DEFAULTS = { packname: 'Aethero', author: 'Aethero by Syllkom' }

export default {
    command: true,
    usePrefix: true,
    case: ['sticker', 's', 'wm', 'setsticker', 'take'],
    description: 'Convierte imágenes, videos o stickers a formato sticker con metadatos personalizados.',
    category: 'herramientas',
    usage: ['s ‹imagen/video›', 'wm ‹pack›|‹autor›', 'take ‹pack›|‹autor›', 'setsticker ‹pack›|‹autor›'],
    script: async (m, { sock }) => {
        const db = await global.db.open('sticker_config')
        db['@users'] ||= {}
        const userConf = db['@users'][m.sender.id] || {}

        let packname = userConf.packname ?? DEFAULTS.packname
        let author = userConf.author ?? DEFAULTS.author

        if (m.command === 'setsticker') {
            if (m.text.trim().toLowerCase() === 'reset') {
                delete db['@users'][m.sender.id]
                return m.reply(`✓ *Configuración restaurada*\n- Pack: ${DEFAULTS.packname}\n- Autor: ${DEFAULTS.author}`)
            }

            if (!m.text.includes('|')) {
                return m.reply(
                    `╭○ *Configuración de Stickers*\n` +
                    `╵ ✧ Pack: ${userConf.packname !== undefined ? `"${userConf.packname}"` : `${DEFAULTS.packname} (Por defecto)`}\n` +
                    `╵ ✦ Autor: ${userConf.author !== undefined ? `"${userConf.author}"` : `${DEFAULTS.author} (Por defecto)`}\n` +
                    `╰╶╴──────╶╴─╶╴◯\n\n` +
                    `ⓘ Para cambiar usa: *.setsticker Pack | Autor*\n` +
                    `ⓘ Para dejar uno vacío: *.setsticker | Autor* o *.setsticker Pack |*\n` +
                    `ⓘ Para reiniciar: *.setsticker reset*`
                )
            }

            const [p, a] = m.text.split('|').map(s => s.trim())
            db['@users'][m.sender.id] = { packname: p ?? '', author: a ?? '' }
            return m.reply(`✓ *Metadatos actualizados*\n- Pack: ${p ?? ''}\n- Autor: ${a ?? ''}`)
        }

        if (['wm', 'take'].includes(m.command) && m.text) {
            if (m.text.includes('|')) {
                const [p, a] = m.text.split('|').map(s => s.trim())
                packname = p ?? ''
                author = a ?? ''
            } else {
                packname = m.text.trim()
                author = ''
            }
        }

        await m.react('wait')

        try {
            const targetRaw = (m.quoted && (m.quoted.raw || m.quoted)) || m.raw
            const targetMsg = targetRaw.message?.ephemeralMessage?.message 
                || targetRaw.message?.viewOnceMessage?.message 
                || targetRaw.message?.documentWithCaptionMessage?.message 
                || targetRaw.message 
                || {}

            const isImage = !!targetMsg.imageMessage
            const isVideo = !!targetMsg.videoMessage
            const isSticker = !!targetMsg.stickerMessage

            if (!isImage && !isVideo && !isSticker) {
                await m.react('error')
                return m.reply('ⓘ Responde o envía una *imagen*, *video corto* o *sticker*.')
            }

            const mediaBuffer = await sock.downloadMedia(targetRaw)
            if (!mediaBuffer || !mediaBuffer.length) {
                await m.react('error')
                return m.reply('ⓘ No se pudo descargar el archivo multimedia.')
            }

            const options = { packname, author, categories: ['🤖', '⚡'] }
            let finalSticker = null

            if (isImage) {
                finalSticker = await imageWebp(mediaBuffer, options)
            }
            else if (isVideo) {
                const duration = targetMsg.videoMessage?.seconds || 0
                if (duration > 10) {
                    await m.react('error')
                    return m.reply('⚠ El video no debe durar más de 10 segundos.')
                }
                finalSticker = await videoWebp(mediaBuffer, options)
            }
            else if (isSticker) {
                finalSticker = await stickerWebp(mediaBuffer, options)
            }

            if (!finalSticker) {
                await m.react('error')
                return m.reply('ⓘ Error al procesar el sticker.')
            }

            await sock.sendMessage(m.chat.id, {
                sticker: finalSticker
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Sticker Plugin Error:', e)
            await m.react('error')
            m.reply(`ⓘ Error al crear sticker: ${e.message}`)
        }
    }
}