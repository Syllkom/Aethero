// ./plugins/gacha/collection.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['col', 'collection', 'harem'],
    description: 'Muestra tu inventario de personajes y waifus coleccionadas.',
    category: 'gacha',
    usage: 'col [pagina]',
    script: async (m, { sock }) => {
        const db = await global.db.open('@rpg')
        const user = db.users?.[m.sender.id]
        
        if (!user || !user.inventory || user.inventory.length === 0) {
            return m.reply('Tu inventario está vacío. Usa .rw para comenzar.')
        }
        
        await m.react('wait')

        const inventory = [...user.inventory].sort((a, b) => (b.value || 0) - (a.value || 0))

        const page = Math.max(1, parseInt(m.args[0]) || 1)
        const limit = 15
        const totalPages = Math.ceil(inventory.length / limit)
        
        if (page > totalPages) return m.reply(`Página no encontrada. Total: ${totalPages}`)

        const start = (page - 1) * limit
        const view = inventory.slice(start, start + limit)
        const totalValue = inventory.reduce((acc, curr) => acc + (curr.value || 0), 0)
        const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')

        let txt = `╭🜲 *Inventario Gacha*\n`
        txt += `╵ Usuario: ${m.sender.name}\n`
        txt += `╵ Total Items: ${inventory.length}\n`
        txt += `╵ Valor Colección: ${totalValue.toLocaleString()}\n`
        txt += `╵ Página: ${page}/${totalPages}\n`
        txt += '╰╶╴──────╶╴─╶╴◯\n\n'

        view.forEach(char => {
            const rarityIcon = char.rarity === 'LR' ? '🜲' : char.rarity === 'UR' ? '✦' : '◯'
            txt += `${rarityIcon} [${char.rarity}] ${char.name} (${char.value})\n`
            txt += `   └ ID: ${char.id}\n`
        })

        if (page < totalPages) txt += `\n> ⓘ Usa .col ${page + 1} para ver más.`
        
        await sock.sendMessage(m.chat.id, {
          orderStatusMenu: {
            image: pp,
            body: txt,
            buttons: [
                  { type: 'order_status', referenceId: 'REF-' + Date.now() }
            ]
          }
        }, { quoted: m.raw })
        
        await m.react('done')
    }
}