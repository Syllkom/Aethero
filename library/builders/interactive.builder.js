// ./core/library/builders/interactiveBuilder.js
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from '@whiskeysockets/baileys'
import crypto from 'crypto'

export const mapButtons = (buttons = [], { inline = false } = {}) => {
    if (!Array.isArray(buttons) || !buttons.length) return []

    const transformBtn = (btn, isRowLeader = false) => {
        if (!btn || typeof btn !== 'object') return { name: "" }
        if (btn.type === 'ghost' || btn.type === 'inline' || btn.type === 'break') return { name: "" }

        if (btn.name && !btn.type) {
            return {
                name: btn.name,
                buttonParamsJson: typeof btn.params === 'object'
                    ? JSON.stringify(btn.params)
                    : (btn.buttonParamsJson || "{}")
            }
        }

        const isIconOnly = Boolean(btn.iconOnly)
        const textVal = isIconOnly ? "\u0000" : (btn.text || btn.buttonText?.displayText || "")
        const listTitleVal = isIconOnly ? " " : (btn.text || btn.title || "")

        let name = 'quick_reply'
        let params = {}

        switch (btn.type) {
            case 'booking':
            case 'booking_confirmation':
                name = 'booking_confirmation'
                params = {
                    start_datetime: btn.start || new Date().toISOString(),
                    end_datetime: btn.end || new Date(Date.now() + 86400000).toISOString(),
                    location: btn.location || "Aethero Engine",
                    booking_url: btn.url || "https://github.com/Syllkom",
                    booking_management_url: btn.manageUrl || "https://github.com/Syllkom",
                    phone_number: (btn.phone || btn.number || '0').replace(/\D/g, ''),
                    description: btn.description || "",
                    email: btn.email || "support@aethero.com",
                    display_text: btn.text || "Ver Detalles",
                    display_content: {
                        display_language: btn.lang || "es",
                        display_meeting_type: btn.meetingType || "Virtual",
                        display_bottom_sheet_header: btn.sheetTitle || "Informacion",
                        display_add_to_calendar_cta_text: btn.calendarText || "Agendar",
                        display_view_on_maps_cta_text: btn.mapsText || "Ver Mapa",
                        display_manage_booking_cta_text: btn.manageText || "Opciones",
                        display_manage_booking_not_supported_text: "No disponible",
                        display_read_more: btn.readMore || btn.readMoreText || "VER MENU COMPLETO"
                    }
                }
                break

            case 'view_catalog':
            case 'catalog_store':
            case 'automated_greeting_message_view_catalog':
                name = 'automated_greeting_message_view_catalog'
                params = {
                    business_phone_number: (btn.phone || btn.number || '0').replace(/\D/g, ''),
                    ...(btn.productId ? { catalog_product_id: String(btn.productId) } : {})
                }
                break

            case 'url':
            case 'url_icon':
                name = 'cta_url'
                params = {
                    display_text: isIconOnly || btn.type === 'url_icon' ? "\u0000" : textVal,
                    url: btn.url || "",
                    merchant_url: btn.url || ""
                }
                break

            case 'call':
            case 'call_icon':
                name = 'cta_call'
                params = {
                    display_text: isIconOnly || btn.type === 'call_icon' ? "\u0000" : textVal,
                    id: btn.phone || btn.id || ""
                }
                break

            case 'copy':
            case 'copy_icon':
                name = 'cta_copy'
                params = {
                    display_text: isIconOnly || btn.type === 'copy_icon' ? "\u0000" : textVal,
                    id: btn.id || 'copy',
                    copy_code: btn.payload || btn.code || ""
                }
                break

            case 'reminder':
                name = 'cta_reminder'
                params = { display_text: textVal, id: btn.id || 'rem_1' }
                break

            case 'cancel_reminder':
                name = 'cta_cancel_reminder'
                params = { display_text: textVal, id: btn.id || 'rem_cancel' }
                break

            case 'address':
                name = 'address_message'
                params = { display_text: textVal, id: btn.id || 'address_req' }
                break

            case 'location':
                name = 'send_location'
                params = { display_text: textVal, id: btn.id || 'location_req' }
                break

            case 'vcard':
                name = 'vcard_message'
                params = { display_text: textVal, vcard: btn.vcard }
                break

            case 'list':
            case 'list_icon':
                name = 'single_select'
                params = {
                    title: isIconOnly || btn.type === 'list_icon' ? " " : listTitleVal,
                    sections: btn.sections || []
                }
                break

            case 'signup':
                return { name: 'inapp_signup', buttonParamsJson: "{}" }

            case 'contact':
                return { name: 'request_contact_info' }

            case 'order_status':
                name = 'order_status'
                params = {
                    reference_id: btn.referenceId || "REF-" + Date.now(),
                    order: {
                        subtotal: { value: btn.price ? (btn.price * 100) : null, offset: 100 },
                        tax: { value: 0, offset: 100 },
                        currency: btn.currency || "USD",
                        ...(btn.status ? { status: btn.status } : {})
                    }
                }
                break

            case 'galaxy':
            case 'flow':
                name = 'galaxy_message'
                params = {
                    mode: btn.mode || "published",
                    flow_message_version: btn.version || "3",
                    flow_token: btn.token || "AETH_TOKEN_" + Date.now(),
                    flow_id: btn.flowId || "1307913409923914",
                    flow_cta: btn.text || "Abrir Flow",
                    flow_action: btn.action || "navigate",
                    flow_action_payload: btn.payload || { screen: "QUESTION_ONE" },
                    flow_metadata: btn.metadata || { flow_json_version: 201, flow_name: "Aethero Flow", categories: [] }
                }
                break

            default:
                name = 'quick_reply'
                params = { display_text: textVal, id: btn.id || 'btn_default' }
                break
        }

        if (btn.icon) params.icon = btn.icon

        if (isRowLeader || btn.inline || (inline && isRowLeader)) {
            params.has_multiple_buttons = true
        }

        return { name, buttonParamsJson: JSON.stringify(params) }
    }

    if (buttons.some(Array.isArray)) {
        const result = []
        for (const row of buttons) {
            const rowList = Array.isArray(row) ? row : [row]
            if (!rowList.length) continue

            if (rowList.length > 1) {
                result.push({ name: "" })
                rowList.forEach((btn, idx) => {
                    const isLeader = idx < rowList.length - 1
                    result.push(transformBtn(btn, isLeader))
                })
            } else {
                result.push(transformBtn(rowList[0], false))
            }
        }
        return result
    }

    if (inline) {
        const result = []
        const allIconOnly = buttons.every(b => b && b.iconOnly)
        const chunkSize = allIconOnly ? 3 : 2

        for (let i = 0; i < buttons.length; i += chunkSize) {
            const chunk = buttons.slice(i, i + chunkSize)
            if (chunk.length > 1) {
                result.push({ name: "" })
                chunk.forEach((btn, idx) => {
                    const isLeader = idx < chunk.length - 1
                    result.push(transformBtn(btn, isLeader))
                })
            } else {
                result.push(transformBtn(chunk[0], false))
            }
        }
        return result
    }

    return buttons.map(btn => transformBtn(btn, false))
}

