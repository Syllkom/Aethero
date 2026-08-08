// ./plugins/rpg/michi.plugin.js
const lobbies = new Map()

export default {
    command: true, usePrefix: true,
    case: ['michi', 'sala', 'unirse'],
    description: 'Juega Michi (Tres en Raya) contra la IA o contra otro usuario.',
    category: 'RPG',
    usage: ['michi (vs IA)', 'sala ‹codigo›', 'unirse ‹sala›'],
    script: async (m, { sock, plugin }) => {
        const utils = plugin.import('@michi/utils')

        if (m.command === 'sala') {
            const code = m.text.trim()
            if (!code) return m.reply('Uso: .sala <codigo>')
            if (lobbies.has(code)) return m.reply('Sala ocupada.')
            lobbies.set(code, { p1: m.sender.id, bet: 3 })
            return m.reply(`Sala ${code} creada. Esperando rival (.unirse ${code}). Apuesta: 3 Soles.`)
        }

        if (m.command === 'unirse') {
            const code = m.text.trim()
            const room = lobbies.get(code)
            if (!room) return m.reply('Sala no existe.')
            if (room.p1 === m.sender.id) return m.reply('No puedes jugar contra ti mismo.')
            
            lobbies.delete(code)
            const gameState = {
                board: Array(9).fill(null),
                turn: 'X',
                players: { X: room.p1, O: m.sender.id },
                isPvP: true,
                bet: 3
            }
            
            const txt = `Juego Iniciado (PvP)\nJugador 1 (❎): @${room.p1.split('@')[0]}\nJugador 2 (🅾️): @${m.sender.id.split('@')[0]}\n${utils.renderBoard(gameState.board)}\nTurno de ❎. Responde con 1-9.`
            const msg = await sock.sendMessage(m.chat.id, { text: txt, contextInfo: { mentionedJid: [room.p1, m.sender.id] } })
            return startHandler(sock, msg, gameState)
        }

        if (m.command === 'michi') {
            const gameState = {
                board: Array(9).fill(null),
                turn: 'X',
                players: { X: m.sender.id, O: 'AI' },
                isPvP: false,
                bet: 0
            }
            const txt = `Juego vs ${global.config.name}\nEres ❎. Responde con 1-9.\n${utils.renderBoard(gameState.board)}`
            const msg = await m.reply(txt)
            return startHandler(sock, msg, gameState)
        }

        async function startHandler(sock, message, state) {
            await sock.setReplyHandler(message, {
                security: { userId: 'all', chatId: m.chat.id },
                lifecycle: { consumeOnce: true },
                state: state,
                routes: [{
                    code: {
                        executor: async (m, ctx) => {
                            const utils = ctx.sock.plugins.import('@michi/utils')
                            const rpg = ctx.sock.plugins.import('@rpg')
                            const state = ctx.state
                            
                            const currentPlayer = state.players[state.turn]
                            if (currentPlayer !== 'AI' && m.sender.id !== currentPlayer) return
                            
                            const pos = parseInt(m.body) - 1
                            if (isNaN(pos) || pos < 0 || pos > 8 || state.board[pos] !== null) {
                                const msg = await m.reply('Posicion invalida o ocupada. Elige del 1 al 9.')
                                return startHandler(ctx.sock, msg, state)
                            }

                            state.board[pos] = state.turn
                            let win = utils.checkWin(state.board)

                            if (!win && !state.isPvP) {
                                state.turn = 'O'
                                const aiPos = utils.aiMove(state.board)
                                if (aiPos !== undefined) state.board[aiPos] = 'O'
                                win = utils.checkWin(state.board)
                                state.turn = 'X'
                            } else if (!win && state.isPvP) {
                                state.turn = state.turn === 'X' ? 'O' : 'X'
                            }

                            if (win) {
                                const finalBoard = utils.renderBoard(state.board)
                                if (win === 'draw') {
                                    return m.reply(`EMPATE\n${finalBoard}\nNadie pierde Soles.`)
                                } else {
                                    const winnerId = state.players[win]
                                    const loserId = state.players[win === 'X' ? 'O' : 'X']
                                    const winIcon = win === 'X' ? '❎' : '🅾️'
                                    
                                    let betTxt = ''
                                    if (state.isPvP && state.bet > 0) {
                                        const { user: wUser } = await rpg.getUser(winnerId)
                                        const { user: lUser } = await rpg.getUser(loserId)
                                        wUser.money += state.bet
                                        lUser.money -= state.bet
                                        betTxt = `\nApuesta: ${state.bet} Soles transferidos.`
                                    }

                                    const winnerName = winnerId === 'AI' ? global.config.name : `@${winnerId.split('@')[0]}`
                                    return m.reply({ text: `VICTORIA DE ${winIcon}\n${finalBoard}\nGanador: ${winnerName}${betTxt}`, contextInfo: { mentionedJid: [winnerId, loserId].filter(id => id !== 'AI') } })
                                }
                            }

                            const nextTurnId = state.players[state.turn]
                            const turnIcon = state.turn === 'X' ? '❎' : '🅾️'
                            const turnName = nextTurnId === 'AI' ? global.config.name : `@${nextTurnId.split('@')[0]}`
                            const txt = `Turno de ${turnIcon} (${turnName})\n${utils.renderBoard(state.board)}`
                            
                            const nextMsg = await m.reply({ text: txt, contextInfo: { mentionedJid: [nextTurnId].filter(id => id !== 'AI') } })
                            
                            await ctx.sock.setReplyHandler(nextMsg, {
                                security: ctx.security,
                                lifecycle: ctx.lifecycle,
                                state: state,
                                routes: [{ code: { executor: ctx.route.code.executor } }]
                            })
                        }
                    }
                }]
            })
        }
    }
}