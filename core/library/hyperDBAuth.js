// ./core/library/hyperDBAuth.js
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

export const useHyperDBAuthState = async (sessionName = 'main') => {
    const baseFolder = sessionName === 'main'
        ? path.resolve('./storage/creds/main')
        : path.resolve(`./storage/subs/${sessionName}/creds`)

    if (!fs.existsSync(baseFolder)) fs.mkdirSync(baseFolder, { recursive: true })

    const sessionFile = path.join(baseFolder, 'session.json')

    let creds = initAuthCreds()
    let keys = {}

    if (fs.existsSync(sessionFile)) {
        try {
            const data = fs.readFileSync(sessionFile, 'utf-8')
            const parsed = JSON.parse(data, BufferJSON.reviver)
            if (parsed.creds) creds = parsed.creds
            if (parsed.keys) keys = parsed.keys
        } catch (e) {
            console.error('Error leyendo la sesión:', e)
        }
    }

    let isWriting = false
    let writeQueued = false

    const writeData = async () => {
        if (isWriting) {
            writeQueued = true
            return
        }
        isWriting = true
        writeQueued = false

        try {
            const tmpFile = sessionFile + '.tmp'
            const dataStr = JSON.stringify({ creds, keys }, BufferJSON.replacer)
            await fs.promises.writeFile(tmpFile, dataStr)
            await fs.promises.rename(tmpFile, sessionFile)
        } catch (e) {
            console.error('Error guardando credenciales:', e)
        } finally {
            isWriting = false
            if (writeQueued) writeData()
        }
    }

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {}
                    for (const id of ids) {
                        const key = `${type}-${id}`
                        if (keys[key]) {
                            data[id] = keys[key]
                        }
                    }
                    return data
                },
                set: (data) => {
                    let hasChanges = false
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id]
                            const key = `${category}-${id}`
                            if (value) {
                                keys[key] = value
                            } else {
                                delete keys[key]
                            }
                            hasChanges = true
                        }
                    }
                    if (hasChanges) writeData()
                }
            }
        },
        saveCreds: () => {
            writeData()
        }
    }
}