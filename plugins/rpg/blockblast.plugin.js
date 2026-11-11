// ./plugins/rpg/blockblast.plugin.js
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import got from 'got'
import fs from 'fs'
import path from 'path'

let fontLoaded = false

async function loadFont() {
    if (fontLoaded) return true
    const tempDir = path.join(process.cwd(), 'storage', 'temp')
    const fontPath = path.join(tempDir, 'NotoSans-Bold.ttf')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    try {
        if (!fs.existsSync(fontPath)) {
            const fontUrl = global.font?.NotoSans?.Bold || 'https://tinyurl.com/NotoSans-Bold'
            const fontData = await got(fontUrl, { timeout: { request: 10000 } }).buffer()
            fs.writeFileSync(fontPath, fontData)
        }
        GlobalFonts.registerFromPath(fontPath, 'NotoSans')
        fontLoaded = true
    } catch (e) { console.error("Font Error:", e) }
    return fontLoaded
}

const PIECES = [
    { shape: [[1]], color: '#FF3B30' }, 
    { shape: [[1,1],[1,1]], color: '#FFCC00' }, 
    { shape: [[1,1,1]], color: '#4CD964' }, 
    { shape: [[1],[1],[1]], color: '#4CD964' }, 
    { shape: [[1,1,1,1]], color: '#5AC8FA' }, 
    { shape: [[1],[1],[1],[1]], color: '#5AC8FA' }, 
    { shape: [[1,1],[1,0]], color: '#AF52DE' }, 
    { shape: [[1,1],[0,1]], color: '#AF52DE' },
    { shape: [[1,1,1],[1,0,0],[1,0,0]], color: '#FF9500' }, 
    { shape: [[1,1,1],[0,1,0]], color: '#FF2D55' } 
]

