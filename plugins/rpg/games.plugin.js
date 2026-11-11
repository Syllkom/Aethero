// ./plugins/rpg/games.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['ppt', 'slot'],
    description: 'Minijuegos RPG de apuestas (Piedra, Papel, Tijera y Tragamonedas).',
    category: 'RPG',
    usage: ['ppt ‹opcion›', 'slot ‹monto›'],
    script: async (m, { plugin }) => {
        const rpg = plugin.import('@rpg')
        const { user } = await rpg.getUser(m.sender.id)
        
        if (m.command === 'ppt') {
            const choices = ['piedra', 'papel', 'tijera']
            const userChoice = m.text.toLowerCase().trim()
            if (!choices.includes(userChoice)) return m.reply('Elige: piedra, papel o tijera.')
            
            const botChoice = choices[Math.floor(Math.random() * 3)]
            let result = 'draw'
            
            if (userChoice === botChoice) result = 'draw'
            else if (
                (userChoice === 'piedra' && botChoice === 'tijera') ||
                (userChoice === 'papel' && botChoice === 'piedra') ||
                (userChoice === 'tijera' && botChoice === 'papel')
            ) result = 'win'
            else result = 'lose'

            let txt = `Bot eligió: ${botChoice}. `
            if (result === 'win') {
                user.exp += 700
                txt += '¡Ganaste! +700 EXP.'
            } else if (result === 'draw') {
                user.exp += 350
                txt += 'Empate. +350 EXP.'
            } else {
                user.exp = Math.max(0, user.exp - 350)
                txt += 'Perdiste. -350 EXP.'
            }
            return m.reply(txt)
        }

        if (m.command === 'slot') {
            const bet = parseInt(m.text)
            if (isNaN(bet) || bet <= 0) return m.reply('Ingresa cantidad válida a apostar.')
            if (user.money < bet) return m.reply('No tienes suficientes Soles para esa apuesta.')
            
            const emojis = ['🧊', '🍻', '🍸', '🥃']
            let board = []
            for (let i = 0; i < 4; i++) {
                let row = []
                for (let j = 0; j < 4; j++) {
                    row.push(emojis[Math.floor(Math.random() * emojis.length)])
                }
                board.push(row)
            }

            let win = false
            for (let i = 0; i < 4; i++) {
                if (board[i].every(val => val === board[i][0])) win = true
                if ([board[0][i], board[1][i], board[2][i], board[3][i]].every(val => val === board[0][i])) win = true
            }
            if ([board[0][0], board[1][1], board[2][2], board[3][3]].every(val => val === board[0][0])) win = true
            if ([board[0][3], board[1][2], board[2][1], board[3][0]].every(val => val === board[0][3])) win = true

            let txt = `🎰 *SLOTS* 🎰\n\n`
            txt += board.map(r => r.join(' | ')).join('\n')
            txt += '\n\n'

            if (win) {
                user.money += bet
                txt += `¡GANASTE! Recibes +${bet} Soles. Saldo: ${user.money}`
            } else {
                user.money -= bet
                txt += `Perdiste. -${bet} Soles. Saldo: ${user.money}`
            }
            
            return m.reply(txt)
        }
    }
}