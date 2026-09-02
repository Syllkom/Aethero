import { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2 } from '@whiskeysockets/baileys'
import crypto from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import { PassThrough, Readable } from 'stream'
import { getFFmpegPath } from '../media/ffmpegResolver.js'

const ffmpegPath = getFFmpegPath()
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath)
}

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
    if (!extract) {
        return {
            text,
            ie: [],
            inline_entities: []
        }
    }

    const createIE = (type, ie) => {
        if (type === 'hyperlink') {
            return {
                key: ie.key,
                metadata: {
                    display_name: ie.text,
                    is_trusted: ie.is_trusted,
                    url: ie.url,
                    __typename: 'GenAIInlineLinkItem'
                }
            }
        }

        if (type === 'citation') {
            return {
                key: ie.key,
                metadata: {
                    reference_id: ie.reference_id,
                    reference_url: ie.url,
                    reference_title: ie.url,
                    reference_display_name: ie.url,
                    sources: [],
                    __typename: 'GenAISearchCitationItem'
                }
            }
        }

        if (type === 'latex') {
            return {
                key: ie.key,
                metadata: {
                    latex_expression: ie.text,
                    latex_image: {
                        url: ie.url,
                        width: Number(ie.width) || 100,
                        height: Number(ie.height) || 100
                    },
                    font_height: Number(ie.font_height) || 83.333333333333,
                    padding: Number(ie.padding) || 15,
                    __typename: 'GenAILatexItem'
                }
            }
        }
    }

    let ie = []
    let inline_entities = []
    let result = ''
    let last = 0
    let citation_index = 1
    let hyperlink_index = 0
    let latex_index = 0
    let stack = []

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '[' && text[i - 1] !== '\\') {
            stack.push(i)
        } else if (text[i] === ']' && (text[i + 1] === '(' || text[i + 1] === '<')) {
            let start = stack.pop()
            if (start == null) continue

            let open = text[i + 1]
            let close = open === '(' ? ')' : '>'
            let type = open === '(' ? 'link' : 'latex'
            let end = i + 2
            let depth = 1

            while (end < text.length && depth) {
                if (text[end] === open && text[end - 1] !== '\\') depth++
                else if (text[end] === close && text[end - 1] !== '\\') depth--
                end++
            }

            if (depth) continue

            let raw = text.slice(start + 1, i).trim()
            let url = text.slice(i + 2, end - 1).trim()

            let key
            let tag
            let data

            if (type === 'latex') {
                if (!latex) continue
                let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|')
                key = `LATEX_${latex_index++}`
                tag = `{{${key}}}${txt || 'image'}{{/${key}}}`
                data = {
                    type: 'latex',
                    ie: { key, text: txt, url, width, height, font_height, padding }
                }
            } else if (raw) {
                if (!hyperlink) continue
                const trusted = !url.startsWith('!')
                if (!trusted) url = url.slice(1)
                key = `HYPERLINK_${hyperlink_index++}`
                tag = `{{${key}}}${url}{{/${key}}}`
                data = {
                    type: 'hyperlink',
                    ie: { key, text: raw, url, is_trusted: trusted }
                }
            } else {
                if (!citation) continue
                key = `CITATION_${citation_index - 1}`
                tag = `{{${key}}}${url}{{/${key}}}`
                data = {
                    type: 'citation',
                    ie: { reference_id: citation_index++, key, text: '', url }
                }
            }

            result += text.slice(last, start) + tag
            last = end
            ie.push(data)

            const entity = createIE(data.type, data.ie)
            if (entity) inline_entities.push(entity)

            i = end - 1
        }
    }

    result += text.slice(last)
    return { text: result, ie, inline_entities }
}

async function waitAllPromises(input) {
    const isPromise = (v) => v && typeof v.then === 'function'
    const isObject = (v) => v && typeof v === 'object'

    const deep = async (v) => {
        if (isPromise(v)) return deep(await v)
        if (Array.isArray(v)) return Promise.all(v.map(deep))
        if (isObject(v)) {
            const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]))
            return Object.fromEntries(entries)
        }
        return v
    }

    return deep(await input)
}

class BaseBuilder {
    constructor() {
        this._title = ''
        this._subtitle = ''
        this._body = ''
        this._footer = ''
        this._contextInfo = {}
        this._extraPayload = {}
    }

    setTitle(title) {
        if (typeof title !== 'string') throw new TypeError('Title must be a string')
        this._title = title
        return this
    }

    setSubtitle(subtitle) {
        if (typeof subtitle !== 'string') throw new TypeError('Subtitle must be a string')
        this._subtitle = subtitle
        return this
    }

    setBody(body) {
        if (typeof body !== 'string') throw new TypeError('Body must be a string')
        this._body = body
        return this
    }

    setFooter(footer) {
        if (typeof footer !== 'string') throw new TypeError('Footer must be a string')
        this._footer = footer
        return this
    }

    setContextInfo(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('ContextInfo must be a plain object')
        }
        this._contextInfo = obj
        return this
    }

    addPayload(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Payload must be a plain object')
        }
        Object.assign(this._extraPayload, obj)
        return this
    }
}

export class Toolkit {
    static extractIE(text, options) {
        return extractIE(text, options)
    }

    static async resize(buffer, x, y, fit = 'cover') {
        const { Jimp } = await import('jimp')
        const img = await Jimp.read(buffer)
        if (fit === 'contain') {
            img.scaleToFit({ w: x, h: y })
        } else {
            img.cover({ w: x, h: y })
        }
        return await img.getBuffer('image/png')
    }

    static async waitAllPromises(input) {
        return await waitAllPromises(input)
    }

