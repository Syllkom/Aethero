import { inspectPlugins, countTotalCommands, listCategoryUsage } from '../../library/pluginInspector.js'
import path from 'path'

const commandLocks = new Map()

export default {
    command: true, usePrefix: true,
    case: ['set', 'setting', 'settings', 'config'],
    description: 'Gestión y configuración de funciones del bot y del grupo mediante subcomandos.',
    category: 'main',
    usage: ['settings'],
    script: async (m, { sock }) => {
        if (commandLocks.has(m.chat.id)) return
        
        commandLocks.set(m.chat.id, true)

        try {
            const dbTarget = await m.chat.db()
            
            if (!dbTarget.settings) dbTarget.settings = {}
            const config = dbTarget.settings

            if (!config.disabledCats) config.disabledCats = []
            if (!config.locks) config.locks = {}
            if (typeof config.bot === 'undefined') config.bot = true

            const sub = m.args[0]?.toLowerCase()
            const isShowMenu = ['setting', 'settings', 'config'].includes(m.command) || !sub

            if (isShowMenu) {
                await m.react('wait')
                const state = (key) => config[key] ? '✓' : '✗'
                const blockedCats = config.disabledCats.length ? config.disabledCats.join(', ') : 'Ninguna'
                const mami = await sock.fakeOrder(m.chat.id, {
                    image: await sock.profilePictureUrl(m.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg'),
                    message: `Configuración / ${global.config.name}`,
                    orderTitle: 'Syllkom Store',
                    price: 374,
                    currency: 'USD'
                })
                
                if (!m.chat.isGroup) {
                    const txt = ['```╭○ Configuración',
                        `╵ AutoDL:     ${state('autodl')}`,
                        '╰╶╴──────╶╴─╶╴◯```',
                        '',
                        '▢ Categorías Apagadas:',
                        `- ${blockedCats}`
                    ].join('\n')
                    return m.reply({ text: txt }, { quoted: mami })
                }

                const alMode = config.antilink ? `(${config.antilinkMode || 'kick'})` : ''
                const txt = ['```╭○ Estado Actual:',
                    `╵ Bot:        ${state('bot')}`,
                    `╵ Detect:     ${state('detect')}`,
                    `╵ Antilink:   ${state('antilink')} ${alMode}`,
                    `╵ Antibot:    ${state('antibot')}`,
                    `╵ Welcome:    ${state('welcome')}`,
                    `╵ Bye:        ${state('bye')}`,
                    `╵ AutoDL:     ${state('autodl')}`,
                    `╵ SoloLatam:  ${state('sololatam')}`,
                    '╰╶╴──────╶╴─╶╴◯```',
                    '',
                    '▢ Categorías Apagadas:',
                    `- ${blockedCats}`,
                    '',
                    'ⓘ Acciones Rápidas:',
                    '- .set ‹función› on/off (Ej: .set antilink on)',
                    '- .set cat ‹nombre› on/off (Ej: .set cat nsfw off)',
                    '- .set welcome ‹texto›'
                ].join('\n')
                
                await m.react('done')
                return m.reply({ text: txt }, { quoted: mami })
            }

            if (m.chat.isGroup) {
                if (!m.sender.role('admin', 'owner', 'root', 'bot')) {
                    return m.reply('ⓘ Solo los administradores o el Owner pueden modificar esto.')
                }
            }

            const validTypes = m.chat.isGroup ? ['welcome', 'bye', 'antilink', 'detect', 'autodl', 'bot', 'sololatam', 'antibot'] : ['autodl']

            if (validTypes.includes(sub)) {
                const type = sub
                const mode = m.args[1]?.toLowerCase()
                const scope = m.args[2]?.toLowerCase()

                if (['welcome', 'bye'].includes(type) && mode !== 'on' && mode !== 'off') {
                    if (!m.chat.isGroup) return m.reply('ⓘ Solo para grupos.')

                    const key = type === 'welcome' ? 'welcomeText' : 'byeText'
                    const text = m.args.slice(1).join(' ').trim()

                    if (!text) {
                        const current = config[key] || '_(Predeterminado)_'
                        return m.reply(`ⓘ Mensaje actual:\n\n${current}\n\n- Para cambiar: .set ${type} ‹texto›\n- Para borrar: .set ${type} reset`)
                    }

                    if (text.toLowerCase() === 'reset') delete config[key]
                    else config[key] = text
                    
                    return m.reply('✓ Mensaje configurado correctamente.')
                }

                if (!['on', 'off'].includes(mode)) {
                    return m.reply(`ⓘ Uso correcto: .set ${type} on / .set ${type} off`)
                }
                
                const isEnable = mode === 'on'
                const isSuperAdmin = m.sender.role('root', 'owner', 'bot')

                config.locks[type] = isSuperAdmin 
                config[type] = isEnable

                let extraTxt = ''
                if (type === 'antilink' && isEnable && m.chat.isGroup) {
                    const alMode = m.args[2]?.toLowerCase()
                    if (['warn', 'delete', 'kick'].includes(alMode)) config.antilinkMode = alMode
                    else config.antilinkMode = config.antilinkMode || 'kick'
                    extraTxt = ` (Modo: ${config.antilinkMode.toUpperCase()})`
                }

                return m.reply(`✓ Función ${type.toUpperCase()} ${isEnable ? 'Activada' : 'Desactivada'}${extraTxt}.`)
            }

            if (['categoria', 'cat'].includes(sub)) {
                const catName = m.args[1]?.toLowerCase()
                const mode = m.args[2]?.toLowerCase()

                if (!catName || !['on', 'off'].includes(mode)) {
                    return m.reply(`ⓘ Uso correcto: .set cat ‹nombre› on/off`)
                }

                const isEnable = mode === 'on'
                if (isEnable) {
                    config.disabledCats = config.disabledCats.filter(c => c !== catName)
                } else {
                    if (!config.disabledCats.includes(catName)) config.disabledCats.push(catName)
                }
                return m.reply(`✓ Categoría ${catName.toUpperCase()} ${isEnable ? 'Activada' : 'Desactivada'}.`)
            }
            
        } finally {
            setTimeout(() => { commandLocks.delete(m.chat.id) }, 2000)
        }
    }
}