export const buildOrderStatusMenu = async (sock, jid, data, options = {}) => {
    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: false
    }

    if (data.image) {
        let imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image)
        const content = await sock.generateWMContent({ image: imgBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.imageMessage = content.imageMessage
    } else if (data.video) {
        let vidBuffer = Buffer.isBuffer(data.video) ? data.video : await sock.getBuffer(data.video)
        const content = await sock.generateWMContent({ video: vidBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.videoMessage = content.videoMessage
    }

    const buttons = mapButtons(data.buttons, { inline: Boolean(data.inline) })
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    if (data.reminder) {
        const schedTime = typeof data.reminder === 'object' && data.reminder.timestamp
            ? data.reminder.timestamp
            : (Date.now() + 86400000) // Mañana por defecto

        messageParams.reminder_info = {
            reminder_status: "reminder_pending",
            scheduled_timestamp: schedTime
        }
    }

    let ctxInfo = { 
        mentionedJid: options.mentions || [], 
        remoteJid: jid,
        pairedMediaType: 0
    }

    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    if (data.inline || buttons.some(b => b.name === "")) {
    ctxInfo.isForwarded = false
    ctxInfo.forwardingScore = 9999
    }

    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || data.text || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: {
                buttons: buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : " "
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{
                tag: "native_flow",
                attrs: { v: "9", name: "mixed" }
            }]
        }]
    }]

    return { message, nodes }
}

