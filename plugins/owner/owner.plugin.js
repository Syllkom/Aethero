// ./plugins/owner/owner.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['owner', 'deowner', 'setowner', 'unsetowner'],
    description: 'Otorga o revoca el rol de owner a un usuario',
    category: 'owner',
    usage: 'owner/deowner ‹@usuario›',
    async script(m) {
        if (!m.sender.role('root')) {
            return m.reply('ⓘ Este comando solo puede ser utilizado por el *dueño absoluto*')
        }

        const target = m.sender.mentioned[0] || m.quoted?.sender?.id

        if (!target) {
            return m.reply('ⓘ Menciona o cita al usuario al que deseas otorgar/quitar owner\n\nEjemplo: .owner @usuario')
        }

        if (target === m.sender.id) {
            return m.reply('ⓘ No puedes modificar tu propio rol')
        }

        const isOwnerCommand = ['owner', 'setowner'].includes(m.command)
        const targetName = target.split('@')[0]

        await m.react('wait')

        try {
            if (isOwnerCommand) {
                await m.setRole(target, true, 'owner', 'mod', 'vip')
                global.config.userRoles ||= {}
                global.config.userRoles[target] ||= {}
                global.config.userRoles[target].owner = true

                await m.reply(`✓ @${targetName} ahora es *Owner*\n\nSe le otorgaron todos los permisos de moderación`)
            } else {
                await m.setRole(target, false, 'owner')
                if (global.config.userRoles?.[target]) {
                    global.config.userRoles[target].owner = false
                }

                await m.reply(`✓ @${targetName} ya no es *Owner*`)
            }

            await m.react('done')
        } catch (error) {
            console.error('[Owner Error]:', error)
            await m.react('error')
            await m.reply('ⓘ Ocurrió un error al actualizar los permisos')
        }
    }
}