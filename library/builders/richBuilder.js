import { randomUUID } from 'crypto'

const tokenizer = (codeStr) => {
    const tokens = []
    let i = 0
    const len = codeStr.length
    const keywords = new Set(['break','case','catch','continue','debugger','default','delete','do','else','finally','for','function','if','in','instanceof','new','return','switch','this','throw','try','typeof','var','void','while','with','true','false','null','undefined','NaN','Infinity','class','const','let','super','extends','export','import','yield','static','constructor','of','async','await','get','set','=>'])
    const push = (content, type) => tokens.push({ content, type })

    while (i < len) {
        const ch = codeStr[i]
        const next = codeStr[i + 1]
        if (/\s/.test(ch)) {
            let s = i
            while (i < len && /\s/.test(codeStr[i])) i++
            push(codeStr.slice(s, i), 'DEFAULT')
            continue
        }
        if (ch === '/' && (next === '/' || next === '*')) {
            let s = i
            if (next === '/') {
                i += 2
                while (i < len && codeStr[i] !== '\n') i++
            } else {
                i += 2
                while (i < len && !(codeStr[i] === '*' && codeStr[i + 1] === '/')) i++
                i = Math.min(len, i + 2)
            }
            push(codeStr.slice(s, i), 'COMMENT')
            continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            let s = i
            const quote = ch
            i++
            while (i < len) {
                if (codeStr[i] === '\\') {
                    i += 2
                    continue
                }
                if (codeStr[i] === quote) {
                    i++
                    break
                }
                i++
            }
            push(codeStr.slice(s, i), 'STR')
            continue
        }
        if (/[0-9]/.test(ch)) {
            let s = i
            while (i < len && /[0-9._xobA-Fa-f]/.test(codeStr[i])) i++
            push(codeStr.slice(s, i), 'NUMBER')
            continue
        }
        if (/[+\-*/%=<>!&|^~?:;.,[\]{}]/.test(ch)) {
            let s = i
            if ((ch === '=' && next === '>') || (ch === '=' && next === '=')) {
                i += 2
            } else {
                i++
            }
            push(codeStr.slice(s, i), 'SYMBOL')
            continue
        }
        if (/[a-zA-Z_$]/.test(ch)) {
            let s = i
            while (i < len && /[a-zA-Z0-9_$]/.test(codeStr[i])) i++
            const word = codeStr.slice(s, i)
            if (keywords.has(word)) {
                push(word, 'KEYWORD')
            } else {
                let j = i
                while (j < len && /\s/.test(codeStr[j])) j++
                push(word, (j < len && codeStr[j] === '(') ? 'METHOD' : 'VARIABLE')
            }
            continue
        }
        push(ch, 'DEFAULT')
        i++
    }
    return tokens
}

