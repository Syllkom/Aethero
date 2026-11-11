// ./plugins/tools/rich.plugin.js

const activeTasks = new Map()

const STAGES = [
    'Verificando integridad de paquetes (10%)...',
    'Sincronizando estado SQLite WAL (20%)...',
    'Optimizando buffers en memoria V8 (35%)...',
    'Analizando arbol de modulos activos (50%)...',
    'Comprobando sockets y canales IPC (65%)...',
    'Validando persistencia en Hyper-DB (80%)...',
    'Procesando paquetes de red (90%)...',
    'Ciclo completado. Reiniciando secuencia (100%)...'
]

export default {
    command: true, usePrefix: true,
    case: ['rich', 'airich', 'task'], category: 'tools',
    description: 'Ejecuta y detiene tareas progresivas en vivo con Meta AI.',
    usage: ['rich --send', 'rich --stop'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        
        const flag = (m.args[0] || '').toLowerCase()
        const chatId = m.chat.id

        if (['--stop', 'stop', 'detener', 'cancelar'].includes(flag)) {
            const currentTask = activeTasks.get(chatId)

            if (!currentTask) {
                return m.reply('[!] No hay ninguna tarea de edicion activa en este chat.')
            }

            currentTask.running = false

            if (currentTask.key) {
                await sock.sendMessage(chatId, { delete: currentTask.key }).catch(() => {})
            }

            activeTasks.delete(chatId)
            return m.reply('✦ Tarea detenida y mensaje eliminado exitosamente.')
        }

        if (['--send', 'send', 'start', 'iniciar'].includes(flag)) {
            if (activeTasks.has(chatId)) {
                return m.reply('[!] Ya existe una tarea en ejecucion en este chat.\n\n- Para detenerla usa: .rich --stop')
            }

            await m.react('wait')

            const rich = new sock.AIRich()
            rich.setTitle('Aethero Live Task Runner')
            rich.addText('✦ *PROCESAMIENTO PROGRESIVO*\n\n● Estado: =={En Ejecucion}==\n● Modo: Bucle continuo de actualizacion\n● Control: Usa .rich --stop para finalizar y eliminar.')
            rich.addProgressStatus('Iniciando secuencia de tareas (0%)...', {
                id: 'status_bar',
                isInProgress: true
            })
            rich.setFooter('Aethero Engine ╵ Meta AI Live Editor')

            const sent = await rich.send(chatId, {
                quoted: m.raw,
                bypassDownload: false
            })

            await m.react('done')

            const task = {
                running: true,
                key: sent.key
            }

            activeTasks.set(chatId, task)

            let stageIndex = 0

            ;(async () => {
                try {
                    while (task.running) {
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        if (!task.running) break

                        const currentStage = STAGES[stageIndex % STAGES.length]
                        stageIndex++

                        rich.addProgressStatus(currentStage, {
                            replace: 'status_bar',
                            isInProgress: true
                        })

                        await rich.sendEdit(chatId, sent.key.id).catch(() => {})
                    }
                } finally {
                    activeTasks.delete(chatId)
                }
            })()

            return
        }

        const helpText = [
            '✦ *CONTROL DE TAREAS LIVE META AI*',
            '',
            '● .rich --send  ╵ Inicia la tarea progresiva en bucle',
            '● .rich --stop  ╵ Detiene la tarea y borra el mensaje',
            '',
            '_Aethero Framework Task Engine_'
        ].join('\n')

        return m.reply(helpText)
    }
}