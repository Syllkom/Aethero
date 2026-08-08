// ./plugins/rpg/@michi.plugin.js
export default {
    description: 'Core de utilidades para el juego de Michi / Tres en Raya.',
    export: {
        '@michi/utils': {
            renderBoard: (board) => {
                const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
                const b = board.map((v, i) => {
                    if (v === 'X') return '❎'
                    if (v === 'O') return '🅾️'
                    return nums[i]
                })
                return `\n${b[0]}${b[1]}${b[2]}\n${b[3]}${b[4]}${b[5]}\n${b[6]}${b[7]}${b[8]}\n`
            },
            
            checkWin: (b) => {
                const w = [[0,1,2],[3,4,5],[6,7,8], [0,3,6],[1,4,7],[2,5,8], [0,4,8],[2,4,6]]
                for (let c of w) { if (b[c[0]] && b[c[0]] === b[c[1]] && b[c[0]] === b[c[2]]) return b[c[0]] }
                return b.includes(null) ? null : 'draw'
            },
            
            aiMove: (b) => {
                const checkWinLocal = (board) => {
                    const w = [[0,1,2],[3,4,5],[6,7,8], [0,3,6],[1,4,7],[2,5,8], [0,4,8],[2,4,6]]
                    for (let c of w) { if (board[c[0]] && board[c[0]] === board[c[1]] && board[c[0]] === board[c[2]]) return board[c[0]] }
                    return board.includes(null) ? null : 'draw'
                }
                const empty = b.map((v, i) => v === null ? i : null).filter(v => v !== null)
                for (let i of empty) { const tmp = [...b]; tmp[i] = 'O'; if (checkWinLocal(tmp) === 'O') return i }
                for (let i of empty) { const tmp = [...b]; tmp[i] = 'X'; if (checkWinLocal(tmp) === 'X') return i }
                if (b[4] === null) return 4
                return empty[Math.floor(Math.random() * empty.length)]
            }
        }
    },
    script: async () => {} 
}