    static async fetchBuffer(url, options = {}, { silent = true } = {}) {
        try {
            let response = await fetch(url, options)
            if (!response.ok) throw Error(`HTTP ${response.status}`)
            return Buffer.from(await response.arrayBuffer())
        } catch (error) {
            if (silent) return Buffer.alloc(0)
            throw error
        }
    }

    static async toUrl(client, path, mediaType = 'document') {
        if (!path) throw new Error('Url or buffer needed')
        const media = await prepareWAMessageMedia(
            { [mediaType]: Buffer.isBuffer(path) ? path : { url: path } },
            { upload: client.waUploadToServer, jid: 'newsletter@broadcast' }
        )
        return Object.values(media)[0]?.url
    }

    static async resolveMedia(client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
        const isUrl = (str) => /^https?:\/\/.+/i.test(str)
        const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str)

        if (Array.isArray(media)) {
            return Promise.all(
                media.map((item) =>
                    Toolkit.resolveMedia(client, item, mediaType, { resolveUrl, resolveWAUrl, result, resize, width, height })
                )
            )
        }

        const originalIsBuffer = Buffer.isBuffer(media)

        if (typeof media === 'string' && isUrl(media)) {
            if (isWAUrl(media)) {
                if (resolveWAUrl) media = await Toolkit.fetchBuffer(media, {}, { silent: true })
                else if (!resolveUrl && result === 'url') return media
                else media = await Toolkit.fetchBuffer(media, {}, { silent: true })
            } else {
                if (!resolveUrl && result === 'url') return media
                else media = await Toolkit.fetchBuffer(media, {}, { silent: true })
            }
        }

        if (typeof media === 'string' && !isUrl(media)) {
            media = Buffer.from(media, 'base64')
        }

        if (!Buffer.isBuffer(media) || !media.length) return undefined

        if (resize && Buffer.isBuffer(media)) {
            media = await Toolkit.resize(media, width, height)
        }

        if (result === 'buffer') return media
        if (result === 'base64') return media.toString('base64')

        return Toolkit.toUrl(client, media, mediaType)
    }

    static getMp4Duration(buffer, { silent = true } = {}) {
        try {
            if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
                if (silent) return 0
                throw new Error('Invalid buffer')
            }
            let offset = 0
            while (offset < buffer.length - 8) {
                const size = buffer.readUInt32BE(offset)
                if (size < 8 || offset + size > buffer.length) {
                    if (silent) return 0
                    throw new Error('Invalid atom size')
                }
                const type = buffer.toString('ascii', offset + 4, offset + 8)
                if (type === 'moov') {
                    let moovOffset = offset + 8
                    const moovEnd = offset + size
                    while (moovOffset < moovEnd - 8) {
                        const childSize = buffer.readUInt32BE(moovOffset)
                        if (childSize < 8 || moovOffset + childSize > moovEnd) {
                            if (silent) return 0
                            throw new Error('Invalid child atom size')
                        }
                        const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8)
                        if (childType === 'mvhd') {
                            const version = buffer.readUInt8(moovOffset + 8)
                            if (version === 0) {
                                const timescale = buffer.readUInt32BE(moovOffset + 20)
                                const duration = buffer.readUInt32BE(moovOffset + 24)
                                if (!timescale) return 0
                                return duration / timescale
                            }
                            if (version === 1) {
                                const timescale = buffer.readUInt32BE(moovOffset + 32)
                                const duration = Number(buffer.readBigUInt64BE(moovOffset + 36))
                                if (!timescale) return 0
                                return duration / timescale
                            }
                        }
                        moovOffset += childSize
                    }
                }
                offset += size
            }
            return 0
        } catch (err) {
            if (silent) return 0
            throw err
        }
    }

    static getMp4Preview(videoBuffer, { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = {}) {
        return new Promise((resolve, reject) => {
            const fail = (err) => {
                if (silent) return resolve(result === 'base64' ? '' : Buffer.alloc(0))
                return reject(err)
            }

            try {
                if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
                    return fail(new Error('videoBuffer vacio o no valido'))
                }

                const inputStream = new Readable({ read() {} })
                inputStream.push(videoBuffer)
                inputStream.push(null)

                const outputStream = new PassThrough()
                const chunks = []

                outputStream.on('data', (chunk) => chunks.push(chunk))
                outputStream.on('end', async () => {
                    try {
                        let output = Buffer.concat(chunks)
                        if (!output.length) return fail(new Error('Output vacio'))
                        if (resize) output = await Toolkit.resize(output, width, height)
                        return resolve(result === 'base64' ? output.toString('base64') : output)
                    } catch (err) {
                        return fail(err)
                    }
                })
                outputStream.on('error', fail)

                time = time ?? Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10)

                ffmpeg(inputStream)
                    .outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
                    .on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
                    .pipe(outputStream, { end: true })
            } catch (err) {
                return fail(err)
            }
        })
    }

    static stringifyEscaped(obj) {
        return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    }
}

export class AIRich extends BaseBuilder {
    #client

    constructor(client, { dynamic = true, unsupportedTypeAlert = true } = {}) {
        super()
        if (!client) throw new Error('Socket es requerido')
        this.#client = client
        this._contextInfo = {}
        this._nodes = []
        this._idIndex = new Map()
        this._unsupportedTypeAlert = !!unsupportedTypeAlert
        this._dynamic = !!dynamic
        this._responseId = crypto.randomUUID()
        this._botResponseId = crypto.randomUUID()
        this._lastMessageKey = null
    }

