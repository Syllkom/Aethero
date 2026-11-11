// ./plugins/main/settings.plugin.js
import path from 'path'

const commandLocks = new Map()

export default {
    command: true, usePrefix: true,
    case: ['set', 'setting', 'settings', 'config'],
    category: 'main', description: 'Gestion y configuracion de funciones del bot y del grupo mediante subcomandos.',
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
                    message: `Configuracion / ${global.config.name}`,
                    orderTitle: 'Syllkom Store',
                    price: 374,
                    currency: 'USD'
                })
                
                if (!m.chat.isGroup) {
                    const txt = ['```╭○ Configuracion',
                        `╵ AutoDL:     ${state('autodl')}`,
                        '╰╶╴──────╶╴─╶╴◯```',
                        '',
                        '▢ Categorias Apagadas:',
                        `- ${blockedCats}`
                    ].join('\n')
                    return m.reply({ text: txt }, { quoted: mami })
                }

                const alMode = config.antilink ? `(${config.antilinkMode || 'kick'})` : ''
                const rulesMode = config.rulesText ? '(Personalizadas)' : '(WhatsApp)'
                const txt = ['```╭○ Estado Actual:',
                    `╵ Bot:        ${state('bot')}`,
                    `╵ Detect:     ${state('detect')}`,
                    `╵ Antilink:   ${state('antilink')} ${alMode}`,
                    `╵ Antibot:    ${state('antibot')}`,
                    `╵ Welcome:    ${state('welcome')}`,
                    `╵ Bye:        ${state('bye')}`,
                    `╵ AutoDL:     ${state('autodl')}`,
                    `╵ Reglas:     ${rulesMode}`,
                    `╵ SoloLatam:  ${state('sololatam')}`,
                    `╵ SoloAdmin:  ${state('soloadmin')}`,
                    '╰╶╴──────╶╴─╶╴◯```',
                    '',
                    '▢ Categorias Apagadas:',
                    `- ${blockedCats}`,
                    '',
                    'ⓘ Acciones Rapidas:',
                    '- .set ‹funcion› on/off (Ej: .set soloadmin on)',
                    '- .set rules ‹texto› / .set rules reset',
                    '- .set cat ‹nombre› on/off (Ej: .set cat nsfw off)',
                    '- .set welcome ‹texto›'
                ].join('\n')
                
                await m.react('done')
                return m.reply(txt, { quoted: mami })
            }

            if (m.chat.isGroup) {
                const canManage = Boolean(m.sender.isAdmin || m.sender.role('admin', 'owner', 'root', 'bot'))
                if (!canManage) {
                    return m.reply('[!] Solo los administradores o el Owner pueden modificar esto.')
                }
            }

            const validTypes = m.chat.isGroup
                ? ['welcome', 'bye', 'rules', 'reglas', 'antilink', 'detect', 'autodl', 'bot', 'sololatam', 'antibot', 'soloadmin', 'modoadmin', 'adminonly']
                : ['autodl']

            if (validTypes.includes(sub)) {
                const type = sub
                const mode = m.args[1]?.toLowerCase()

                if (['welcome', 'bye', 'rules', 'reglas'].includes(type) && mode !== 'on' && mode !== 'off') {
                    if (!m.chat.isGroup) return m.reply('[!] Solo para grupos.')

                    const isRules = ['rules', 'reglas'].includes(type)
                    const key = type === 'welcome' ? 'welcomeText' : type === 'bye' ? 'byeText' : 'rulesText'
                    const text = m.args.slice(1).join(' ').trim()

                    if (!text) {
                        const defaultDesc = isRules ? '_(Usa la descripcion de WhatsApp por defecto)_' : '_(Predeterminado)_'
                        const current = config[key] || defaultDesc
                        return m.reply(`[!] Contenido actual:\n\n${current}\n\n- Para cambiar: .set ${type} ‹texto›\n- Para borrar: .set ${type} reset`)
                    }

                    if (text.toLowerCase() === 'reset') delete config[key]
                    else config[key] = text
                    
                    return m.reply(`✓ ${isRules ? 'Reglas' : 'Mensaje'} configurado correctamente.`)
                }

                if (!['on', 'off'].includes(mode)) {
                    return m.reply(`[!] Uso correcto: .set ${type} on / .set ${type} off`)
                }
                
                const isEnable = mode === 'on'
                const isSuperAdmin = m.sender.role('root', 'owner', 'bot')
                const targetKey = ['soloadmin', 'modoadmin', 'adminonly'].includes(type) ? 'soloadmin' : type

                config.locks[targetKey] = isSuperAdmin 
                config[targetKey] = isEnable

                let extraTxt = ''
                if (type === 'antilink' && isEnable && m.chat.isGroup) {
                    const alMode = m.args[2]?.toLowerCase()
                    if (['warn', 'delete', 'kick'].includes(alMode)) config.antilinkMode = alMode
                    else config.antilinkMode = config.antilinkMode || 'kick'
                    extraTxt = ` (Modo: ${config.antilinkMode.toUpperCase()})`
                }

                return m.reply(`✓ Funcion ${targetKey.toUpperCase()} ${isEnable ? 'Activada' : 'Desactivada'}${extraTxt}.`)
            }

            if (['categoria', 'cat'].includes(sub)) {
                const catName = m.args[1]?.toLowerCase()
                const mode = m.args[2]?.toLowerCase()

                if (!catName || !['on', 'off'].includes(mode)) {
                    return m.reply(`[!] Uso correcto: .set cat ‹nombre› on/off`)
                }

                const isEnable = mode === 'on'
                if (isEnable) {
                    config.disabledCats = config.disabledCats.filter(c => c !== catName)
                } else {
                    if (!config.disabledCats.includes(catName)) config.disabledCats.push(catName)
                }
                return m.reply(`✓ Categoria ${catName.toUpperCase()} ${isEnable ? 'Activada' : 'Desactivada'}.`)
            }
            
        } finally {
            setTimeout(() => { commandLocks.delete(m.chat.id) }, 2000)
        }
    }
}