export const buildRichResponse = async (sock, jid, data, options) => {
    const sections = []
    const sources = []
    const inlineEntities = []
    const submessages = []

    if (data.links && data.links.length > 0) {
        data.links.forEach((link, idx) => {
            const hostname = link.displayName || new URL(link.url).hostname
            const favicon = link.favicon || `https://external-content.duckduckgo.com/ip3/${hostname}.ico`
            
            sources.push({
                provider: 0,
                thumbnailCdnUrl: link.thumbnail || "",
                sourceProviderUrl: link.url,
                sourceQuery: "",
                faviconCdnUrl: favicon,
                citationNumber: idx + 1,
                sourceTitle: link.title
            })

            inlineEntities.push({
                key: `IE_${idx}`,
                metadata: {
                    reference_id: idx + 1,
                    reference_url: link.url,
                    reference_title: link.title,
                    reference_display_name: hostname,
                    sources: [{
                        source_type: "THIRD_PARTY",
                        source_display_name: hostname,
                        source_subtitle: link.title,
                        source_url: link.url
                    }],
                    __typename: "GenAISearchCitationItem"
                }
            })
        })
    }

    if (data.cards && data.cards.length > 0) {
        const cardPrimitives = data.cards.map(card => ({
            title: card.title || "",
            brand: card.brand || "",
            price: card.price || "Free",
            sale_price: card.salePrice || "Free",
            product_url: card.url || "",
            image: { url: card.image || "" },
            additional_images: card.additionalImages ? card.additionalImages.map(img => ({ url: img })) : [],
            __typename: "GenAIProductItemCardPrimitive"
        }))

        if (cardPrimitives.length === 1) {
            sections.push({
                view_model: {
                    primitive: cardPrimitives[0],
                    __typename: "GenAISingleLayoutViewModel"
                }
            })
        } else {
            sections.push({
                view_model: {
                    primitives: cardPrimitives,
                    __typename: "GenAIHScrollLayoutViewModel"
                }
            })
        }
    }

    if (data.text) {
        submessages.push({
            messageType: "AI_RICH_RESPONSE_TEXT",
            messageText: data.text
        })

        const textSection = {
            view_model: {
                primitive: {
                    text: data.text,
                    __typename: "GenAIMarkdownTextUXPrimitive"
                },
                __typename: "GenAISingleLayoutViewModel"
            }
        }
        if (inlineEntities.length > 0) {
            textSection.view_model.primitive.inline_entities = inlineEntities
        }
        sections.push(textSection)
    }

    if (data.table) {
        const tableRows = [
            { items: data.table.headers, isHeading: true },
            ...data.table.rows.map(row => ({ items: row.map(String) }))
        ]
        
        submessages.push({
            messageType: 4,
            tableMetadata: {
                title: data.table.title || "Datos",
                rows: tableRows
            }
        })
    }

    if (data.pills && data.pills.length > 0) {
        sections.push({
            view_model: {
                primitives: data.pills.map(pill => ({
                    prompt_text: pill.text,
                    prompt_type: "SUGGESTED_PROMPT",
                    ...(pill.url ? { url: pill.url } : {}),
                    __typename: "GenAIFollowUpSuggestionPillPrimitive"
                })),
                __typename: "GenAIActionRowLayoutViewModel"
            }
        })
    }

    if (data.code) {
        const rawTokens = tokenizer(data.code.code)
        
        const typeToHighlightV2 = {
            KEYWORD: "KEYWORD",
            METHOD: "METHOD",
            VARIABLE: "METHOD",
            STR: "STR",
            COMMENT: "STR",
            NUMBER: "DEFAULT",
            SYMBOL: "DEFAULT",
            DEFAULT: "DEFAULT"
        }
        const typeToHighlightV1 = {
            KEYWORD: 1,
            METHOD: 2,
            VARIABLE: 2,
            STR: 3,
            COMMENT: 3,
            NUMBER: 4,
            SYMBOL: 4,
            DEFAULT: 1
        }

        const neonTokens = rawTokens.map(t => ({
            content: t.content,
            type: typeToHighlightV2[t.type] || "DEFAULT"
        }))
        const protoBlocks = rawTokens.map(t => ({
            codeContent: t.content,
            highlightType: typeToHighlightV1[t.type] || 1
        }))

        submessages.push({
            messageType: 5,
            codeMetadata: {
                codeLanguage: data.code.language || "javascript",
                codeBlocks: protoBlocks
            }
        })

        sections.push({
            view_model: {
                primitive: {
                    language: data.code.language || "javascript",
                    code_blocks: neonTokens,
                    __typename: "GenAICodeUXPrimitive"
                },
                __typename: "GenAISingleLayoutViewModel"
            }
        })
    }

    if (data.reels && data.reels.length > 0) {
        const normalizedReels = data.reels.map(item => ({
            title: item.title || "Reel",
            creator: item.creator || "Reel",
            verified: !!item.verified,
            profileIconUrl: item.profileIconUrl || "https://files.catbox.moe/obz4b4.jpg",
            thumbnailUrl: item.thumbnailUrl || "https://files.catbox.moe/obz4b4.jpg",
            videoUrl: item.videoUrl || ""
        }))

        submessages.push({
            messageType: 9,
            contentItemsMetadata: {
                contentType: "CAROUSEL",
                itemsMetadata: normalizedReels.map(item => ({
                    reelItem: {
                        title: item.title + (item.verified ? " (verificado)" : ""),
                        profileIconUrl: item.profileIconUrl,
                        thumbnailUrl: item.thumbnailUrl,
                        videoUrl: item.videoUrl,
                        creator: item.creator,
                        isVerified: item.verified
                    }
                }))
            }
        })

        sections.push({
            view_model: {
                primitives: normalizedReels.map(item => ({
                    reels_url: item.videoUrl,
                    thumbnail_url: item.thumbnailUrl,
                    creator: item.creator + (item.verified ? " (verificado)" : ""),
                    avatar_url: item.profileIconUrl,
                    reels_title: item.title,
                    reel_source: "IG",
                    is_verified: true,
                    creator_verified: item.verified,
                    __typename: "GenAIReelPrimitive"
                })),
                __typename: "GenAIHScrollLayoutViewModel"
            }
        })
    }

    if (data.links && data.links.length > 0) {
        sections.push({
            view_model: {
                primitive: {
                    sources: data.links.map(link => ({
                        source_type: "THIRD_PARTY",
                        source_display_name: link.displayName || new URL(link.url).hostname,
                        source_subtitle: link.title,
                        source_url: link.url
                    })),
                    search_engine: "MASE",
                    __typename: "GenAISearchResultPrimitive"
                },
                __typename: "GenAISingleLayoutViewModel"
            }
        })
    }

    if (data.footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: data.footer,
                    __typename: "GenAIMetadataTextPrimitive"
                },
                __typename: "GenAISingleLayoutViewModel"
            }
        })
    }

    let ctxInfo = {
        mentionedJid: options.mentions || [],
        remoteJid: jid
    }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                pluginMetadata: {},
                ...(sources.length > 0 ? { richResponseSourcesMetadata: { sources } } : {})
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: submessages,
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify({
                            response_id: randomUUID(),
                            sections: sections
                        })).toString('base64')
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: "0@bot"
                        },
                        forwardOrigin: 4,
                        ...ctxInfo
                    }
                }
            }
        }
    }

    return { message, nodes: [] }
}

export const executeAlbumMessage = async (sock, jid, medias, options = {}) => {
    const caption = options.caption || ""
    const mediaList = medias.map(m => {
        if (m.type && m.data) {
            return { [m.type]: m.data,
                caption: m.caption || "" }
            } return m
        }
    )

    if (mediaList.length < 2) {
        const item = mediaList[0]
        const typeKey = item.image ? 'image' : 'video'
        const content = {[typeKey]: item[typeKey], caption: caption || item.caption || "" }
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
        const itemCaption = (i === 0 && caption) ? caption : (item.caption || "")
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