// ./plugins/rpg/@rpg.plugin.js
const ROLES = ['Novato', 'Explorador', 'Guerrero', 'Veterano', 'Maestro', 'Élite', 'Héroe', 'Leyenda', 'Mítico', 'Dios', 'Horeku']
const MONEY_RATES = { '57': { name: 'COP', rate: 1100 }, '54': { name: 'ARS', rate: 250 }, '52': { name: 'MXN', rate: 5 }, 'default': { name: 'Soles', rate: 1 } }

const getRate = (jid = '') => {
    const prefix = Object.keys(MONEY_RATES).find(p => jid.startsWith(p))
    return MONEY_RATES[prefix] || MONEY_RATES['default']
}

const DEFAULT_USER = {
    name: null, age: 0, registered: false,
    level: 1, exp: 0, role: ROLES[0],
    money: 0, diamond: 0, gold: 0,
    stamina: 100,
    autolvl: false,
    inventory: [],
    cooldowns: { daily: 0, work: 0, mine: 0, adventure: 0, rob: 0, work_type: 'normal' },
    streak: 0, partner: null, gender: null, birthday: null, hobby: null
}

export default {
    before: true, 
    priority: 1,
    command: false,
    description: 'API Core RPG. Maneja la experiencia, niveles, roles y gestión de usuarios en base de datos.',
    export: {
        '@rpg': {
            xpForLevel: (level) => Math.floor(100 * Math.pow(1.5, level - 1)),
            getRole: (level) => ROLES[Math.floor((level - 1) / 10)] || ROLES[ROLES.length - 1],
            formatMoney: (amount, jid) => {
                const currency = getRate(jid)
                return `${((amount || 0) * currency.rate).toLocaleString('es-ES')} ${currency.name}`
            },
            
            getUser: async (id) => {
                const db = await global.db.open('@rpg')
                db.users ||= {}
                if (!db.users[id]) {
                    db.users[id] = JSON.parse(JSON.stringify(DEFAULT_USER))
                }

                return { 
                    user: db.users[id],
                    save: async () => true 
                }
            },

            getDB: async () => {
                return await global.db.open('@rpg')
            }
        }
    },
    script: async function (m, { modules }) {
        if (!m.sender?.id) return
        const pluginsFolder = modules?.getFolder('plugins')
        const rpg = pluginsFolder?.import('@rpg')
        if (!rpg) return

        const { user } = await rpg.getUser(m.sender.id)
        
        if (user.registered && user.autolvl) {
            const need = rpg.xpForLevel(user.level)
            if (user.exp >= need) {
                user.level++
                user.exp -= need
                user.role = rpg.getRole(user.level)
                m.reply(`↑ *AUTO-LEVEL* | Has subido al nivel ${user.level} (${user.role})`)
            }
        }
    }
}