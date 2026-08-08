// ./plugins/rpg/economy.plugin.js
const WORK_STORIES_EASY = [
    'Atendiste un puesto de empanadas y te dieron propina.',
    'Ayudaste a limpiar la taberna local del pueblo.',
    'Paseaste a los monstruos de un vecino del reino.',
    'Repartiste volantes publicitarios del herrero en la plaza.',
    'Lavaste carruajes mágicos en la entrada de la ciudad.',
    'Pintaste la fachada de la botica del alquimista.'
]

const WORK_STORIES_HARD = [
    'Derrotaste a un grupo de duendes que robaban cosechas.',
    'Escortaste una caravana de mercaderes a través del bosque oscuro.',
    'Descubriste un alijo de monedas antiguas en unas ruinas.',
    'Reparaste el mecanismo del molino mágico durante una tormenta.',
    'Cazaste a un jabalí gigante que aterrorizaba los campos.'
]

const MINE_STORIES_WIN = [
    'Picaste una veta brillante y encontraste valiosos minerales.',
    'Derribaste una pared falsa en la cueva y hallaste tesoros ocultos.',
    'Descubriste geodas luminosas enterradas en las profundidades.',
    'Un topo minero amigable te guió hasta un yacimiento de oro.'
]

const MINE_STORIES_FAIL = [
    'Un pequeño derrumbe te obligó a huir corriendo sin nada.',
    'Tu pico se rompió al primer impacto contra la piedra dura.',
    'Un enjambre de murciélagos de cueva te espantó del túnel.',
    'Escarbaste durante horas pero solo encontraste carbón sin valor.'
]

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