export const buildMediaMenu = async (sock, jid, data, options) => {
    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: false
    }

    if (data.image) {
        let imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image)
        if (!imgBuffer || !imgBuffer.length) {
            imgBuffer = await sock.resizePhoto({ image: 'https://files.catbox.moe/obz4b4.jpg', scale: 300, result: 'buffer' })
        }
        const content = await sock.generateWMContent({ image: imgBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.imageMessage = content.imageMessage
    }

    const buttons = mapButtons(data.buttons, { inline: Boolean(data.inline) })
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }
    
    if (data.reminder) {
        const schedTime = typeof data.reminder === 'object' && data.reminder.timestamp
            ? data.reminder.timestamp
            : (Date.now() + 86400000) // Mañana por defecto

        messageParams.reminder_info = {
            reminder_status: "reminder_pending",
            scheduled_timestamp: schedTime
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    if (data.inline || buttons.some(b => b.name === "")) {
    ctxInfo.isForwarded = false
    ctxInfo.forwardingScore = 9999
    }

    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: {
                buttons: buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                messageVersion: 1
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [ {
        tag: "biz",
        attrs: {},
        content:[ {
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            }, content:[{
                    tag: "native_flow",
                    attrs: { name: "mixed" }
                }]
            } ]
        } ]
    return { message, nodes }
}

export const buildLocationMenu = async (sock, jid, data, options) => {
    let mapBuffer = Buffer.alloc(0)
    try {
        let mBuf = await sock.getBuffer(data.mapImage || 'https://files.catbox.moe/obz4b4.jpg')
        mapBuffer = await sock.resizePhoto({ image: mBuf, scale: 300, result: 'buffer' })
    } catch (e) {}

    const buttons = mapButtons(data.buttons, { inline: Boolean(data.inline) })
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }
    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta",
            url: data.offer.url || "https://github.com/Syllkom",
            copy_code: data.offer.code || "AETHERO",
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }
    if (data.reminder) {
        const schedTime = typeof data.reminder === 'object' && data.reminder.timestamp
            ? data.reminder.timestamp
            : (Date.now() + 86400000) // Mañana por defecto

        messageParams.reminder_info = {
            reminder_status: "reminder_pending",
            scheduled_timestamp: schedTime
        }
    }

    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: mapBuffer.length > 0
    }
    if (mapBuffer.length > 0) {
        headerObj.locationMessage = {
            degreesLatitude: 0,
            degreesLongitude: 0,
            name: data.locationName || "Aethero",
            address: data.locationAddress || "Engine",
            url: data.locationUrl || "https://github.com/Syllkom",
            jpegThumbnail: mapBuffer
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (data.thumbnail) {
        ctxInfo.externalAdReply = {
            title: data.thumbTitle || "Aethero",
            body: data.thumbBody || "System",
            thumbnailUrl: data.thumbnail,
            sourceUrl: data.thumbUrl || "https://github.com/Syllkom",
            mediaType: 1,
            renderLargerThumbnail: true
        }
    }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    let nodes = [ {
        tag: "biz", attrs: {},
        content:[ { tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            }, content:[{
                    tag: "native_flow",
                    attrs: { name: "mixed" }
                }]
            } ]
        } ]

    if (data.inline || buttons.some(b => b.name === "")) {
    ctxInfo.isForwarded = false
    ctxInfo.forwardingScore = 9999
    }
    
    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: { 
                buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                messageVersion: 1
            },
            contextInfo: ctxInfo
        }
    }
    
    return { message, nodes }
}

