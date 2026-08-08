// ./plugins/tools/toimg.plugin.js
import axios from 'axios'
import { generateWAMessageContent } from '@whiskeysockets/baileys'

export default {
    command: true, usePrefix: true,
    case: ['toimg', 'toimage', 'jpg'],
    description: 'Convierte stickers a imagen JPG manteniendo alta calidad.',
    category: 'herramientas',
    usage: 'toimg ‹citar sticker›',
    script: async (m, { sock }) => {
        if (!m.quoted || m.quoted.type !== 'stickerMessage') {
            return m.reply('ⓘ Responde a un sticker para convertirlo a imagen.')
        }

        await m.react('wait')

        try {
            const stickerBuffer = await m.quoted.content.media.download()
            const ppUrl = await m.sender.getPhoto().catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const { data: ppBuffer } = await axios.get(ppUrl, { responseType: 'arraybuffer' })

            const baitThumbnail = await sock.resizePhoto({ image: ppBuffer, scale: 100, result: 'buffer' })

            const imgContent = await generateWAMessageContent({ 
                image: stickerBuffer 
            }, { upload: sock.waUploadToServer })

            imgContent.imageMessage.jpegThumbnail = baitThumbnail
            imgContent.imageMessage.caption = ''

            await sock.relayMessage(m.chat.id, {
                imageMessage: imgContent.imageMessage
            }, { 
                messageId: `HK_BAIT_${Date.now()}`,
                quoted: m.raw 
            })

            await m.react('done')

        } catch (e) {
            console.error('ToImg Bait Error:', e)
            await m.react('error')
            m.reply('ⓘ Ocurrió un error al convertir el sticker.')
        }
    }
}