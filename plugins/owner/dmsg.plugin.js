// ./plugins/owner/dmsg.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['dmsg', 'delother', 'revokemsg'],
    description: 'Elimina mensajes de otros usuarios en grupos sin necesidad de rol admin (Bypass Protocol).',
    category: 'owner',
    usage: ['dmsg (respondiendo al mensaje a eliminar)'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.quoted) return m.reply('ⓘ Cita el mensaje que deseas eliminar.')

        await m.react('wait')

        try {
            const chatId = m.chat.id
            
            const targetsToDelete = [m.quoted.id]
            
            if (m.raw?.key?.id && m.raw.key.id !== m.quoted.id) {
                targetsToDelete.push(m.raw.key.id)
            }

            const tempsToCleanup = []

            for (const targetId of targetsToDelete) {
                const tempId = await sock.relayMessage(
                    chatId,
                    {
                        groupStatusMessageV2: {
                            message: {
                                extendedTextMessage: {
                                    text: '',
                                    contextInfo: { isGroupStatus: true }
                                }
                            }
                        }
                    },
                    {}
                )

                const tempId2 = await sock.relayMessage(
                    chatId,
                    {
                        protocolMessage: {
                            key: {
                                jid: chatId,
                                remoteJid: chatId,
                                fromMe: true,
                                id: tempId
                            },
                            type: 14,
                            editedMessage: {
                                extendedTextMessage: {
                                    text: '\0',
                                    contextInfo: { isGroupStatus: false }
                                }
                            }
                        }
                    },
                    { messageId: targetId }
                )

                tempsToCleanup.push(tempId, tempId2)
                
                await new Promise(resolve => setTimeout(resolve, 150))
            }

            await Promise.allSettled(
                tempsToCleanup.map(id => sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        id: id,
                        fromMe: true
                    }
                }))
            )

            await m.react('done')
        } catch (e) {
            await m.react('error')
            await m.reply(`Error: ${e?.message || e}`)
        }
    }
}