export const buildInteractiveMenu = async (sock, jid, data, options) => {
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
    
    let docBuffer = dummyPng 
    if (data.document) { 
        try { docBuffer = Buffer.isBuffer(data.document) ? data.document : await sock.getBuffer(data.document); } catch (e) {} 
    }

    let thumbBuffer = null
    if (data.thumbnail) {
        try {
            let tBuf = Buffer.isBuffer(data.thumbnail) ? data.thumbnail : await sock.getBuffer(data.thumbnail)
            thumbBuffer = await sock.resizePhoto({ image: tBuf, scale: 300, result: 'buffer' })
        } catch (e) {}
    }

    const content = await sock.generateWMContent({
        document: docBuffer, 
        fileName: data.fileName || 'Archivo', 
        mimetype: data.mimetype || 'image/png',
        fileLength: data.fileLength || 0, 
        ...(thumbBuffer ? { jpegThumbnail: thumbBuffer } : {})
    })

    const buttons = mapButtons(data.buttons, { inline: Boolean(data.inline) })
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }
    
    if (data.reminder) {
        const schedTime = typeof data.reminder === 'object' && data.reminder.timestamp
            ? data.reminder.timestamp
            : (Date.now() + 86400000) // Mañana por defecto

        messageParams.reminder_info = {
            reminder_status: "reminder_pending",
            scheduled_timestamp: schedTime
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid, ...(options.externalAdReply ? { externalAdReply: options.externalAdReply } : {}) }
    if (options.quoted) {
        const q = options.quoted; ctxInfo.stanzaId = q.key.id; ctxInfo.participant = q.key.participant || q.key.remoteJid; ctxInfo.quotedMessage = q.message;
    }

    let nodes = [ { tag: "biz", attrs: {}, content:[ { tag: "interactive", attrs: { type: "native_flow", v: "1" }, content:[{ tag: "native_flow", attrs: { name: "mixed" } }] } ] } ]
    
    if (data.inline || buttons.some(b => b.name === "")) {
    ctxInfo.isForwarded = false
    ctxInfo.forwardingScore = 9999
    }

    const message = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    header: { title: data.title || "", subtitle: data.subtitle || "", hasMediaAttachment: true, documentMessage: content.documentMessage },
                    body: { text: data.body || "" }, footer: { text: data.footer || "" },
                    nativeFlowMessage: { 
                        buttons, 
                        messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "", 
                        messageVersion: 1 
                    },
                    contextInfo: ctxInfo
                }
            }
        }
    }
    
    return { message, nodes }
}

export const buildCards = async (sock, jid, data, options) => {
    const imgBuffer = await sock.getBuffer(data.image || 'https://files.catbox.moe/obz4b4.jpg')
    const uploaded = await sock.generateWMContent({ image: imgBuffer })
    
    const message = {
        interactiveMessage: {
            header: { hasMediaAttachment: true, imageMessage: uploaded.imageMessage },
            body: { text: data.text || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: { messageVersion: 3, buttons: data.buttons || [] },
            contextInfo: { mentionedJid: options.mentions || [], remoteJid: jid }
        }
    }
    const nodes = [{
        tag: "biz",
        attrs: {},
        content:[{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1" }, content:[{
                    tag: "native_flow",
                    attrs: { name: "order_details" }
                }]
            }]
        }]
    return { message, nodes }
}

