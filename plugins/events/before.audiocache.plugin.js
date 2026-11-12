// ./plugins/events/before.audiocache.plugin.js

if (!global._audioCache) global._audioCache = new Map()

export default {
    before: true,
    command: false,
    description: 'Guarda el ultimo audio por 15 segundos para el comando tomp4.',
    script: async (m, { sock }) => {
        if (m.type !== 'audioMessage') return
        
        try {
            const buffer = await m.content.media.download()
            if (buffer && buffer.length) {
                const userId = m.sender.id
                
                if (global._audioCache.has(userId)) {
                    clearTimeout(global._audioCache.get(userId).timer)
                }

                const timer = setTimeout(() => {
                    global._audioCache.delete(userId)
                }, 15000)

                global._audioCache.set(userId, {
                    buffer,
                    timestamp: Date.now(),
                    timer
                })
            }
        } catch (e) {
            // te amo mami, te extraño :(
        }
    }
}
