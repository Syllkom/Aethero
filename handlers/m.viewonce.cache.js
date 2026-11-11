// ./handlers/m.viewonce.cache.js
export default {
    enabled: true,
    priority: 0.03,
    script: async function ({ sock }) {
        const m = this
        if (!global.db) return

        const isViewOnce = 
            m.raw?.message?.viewOnceMessageV2 || 
            m.raw?.message?.viewOnceMessage || 
            m.raw?.message?.viewOnceMessageV2Extension ||
            m.messageData?.viewOnce === true

        if (!isViewOnce) return

        try {
            const buffer = await sock.downloadMedia(m.raw)
            if (!buffer || !buffer.length) return

            const cache = await global.db.open('@viewonce_cache')
            cache[m.id] = {
                base64: buffer.toString('base64'),
                mimetype: m.messageData?.mimetype || 'application/octet-stream',
                type: m.type
            }
            
            const keys = Object.keys(cache)
            if (keys.length > 50) delete cache[keys[0]]

        } catch (e) {
        }
    }
}