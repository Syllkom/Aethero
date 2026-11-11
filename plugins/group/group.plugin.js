// ./plugins/group/group.plugin.js
export default {
    command: true,
    usePrefix: true,
    case: ['grupo', 'group', 'abrir', 'cerrar'],
    description: 'Permite abrir o cerrar la escritura del grupo y ajustar la configuración.',
    category: 'grupo',
    usage: ['abrir', 'cerrar', 'grupo lock/unlock'],
    script: async (m) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.role('admin', 'owner', 'root')) return m.sms('admin')
        if (!m.bot.roles.admin) return m.sms('botAdmin')

        const cmd = m.command.toLowerCase()
        const sub = m.args[0]?.toLowerCase()

        await m.react('⚙️')

        try {
            if (cmd === 'abrir' || sub === 'open' || sub === 'abrir') {
                await m.chat.settings.announce(false)
                await m.reply('✓ *Grupo Abierto*\nⓘ Todos los participantes pueden enviar mensajes.')
            } else if (cmd === 'cerrar' || sub === 'close' || sub === 'cerrar') {
                await m.chat.settings.announce(true)
                await m.reply('🔒 *Grupo Cerrado*\nⓘ Solo los administradores pueden enviar mensajes.')
            } else if (sub === 'lock' || sub === 'bloquear') {
                await m.chat.settings.lock(true)
                await m.reply('🔒 *Información Restringida*\nⓘ Solo los administradores pueden editar la info del grupo.')
            } else if (sub === 'unlock' || sub === 'desbloquear') {
                await m.chat.settings.lock(false)
                await m.reply('🔓 *Información Libre*\nⓘ Todos los participantes pueden editar la info del grupo.')
            } else {
                return m.reply(
                    `▢ *Ajustes de Grupo*\n\n` +
                    `- _.abrir_ — Abre el grupo para todos\n` +
                    `- _.cerrar_ — Cierra el grupo (Solo admins)\n` +
                    `- _.grupo lock_ — Restringe la edición de la info\n` +
                    `- _.grupo unlock_ — Permite editar la info a todos`
                )
            }
            await m.react('done')
        } catch (e) {
            console.error('Group Settings Error:', e)
            await m.react('error')
            await m.reply('ⓘ No se pudo cambiar la configuración del grupo.')
        }
    }
}