    loadFrom(msg) {
        if (!msg) throw new Error('Mensaje AI Rich requerido')
        const message = msg.message ?? msg

        let rich = message?.botForwardedMessage?.message?.richResponseMessage
            || message?.botForwardedMessage?.richResponseMessage
            || message?.richResponseMessage

        if (!rich) throw new Error('richResponseMessage no encontrado')

        const messageContextInfo = message?.messageContextInfo ?? {}
        const botMetadata = messageContextInfo?.botMetadata ?? {}

        this._title = botMetadata?.messageDisclaimerText ?? ''
        this._contextInfo = structuredClone(rich?.contextInfo ?? {})

        const loadedSubmessages = Array.isArray(rich?.submessages) ? structuredClone(rich.submessages) : []
        let loadedSections = []

        const unifiedData = rich?.unifiedResponse?.data
        if (unifiedData) {
            try {
                const decoded = Buffer.from(unifiedData, 'base64').toString('utf8')
                const unifiedResponse = JSON.parse(decoded)
                if (Array.isArray(unifiedResponse?.sections)) {
                    loadedSections = structuredClone(unifiedResponse.sections)
                }
            } catch {}
        }

        this._nodes = []
        this._idIndex = new Map()

        const maxLength = Math.max(loadedSections.length, loadedSubmessages.length)
        for (let i = 0; i < maxLength; i++) {
            this._nodes.push({
                id: null,
                section: loadedSections[i] ?? null,
                submessage: loadedSubmessages[i] ?? null
            })
        }

        this._extraPayload = {}
        for (const [key, value] of Object.entries(message)) {
            if (key !== 'messageContextInfo' && key !== 'botForwardedMessage' && key !== 'richResponseMessage') {
                this._extraPayload[key] = structuredClone(value)
            }
        }

        return this
    }

    setResponseId(id) {
        if (typeof id !== 'string') throw new TypeError('ID must be a string')
        this._responseId = id
        return this
    }

    refreshResponseId() {
        this._responseId = crypto.randomUUID()
        return this
    }

    setBotResponseId(id) {
        if (typeof id !== 'string') throw new TypeError('ID must be a string')
        this._botResponseId = id
        return this
    }

    refreshBotResponseId() {
        this._botResponseId = crypto.randomUUID()
        return this
    }

    createAlert(type) {
        if (this._unsupportedTypeAlert) {
            return {
                messageType: 2,
                messageText: `[ UNSUPPORTED_TYPE - ${type}]`
            }
        }
        return undefined
    }

