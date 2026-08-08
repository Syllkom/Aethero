// ./plugins/rpg/leaderboard.plugin.js
export default {
    command: true, usePrefix: true, 
    case: ['lb', 'leaderboard', 'top', 'ranking'], 
    description: 'Muestra el ranking Top 10 global en economía, niveles o waifus.',
    category: 'RPG',
    usage: 'top [money/waifus/exp]',
    script: async (m) => {
        const type = m.args[0]?.toLowerCase() || 'money'
        
        const db = await global.db.open('@rpg')
        const users = db.users || {}
        
        let top = []
        let title = ''
        let unit = ''

        if (['money', 'dinero', 'soles'].includes(type)) {
            title = 'TOP MILLONARIOS'
            unit = 'Soles'
            
            Object.entries(users).forEach(([id, u]) => {
                const total = (u.money || 0) + (u.bank || 0)
                if (total > 0) top.push({ id, val: total, name: u.name || 'Usuario' })
            })
        }
        else if (['exp', 'nivel', 'level', 'lvl'].includes(type)) {
            title = 'TOP NIVELES'
            unit = 'Nivel'
            
            Object.entries(users).forEach(([id, u]) => {
                if (u.level > 1 || u.exp > 0) top.push({ id, val: u.level || 1, name: u.name || 'Usuario' })
            })
        }
        else if (['waifu', 'waifus', 'gacha'].includes(type)) {
            title = 'TOP COLECCIONISTAS'
            unit = 'Waifus'
            
            Object.entries(users).forEach(([id, u]) => {
                if (u.inventory && Array.isArray(u.inventory) && u.inventory.length > 0) {
                    top.push({ id, val: u.inventory.length, name: u.name || 'Usuario' })
                }
            })
        }
        else {
            return m.reply('Tipos disponibles: money, level, waifus')
        }

        top.sort((a, b) => b.val - a.val)
        const list = top.slice(0, 10) 

        if (list.length === 0) return m.reply('Aún no hay datos suficientes para el ranking.')

        let txt = `🏆 *${title}* 🏆\n\n`
        
        list.forEach((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
            txt += `${medal} ${u.name}\n   └ ${(u.val || 0).toLocaleString()} ${unit}\n`
        })

        const myPos = top.findIndex(x => x.id === m.sender.id)
        if (myPos !== -1) {
            txt += `\nⓘ Tú estás en la posición: ${myPos + 1}`
        } else {
            txt += `\nⓘ No estás en el ranking.`
        }

        await m.reply(txt)
    }
}