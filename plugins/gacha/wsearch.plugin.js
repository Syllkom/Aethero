// ./plugins/gacha/search.plugin.js
export default {
    command: true, usePrefix: true, 
    case: ['wsearch', 'buscarwaifu', 'ws'], 
    description: 'Busca personajes reclamados en el mercado o servidor.',
    category: 'gacha',
    usage: 'wsearch ‹nombre/anime›',
    script: async (m, { sock }) => {
        const query = m.text.trim().toLowerCase()

        if (!query) {
            return m.reply(`● *BUSCADOR GACHA*\n\nBusca personajes que ya han sido reclamados en el servidor.\n\n  » Uso: .${m.command} <nombre>\n  » Ejemplo: .${m.command} miku`)
        }

        await m.react('🔍')

        const db = await global.db.open('@rpg')
        db.users ||= {}
        
        let allItems = []
        Object.values(db.users).forEach(user => {
            if (user.inventory && Array.isArray(user.inventory)) {
                allItems.push(...user.inventory)
            }
        })

        const results = allItems.filter(char => 
            (char.name && char.name.toLowerCase().includes(query)) || 
            (char.source && char.source.toLowerCase().includes(query))
        )

        if (results.length === 0) {
            await m.react('error')
            return m.reply(`✗ No se encontraron personajes reclamados con: "${query}"\n\n> Intenta tirar la ruleta (.rw) para ser el primero en conseguirlo.`)
        }

        const topResults = results
            .sort((a, b) => (b.value || 0) - (a.value || 0))
            .slice(0, 20)

        let txt = `● *Resultados Global* — "${query}"\n` +
                  `  Encontrados: ${results.length} (Mostrando Top 20)\n\n`

        topResults.forEach((char) => {
            const rarityIcon = char.rarity === 'LR' ? '👑' : 
                               char.rarity === 'UR' ? '🌟' : 
                               char.rarity === 'SR' ? '✨' : 
                               char.rarity === 'R' ? '💠' : '⚪'
            
            txt += `» ${rarityIcon} *${char.name}* [${char.rarity}]\n`
            txt += `   └ Serie: ${char.source}\n`
            txt += `   └ ID: \`${char.id}\` | Val: ${(char.value || 0).toLocaleString()}\n`
        })

        txt += `\nⓘ Usa .winfo ‹id› para ver al dueño.`

        await sock.sendMessage(m.chat.id, { text: txt }, { quoted: m.raw })
        await m.react('done')
    }
}