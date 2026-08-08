// ./plugins/gacha/ginfo.plugin.js
export default {
    command: true,
    usePrefix: true,
    case: ['ginfo', 'gachainfo'],
    description: 'Muestra el perfil del jugador: economía global, valor de su inventario y los tiempos restantes (cooldowns).',
    category: 'gacha',
    usage: 'ginfo',
    script: async (m, { sock, plugin }) => {
        await m.react('wait')

        try {
            const rpg = plugin.import('@rpg')

            if (!rpg) {
                await m.react('error')
                return m.reply('ⓘ El módulo RPG no está cargado.')
            }

            const { user } = await rpg.getUser(m.sender.id)
            const db = await rpg.getDB()
            
            let totalValue = 0
            const inventory = user.inventory || []
            
            inventory.forEach(char => {
                totalValue += char.value || 0
            })

            const now = Date.now()
            
            const rollCd = 15 * 60 * 1000
            const dailyCd = 24 * 60 * 60 * 1000
            const workCd = 60 * 60 * 1000
            const mineCd = 30 * 60 * 1000

            const formatTime = (ms) => {
                if (ms <= 0) return '*Ahora*'
                const seconds = Math.floor((ms / 1000) % 60)
                const minutes = Math.floor((ms / (1000 * 60)) % 60)
                const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
                if (hours > 0) return `${hours}h ${minutes}m`
                if (minutes > 0) return `${minutes}m ${seconds}s`
                return `${seconds}s`
            }

            const timeRoll = formatTime(((user.lastRoll || 0) + rollCd) - now)
            const timeDaily = formatTime(((user.cooldowns?.daily || 0) + dailyCd) - now)
            const timeWork = formatTime(((user.cooldowns?.work || 0) + workCd) - now)
            const timeMine = formatTime(((user.cooldowns?.mine || 0) + mineCd) - now)

            const bodyText = [
                `╭○ User Info`,
                `╵ Nombre : ${user.name || m.sender.name}`,
                `╵ Nivel  : ${user.level || 1} (${user.role || 'Novato'})`,
                `╵ Dinero : ${rpg.formatMoney(user.money || 0, m.sender.id)}`,
                `╰╶╴──────╶╴─╶╴◯`,
                ``,
                `▢ Tiempos De Espera`,
                `- Roll  »  ${timeRoll}`,
                `- Daily »  ${timeDaily}`,
                `- Work  »  ${timeWork}`,
                `- Mine  »  ${timeMine}`,
                ``,
                `✦ Estadísticas Gacha`,
                `- Tuyo  : ${inventory.length} Pjs`,
                `- Total : $${totalValue.toLocaleString('es-ES')}`
            ].join('\n')

            const ppUrl = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')

            const fakeQuoted = await sock.fakeOrder(m.chat.id, {
                image: ppUrl,
                message: `Perfil de: ${user.name || m.sender.name}`,
                orderTitle: 'Aethero System',
                price: totalValue > 0 ? totalValue : 374,
                currency: 'USD'
            })

            await sock.sendMessage(m.chat.id, {
                productMenu: {
                    image: ppUrl,
                    title: "Perfil & Estadísticas",
                    description: "Información general de tu cuenta",
                    price: (user.gold || 0) * 1500 + 5000,      
                    salePrice: user.money || 0,
                    currency: "USD",
                    body: bodyText,
                    footer: "Aethero RPG System | @syllkom",
                    buttons: [
                        { type: 'reply', text: 'Tirar Roll', id: '.rw' }
                    ]
                }
            }, { 
                contextInfo: { mentionedJid: [m.sender.id] },
                quoted: fakeQuoted
            })

            await m.react('done')

        } catch (e) {
            console.error('Ginfo Error:', e)
            await m.react('error')
            m.reply('ⓘ Ocurrió un error al obtener la información de tu cuenta.')
        }
    }
}