export const buildPollSnapshot = async (sock, jid, data = {}, options = {}) => {
    const title = data.title || data.name || 'Encuesta'
    const isClosed = Boolean(data.closed || data.snapshot || data.stats || data.votes)

    let ctxInfo = {
        mentionedJid: options.mentions || data.mentions || [],
        remoteJid: jid,
        ...(options.contextInfo || {})
    }

    if (options.quoted) {
        const q = options.quoted?.raw || options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    if (isClosed) {
        const rawVotes = data.votes || data.stats || data.options || []
        const pollVotes = rawVotes.map((v, idx) => {
            if (typeof v === 'string') {
                return { optionName: v, optionVoteCount: 0 }
            }
            return {
                optionName: v.name || v.optionName || v.title || `Opcion ${idx + 1}`,
                optionVoteCount: Math.round(v.votes || v.voteCount || v.value || v.count || 0)
            }
        })

        const message = {
            pollResultSnapshotMessage: {
                name: title,
                pollVotes,
                pollType: 0,
                contextInfo: ctxInfo
            }
        }

        const id = options.messageId || ('HK_POLL_' + Date.now().toString(36))
        await sock.relayMessage(jid, message, { messageId: id })
        return { key: { id, remoteJid: jid, fromMe: true }, message }
    }

    const rawOptions = data.options || data.values || []
    const hasImages = rawOptions.some(opt => typeof opt === 'object' && Boolean(opt.image || opt.img))
    const selectableCount = data.selectableCount || data.selectableOptionsCount || 1
    const messageSecret = crypto.randomBytes(32)

    const hashOpt = (name, sha) =>
        crypto
            .createHash('sha256')
            .update(
                crypto.createHash('sha256').update(String(name)).digest('hex') +
                    (sha ? Buffer.from(sha).toString('base64') : '')
            )
            .digest('hex')

    if (hasImages) {
        const processedOptions = await Promise.all(
            rawOptions.map(async (item, index) => {
                const rawImage = typeof item === 'object' ? (item.image || item.img) : null
                let imageMessage = null

                if (rawImage) {
                    const buffer = Buffer.isBuffer(rawImage)
                        ? rawImage
                        : await sock.getBuffer(rawImage?.url || rawImage)
                    const media = await sock.generateWMContent({ image: buffer })
                    imageMessage = media.imageMessage
                }

                const optName = String(typeof item === 'string' ? item : (item.name || item.title || `Opcion ${index + 1}`))
                const optionHash = hashOpt(optName, imageMessage?.fileSha256)

                return { name: optName, imageMessage, optionHash }
            })
        )

        const pollType = proto?.Message?.PollContentType?.IMAGE ?? 2
        const assocType = proto?.MessageAssociation?.AssociationType?.MEDIA_POLL ?? 7

        const parent = await sock.generateWMContent({
            pollCreationMessageV3: {
                name: title,
                selectableOptionsCount: selectableCount,
                options: processedOptions.map(({ name, optionHash }) => ({
                    optionName: name,
                    optionHash
                })),
                pollContentType: pollType
            }
        })

        const parentPayload = {
            pollCreationMessageV3: parent.pollCreationMessageV3,
            messageContextInfo: {
                messageSecret,
                ...ctxInfo
            }
        }

        const parentId = options.messageId || ('HK_POLL_' + Date.now().toString(36))
        await sock.relayMessage(jid, parentPayload, {
            messageId: parentId,
            additionalNodes: [{
                tag: 'meta',
                attrs: {
                    polltype: 'creation',
                    contenttype: 'image'
                }
            }]
        })

        const parentKey = { id: parentId, remoteJid: jid, fromMe: true }

        for (const { imageMessage } of processedOptions) {
            if (!imageMessage) continue

            const child = proto.Message.create({
                messageContextInfo: {
                    messageAssociation: {
                        parentMessageKey: parentKey,
                        associationType: assocType
                    }
                },
                pollCreationOptionImageMessage: {
                    message: { imageMessage }
                }
            })

            await sock.relayMessage(jid, child, {
                messageId: crypto.randomUUID(),
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {
                        message_association_type: 'media_poll'
                    }
                }]
            })
        }

        return parentKey
    }

    const processedOptions = rawOptions.map((item, index) => {
        const optName = String(typeof item === 'string' ? item : (item.name || item.title || `Opcion ${index + 1}`))
        const optionHash = hashOpt(optName)
        return { optionName: optName, optionHash }
    })

    const message = {
        pollCreationMessageV3: {
            name: title,
            selectableOptionsCount: selectableCount,
            options: processedOptions,
            pollContentType: 1
        },
        messageContextInfo: {
            messageSecret,
            ...ctxInfo
        }
    }

    const id = options.messageId || ('HK_POLL_' + Date.now().toString(36))
    await sock.relayMessage(jid, message, { messageId: id })
    return { key: { id, remoteJid: jid, fromMe: true }, message }
}

