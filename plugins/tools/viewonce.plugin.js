// ./plugins/tools/viewonce.plugin.js
import { resolveMessage } from '../../core/library/message.js'

export default {
    command: true,
    usePrefix: false,
    reaction: '💤',
    case: ['vv', 'amor', 'mami', 'helmosha', 'awww', 'ñam', 'uu', 'epa', 'owwww', 'jijiji', 'tiempo', 'jajaja', 'nmms', 'velda', 'si', 'shi', 'vrg'],
    list: [
        { cmd: 'vv (responde a mensaje)', category: 'herramientas' }
    ],
    script: async (m, { sock, targetKey }) => {
        if (!m.sender.role('root', 'owner')) return
        
        const cache = await global.db.open('@viewonce_cache')
        let buffer = null
        let mime = 'application/octet-stream'
        let mediaType = null

        const targetId = targetKey?.id || m.quoted?.id
        if (cache[targetId]) {
            buffer = Buffer.from(cache[targetId].base64, 'base64')
            mime = cache[targetId].mimetype
            mediaType = cache[targetId].type
        } 
        
        else if (m.quoted) {
            let targetMsg = m.quoted.raw
            if (!targetMsg || !targetMsg.message) return

            const resolved = resolveMessage(targetMsg.message)
            mime = resolved.messageData?.mimetype || ''
            mediaType = resolved.type

            try {
                buffer = await sock.downloadMedia(targetMsg)
            } catch {
                return
            }
        }

        if (!buffer || !buffer.length) return

        const isPrivileged = m.sender.role('root', 'owner')
        if (!isPrivileged) {
            await new Promise(resolve => setTimeout(resolve, 30000))
        }

        const senderTag = m.sender.number ? `@${m.sender.number}` : m.sender.name
        const caption = `ⓘ *ViewOnce Revelado*\n${senderTag} lo solicitó.`
        
        const targetJid = m.sender.id

        if (mediaType === 'imageMessage' || mime.startsWith('image/')) {
            await sock.sendMessage(targetJid, {
                image: buffer,
                caption: caption,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else if (mediaType === 'videoMessage' || mime.startsWith('video/')) {
            await sock.sendMessage(targetJid, {
                video: buffer,
                caption: caption,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else if (mediaType === 'audioMessage' || mime.startsWith('audio/')) {
            await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: true,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else {
            await sock.sendMessage(targetJid, {
                document: buffer,
                mimetype: mime,
                caption: caption,
                fileName: 'viewonce_revealed.bin',
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        }
    }
}