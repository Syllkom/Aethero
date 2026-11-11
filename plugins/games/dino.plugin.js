// ./plugins/games/dino.plugin.js
const DINO_URL = 'https://raw.githubusercontent.com/Syllkom/MyArchive/refs/heads/main/main/index.html'
let cachedHtml = null

export default {
    command: true, usePrefix: true,
    case: ['dino', 'trex', 'dinorunner'],
    description: 'Envía el juego interactivo T-Rex Runner en una hoja modal inferior deslizable.',
    category: 'juegos',
    usage: ['dino'],
    script: async (m, { sock }) => {
        await m.react('wait')

        try {
            if (!cachedHtml) {
                const buffer = await sock.getBuffer(DINO_URL)
                if (!buffer || !buffer.length) throw new Error('No se pudo descargar el archivo del juego')
                cachedHtml = buffer.toString('utf-8')
            }

            const bubbleMessage = [
                '*Dino Runner*',
                'Desliza la pestaña inferior hacia arriba para jugar.'
            ].join('\n')

            const rich = new sock.AIRich()
                .addBottomSheet([
                    {
                        id: 'dino_tab',
                        header: 'Dino Runner',
                        html: cachedHtml,
                        url: DINO_URL,
                        trustedSources: ['raw.githubusercontent.com']
                    }
                ], {
                    title: 'Dino Runner',
                    bubbleText: bubbleMessage
                })

            await rich.send(m.chat.id, { quoted: m.raw })
            await m.react('done')

        } catch (e) {
            console.error('Dino Game Error:', e)
            await m.react('error')
            return m.reply('ⓘ Error al enviar el juego: ' + e.message)
        }
    }
}