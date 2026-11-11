// ./plugins/owner/editmsg.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['edit', 'fakemsg', 'editmsg'],
    description: 'Edita el mensaje citado (propio o de otros) sin dejar rastro de "editado".',
    category: 'owner',
    usage: ['edit ‹nuevo texto› (respondiendo al mensaje)'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted) return m.reply('ⓘ Cita el mensaje que deseas editar.')
        
        const newText = m.text.trim()
        if (!newText) return m.reply('ⓘ Escribe el nuevo texto que reemplazará al mensaje.')

        await m.react('wait')

        try {
            const chatId = m.chat.id
            const stanzaId = m.quoted.id

            const tempId = await sock.relayMessage(
                chatId,
                {
                    extendedTextMessage: {
                        text: '',
                        contextInfo: {
                            isGroupStatus: true
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
                                text: newText,
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
            console.error('[fakemsg]', e)
            await m.react('error')
            await m.reply(`Error: ${e?.message || e}`)
        }
    }
}