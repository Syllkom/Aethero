import { generateWAMessageFromContent, prepareWAMessageMedia } from '@whiskeysockets/baileys'

export default {
    case: 'test1740',
    command: true,
    async script(m, { sock }) {

        const media = [{
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' },
            caption: 'test1'
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' },
            caption: 'test2'
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' }
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' }
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' }
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' }
        }, {
            image: { url: 'https://files.catbox.moe/obz4b4.jpg' }
        },]

        async function sendAlbum(jid, mediaList) {
            const imageCount = mediaList.filter(item => item.image).length;
            const videoCount = mediaList.filter(item => item.video).length;
            const album = await generateWAMessageFromContent(jid, {
                albumMessage: {
                    expectedImageCount: imageCount,
                    expectedVideoCount: videoCount,
                    contextInfo: {}
                }
            }, { userJid: sock.user.id });
            await sock.relayMessage(jid, album.message,
                { messageId: album.key.id });
            for (let i = 0; i < mediaList.length; i++) {
                const item = mediaList[i];
                if (!item.image && !item.video) continue;
                const a0 = item.image ? 'image' : 'video'
                const prepared = await prepareWAMessageMedia(
                    { [a0]: item[a0] }, { upload: sock.waUploadToServer });
                const mediaType = item.image ? 'imageMessage' : 'videoMessage';
                if (item.caption) prepared[mediaType].caption = item.caption;
                const container = await generateWAMessageFromContent(jid, {
                    [mediaType]: prepared[mediaType],
                    messageContextInfo: {
                        messageAssociation: {
                            associationType: 1,
                            parentMessageKey: album.key
                        }
                    }
                }, { userJid: sock.user.id });
                await sock.relayMessage(jid, container.message,
                    { messageId: container.key.id });
            }
        }

        await sendAlbum(m.chat.id, media);
    }
}