export default {
    command: true, usePrefix: true,
    case: ['blockblast', 'blocks', 'tetris'],
    description: 'Juego estilo BlockBlast en tablero 8x8 con imágenes generadas en Canvas.',
    category: 'RPG',
    usage: 'tetris',
    export: {
        '@rpg/blockblast': {
            getRandomPieces: () => {
                return [
                    PIECES[Math.floor(Math.random() * PIECES.length)],
                    PIECES[Math.floor(Math.random() * PIECES.length)],
                    PIECES[Math.floor(Math.random() * PIECES.length)]
                ]
            },

            renderGame: async (grid, pieces, score) => {
                const canvas = new Canvas(600, 800)
                const ctx = canvas.getContext('2d')
                const font = fontLoaded ? 'NotoSans, sans-serif' : 'sans-serif'

                ctx.fillStyle = '#09090b'
                ctx.fillRect(0, 0, 600, 800)

                ctx.fillStyle = '#ffffff'
                ctx.font = `40px ${font}`
                ctx.textAlign = 'center'
                ctx.fillText(`SCORE: ${score}`, 300, 60)

                const cellSize = 50
                const startX = 100
                const startY = 120

                ctx.fillStyle = '#71717a'
                ctx.font = `20px ${font}`
                const letters = ['A','B','C','D','E','F','G','H']
                for (let i = 0; i < 8; i++) {
                    ctx.fillText(letters[i], startX + (i*cellSize) + (cellSize/2), startY - 15)
                    ctx.fillText(i+1, startX - 20, startY + (i*cellSize) + (cellSize/2) + 7)
                }

                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const cell = grid[r][c]
                        ctx.fillStyle = cell === 0 ? '#18181b' : cell 
                        ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize - 2, cellSize - 2)
                        ctx.strokeStyle = '#27272a'
                        ctx.lineWidth = 2
                        ctx.strokeRect(startX + c * cellSize, startY + r * cellSize, cellSize - 2, cellSize - 2)
                    }
                }

                const pieceY = 580
                const pieceBoxes = [100, 250, 400] 

                for (let i = 0; i < 3; i++) {
                    const piece = pieces[i]
                    if (!piece) continue

                    ctx.fillStyle = '#ffffff'
                    ctx.font = `24px ${font}`
                    ctx.fillText(`[ ${i+1} ]`, pieceBoxes[i] + 40, pieceY - 20)

                    const miniSize = 20
                    for (let r = 0; r < piece.shape.length; r++) {
                        for (let c = 0; c < piece.shape[r].length; c++) {
                            if (piece.shape[r][c] === 1) {
                                ctx.fillStyle = piece.color
                                ctx.fillRect(pieceBoxes[i] + c * miniSize, pieceY + r * miniSize, miniSize-1, miniSize-1)
                            }
                        }
                    }
                }
                return await canvas.toBuffer('image/png')
            },

            canPlace: (grid, piece, startR, startC) => {
                for (let r = 0; r < piece.shape.length; r++) {
                    for (let c = 0; c < piece.shape[r].length; c++) {
                        if (piece.shape[r][c] === 1) {
                            const targetR = startR + r
                            const targetC = startC + c
                            if (targetR < 0 || targetR >= 8 || targetC < 0 || targetC >= 8 || grid[targetR][targetC] !== 0) {
                                return false
                            }
                        }
                    }
                }
                return true
            },

            checkGameOver: (bb, grid, pieces) => {
                for (const piece of pieces) {
                    if (!piece) continue
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            if (bb.canPlace(grid, piece, r, c)) return false 
                        }
                    }
                }
                return true 
            }
        }
    },

    script: async (m, { sock, plugin }) => {
        await loadFont()
        const bb = plugin.import('@rpg/blockblast')

        const grid = Array(8).fill().map(() => Array(8).fill(0))
        const pieces = bb.getRandomPieces()
        
        const state = {
            userId: m.sender.id,
            chatId: m.chat.id,
            grid,
            pieces,
            score: 0
        }

        const buffer = await bb.renderGame(grid, pieces, state.score)
        
        const txt = `☐ *BLOCK BLAST!* ☐\n\n` +
                    `*¿Cómo jugar?*\n` +
                    `Responde a este mensaje con el número de pieza y la coordenada.\n` +
                    `Ejemplo: \`1 C4\` (Pone la pieza 1 en la columna C, fila 4).\n\n` +
                    `_Escribe "salir" para rendirte y cobrar tus puntos._`

        const gameMsg = await sock.sendMessage(m.chat.id, { image: buffer, caption: txt }, { quoted: m.raw })

        await sock.setReplyHandler(gameMsg, {
            security: { userId: m.sender.id, chatId: m.chat.id },
            lifecycle: { consumeOnce: true },
            state: state,
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        try {
                            const bb = ctx.sock.plugins.import('@rpg/blockblast')
                            const input = (m.content?.text || m.body || '').trim().toUpperCase()
                            let st = ctx.state

                            if (input === 'SALIR' || input === 'RENDIRSE') {
                                const gainExp = st.score * 2
                                const gainMoney = Math.floor(st.score * 1.5)
                                const rpg = ctx.sock.plugins.import('@rpg')
                                const { user } = await rpg.getUser(m.sender.id)
                                user.exp += gainExp
                                user.money += gainMoney
                                return m.reply(`⚑ Te has rendido.\n\nPuntaje Final: *${st.score}*\nRecompensas:\n⊹₊⋆ +${gainExp} XP\n𖤓 +${gainMoney} Soles`)
                            }

                            const match = input.match(/([1-3])\s*([A-H])\s*([1-8])/)
                            if (!match) return m.reply('✗ Formato inválido. Usa: `1 C4`')

                            const pIndex = parseInt(match[1]) - 1
                            const colLetter = match[2]
                            const rowNum = parseInt(match[3])

                            const piece = st.pieces[pIndex]
                            if (!piece) return m.reply('✗ Esa pieza ya la usaste. Elige otra.')

                            const startC = colLetter.charCodeAt(0) - 65
                            const startR = rowNum - 1

                            if (!bb.canPlace(st.grid, piece, startR, startC)) {
                                return m.reply('ⓘ La pieza choca con otro bloque o sale del tablero.')
                            }

                            await m.react('🧩')

                            for (let r = 0; r < piece.shape.length; r++) {
                                for (let c = 0; c < piece.shape[r].length; c++) {
                                    if (piece.shape[r][c] === 1) st.grid[startR + r][startC + c] = piece.color
                                }
                            }

                            st.score += 10
                            st.pieces[pIndex] = null

                            let linesCleared = 0
                            let colsToClear = []
                            let rowsToClear = []

                            for (let r = 0; r < 8; r++) {
                                if (st.grid[r].every(cell => cell !== 0)) rowsToClear.push(r)
                            }
                            for (let c = 0; c < 8; c++) {
                                let isFull = true
                                for (let r = 0; r < 8; r++) {
                                    if (st.grid[r][c] === 0) { isFull = false; break }
                                }
                                if (isFull) colsToClear.push(c)
                            }

                            rowsToClear.forEach(r => { st.grid[r] = Array(8).fill(0); linesCleared++ })
                            colsToClear.forEach(c => {
                                for (let r = 0; r < 8; r++) st.grid[r][c] = 0
                            })
                            linesCleared += colsToClear.length

                            if (linesCleared > 0) st.score += (linesCleared * 50) 

                            if (st.pieces.every(p => p === null)) {
                                st.pieces = bb.getRandomPieces()
                            }

                            if (bb.checkGameOver(bb, st.grid, st.pieces)) {
                                const buff = await bb.renderGame(st.grid, st.pieces, st.score)
                                const gainExp = st.score * 2
                                const gainMoney = Math.floor(st.score * 1.5)
                                
                                const rpg = ctx.sock.plugins.import('@rpg')
                                const { user } = await rpg.getUser(m.sender.id)
                                user.exp += gainExp
                                user.money += gainMoney

                                return await ctx.sock.sendMessage(m.chat.id, { 
                                    image: buff, 
                                    caption: `*𓉸* GAME OVER\n\n*𐃯* Puntaje: ${st.score}\n⊹₊⋆ +${gainExp} XP\n𖤓 +${gainMoney} Soles` 
                                }, { quoted: m.raw })
                            }

                            const newBuff = await bb.renderGame(st.grid, st.pieces, st.score)
                            const nextMsg = await ctx.sock.sendMessage(m.chat.id, { 
                                image: newBuff, 
                                caption: linesCleared > 0 ? `¡COMBO! +${linesCleared * 50} Pts\nSiguiente movimiento:` : `Siguiente movimiento:` 
                            }, { quoted: m.raw })

                            await sock.setReplyHandler(nextMsg, {
                                security: { userId: m.sender.id, chatId: m.chat.id },
                                lifecycle: { consumeOnce: true },
                                state: st,
                                routes: [{ code: { executor: ctx.route.code.executor } }]
                            }, 120000)

                        } catch (err) {
                            console.error("[BlockBlast Error]", err)
                            m.reply("Error procesando la jugada.")
                        }
                    }
                }
            }]
        }, 120000)
    }
}