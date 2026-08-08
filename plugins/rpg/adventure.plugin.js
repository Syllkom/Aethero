// ./plugins/rpg/adventure.plugin.js
const COOLDOWN = 5 * 60 * 1000

const TEMATICAS = [
    {
        theme: 'Fantasía Oscura',
        intro: 'Te adentras en unas ruinas góticas rodeadas de neblina espesa. A lo lejos escuchas el rugido de una gargola de piedra.',
        options: {
            A: { text: 'Empuñar tu espada e investigar el altar principal.', exp: 120, money: 200, outcome: 'Encontraste un cofre antiguo escondido bajo el altar con monedas brillantes.' },
            B: { text: 'Moverte sigilosamente por los pasillos laterales.', exp: 80, money: 100, outcome: 'Evitaste una trampa de dardos de veneno y recogiste unas monedas de exploradores caídos.' },
            C: { text: 'Lanzar un hechizo de luz para iluminar la sala.', exp: 150, money: 50, outcome: 'El hechizo ahuyentó a los espectros y reveló un pasadizo secreto hacia la salida.' }
        }
    },
    {
        theme: 'Cyberpunk',
        intro: 'Llegas a un callejón neón bajo la lluvia. Un fixer cibernético te ofrece un chip de datos encriptado.',
        options: {
            A: { text: 'Hackear el chip en el acto con tu terminal.', exp: 180, money: 250, outcome: 'Desencryptaste información corporativa confidencial y la vendiste en la red negra.' },
            B: { text: 'Negociar el precio del chip cara a cara.', exp: 100, money: 150, outcome: 'Lograste un excelente acuerdo y te pagaron una generosa comisión.' },
            C: { text: 'Revisar si hay drones de seguridad vigilando la zona.', exp: 90, money: 80, outcome: 'Detectaste un dron espía y te retiraste a tiempo cobrando por la advertencia.' }
        }
    },
    {
        theme: 'Japón Feudal Yokai',
        intro: 'Cruzas el torii de un templo místico al anochecer. Un espíritu linterna (Chochin-obake) flotante te bloquea el camino.',
        options: {
            A: { text: 'Ofrecer una ofrenda de arroz sagrado al espíritu.', exp: 140, money: 120, outcome: 'El espíritu purificado te guió hacia una urna con reliquias de oro.' },
            B: { text: 'Desenfundar tu katana y asumir postura de combate.', exp: 160, money: 220, outcome: 'Tras un duelo veloz, el Yokai se disipó dejando caer talismanes de valor.' },
            C: { text: 'Meditar y recitar un mantra de pacificación.', exp: 110, money: 90, outcome: 'Tu paz mental disolvió la ilusión y encontraste un cofre dejado por monjes.' }
        }
    }
]

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

export default {
    command: true, usePrefix: true,
    case: ['adventure', 'aventura', 'explore'],
    description: 'Embarcate en una aventura RPG interactiva con toma de decisiones A, B o C.',
    category: 'RPG',
    usage: 'aventura',
    script: async (m, { sock, plugin }) => {
        const rpg = plugin.import('@rpg')
        const { user } = await rpg.getUser(m.sender.id)

        const now = Date.now()
        const lastAdv = user.cooldowns?.adventure || 0
        if (now - lastAdv < COOLDOWN) {
            const left = Math.ceil((COOLDOWN - (now - lastAdv)) / 1000 / 60)
            return m.reply(`ⓘ Estás descansando de tu última aventura. Vuelve en ${left} minutos.`)
        }

        user.cooldowns ||= {}
        user.cooldowns.adventure = now

        await m.react('wait')

        const selectedEvent = getRandom(TEMATICAS)
        
        const txt = `𖦹 *Misión:* ${selectedEvent.theme}\n` +
                  `⚲ *Escenario Inicial:*\n${selectedEvent.intro}\n\n` +
                  `Ⓐ ${selectedEvent.options.A.text}\n` +
                  `Ⓑ ${selectedEvent.options.B.text}\n` +
                  `Ⓒ ${selectedEvent.options.C.text}\n\n` +
                  `ⓘ _Responde A, B o C para tomar tu decisión._`

        const eventMsg = await sock.sendMessage(m.chat.id, { text: txt }, { quoted: m.raw })
        await m.react('done')

        await sock.setReplyHandler(eventMsg, {
            security: { userId: m.sender.id, chatId: m.chat.id },
            lifecycle: { consumeOnce: true },
            state: { eventData: selectedEvent },
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        const choiceKey = (m.content?.text || m.body || '').toUpperCase().trim().charAt(0)
                        
                        if (!['A', 'B', 'C'].includes(choiceKey)) {
                            return m.reply('✗ Opción no válida. La aventura se ha desvanecido.')
                        }

                        const choice = ctx.state.eventData.options[choiceKey]
                        const rpg = ctx.sock.plugins.import('@rpg')
                        const { user } = await rpg.getUser(m.sender.id)

                        user.exp = (user.exp || 0) + choice.exp
                        user.money = (user.money || 0) + choice.money

                        const resultTxt = `▢ *RESULTADO DE LA AVENTURA*\n\n` +
                                        `● *Elegiste:* ${choice.text}\n` +
                                        `● *Resultado:* ${choice.outcome}\n\n` +
                                        `*Recompensas:*\n` +
                                        `- ⊹₊⋆ +${choice.exp} XP\n` +
                                        `- 𖤓 +${choice.money} Soles`

                        await m.reply(resultTxt)
                    }
                }
            }]
        }, 120000)
    }
}