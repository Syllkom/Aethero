// ./plugins/gacha/collection.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['col', 'collection', 'harem'],
    description: 'Muestra tu inventario de personajes y waifus coleccionadas.',
    category: 'gacha',
    usage: 'col [pagina]',
    script: async (m) => {
        const db = await global.db.open('@rpg')
        const user = db.users?.[m.sender.id]
        
        if (!user || !user.inventory || user.inventory.length === 0) {
            return m.reply('Tu inventario está vacío. Usa .rw para comenzar.')
        }

        const inventory = [...user.inventory].sort((a, b) => (b.value || 0) - (a.value || 0))

        const page = Math.max(1, parseInt(m.args[0]) || 1)
        const limit = 15
        const totalPages = Math.ceil(inventory.length / limit)
        
        if (page > totalPages) return m.reply(`Página no encontrada. Total: ${totalPages}`)

        const start = (page - 1) * limit
        const view = inventory.slice(start, start + limit)
        const totalValue = inventory.reduce((acc, curr) => acc + (curr.value || 0), 0)

        let txt = `╭🜲 *Inventario Gacha*\n`
        txt += `╵ Usuario: ${m.sender.name}\n`
        txt += `╵ Total Items: ${inventory.length}\n`
        txt += `╵ Valor Colección: ${totalValue.toLocaleString()}\n`
        txt += `╵ Página: ${page}/${totalPages}\n\n`
        txt += '╰╶╴──────╶╴─╶╴◯'

        view.forEach(char => {
            const rarityIcon = char.rarity === 'LR' ? '🜲' : char.rarity === 'UR' ? '✦' : '◯'
            txt += `${rarityIcon} [${char.rarity}] ${char.name} (${char.value})\n`
            txt += `   └ ID: ${char.id}\n`
        })

        if (page < totalPages) txt += `\n> ⓘ Usa .col ${page + 1} para ver más.`

        await m.reply(txt)
    }
}