export const buildProductMenu = async (sock, jid, data, options) => {
    let imgBuffer = Buffer.alloc(0)
    if (data.image) {
        try { imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image); } catch (e) {}
    }
    const imgContent = await sock.generateWMContent({ image: imgBuffer })

    const buttons = mapButtons(data.buttons, { inline: Boolean(data.inline) })
    let ctxInfo = { 
        mentionedJid: options.mentions || [],
        remoteJid: jid, ...(options.externalAdReply ? { externalAdReply: options.externalAdReply } : {})
    }
    
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const productObj = {
        productImage: imgContent.imageMessage,
        productId: data.productId || "HK_PROD_" + Date.now(),
        title: data.title || "",
        description: data.description || "",
        currencyCode: data.currency || "USD",
        priceAmount1000: (data.price || 0) * 1000,
        retailerId: data.retailerId || "Aethero",
        productImageCount: 1
    }

    if (data.salePrice) {
        productObj.salePriceAmount1000 = data.salePrice * 1000
    }

    let messageParams = {}
    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }
    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }
    
    if (data.reminder) {
        const schedTime = typeof data.reminder === 'object' && data.reminder.timestamp
            ? data.reminder.timestamp
            : (Date.now() + 86400000) // Mañana por defecto

        messageParams.reminder_info = {
            reminder_status: "reminder_pending",
            scheduled_timestamp: schedTime
        }
    }

    let nodes = [ {
        tag: "biz",
        attrs: {},
        content:[ {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content:[{ tag: "native_flow",
                attrs: { v: "9", name: "mixed" }
            }]
        } ]
    } ]

    if (data.inline || buttons.some(b => b.name === "")) {
    ctxInfo.isForwarded = false
    ctxInfo.forwardingScore = 9999
    }

    const message = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    header: {
                        hasMediaAttachment: true,
                        productMessage: {
                            product: productObj,
                            businessOwnerJid: "0@s.whatsapp.net"
                        }
                    },
                    body: { text: data.body || "" },
                    footer: { text: data.footer || "" },
                    nativeFlowMessage: { 
                        buttons, 
                        messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                        messageVersion: 3
                    },
                    contextInfo: ctxInfo
                }
            }
        }
    }

    return { message, nodes }
}

export const buildAdMenu = async (sock, jid, data, options) => {
    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        interactiveMessage: {
            header: {
                title: data.title || ""
            },
            body: {
                text: data.body || ""
            },
            nativeFlowMessage: {
                buttons: [
                    {
                        name: "inapp_signup",
                        buttonParamsJson: "{}"
                    }
                ],
                messageParamsJson: ""
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            },
            content: [{
                tag: "native_flow",
                attrs: { name: "mixed" }
            }]
        }]
    }]

    return { message, nodes }
}

export const buildLocationButtons = async (sock, jid, data, options = {}) => {
    let thumbBuffer = Buffer.alloc(0)
    if (data.image) {
        try {
            let imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image)
            thumbBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 300, result: 'buffer' })
        } catch (e) {}
    }

    const buttons = (data.buttons || []).map((btn, index) => {
        return {
            buttonId: btn.id || btn.buttonId || `btn_${index + 1}`,
            buttonText: {
                displayText: btn.text || btn.displayText || `Opción ${index + 1}`
            },
            type: 1
        }
    })

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        buttonsMessage: {
            buttons,
            locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: data.title || data.name || "",
                address: data.subtitle || data.address || "",
                jpegThumbnail: thumbBuffer
            },
            contentText: data.body || data.text || "",
            footerText: data.footer || "",
            headerType: 6,
            contextInfo: ctxInfo
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{
                tag: "native_flow",
                attrs: { v: "9", name: "mixed" }
            }]
        }]
    }]

    return { message, nodes }
}

