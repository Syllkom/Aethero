// ./plugins/owner/owner.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['owner', 'deowner', 'setowner', 'unsetowner'],
    category: 'owner', description: 'Otorga o revoca permisos de owner en memoria y base de datos.',
    usage: ['owner @usuario', 'deowner @usuario'],
    async script(m) {
        if (!m.sender.role('root')) {
            return m.reply('[!] Este comando solo puede ser utilizado por el Creador absoluto.')
        }

        const target = m.sender.mentioned[0] || m.quoted?.key?.participant || m.quoted?.sender?.id

        if (!target) {
            return m.reply('[!] Menciona o cita al usuario al que deseas otorgar o quitar owner.')
        }

        if (target === m.sender.id) {
            return m.reply('[!] No puedes modificar tu propio rango de creador.')
        }

        const isOwnerCommand = ['owner', 'setowner'].includes(m.command)
        const targetCleanNum = target.split('@')[0].split(':')[0].replace(/\D/g, '')
        const phoneJid = `${targetCleanNum}@s.whatsapp.net`

        await m.react('wait')

        try {
            global.config.userRoles ||= {}
            const usersDB = await global.db.open('@users')

            if (isOwnerCommand) {
                await m.setRole(target, true, 'owner', 'mod', 'vip')
                if (target !== phoneJid) {
                    await m.setRole(phoneJid, true, 'owner', 'mod', 'vip')
                }

                global.config.userRoles[targetCleanNum] = { root: false, owner: true, mod: true, vip: true }
                global.config.userRoles[phoneJid] = { root: false, owner: true, mod: true, vip: true }
                global.config.userRoles[target] = { root: false, owner: true, mod: true, vip: true }

                await m.reply(`✦ @${targetCleanNum} ha sido ascendido a *Owner* con todos los permisos.`)
            } else {
                await m.setRole(target, false, 'owner', 'mod', 'vip')
                if (target !== phoneJid) {
                    await m.setRole(phoneJid, false, 'owner', 'mod', 'vip')
                }

                if (usersDB[target]?.roles) {
                    usersDB[target].roles.owner = false
                    usersDB[target].roles.mod = false
                    usersDB[target].roles.vip = false
                }
                if (usersDB[phoneJid]?.roles) {
                    usersDB[phoneJid].roles.owner = false
                    usersDB[phoneJid].roles.mod = false
                    usersDB[phoneJid].roles.vip = false
                }

                delete global.config.userRoles[targetCleanNum]
                delete global.config.userRoles[phoneJid]
                delete global.config.userRoles[target]

                await m.reply(`✦ Permisos de *Owner* revocados exitosamente para @${targetCleanNum}.`)
            }

            await m.react('done')
        } catch (error) {
            console.error('[Owner Error]:', error)
            await m.react('error')
            await m.reply(`[!] Error al actualizar permisos: ${error.message}`)
        }
    }
}