    addText(text, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
        if (typeof text !== 'string') throw new TypeError('Text must be a string')
        const { text: extractedText, inline_entities } = extractIE(text, { hyperlink, citation, latex })
        const section = AIRich.newLayout('Single', {
            text: extractedText,
            ...(inline_entities.length && { inline_entities }),
            __typename: 'GenAIMarkdownTextUXPrimitive'
        })
        const submessages = [{ messageType: 2, messageText: text }]
        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addHtml(html, { trustedSources = [], id, replace, insertAt } = {}) {
        if (typeof html !== 'string') throw new TypeError('HTML must be a string')
        const section = AIRich.newLayout('Single', {
            payload: html,
            trusted_sources: trustedSources,
            __typename: 'GenAIaeacdsnwHtmlPrimitive'
        })
        const submessages = [{ messageType: 2, messageText: 'Interactive HTML' }]
        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addFOAText(text, { id, replace, insertAt } = {}) {
        if (typeof text !== 'string') throw new TypeError('Text must be a string')
        const section = AIRich.newLayout('Single', { text, __typename: 'FOATextPrimitive' })
        const submessages = [{ messageType: 2, messageText: text }]
        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addCode(language, code, { id, replace, insertAt } = {}) {
        if (typeof language !== 'string' || typeof code !== 'string') {
            throw new TypeError('Language and code must be a string')
        }
        const meta = AIRich.tokenizer(code, language)
        const section = AIRich.newLayout('Single', {
            language,
            code_blocks: meta.unified_codeBlock,
            __typename: 'GenAICodeUXPrimitive'
        })
        const submessages = [{
            messageType: 5,
            codeMetadata: { codeLanguage: language, codeBlocks: meta.codeBlock }
        }]
        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addTable(table, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
        if (!Array.isArray(table)) throw new TypeError('Table must be an array')
        const meta = AIRich.toTableMetadata(table, { hyperlink, citation, latex })
        const section = AIRich.newLayout('Single', {
            rows: meta.unified_rows,
            __typename: 'GenATableUXPrimitive'
        })
        const submessages = [{
            messageType: 4,
            tableMetadata: { title: meta.title, rows: meta.rows }
        }]
        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addSource(sources = [], { id, replace, insertAt } = {}) {
        if (!Array.isArray(sources)) throw new TypeError('Sources must be an array')
        if (sources.every(item => typeof item === 'string')) sources = [sources]

        const normalizedSources = sources.map((source) => {
            if (Array.isArray(source)) {
                const [icon, url, title, subtitle] = source
                return { icon, url, title, subtitle }
            }
            return {
                icon: source.favicon ?? source.icon ?? '',
                url: source.url ?? '',
                title: source.title ?? '',
                subtitle: source.subtitle ?? ''
            }
        })

        const source = normalizedSources.map(({ icon, url, title, subtitle }) => ({
            source_type: 'THIRD_PARTY',
            source_display_name: title,
            source_subtitle: subtitle,
            source_url: url,
            favicon: {
                url: Toolkit.resolveMedia(this.#client, icon, 'image'),
                mime_type: 'image/jpeg',
                width: 16,
                height: 16
            }
        }))

        const submessage = this.createAlert('GenAISearchResultPrimitive')
        const section = AIRich.newLayout('Single', { sources: source, __typename: 'GenAISearchResultPrimitive' })
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addReels(reelsItems = [], { id, replace, insertAt } = {}) {
        const items = Array.isArray(reelsItems) ? reelsItems : [reelsItems]
        const reels = items.map((item) => ({
            ...item,
            _avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? '', 'image'),
            _thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? '', 'image')
        }))

        const section = AIRich.newLayout('HScroll', reels.map((item) => ({
            reels_url: item.videoUrl ?? item.url ?? '',
            thumbnail_url: item._thumbnail,
            creator: item.username ?? item.title ?? '',
            avatar_url: item._avatar,
            reels_title: item.reels_title ?? item.title ?? '',
            likes_count: item.likes_count ?? item.like ?? 0,
            shares_count: item.shares_count ?? item.share ?? 0,
            view_count: item.view_count ?? item.view ?? 0,
            reel_source: item.reel_source ?? item.source ?? 'IG',
            is_verified: !!(item.is_verified || item.verified),
            __typename: 'GenAIReelPrimitive'
        })))

        const submessages = [{
            messageType: 9,
            contentItemsMetadata: {
                contentType: 1,
                itemsMetadata: reels.map((item) => ({
                    reelItem: {
                        title: item.username ?? '',
                        profileIconUrl: item._avatar,
                        thumbnailUrl: item._thumbnail,
                        videoUrl: item.videoUrl ?? item.url ?? ''
                    }
                }))
            }
        }]

        return this._addContent(section, submessages, { id, replace, insertAt })
    }

    addImage(imageUrl, { width, height, status = 'READY', update_text, resolveUrl = false, id, replace, insertAt } = {}) {
        const list = Array.isArray(imageUrl)
            ? imageUrl.map(v => {
                const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl })
                return { imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: url }
            })
            : (() => {
                const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl })
                return [{ imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: url }]
            })()

        const sections = list.map(({ imagePreviewUrl }) =>
            AIRich.newLayout('Single', {
                media: { url: imagePreviewUrl, mime_type: 'image/png', width, height },
                imagine_type: 'IMAGE',
                status: { status, update_text },
                __typename: 'GenAIImaginePrimitive'
            })
        )

        const submessage = {
            messageType: 1,
            gridImageMetadata: {
                gridImageUrl: { imagePreviewUrl: list[0]?.imagePreviewUrl },
                imageUrls: list
            }
        }

        return this._addContent(sections, submessage, { id, replace, insertAt })
    }

    addVideo(videoUrl, { autoFill = true, status = 'READY', estimatedTime, id, replace, insertAt } = {}) {
        const isObjectVideo = (v) => v && typeof v === 'object' && !Array.isArray(v) && v.url
        const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl]
        const alert = this.createAlert('GenAIImaginePrimitive (ANIMATE)')
        const sections = []

        for (const item of items) {
            const isObject = isObjectVideo(item)
            const url = isObject ? Toolkit.resolveMedia(this.#client, item.url ?? '', 'video') : Toolkit.resolveMedia(this.#client, item, 'video')
            const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null
            const file_length = isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => b?.length ?? 0) : 0
            const duration = isObject && item.duration != null ? item.duration : autoFill ? bufferPromise.then((b) => Toolkit.getMp4Duration(b, { silent: true })) : 0
            const thumbnail = isObject && item.thumbnail
                ? Toolkit.resolveMedia(this.#client, item.thumbnail, 'image', { result: 'base64', resize: true, width: 300, height: 300 })
                : autoFill ? bufferPromise?.then((b) => Toolkit.getMp4Preview(b, { time: 0, result: 'base64' })) : null

            sections.push(
                AIRich.newLayout('Single', {
                    media: { url, mime_type: isObject ? (item.mime_type ?? 'video/mp4') : 'video/mp4', file_length, duration },
                    imagine_type: 'ANIMATE',
                    status: { status, estimated_completion_time: estimatedTime != null ? Math.floor((Date.now() + estimatedTime) / 1000) : undefined },
                    thumbnail: { raw_media: thumbnail },
                    __typename: 'GenAIImaginePrimitive'
                })
            )
        }

        return this._addContent(sections, alert, { id, replace, insertAt })
    }

    addProduct(data = {}, { id, replace, insertAt } = {}) {
        const items = Array.isArray(data) ? data : [data]
        const product = items.map((item) => ({
            title: item.title,
            brand: item.brand,
            price: item.price,
            sale_price: item.sale_price,
            product_url: item.product_url ?? item.url,
            image: { url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image, 'image') },
            additional_images: [{ url: Toolkit.resolveMedia(this.#client, item.icon_url ?? item.icon, 'image') }],
            __typename: 'GenAIProductItemCardPrimitive'
        }))

        const section = AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0])
        const submessage = this.createAlert('GenAIProductItemCardPrimitive')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addPost(data = {}, { id, replace, insertAt } = {}) {
        const posts = Array.isArray(data) ? data : [data]
        const primitives = posts.map((p) => ({
            title: p.title ?? '',
            subtitle: p.subtitle ?? '',
            username: p.username ?? '',
            profile_picture_url: Toolkit.resolveMedia(this.#client, p.profile_picture_url ?? p.profile_url ?? p.profile ?? '', 'image'),
            is_verified: !!(p.is_verified || p.verified),
            thumbnail_url: Toolkit.resolveMedia(this.#client, p.thumbnail_url ?? p.thumbnail ?? '', 'image'),
            post_caption: p.post_caption ?? p.caption ?? '',
            likes_count: p.likes_count ?? p.like ?? 0,
            comments_count: p.comments_count ?? p.comment ?? 0,
            shares_count: p.shares_count ?? p.share ?? 0,
            post_url: p.post_url ?? p.url ?? '',
            post_deeplink: p.post_deeplink ?? p.deeplink ?? '',
            source_app: p.source_app || p.source || 'INSTAGRAM',
            footer_label: p.footer_label ?? p.footer ?? '',
            footer_icon: Toolkit.resolveMedia(this.#client, p.footer_icon ?? p.icon ?? '', 'image'),
            is_carousel: posts.length > 1,
            orientation: p.orientation ?? 'LANDSCAPE',
            post_type: p.post_type ?? 'VIDEO',
            __typename: 'GenAIPostPrimitive'
        }))

        const section = AIRich.newLayout('HScroll', primitives)
        const submessage = this.createAlert('GenAIPostPrimitive')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addMetadata(text, { id, replace, insertAt } = {}) {
        if (typeof text !== 'string') throw new TypeError('Text must be a string')
        const section = AIRich.newLayout('Single', { text, __typename: 'GenAIMetadataTextPrimitive' })
        const submessage = { messageType: 2, messageText: text }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addTip(text, { id, replace, insertAt } = {}) {
        if (typeof text !== 'string') throw new TypeError('Text must be a string')
        const section = AIRich.newLayout('Single', { text: 'i ' + text, __typename: 'GenAIMetadataTextPrimitive' })
        const submessage = { messageType: 2, messageText: text }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addWidget(data, { layout, id, replace, insertAt, ...options } = {}) {
        const isArray = Array.isArray(data)
        const items = isArray ? data : [data]

        const widgets = items.map((item) => ({
            __typename: 'GenAI3PExtWidgetPrimitive',
            header: {
                __typename: 'GenAI3PExtWidgetStandardHeader',
                title: item.title ?? '',
                ...(item.header ?? {})
            },
            body: {
                __typename: 'GenAI3PExtCalendarEventList',
                sections: item.sections ?? [],
                ctas: (item.actions ?? []).map((action) => ({
                    __typename: 'GenAI3PExtWidgetCTA',
                    label: action.label ?? '',
                    state: action.state ?? 'PENDING',
                    kind: action.kind ?? 'OTHER',
                    tool_call_id: action.tool_call_id ?? action.id ?? '',
                    ...(action.toast && {
                        toast: {
                            __typename: 'GenAI3PExtWidgetToast',
                            label: action.toast.label ?? action.label ?? ''
                        }
                    })
                })),
                ...(item.body ?? {})
            }
        }))

        const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? widgets : widgets[0], options)
        const submessage = this.createAlert('GenAI3PExtWidgetStandardHeader')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addFooterAction(data, { layout, id, replace, insertAt, ...options } = {}) {
        const isArray = Array.isArray(data)
        const items = isArray ? data : [data]

        const actions = items.map((item) => ({
            __typename: 'GenAIFooterActionPrimitive',
            cta_text: item.text ?? item.cta_text ?? '',
            cta_type: item.type ?? item.cta_type ?? 'OPEN_URL',
            cta_url: item.url ?? item.cta_url ?? ''
        }))

        const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? actions : actions[0], options)
        const submessage = this.createAlert('GenAIFooterActionPrimitive')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addSuggest(suggestion, { scroll = true, layout, id, replace, insertAt } = {}) {
        const suggest = Array.isArray(suggestion)
            ? suggestion.map(text => ({ prompt_text: text, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }))
            : [{ prompt_text: suggestion, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }]

        const type = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow')
        const section = AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, { __typename: 'GenAIUnifiedResponseSection' })
        const submessage = this.createAlert('GenAIFollowUpSuggestionPillPrimitive')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    async build(jid, { bypassDownload = true, forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, messageId, ...options } = {}) {
        const forward = forwarded
            ? {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                forwardOrigin: 4
            }
            : {}

        const notif = notification
            ? {
                sessionTransparencyMetadata: {
                    disclaimerText: 'Aethero Engine',
                    hcaId: `hca_${Date.now()}`,
                    sessionTransparencyType: 1
                }
            }
            : {}

        const qObj = quoted
            ? {
                stanzaId: quoted?.key?.id || quoted?.id,
                participant: quotedParticipant || quoted?.key?.participant || quoted?.participant || quoted?.key?.remoteJid,
                quotedType: 0,
                quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined
            }
            : {}

        const sections = this._footer
            ? [
                ...(await waitAllPromises(this._sections)),
                AIRich.newLayout('Single', { text: this._footer, __typename: 'GenAIMetadataTextPrimitive' })
            ]
            : [...(await waitAllPromises(this._sections))]

        if (this._dynamic) {
            this.refreshResponseId()
            this.refreshBotResponseId()
        }

        return generateWAMessageFromContent(
            jid,
            {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                    botMetadata: {
                        messageDisclaimerText: this._title,
                        ...notif,
                        verificationMetadata: AIRich.generateVerificationMetadata(),
                        botResponseId: this._botResponseId
                    }
                },
                ...this._extraPayload,
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
                            unifiedResponse: {
                                data: includesUnifiedResponse ? Buffer.from(Toolkit.stringifyEscaped({ response_id: this._responseId, sections })).toString('base64') : ''
                            },
                            contextInfo: {
                                ...forward,
                                ...qObj,
                                ...this._contextInfo
                            }
                        }
                    }
                }
            },
            { messageId: messageId || generateMessageIDV2(), ...options }
        )
    }

    async buildEdit(targetJid, targetId, { msg, messageId, ...options } = {}) {
        if (!msg) msg = (await this.build(targetJid, options)).message
        const editedMessage = msg
        if (!editedMessage) throw new Error('buildEdit: msg no contiene botForwardedMessage')

        return generateWAMessageFromContent(
            targetJid,
            {
                botForwardedMessage: {
                    message: {
                        protocolMessage: {
                            key: { remoteJid: targetJid, fromMe: true, id: targetId },
                            type: 14,
                            editedMessage
                        }
                    }
                }
            },
            { messageId: messageId || generateMessageIDV2(), ...options }
        )
    }

    async sendEdit(jid, id, { msg, messageId, additionalNodes = [], ...options } = {}) {
        jid = jid ?? this._lastMessageKey?.remoteJid
        id = id ?? this._lastMessageKey?.id
        if (!jid) throw new Error('JID es requerido')
        if (!id) throw new Error('Message id es requerido')

        const msgEdit = await this.buildEdit(jid, id, {
            msg,
            messageId: messageId || generateMessageIDV2(),
            ...options
        })

        await this.#client.relayMessage(jid, msgEdit.message, {
            messageId: msgEdit.key.id,
            additionalNodes
        })

        return msgEdit
    }

    async send(jid, { bypassDownload = true, forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, messageId, additionalNodes = [], ...options } = {}) {
        const msg = await this.build(jid, {
            forwarded,
            notification,
            includesUnifiedResponse,
            includesSubmessages,
            messageId,
            ...options
        })

        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes,
            ...options
        })

        if (includesUnifiedResponse && bypassDownload) {
            await this.sendEdit(jid, msg.key.id, { msg: msg.message })
        }

        this._lastMessageKey = msg.key
        return msg
    }

