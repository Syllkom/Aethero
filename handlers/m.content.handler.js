import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
    enabled: true,
    priority: 0.02,
    script: async function ({ sock }) {
        if (!this.messageData) return
        const m = this

        const MEDIA_TYPES = new Set([
            'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'
        ])
        const isMediaType = (type) => MEDIA_TYPES.has(type) ? true : undefined

        const object = {
            'conversation': (message) => typeof message === 'string' ? message : (message?.text || ''),
            'imageMessage': (message) => message?.caption || '',
            'videoMessage': (message) => message?.caption || '',
            'extendedTextMessage': (message) => message?.text || '',
            'buttonsResponseMessage': (message) => message?.selectedButtonId || '',
            'templateButtonReplyMessage': (message) => message?.selectedId || '',
            'interactiveResponseMessage': (message) => {
                try {
                    return message?.nativeFlowResponseMessage?.paramsJson
                        ? JSON.parse(message.nativeFlowResponseMessage.paramsJson).id || ''
                        : ''
                } catch {
                    return ''
                }
            },
            'pollCreationMessage': (message) => message?.name || '',
            'pollCreationMessageV2': (message) => message?.name || '',
            'pollCreationMessageV3': (message) => message?.name || ''
        }

        const getText = (type, messageData) => {
            try {
                const res = object[type] ? object[type](messageData) : ''
                return typeof res === 'string' ? res : ''
            } catch {
                return ''
            }
        }

        let isMedia = isMediaType(this.type)
        let text = getText(this.type, this.messageData)

        this.content = {
            isMedia: isMedia,
            text: text,
            args: typeof text === 'string' && text.length > 0 ? text.trim().split(/ +/) : [],
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

        if (this.quoted) {
            let isQuotedMedia = isMediaType(this.quoted.type)
            let quotedText = getText(this.quoted.type, this.quoted.messageData)

            this.quoted.content = {
                isMedia: isQuotedMedia,
                text: quotedText,
                args: typeof quotedText === 'string' && quotedText.length > 0 ? quotedText.trim().split(/ +/) : [],
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