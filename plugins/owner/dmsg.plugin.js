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
            const stanzaId = m.quoted.id

            const tempId = await sock.relayMessage(
                chatId,
                {
                    groupStatusMessageV2: {
                        message: {
                            extendedTextMessage: {
                                text: '',
                                contextInfo: {
                                    isGroupStatus: true
                                }
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
                                contextInfo: {
                                    isGroupStatus: false
                                }
                            }
                        }
                    }
                },
                {
                    messageId: stanzaId
                }
            )

            await new Promise(resolve => setTimeout(resolve, 100))

            await Promise.allSettled([
                sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        id: tempId,
                        fromMe: true
                    }
                }),
                sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        id: tempId2,
                        fromMe: true
                    }
                })
            ])

            await m.react('done')
        } catch (e) {
            await m.react('error')
            await m.reply(`✖️ Error: ${e?.message || e}`)
        }
    }
}