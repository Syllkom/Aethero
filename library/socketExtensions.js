// ./library/socketExtensions.js
import got from 'got'
import { Jimp } from 'jimp'
import axios from 'axios'
import { downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent } from '@whiskeysockets/baileys'

import { imageWebp, videoWebp } from './media/mediaConverter.js'
import $base from '../core/library/hyperDBAdapter.js'

import { buildCatalog, buildOrder, buildPayment, buildInvoice } from './builders/commerceBuilder.js'
import { buildLocationMenu, buildInteractiveMenu, buildCards, buildMediaMenu, buildPollSnapshot, buildProductMenu, buildAdMenu, executeAlbumMessage, buildOrderStatusMenu } from './builders/interactiveBuilder.js'
import { buildFakeOrder, buildFakePayment, buildFakeInvoice, buildFakeLink, buildFakeCatalog } from './builders/fakeContextBuilder.js'

const generateID = () => 'HK_' + Date.now().toString(36) + Math.random().toString(36).substring(2)

export default async function (sock) {
    try {
        sock.Baileys = async () => { return (await import('@whiskeysockets/baileys')).default }

        sock.getBuffer = async (url) => {
            if (Buffer.isBuffer(url)) return url
            try { const res = await axios.get(url, { responseType: 'arraybuffer' }); return res.data } 
            catch (e) { return Buffer.alloc(0) }
        }

        sock.downloadMedia = async (message, type = 'buffer') => {
            if (typeof message !== 'object' || !message.key) throw new Error('Invalid message object')
            try { return await downloadMediaMessage(message, type, { reuploadRequest: sock.updateMediaMessage }) } 
            catch (e) {
                if (e?.output?.statusCode === 429 || e?.message?.includes('429')) {
                    await new Promise(r => setTimeout(r, 1500))
                    return await downloadMediaMessage(message, type, { reuploadRequest: sock.updateMediaMessage })
                }
                throw e
            }
        }

        sock.generateWMContent = (o) => generateWAMessageContent(o, { upload: sock.waUploadToServer })

        sock.sendWAMContent = async (jid, message, options = {}) => {
            const gmessage = await generateWAMessageFromContent(jid, message, options)
            return sock.relayMessage(jid, gmessage.message, { messageId: generateID() })
        }

        sock.resizePhoto = async (data = {}) => {
            try {
                const image = data.image || ''
                const scale = data.scale || 140
                const resultFormat = data.result || 'buffer'
                const fit = data.fit || 'cover'
                let buffer = await sock.getBuffer(image)
                if (!buffer.length) throw new Error('Formato de imagen inválido')

                const img = await Jimp.read(buffer)

                if (fit === 'contain') {
                    img.scaleToFit({ w: scale, h: scale })
                } else {
                    img.cover({ w: scale, h: scale })
                }

                const outputBuffer = await img.getBuffer('image/jpeg')

                if (resultFormat === 'base64') return outputBuffer.toString('base64')
                else return outputBuffer
            } catch (e) {
                console.error('Jimp Resize Error:', e.message)
                return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
            }
        }

        const getProfilePic = async (jid, type = 'image', timeoutMs = 4000) => {
            let queryJid = jid

            if (jid.endsWith('@lid') && jid === sock.user?.lid) {
                queryJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'
            }

            let xmlAttrs = {}
            if (queryJid.endsWith('@lid') || queryJid.endsWith('@g.us')) {
                xmlAttrs = {
                    target: queryJid,
                    to: '@s.whatsapp.net',
                    type: 'get',
                    xmlns: 'w:profile:picture'
                }
            } else {
                xmlAttrs = {
                    to: queryJid,
                    type: 'get',
                    xmlns: 'w:profile:picture'
                }
            }

            const response = await Promise.race([
                sock.query({
                    tag: 'iq',
                    attrs: xmlAttrs,
                    content: [
                        { tag: 'picture', attrs: { type: type, query: 'url' } }
                    ]
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de Meta')), timeoutMs))
            ])

            const pictureNode = response?.content?.find(n => n.tag === 'picture')
            if (pictureNode?.attrs?.url) {
                return pictureNode.attrs.url
            }

            throw new Error('Foto privada o inexistente')
        }

        sock.profilePictureUrl = getProfilePic
        sock.updateProfilePicture = getProfilePic
        sock.groupUpdateProfilePicture = getProfilePic

        const originalRelayMessage = sock.relayMessage

        sock.relayMessage = async (jid, message, options = {}) => {
            const isPrivate = jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')

            if (global.config.iconAI && isPrivate) {
                options.additionalNodes = options.additionalNodes || []
                const hasBotNode = options.additionalNodes.some(node => node.tag === 'bot')

                if (!hasBotNode) {
                    options.additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
                }
            }

            return await originalRelayMessage(jid, message, options)
        }

        const originalSendMessage = sock.sendMessage

        sock.sendMessage = async (jid, content, options = {}) => {
            // Sanitizador de citados
            if (options.quoted) {
                if (options.quoted.raw) {
                    options.quoted = options.quoted.raw
                } else if (!options.quoted.key) {
                    delete options.quoted
                }
            }

            const msgId = options.messageId || generateID()

            let globalNodes = []
            const isPrivate = jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')

            if (global.config.iconAI && isPrivate) {
                globalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
            }

            if (options.additionalNodes) {
                globalNodes.push(...options.additionalNodes)
            }

            const mergeNodes = (builderNodes) => [...globalNodes, ...(builderNodes || [])]

            // Commerce
            if (content.invoice) {
                const { message, nodes } = await buildInvoice(sock, jid, content.invoice, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.catalog) {
                const { message, nodes } = await buildCatalog(sock, jid, content.catalog, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.order) {
                const { message, nodes } = await buildOrder(sock, jid, content.order, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.payment) {
                const { message, nodes } = await buildPayment(sock, jid, content.payment, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }

            // Interactive UI
            if (content.locationMenu) {
                const { message, nodes } = await buildLocationMenu(sock, jid, content.locationMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.interactiveMenu) {
                const { message, nodes } = await buildInteractiveMenu(sock, jid, content.interactiveMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.mediaMenu) {
                const { message, nodes } = await buildMediaMenu(sock, jid, content.mediaMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.cards) {
                const { message, nodes } = await buildCards(sock, jid, content.cards, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.productMenu) {
                const { message, nodes } = await buildProductMenu(sock, jid, content.productMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.adMenu) {
                const { message, nodes } = await buildAdMenu(sock, jid, content.adMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.productMenu) {
                const { message, nodes } = await buildProductMenu(sock, jid, content.productMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.orderStatusMenu) {
                const { message, nodes } = await buildOrderStatusMenu(sock, jid, content.orderStatusMenu, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.pollSnapshot) {
                const { message, nodes } = await buildPollSnapshot(sock, jid, content.pollSnapshot, options)
                return await sock.relayMessage(jid, message, { messageId: msgId, additionalNodes: mergeNodes(nodes) })
            }
            if (content.album) {
                options.additionalNodes = globalNodes.length > 0 ? globalNodes : undefined
                return await executeAlbumMessage(sock, jid, content.album, options)
            }

            options.additionalNodes = globalNodes.length > 0 ? globalNodes : undefined
            return await originalSendMessage(jid, content, options)
        }

        // Contextos Falsos
        sock.fakeOrder = (jid, opts) => buildFakeOrder(sock, jid, opts)
        sock.fakeCatalog = (jid, data, opts) => buildFakeCatalog(sock, jid, data, opts)
        sock.fakePayment = (jid, opts) => buildFakePayment(sock, jid, opts)
        sock.fakeInvoice = (jid, data, opts) => buildFakeInvoice(sock, jid, data, opts)
        sock.fakeLink = (jid, data, opts) => buildFakeLink(sock, jid, data, opts)

        sock.setReplyHandler = async (message, options = {}, expiresIn = 1000 * 60 * 15) => {
            if (!message?.key?.id) throw new Error('sock.setReplyHandler: key.id required')
            options.lifecycle = options.lifecycle || {}
            options.security = options.security || {}
            options.state = options.state || {}
            if (expiresIn) {
                options.lifecycle.createdAt = Date.now()
                options.lifecycle.expiresAt = Date.now() + expiresIn
            }
            if (options.routes) {
                options.routes.forEach(route => {
                    if (typeof route.code.guard === 'function') route.code.guard = route.code.guard.toString()
                    if (typeof route.code.executor === 'function') route.code.executor = route.code.executor.toString()
                })
            }
            const db = await $base.open('@reply:Handler')
            db[message.key.id] = options
        }

        sock.getJSON = async (url) => {
            if (!url) throw new Error('sock.getJSON:0')
            try {
                return (await got(url, {
                    responseType: 'json',
                    timeout: { request: 10000 },
                    retry: { limit: 2 }
                })).body
            } catch (error) { return 0 }
        }

        sock.sendSticker = async (jid, sticker, quoted, options = {}) => {
            if (!sticker) return
            let buff = Buffer.isBuffer(sticker.sticker) ? sticker.sticker : (sticker.sticker.url ? await sock.getBuffer(sticker.sticker.url) : Buffer.alloc(0))
            return await sock.sendMessage(jid, { sticker: sticker.mediaType === 'video' ? await videoWebp(buff, options) : await imageWebp(buff, options), ...options }, { quoted })
        }

        sock.loadMessage = async (jid, id) => {
            if (!global.config.saveHistory) return null
            const chatIndex = await $base.open('@history/' + jid)
            const senderId = chatIndex[id]
            if (!senderId) return null
            const userHistory = await $base.open('@history/' + jid + '/' + senderId)
            if (!Array.isArray(userHistory.data)) return null
            return userHistory.data.find(m => m.key.id === id)
        }

    } catch (e) { console.error('SocketExtensions Error:', e) }
    return sock
}