// ./plugins/gacha/info.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['winfo', 'char'],
    description: 'Muestra información detallada de un personaje por su ID.',
    category: 'gacha',
    usage: 'winfo ‹id›',
    script: async (m, { sock, plugin }) => {
        const gacha = plugin.import('@gacha')
        const id = m.text.trim()

        if (!id) return m.reply(`Ingrese el ID del personaje.\nEjemplo: .winfo 5829102`)

        await m.react('wait')

        const char = await gacha.getById(id)
        if (!char) {
            await m.react('error')
            return m.reply('ID no encontrado en el servidor.')
        }

        const db = await global.db.open('@rpg')
        db.gacha ||= { global: {} }

        const globalEntry = db.gacha.global[id]
        const ownerId = (globalEntry && typeof globalEntry === 'object') ? globalEntry.owner : globalEntry
        const isClaimed = !!ownerId

        const meta = gacha.meta(char.rarity)

        let ownerTxt = 'Nadie'
        if (isClaimed) {
            const usersDB = await global.db.open('@users')
            const ownerData = usersDB[ownerId]
            ownerTxt = ownerData?.name || '@' + ownerId.split('@')[0]
        }

        const txt = ['— *Ficha De Personaje* ๑ 🌸 ୧',
            `╭✧ Nombre: ${char.name}`,
            `﹕𖦹 ID: ${char.id}`,
            `﹕✦ Origen: ${char.source}`,
            `﹕✎ Artista: ${char.artist || 'Desconocido'}`,
            `﹕✶ Rareza: ${meta.name} [${char.rarity}]`,
            `﹕✰ Valor Actual: ${(char.value || 0).toLocaleString()}`,
            `﹕♡ Popularidad: ${char.favs || 0} Likes`,
            `╰🜲 *Dueño Actual:* ${ownerTxt}`
        ].join('\n')

        await sock.sendMessage(m.chat.id, { image: { url: char.image }, caption: txt }, { quoted: m.raw })
        await m.react('done')
    }
}