    static tokenizer(code, lang = 'javascript') {
        const keywordsMap = {
            javascript: new Set(['break', 'case', 'catch', 'continue', 'debugger', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'true', 'false', 'null', 'undefined', 'class', 'const', 'let', 'super', 'extends', 'export', 'import', 'yield', 'static', 'constructor', 'async', 'await', 'get', 'set']),
            typescript: new Set(['abstract', 'any', 'as', 'asserts', 'bigint', 'boolean', 'declare', 'enum', 'implements', 'infer', 'interface', 'is', 'keyof', 'module', 'namespace', 'never', 'readonly', 'require', 'number', 'object', 'override', 'private', 'protected', 'public', 'satisfies', 'string', 'symbol', 'type', 'unknown', 'using', 'from', 'break', 'case', 'catch', 'continue', 'do', 'else', 'finally', 'for', 'function', 'if', 'new', 'return', 'switch', 'this', 'throw', 'try', 'var', 'void', 'while', 'class', 'const', 'let', 'extends', 'import', 'export', 'async', 'await']),
            python: new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'])
        }

        if (!lang || lang === 'txt' || lang === 'text' || lang === 'plaintext') {
            return {
                codeBlock: [{ codeContent: code, highlightType: 0 }],
                unified_codeBlock: [{ content: code, type: 'DEFAULT' }]
            }
        }

        const TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' }
        const keywords = keywordsMap[lang.toLowerCase()] || new Set()
        const tokens = []
        let i = 0

        const push = (content, type) => {
            if (!content) return
            const last = tokens[tokens.length - 1]
            if (last && last.highlightType === type) {
                last.codeContent += content
            } else {
                tokens.push({ codeContent: content, highlightType: type })
            }
        }

        while (i < code.length) {
            const c = code[i]
            if (/\s/.test(c)) {
                let s = i
                while (i < code.length && /\s/.test(code[i])) i++
                push(code.slice(s, i), 0)
                continue
            }
            if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang))) {
                let s = i
                while (i < code.length && code[i] !== '\n') i++
                push(code.slice(s, i), 5)
                continue
            }
            if (c === '"' || c === "'" || c === '`') {
                let s = i
                const q = c
                i++
                while (i < code.length) {
                    if (code[i] === '\\' && i + 1 < code.length) i += 2
                    else if (code[i] === q) { i++; break }
                    else i++
                }
                push(code.slice(s, i), 3)
                continue
            }
            if (/[0-9]/.test(c)) {
                let s = i
                while (i < code.length && /[0-9._]/.test(code[i])) i++
                push(code.slice(s, i), 4)
                continue
            }
            if (/[a-zA-Z_$]/.test(c)) {
                let s = i
                while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++
                const word = code.slice(s, i)
                let type = keywords.has(word) ? 1 : 0
                push(word, type)
                continue
            }
            push(c, 0)
            i++
        }

        return {
            codeBlock: tokens,
            unified_codeBlock: tokens.map((t) => ({ content: t.codeContent, type: TYPE_MAP[t.highlightType] }))
        }
    }

    static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
        if (!Array.isArray(arr)) throw new TypeError('Table must be a nested array')
        const [header, ...rows] = arr
        const maxLen = Math.max(header.length, ...rows.map(r => r.length))
        const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')]

        const unified_rows = [
            { is_header: true, cells: normalize(header) },
            ...rows.map(r => ({ is_header: false, cells: normalize(r) }))
        ].map((row) => {
            const markdown_cells = row.cells.map((cell) => {
                const extracted = extractIE(cell, { hyperlink, citation, latex })
                return { text: extracted.text, ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}) }
            })
            return { ...row, ...(markdown_cells.some(c => c.inline_entities?.length) ? { markdown_cells } : {}) }
        })

        const rowsMeta = unified_rows.map((r) => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) }))
        return { title: '', rows: rowsMeta, unified_rows }
    }

    static generateVerificationMetadata() {
        const signatureMaterial = Buffer.from('AETHERO.AIRich.VerificationSignature')
        const certificateMaterial = Buffer.from('AETHERO.AIRich.CertificateChain')
        const signature = Buffer.concat([signatureMaterial, crypto.randomBytes(64 - signatureMaterial.length)]).toString('base64')
        const certificateChain = [
            Buffer.concat([certificateMaterial, crypto.randomBytes(684 - certificateMaterial.length)]).toString('base64'),
            Buffer.concat([certificateMaterial, crypto.randomBytes(892 - certificateMaterial.length)]).toString('base64')
        ]
        return {
            proofs: [{ version: 1, useCase: 1, signature, certificateChain }]
        }
    }

    static newLayout(name, data, extra = {}) {
        return {
            ...extra,
            view_model: {
                [Array.isArray(data) ? 'primitives' : 'primitive']: data,
                __typename: `GenAI${name}LayoutViewModel`
            }
        }
    }

    _makeNode(id, section, submessage) {
        return { id: id ?? null, section: section ?? null, submessage: submessage ?? null }
    }

    _registerId(node, id) {
        if (id === undefined || id === null || id === '') return
        if (typeof id !== 'string') throw new Error('Item id must be a string')
        if (this._idIndex.has(id)) throw new Error(`Item id "${id}" already exists`)
        node.id = id
        this._idIndex.set(id, node)
    }

    _unregisterId(node) {
        if (node.id && this._idIndex.get(node.id) === node) {
            this._idIndex.delete(node.id)
        }
    }

    hasId(id) {
        return typeof id === 'string' && this._idIndex.has(id)
    }

    getIds() {
        return [...this._idIndex.keys()]
    }

    peek(id) {
        const node = this._idIndex.get(id)
        if (!node) return null
        return { id: node.id, section: node.section, submessage: node.submessage }
    }

    assignId(index, id) {
        if (!Number.isInteger(index) || index < 0 || index >= this._nodes.length) {
            throw new Error('Index out of range')
        }
        const node = this._nodes[index]
        if (node.id) throw new Error(`Node already has id "${node.id}"`)
        this._registerId(node, id)
        return this
    }

    _getNode(id) {
        const node = this._idIndex.get(id)
        if (!node) throw new Error(`Item id "${id}" not found`)
        return node
    }

    _resolveTarget(target) {
        if (Array.isArray(target)) {
            const [id, offset = 0] = target
            return { id, offset }
        }
        return { id: target, offset: 0 }
    }

    _resolveNodeIndex(target) {
        const { id, offset } = this._resolveTarget(target)
        const node = this._getNode(id)
        const baseIndex = this._nodes.indexOf(node)
        const index = baseIndex + offset
        return { id, offset, baseIndex, index }
    }

    _validateSections(section) {
        const items = Array.isArray(section) ? section : [section]
        if (!items.length) throw new Error('At least one section is required')
        return items
    }

    _validateSubmessages(submessage) {
        if (submessage === undefined || submessage === null) return []
        return Array.isArray(submessage) ? submessage : [submessage]
    }

    _addContent(section, submessage, { id, replace, insertAt } = {}) {
        const hasReplace = replace !== undefined && replace !== null && replace !== ''
        const hasInsertAt = insertAt !== undefined && insertAt !== null && insertAt !== ''
        const sections = this._validateSections(section)
        const submessages = this._validateSubmessages(submessage)

        const pairedSubmessages = sections.map((_, index) => {
            if (!submessages.length) return undefined
            return submessages.length === 1 ? submessages[0] : submessages[index]
        })

        if (id && this._idIndex.has(id) && !(hasReplace && this._resolveTarget(replace)?.id === id)) {
            throw new Error(`Item id "${id}" already exists`)
        }

        const newNodes = sections.map((currentSection, index) => {
            return this._makeNode(index === 0 ? id : null, currentSection, pairedSubmessages[index])
        })

        if (hasReplace) {
            const target = this._resolveNodeIndex(replace)
            const oldNode = this._nodes[target.index]
            const newNode = newNodes[0]
            if (!newNode.id && oldNode?.id) newNode.id = oldNode.id
            this._unregisterId(oldNode)
            this._nodes.splice(target.index, 1, newNode)
            if (newNode.id) this._idIndex.set(newNode.id, newNode)
            return this
        }

        if (hasInsertAt) {
            const target = this._resolveNodeIndex(insertAt)
            const insertIndex = target.offset < 0 ? target.index : target.index + 1
            this._nodes.splice(insertIndex, 0, ...newNodes)
            for (const node of newNodes) {
                if (node.id) this._idIndex.set(node.id, node)
            }
            return this
        }

        this._nodes.push(...newNodes)
        for (const node of newNodes) {
            if (node.id) this._idIndex.set(node.id, node)
        }
        return this
    }

    addSection(section, options = {}) {
        return this._addContent(section, undefined, options)
    }

    addSubmessage(submessage, options = {}) {
        const items = this._validateSubmessages(submessage)
        return this._addContent(undefined, items, options)
    }

    delete(target) {
        const { index } = this._resolveNodeIndex(target)
        const [oldNode] = this._nodes.splice(index, 1)
        this._unregisterId(oldNode)
        return this
    }

    get _sections() {
        return this._nodes.filter((n) => n.section !== null).map((n) => n.section)
    }

    get _submessages() {
        return this._nodes.filter((n) => n.submessage !== null).map((n) => n.submessage)
    }

    get sections() {
        return this._sections
    }

    get items() {
        return this._sections.flatMap((section) => {
            const vm = section?.view_model
            if (Array.isArray(vm?.primitives)) return vm.primitives
            if (vm?.primitive) return [vm.primitive]
            return []
        })
    }

    addProgressStatus(title, { isInProgress = true, id, replace, insertAt } = {}) {
        if (typeof title !== 'string') throw new TypeError('Title must be a string')
        const section = AIRich.newLayout('Single', {
            title,
            is_in_progress: !!isInProgress,
            icon: null,
            meta_search_apps: null,
            target_secondary_screen_id: null,
            target_secondary_screen_tab_id: null,
            __typename: 'GenAIBotProgressStatusPrimitive'
        })
        const submessage = { messageType: 2, messageText: title }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addImageButton(imageUrl, { width = 100, height = 100, fontHeight = 24, padding = -5, ctaText, ctaUrl, id, replace, insertAt } = {}) {
        const key = 'header_' + crypto.randomBytes(4).toString('hex')
        const primitives = []

        if (ctaText && ctaUrl) {
            primitives.push({
                cta_text: ctaText,
                cta_type: 'OPEN_URL',
                cta_url: ctaUrl,
                __typename: 'GenAIFooterActionPrimitive'
            })
        }

        primitives.push({
            text: `{{${key}}}.{{/${key}}}`,
            inline_entities: [
                {
                    key,
                    metadata: {
                        latex_expression: '.',
                        font_height: fontHeight,
                        padding: padding,
                        latex_image: {
                            mime_type: 'image/png',
                            url: imageUrl,
                            url_fallback: imageUrl,
                            width,
                            height,
                            expiration_timestamp_ms: Date.now() + 86400000 * 30,
                            __typename: 'GenAIMediaItem'
                        },
                        __typename: 'GenAILatexItem'
                    },
                    __typename: 'GenAITextInlineEntity'
                }
            ],
            __typename: 'GenAIMarkdownTextUXPrimitive'
        })

        const section = {
            view_model: {
                primitives,
                __typename: 'GenAIActionRowLayoutViewModel'
            }
        }

        const submessage = { messageType: 2, messageText: ctaText || 'Logo Action' }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addSystemWidgets(widgetList = [], { id, replace, insertAt } = {}) {
        const list = Array.isArray(widgetList) ? widgetList : [widgetList]
        const primitives = list.map((w, idx) => ({
            header: {
                title: w.title || '',
                __typename: 'GenAI3PExtWidgetStandardHeader'
            },
            body: {
                sections: w.sections || [],
                ctas: (w.buttons || w.actions || []).map((btn, bIdx) => ({
                    label: btn.label || btn.text || '',
                    state: btn.state || 'PENDING',
                    kind: btn.kind || 'OTHER',
                    tool_call_id: btn.id || btn.tool_call_id || `${idx}${bIdx}`,
                    toast: {
                        label: btn.toast || btn.label || '',
                        __typename: 'GenAI3PExtWidgetToast'
                    },
                    __typename: 'GenAI3PExtWidgetCTA'
                })),
                __typename: 'GenAI3PExtCalendarEventList'
            },
            __typename: 'GenAI3PExtWidgetPrimitive'
        }))

        const section = AIRich.newLayout('HScroll', primitives)
        const submessage = { messageType: 2, messageText: 'System Widgets' }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addSocialCards(cards = [], { id, replace, insertAt } = {}) {
        const list = Array.isArray(cards) ? cards : [cards]
        const primitives = list.map(c => ({
            title: c.title || '',
            subtitle: c.subtitle || '',
            username: c.username || c.author || '',
            profile_picture_url: c.profile || c.avatar || c.thumbnail || '',
            is_verified: c.verified !== undefined ? !!c.verified : true,
            thumbnail_url: c.image || c.thumbnail || '',
            post_caption: c.caption || c.description || '',
            likes_count: c.likes || 0,
            comments_count: c.comments || 0,
            shares_count: c.shares || 0,
            post_url: c.url || '',
            post_deeplink: c.deeplink || c.url || '',
            source_app: (c.source || 'PINTEREST').toUpperCase(),
            footer_label: c.footer || 'Ver Enlace',
            footer_icon: c.icon || 'https://s.pinimg.com/webapp/logo_2x-e3979848.png',
            is_carousel: false,
            orientation: c.orientation || 'PORTRAIT',
            post_type: c.type || 'PHOTO',
            __typename: 'GenAIPostPrimitive'
        }))

        const section = AIRich.newLayout('HScroll', primitives)
        const submessage = { messageType: 2, messageText: 'Social Cards' }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }


    addBanner(imageUrl, { mimeType = 'image/jpeg', id, replace, insertAt } = {}) {
        if (typeof imageUrl !== 'string') throw new TypeError('imageUrl must be a string')
        const section = AIRich.newLayout('Single', {
            preview_image: {
                url: imageUrl,
                mime_type: mimeType,
                __typename: 'GenAIMediaItem'
            },
            full_image: {
                url: imageUrl,
                mime_type: mimeType,
                __typename: 'GenAIMediaItem'
            },
            __typename: 'GenAIImagePrimitive'
        })
        const submessage = { messageType: 2, messageText: 'Banner Image' }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addCitations(text, citationsList = [], { id, replace, insertAt } = {}) {
        if (typeof text !== 'string') throw new TypeError('Text must be a string')
        const list = Array.isArray(citationsList) ? citationsList : [citationsList]
        const inlineEntities = []

        list.forEach((cite, idx) => {
            const key = `IE_CITE_${idx}`
            inlineEntities.push({
                key,
                metadata: {
                    reference_id: idx + 1,
                    reference_url: cite.url || '',
                    reference_title: cite.title || cite.url || '',
                    reference_display_name: cite.name || cite.title || '',
                    sources: [
                        {
                            source_type: 'THIRD_PARTY',
                            source_display_name: cite.name || cite.title || '',
                            source_subtitle: cite.subtitle || cite.title || '',
                            source_url: cite.url || '',
                            favicon: {
                                url: cite.favicon || cite.icon || 'https://github.githubassets.com/favicons/favicon.png',
                                width: 80,
                                height: 80
                            }
                        }
                    ],
                    __typename: 'GenAISearchCitationItem'
                },
                __typename: 'GenAITextInlineEntity'
            })
        })

        const section = AIRich.newLayout('Single', {
            text,
            inline_entities: inlineEntities,
            __typename: 'GenAIMarkdownTextUXPrimitive'
        })

        const submessage = { messageType: 2, messageText: text }
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

    addSingleProduct(product = {}, { id, replace, insertAt } = {}) {
        if (typeof product !== 'object' || Array.isArray(product)) throw new TypeError('Product must be an object')
        const section = AIRich.newLayout('Single', {
            title: product.title || '',
            brand: product.brand || '',
            price: product.price || '',
            sale_price: product.sale_price || product.salePrice || '',
            product_url: product.url || product.product_url || '',
            image: {
                url: product.image || product.image_url || ''
            },
            __typename: 'GenAIProductItemCardPrimitive'
        })
        const submessage = this.createAlert('GenAIProductItemCardPrimitive')
        return this._addContent(section, submessage, { id, replace, insertAt })
    }

}