export default {
    command: true,
    usePrefix: true,
    case: ['daily', 'work', 'mine', 'bal', 'balance', 'dep', 'deposit', 'reti', 'retirar', 'rob', 'robar'],
    description: 'Sistema de economía RPG: trabajo, minería, banco, recompensas diarias y robos.',
    category: 'RPG',
    list: [
        { cmd: 'daily', category: 'RPG' },
        { cmd: 'work', category: 'RPG' },
        { cmd: 'mine', category: 'RPG' },
        { cmd: 'rob @user', category: 'RPG' },
        { cmd: 'dep ‹cantidad›', category: 'RPG' },
        { cmd: 'reti ‹cantidad›', category: 'RPG' },
        { cmd: 'bal', category: 'RPG' }
    ],
    
    script: async (m, { sock, plugin }) => {
        const rpg = plugin.import('@rpg')
        const { user } = await rpg.getUser(m.sender.id)
        
        if (!user.registered) return m.reply('ⓘ Requiere registro. Usa .reg')
        
        user.bank ||= 0
        user.cooldowns ||= {}
        user.cooldowns.rob ||= 0

        const now = Date.now()

        // --- BALANCE ---
        if (['bal', 'balance'].includes(m.command)) {
            const txt = [
                ` ❀ Usuario: ${user.name}`,
                ` 𖤓 Billetera: ${user.money} Soles`,
                ` 𖠿 Banco: ${user.bank} Soles`,
                ` ✦ Diamantes: ${user.diamond}`,
                ` ⛃ Oro: ${user.gold}`,
                ``,
                `ⓘ Total Neto: ${user.money + user.bank} Soles`
            ].join('\n')
            
            const pp = await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            
            return await sock.sendMessage(m.chat.id, {
                invoice: {
                    title: `▢ ${global.config.name} / RPG`,
                    body: txt,
                    footer: 'Powered by Syllkom',
                    orderId: `Cuenta de ${user.name}`,
                    itemName: 'Balance Total',
                    itemCount: 1,
                    price: user.money + user.bank,
                    currency: 'PEN',
                    image: pp
                }
            }, {
                quoted: await sock.fakeOrder(m.chat.id, {
                    image: pp,
                    message: `Engine v1.0.0`,
                    orderTitle: m.sender.name,
                    price: 374,
                    currency: 'USD'
                })
            })
        }

        // --- DEPOSITAR ---
        if (['dep', 'deposit', 'd'].includes(m.command)) {
            const count = m.args[0] === 'all' ? user.money : parseInt(m.args[0])
            if (!count || isNaN(count) || count <= 0) return m.reply('ⓘ Ingresa una cantidad válida o "all".')
            if (user.money < count) return m.reply('✗ No tienes suficientes Soles en la billetera.')

            user.money -= count
            user.bank += count
            return m.reply(`✓ Depositaste ${count} Soles en el banco.`)
        }

        // --- RETIRAR ---
        if (['reti', 'retirar'].includes(m.command)) {
            const count = m.args[0] === 'all' ? user.bank : parseInt(m.args[0])
            if (!count || isNaN(count) || count <= 0) return m.reply('ⓘ Ingresa una cantidad válida o "all".')
            if (user.bank < count) return m.reply('✗ No tienes suficientes Soles en el banco.')

            user.bank -= count
            user.money += count
            return m.reply(`✓ Retiraste ${count} Soles del banco.`)
        }

        // --- ROBAR ---
        if (['rob', 'robar'].includes(m.command)) {
            if (now - user.cooldowns.rob < 15 * 60 * 1000) { 
                const min = Math.ceil((900000 - (now - user.cooldowns.rob)) / 1000 / 60)
                return m.reply(`ⓘ La policía está patrullando. Espera ${min} minutos para robar de nuevo.`)
            }

            const targetId = m.quoted ? m.quoted.sender.id : m.sender.mentioned[0]
            if (!targetId) return m.reply('ⓘ Menciona a tu víctima.')
            if (targetId === m.sender.id) return m.reply('ⓘ No puedes robarte a ti mismo.')
            
            const { user: victim } = await rpg.getUser(targetId)
            const limits = { money: 100, gold: 10, diamond: 5 }
            const types = ['money', 'gold', 'diamond']
            
            let type = m.args[1]?.toLowerCase()
            if (!['soles', 'oro', 'diamantes'].includes(type)) {
                type = types[Math.floor(Math.random() * types.length)]
            } else {
                if (type === 'soles') type = 'money'
                if (type === 'oro') type = 'gold'
                if (type === 'diamantes') type = 'diamond'
            }

            const success = Math.random() < 0.4
            user.cooldowns.rob = now

            if (success) {
                const maxSteal = limits[type]
                const victimAmount = victim[type] || 0
                
                if (victimAmount <= 0) return m.reply(`ⓘ La víctima tiene los bolsillos vacíos (${type}).`)

                const loot = Math.floor(Math.random() * Math.min(maxSteal, victimAmount)) + 1
                victim[type] -= loot
                user[type] += loot
                
                const label = type === 'money' ? 'Soles' : type === 'gold' ? 'Oro' : 'Diamantes'
                return m.reply(`▢ *ROBO EXITOSO*\n● Botín: ${loot} ${label}\n● Víctima: @${targetId.split('@')[0]}`, { contextInfo: { mentionedJid: [targetId] } })
            } else {
                const fine = 50
                user.money = Math.max(0, user.money - fine)
                return m.reply(`✗ *Te Atraparon*\nⓘ La policía te detuvo y pagaste ${fine} Soles de soborno.`)
            }
        }

        // --- DAILY ---
        if (m.command === 'daily') {
            user.cooldowns.daily ||= 0
            if (now - user.cooldowns.daily < 86400000) return m.reply(`ⓘ Vuelve en ${Math.floor((86400000 - (now - user.cooldowns.daily)) / 3600000)} horas.`)
            
            if (now - user.cooldowns.daily > 172800000) user.streak = 0
            else user.streak = (user.streak || 0) + 1
            
            const luckBonus = Math.min(24, Math.floor(user.streak * 0.5))
            const isLucky = (Math.random() * 100) < (3 + luckBonus)
            
            let rew = { money: 100, exp: 150, diamond: 1 } 
            let luckMsg = ''
            if (isLucky) {
                rew.money *= 2; rew.exp *= 2; rew.diamond = 2
                luckMsg = `\nⓘ ¡SUERTE! Tu racha de ${user.streak} días te dio un buff de recompensas.`
            }

            user.money += rew.money
            user.exp += rew.exp
            user.diamond += rew.diamond
            user.cooldowns.daily = now
            
            return m.reply(`▢ *RECOMPENSA DIARIA*\n● +${rew.money} Soles\n● +${rew.exp} EXP\n● +${rew.diamond} Diamantes\n\n- Racha actual: ${user.streak}${luckMsg}`)
        }

        // --- TRABAJAR ---
        if (['work', 'w'].includes(m.command)) {
            user.cooldowns.work ||= 0
            const isHardWork = (user.cooldowns.work_type === 'hard')
            const cooldownTime = isHardWork ? 86400000 : 43200000
            
            if (now - user.cooldowns.work < cooldownTime) return m.reply('ⓘ Estás cansado, descansa un poco más.')

            await m.react('wait')

            const pay = Math.floor(Math.random() * 91) + 10
            user.money += pay
            user.cooldowns.work = now
            user.cooldowns.work_type = pay > 50 ? 'hard' : 'low'

            const lore = pay > 50 ? getRandom(WORK_STORIES_HARD) : getRandom(WORK_STORIES_EASY)
            
            await m.react('done')
            return m.reply(`▢ *TRABAJO*\n● ${lore}\n● +${pay} Soles`)
        }

        // --- MINAR ---
        if (m.command === 'mine') {
            user.cooldowns.mine ||= 0
            if (now - user.cooldowns.mine < 300000) return m.reply('ⓘ Minar cansa mucho. Espera 5 minutos.')
            
            await m.react('wait')
            const success = Math.random() > 0.3
            user.cooldowns.mine = now

            if (!success) {
                const loreFail = getRandom(MINE_STORIES_FAIL)
                await m.react('error')
                return m.reply(`▢ *MINERÍA*\n✗ ${loreFail}`)
            }

            const gold = Math.floor(Math.random() * 5) + 1
            const dia = Math.floor(Math.random() * 2)
            const exp = Math.floor(Math.random() * 50) + 10
            
            user.gold += gold
            user.diamond += dia
            user.exp += exp
            
            const loreWin = getRandom(MINE_STORIES_WIN)
            await m.react('done')
            return m.reply(`▢ *MINERÍA*\n● ${loreWin}\n\n*Obtenido:*\n- ${gold} Oro\n- ${dia} Diamantes\n- ${exp} XP`)
        }
    }
}