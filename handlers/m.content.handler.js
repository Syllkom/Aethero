// ./handlers/m.content.handler.js
import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
    enabled: true,
    priority: 0.02,
    script: async function ({ sock }) {
        if (!this.messageData) return
        const m = this

        const MEDIA_TYPES = new Set([
            'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'])
        const isMediaType = (type) => MEDIA_TYPES.has(type) ? true : undefined
        const getText = (type, messageData) => object[type] ? object[type](messageData) : ''

        const object = {
            'conversation': (message) => message || '',
            'imageMessage': (message) => message.caption || '',
            'videoMessage': (message) => message.caption || '',
            'extendedTextMessage': (message) => message.text || '',
            'buttonsResponseMessage': (message) => {
                return message.selectedButtonId || ''
            },
            'templateButtonReplyMessage': (message) => {
                return message.selectedId || ''
            },
            'interactiveResponseMessage': (message) => {
                return message.nativeFlowResponseMessage
                    ? (JSON.parse(message.nativeFlowResponseMessage
                        .paramsJson)).id || '' : ''
            },
        }

        //--------------------
        let isMedia = isMediaType(this.type)
        let text = getText(this.type, this.messageData)

        this.content = {
            isMedia: isMedia, text: text,
            args: text?.trim().split(/ +/),
            media: !isMedia ? undefined : {
                mimeType: this.messageData?.mimetype || '',
                fileName: this.messageData?.filename || '',
                download: async (type = 'buffer') => {
                    return await downloadMediaMessage(this.raw, type, {
                        reuploadRequest: sock.updateMediaMessage
                    })
                }
            }
        }

        //--------------------
        if (this.quoted) {
            let isQuotedMedia = isMediaType(this.quoted.type)
            let quotedText = getText(this.quoted.type, this.quoted.messageData)

            this.quoted.content = {
                isMedia: isQuotedMedia, text: quotedText,
                args: quotedText?.trim().split(/ +/),
                media: !isQuotedMedia ? undefined : {
                    mimeType: this.quoted.messageData?.mimetype || '',
                    fileName: this.quoted.messageData?.filename || '',
                    download: async (type = 'buffer') => {
                        return await downloadMediaMessage(this.quoted.raw, type, {
                            reuploadRequest: sock.updateMediaMessage
                        })
                    }
                }
            }
        }
    }
}