export const executeAlbumMessage = async (sock, jid, medias, options = {}) => {
    const caption = options.caption || ''
    const mediaList = medias.map(m => {
        if (m.type && m.data) {
            return { [m.type]: m.data,
                caption: m.caption || '' }
            } return m
        }
    )

    if (mediaList.length < 2) {
        const item = mediaList[0]
        const typeKey = item.image ? 'image' : 'video'
        const content = {[typeKey]: item[typeKey], caption: caption || item.caption || '' }
        if (typeKey === 'document' || options.contextInfo)
            return await sock.sendMessage(jid, { ...content, ...options }, { quoted: options.quoted })
        return await sock.sendMessage(jid, content, { quoted: options.quoted })
    }

    const imageCount = mediaList.filter(item => item.image).length
    const videoCount = mediaList.filter(item => item.video).length

    const album = await generateWAMessageFromContent(jid, {
        albumMessage: {
            expectedImageCount: imageCount,
            expectedVideoCount: videoCount,
            ...(options.quoted ? {
                contextInfo: {
                    remoteJid: options.quoted.key.remoteJid,
                    fromMe: options.quoted.key.fromMe,
                    stanzaId: options.quoted.key.id,
                    participant: options.quoted.key.participant || options.quoted.key.remoteJid
        }
    } : { contextInfo: {} })
}
    }, { userJid: sock.user.id })

    await sock.relayMessage(jid, album.message, { messageId: album.key.id })

    for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i]
        if (!item.image && !item.video) continue
        const mediaKey = item.image ? 'image' : 'video'
        const protoKey = item.image ? 'imageMessage' : 'videoMessage'
        const prepared = await prepareWAMessageMedia({ [mediaKey]: item[mediaKey] }, { upload: sock.waUploadToServer })
        const itemCaption = (i === 0 && caption) ? caption : (item.caption || '')
        if (itemCaption) prepared[protoKey].caption = itemCaption

        const container = await generateWAMessageFromContent(jid, {[protoKey]: prepared[protoKey],
            messageContextInfo: {
                messageAssociation: {
                    associationType: 1,
                    parentMessageKey: album.key
                }
            }
        }, { userJid: sock.user.id }
    )
        await sock.relayMessage(jid, container.message, { messageId: container.key.id })
        await new Promise(r => setTimeout(r, 500))
    }
    return album
}

export const buildPairedMedia = async (sock, jid, data = {}, options = {}) => {
    const { prepareWAMessageMedia } = await import('@whiskeysockets/baileys')

    const rawImage = data.image || data.img
    const rawChild = data.video || data.audio || data.media

    if (!rawImage || !rawChild) {
        throw new Error('pairedMedia requiere tanto una imagen como un video o audio')
    }

    const imgBuffer = Buffer.isBuffer(rawImage) ? rawImage : await sock.getBuffer(rawImage)
    const childBuffer = Buffer.isBuffer(rawChild) ? rawChild : await sock.getBuffer(rawChild)

    if (!imgBuffer.length || !childBuffer.length) {
        throw new Error('No se pudo procesar el buffer de imagen o medio para pairedMedia')
    }

    const isAudio = !!data.audio
    const childKey = isAudio ? 'audio' : 'video'
    const childProtoKey = isAudio ? 'audioMessage' : 'videoMessage'

    const preparedImage = await prepareWAMessageMedia(
        { image: imgBuffer },
        { upload: sock.waUploadToServer }
    )

    const preparedChild = await prepareWAMessageMedia(
        { [childKey]: childBuffer },
        { upload: sock.waUploadToServer }
    )

    let ctxInfo = {
        mentionedJid: options.mentions || data.mentions || [],
        remoteJid: jid,
        pairedMediaType: 5,
        statusSourceType: 0,
        ...(options.contextInfo || {})
    }

    if (options.quoted) {
        const q = options.quoted?.raw || options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const parentPayload = {
        imageMessage: {
            ...preparedImage.imageMessage,
            caption: data.caption || data.text || '',
            contextInfo: ctxInfo
        }
    }

    const parentId = options.messageId || ('HK_' + Date.now().toString(36))
    const parentResult = await sock.relayMessage(jid, parentPayload, { messageId: parentId })
    const parentKey = { id: parentResult || parentId, remoteJid: jid, fromMe: true }

    await new Promise(resolve => setTimeout(resolve, 400))

    const childPayload = {
        [childProtoKey]: {
            ...preparedChild[childProtoKey],
            contextInfo: {
                pairedMediaType: 6,
                statusSourceType: 0
            }
        },
        messageContextInfo: {
            messageAssociation: {
                associationType: 12,
                parentMessageKey: parentKey
            }
        }
    }

    await sock.relayMessage(jid, childPayload, {})

    return parentResult || parentId
}