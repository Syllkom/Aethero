// ./plugins/gacha/maket.plugin.js
export default {
    command: true, usePrefix: true, 
    case: ['sell', 'vender', 'buy', 'comprar', 'unsell'], 
    description: 'Pone a la venta o compra personajes en el mercado global.',
    category: 'gacha',
    usage: ['sell ‹id› ‹precio›', 'buy ‹id›'],
    script: async (m, { sock, plugin }) => {
        const gacha = plugin.import('@gacha')
        const rpg = plugin.import('@rpg')

        const db = await global.db.open('@rpg')
        db.gacha ||= { global: {}, tags: {} }

        if (['sell', 'vender'].includes(m.command)) {
            const args = m.text.trim().split(/\s+/)
            const id = args[0]
            const price = parseInt(args[1])

            if (!id || !price || isNaN(price) || price <= 0) {
                return m.reply('╭○ *Mercado Gacha*\n' +
                               `╵ Uso: .${m.command} <id> <precio>\n` +
                               `╵ Ejemplo: .${m.command} 5829102 5000\n` + 
                               '╰╶╴──────╶╴─╶╴◯'
                )
            }

            const entry = db.gacha.global[id]
            if (!entry || entry.owner !== m.sender.id) {
                return m.reply('No eres el dueño de este personaje o no existe.')
            }
            
            entry.price = price
            entry.forSale = true
            
            const char = await gacha.getById(id)
            const name = char ? char.name : 'Personaje'
            
            return m.reply(`✓ *EN VENTA*\nHas puesto a *${name}* en el mercado por ${price.toLocaleString()} Soles.`)
        }
        
        if (m.command === 'unsell') {
            const id = m.text.trim()
            if (!id) return m.reply('Ingresa la ID del personaje.')

            const entry = db.gacha.global[id]
            if (!entry || entry.owner !== m.sender.id) return m.reply('No eres el dueño.')
            
            entry.forSale = false
            entry.price = 0

            return m.reply('Has retirado el personaje del mercado.')
        }
        
        if (['buy', 'comprar'].includes(m.command)) {
            const id = m.text.trim()
            if (!id) return m.reply('Ingresa la ID del personaje a comprar.')

            const entry = db.gacha.global[id]
            
            if (!entry || !entry.forSale) {
                return m.reply('Este personaje no está a la venta.')
            }

            if (entry.owner === m.sender.id) return m.reply('No puedes comprar tu propio personaje.')

            const price = entry.price
            const sellerId = entry.owner
            const { user: buyer } = await rpg.getUser(m.sender.id)
            const { user: seller } = await rpg.getUser(sellerId)
            
            if (buyer.money < price) {
                return m.reply(`Fondos insuficientes.\nRequieres: ${price.toLocaleString()} Soles\nTienes: ${buyer.money.toLocaleString()} Soles`)
            }
            
            await m.react('wait')
            
            buyer.money -= price
            seller.money += price
            
            seller.inventory ||= []
            const itemIndex = seller.inventory.findIndex(i => i.id == id)
            if (itemIndex === -1) {
                const charData = await gacha.getById(id)
                if (charData) {
                    buyer.inventory ||= []
                    buyer.inventory.push({ ...charData, date: Date.now() })
                }
            } else {
                const item = seller.inventory[itemIndex]
                seller.inventory.splice(itemIndex, 1)
                
                buyer.inventory ||= []
                buyer.inventory.push(item)
            }
            
            entry.owner = m.sender.id
            entry.forSale = false
            entry.price = 0
            
            const char = await gacha.getById(id)
            const imgUrl = char ? char.image : null
            
            const txtComprador = `✦ *Compra Exitosa*\n\nHas comprado a *${char ? char.name : id}* por ${price.toLocaleString()} Soles.\nNuevo saldo: ${buyer.money.toLocaleString()}`
            
            if (imgUrl) {
                await sock.sendMessage(m.chat.id, { image: { url: imgUrl }, caption: txtComprador, contextInfo: { mentionedJid: [sellerId] } }, { quoted: m.raw })
            } else {
                await m.reply(txtComprador)
            }
            
            const txtVendedor = `⛁ *Venta Exitosa*\n\n@${m.sender.number} compró tu personaje *${char ? char.name : id}*.\nHas recibido +${price.toLocaleString()} Soles.`
            await sock.sendMessage(sellerId, { text: txtVendedor, contextInfo: { mentionedJid: [m.sender.id] } })

            await m.react('done')
        }
    }
}