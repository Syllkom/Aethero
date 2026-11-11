// ./plugins/tools/stickreact.plugin.js
import crypto from 'crypto'
import { prepareWAMessageMedia } from '@whiskeysockets/baileys'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export default {
    command: true, usePrefix: true,
    reaction: '*',
    dbScope: 'user',
    dbName: '@stickers',
    case: ['sreact', 'sreaccion'],
    description: 'Sistema de stickers personalizados.',
    category: 'tools',
    usage: [
        'sreact save <nombre/emoji> (citando sticker)',
        'sreact on / off',
        'sreact list',
        'sreact del <nombre>',
        'sreact <nombre/emoji> (citando mensaje)'
    ],
    script: async (m, { sock, db, emoji, targetKey, userKey }) => {
        if (!global.db) return m.reply('Base de datos no disponible.')

        const actualUserKey = userKey || m.sender.id.split('@')[0].split(':')[0]
        const stickersDb = db || await global.db.open(`@stickers:${actualUserKey}`)
        const settingsDb = await global.db.open(`@stickers_settings:${actualUserKey}`)

        if (emoji && targetKey) {
            if (!settingsDb.autoReact) return
            const stickerData = stickersDb[emoji]
            if (!stickerData) return

            try {
                const buffer = Buffer.from(stickerData.base64, 'base64')
                const media = await prepareWAMessageMedia({ sticker: buffer }, { upload: sock.waUploadToServer })
                const stickerMessage = media?.stickerMessage
                if (!stickerMessage) return

                stickerMessage.premium = 1
                stickerMessage.isAiSticker = false

                const parentMessageKey = {
                    remoteJid: m.chat.id,
                    id: targetKey.id,
                    participant: targetKey.participant || m.chat.id,
                    fromMe: targetKey.fromMe !== undefined ? targetKey.fromMe : false
                }

                for (let i = 0; i < 3; i++) {
                    const payload = {
                        messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey } },
                        stickerMessage
                    }
                    const msgId = '3EB0' + crypto.randomBytes(8).toString('hex').toUpperCase()
                    await sock.relayMessage(m.chat.id, payload, { messageId: msgId })
                    await sleep(350) 
                }
            } catch (e) {
                console.error('[StickerReact Error]:', e)
            }
            return 
        }

        const args = m.args || []
        const subCmd = args[0]?.toLowerCase()
        const stickerName = args[1]?.trim()

        if (subCmd === 'on') {
            settingsDb.autoReact = true
            return m.reply('Modo auto-reaccion ACTIVADO para tu usuario.')
        }

        if (subCmd === 'off') {
            settingsDb.autoReact = false
            return m.reply('Modo auto-reaccion DESACTIVADO para tu usuario.')
        }

        if (subCmd === 'save' || subCmd === 'add') {
            if (!m.quoted || m.quoted.type !== 'stickerMessage') {
                return m.reply('Cita un sticker para guardarlo.')
            }
            if (!stickerName) return m.reply('Escribe un nombre o un emoji para el sticker.')

            if (stickersDb[stickerName]) return m.reply(`Ya tienes un sticker guardado con el nombre/emoji *${stickerName}*.`)

            await m.react('wait')
            try {
                const buffer = await m.getQuotedMedia()
                if (!buffer || !buffer.length) throw new Error('No se pudo descargar el sticker.')

                stickersDb[stickerName] = {
                    base64: buffer.toString('base64'),
                    createdAt: Date.now(),
                    isEmoji: /\p{Extended_Pictographic}/u.test(stickerName)
                }
                await m.react('done')
                return m.reply(`Sticker guardado para *${stickerName}*.`)
            } catch (e) {
                await m.react('error')
                return m.reply(`Error al guardar el sticker: ${e.message}`)
            }
        }

        if (subCmd === 'list' || subCmd === 'lista') {
            const keys = Object.keys(stickersDb)
            if (!keys.length) return m.reply('No tienes stickers guardados aun.')

            const state = settingsDb.autoReact ? 'ACTIVADO' : 'DESACTIVADO'
            const listStr = keys.map(k => `- ${k}`).join('\n')
            return m.reply(`Tus Stickers:\n\n${listStr}\n\nAuto-reaccion: *${state}*`)
        }

        if (subCmd === 'del' || subCmd === 'delete' || subCmd === 'remove') {
            if (!stickerName) return m.reply('Escribe el nombre/emoji del sticker a borrar.')
            if (!stickersDb[stickerName]) return m.reply(`No tienes un sticker con el nombre *${stickerName}*.`)

            delete stickersDb[stickerName]
            return m.reply(`Sticker *${stickerName}* eliminado.`)
        }

        const targetName = subCmd
        if (!targetName) return m.reply('Usa: .sreact <nombre/emoji> (citando el mensaje).')
        if (!stickersDb[targetName]) return m.reply(`No tienes un sticker con el nombre *${targetName}*.`)
        if (!m.quoted) return m.reply('Cita el mensaje al que quieres reaccionar.')

        await m.react('wait')
        try {
            const buffer = Buffer.from(stickersDb[targetName].base64, 'base64')
            const media = await prepareWAMessageMedia({ sticker: buffer }, { upload: sock.waUploadToServer })
            const stickerMessage = media?.stickerMessage
            if (!stickerMessage) throw new Error('Error preparando el sticker.')

            stickerMessage.premium = 1
            stickerMessage.isAiSticker = false

            const parentMessageKey = {
                remoteJid: m.chat.id,
                id: m.quoted.id,
                participant: m.quoted.sender?.id || m.chat.id,
                fromMe: m.quoted.key?.fromMe || false
            }

            for (let i = 0; i < 3; i++) {
                const payload = {
                    messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey } },
                    stickerMessage
                }
                const msgId = '3EB0' + crypto.randomBytes(8).toString('hex').toUpperCase()
                await sock.relayMessage(m.chat.id, payload, { messageId: msgId })
                await sleep(350) 
            }
            await m.react('done')
        } catch (e) {
            await m.react('error')
            await m.reply(`Error: ${e?.message || e}`)
        }
    }
}