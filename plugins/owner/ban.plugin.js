// ./plugins/owner/ban.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['ban', 'banear', 'unban', 'desbanear'],
    description: 'Gestiona el acceso al bot mediante bloqueos permanentes.',
    category: 'owner',
    usage: 'ban @user/57..',
    script: async (m) => {
        const isRoot = m.sender.role('root')
        const isOwner = m.sender.role('owner')

        if (!isRoot && !isOwner) {
            return m.sms('owner')
        }

        let target = m.sender.mentioned[0] || m.quoted?.sender?.id

        if (!target && m.args.length > 0) {
            const num = m.args[0].replace(/\D/g, '')
            if (num) target = `${num}@lid`
        }

        if (!target) {
            return m.reply('ⓘ Debes mencionar, citar un mensaje o escribir el número del usuario.\n\n*Ejemplos:*\n» .ban @usuario\n» .ban 573333333333')
        }

        if (target === m.bot.id) return m.reply(':D No me puedo banear a mí mismo.')
        if (target === m.sender.id) return m.reply('. _ . No te puedes banear a ti mismo.')

        const targetNum = target.split('@')[0]
        const targetConfigRoles = global.config.userRoles?.[target] || global.config.userRoles?.[targetNum] || {}

        if (targetConfigRoles.root) {
            return m.reply('✗ *Acción denegada:* No puedes banear a un administrador ROOT.')
        }
        if (targetConfigRoles.owner && !isRoot) {
            return m.reply('✗ *Acción denegada:* Solo un ROOT puede banear a otro Owner.')
        }

        const targetDB = await m.db(target)
        if (!targetDB) return m.reply('✗ Error al obtener los datos del usuario.')

        const isBanCmd = ['ban', 'banear'].includes(m.command)

        if (isBanCmd) {
            if (targetDB.banned) {
                return m.reply(`⚠ El usuario ya se encuentra baneado por un *${(targetDB.bannedByRole || 'admin').toUpperCase()}*.`)
            }

            targetDB.banned = true
            targetDB.bannedByRole = isRoot ? 'root' : 'owner'
            targetDB.bannedBy = m.sender.id

            return m.reply(`✓ *Usuario Baneado*\n\n- Usuario: @${targetNum}\n- Autoridad: ${targetDB.bannedByRole.toUpperCase()}\n\n_El usuario ya no podrá utilizar el bot._`)
        } else {
            if (!targetDB.banned) {
                return m.reply('✗ El usuario no se encuentra baneado.')
            }

            if (targetDB.bannedByRole === 'root' && !isRoot) {
                return m.reply('ⓘ *Acceso Denegado:*\nEste usuario fue baneado por un *ROOT*. Solo otro administrador de rango ROOT puede remover este castigo.')
            }

            targetDB.banned = false
            targetDB.bannedByRole = null
            targetDB.bannedBy = null

            return m.reply(`✓ *Usuario Desbaneado*\n\n￫ Usuario: @${targetNum}\n\n_El usuario vuelve a tener acceso a las funciones del bot._`)
        }
    }
}