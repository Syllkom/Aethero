// ./core/library/hyperDBAuth.js
import { DatabaseSync } from 'node:sqlite'
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

export const useHyperDBAuthState = async (sessionName = 'main') => {
    const baseFolder = sessionName === 'main'
        ? path.resolve('./storage/creds/main')
        : path.resolve(`./storage/subs/${sessionName}/creds`)

    if (!fs.existsSync(baseFolder)) {
        fs.mkdirSync(baseFolder, { recursive: true })
    }

    const dbPath = path.join(baseFolder, 'session.sqlite')
    const legacySessionFile = path.join(baseFolder, 'session.json')

    const db = new DatabaseSync(dbPath)

    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = MEMORY;

        CREATE TABLE IF NOT EXISTS creds (
            id TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS keys (
            type TEXT NOT NULL,
            id TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (type, id)
        );
    `)

    const getCredsStmt = db.prepare("SELECT value FROM creds WHERE id = 'main'")
    const setCredsStmt = db.prepare("INSERT INTO creds (id, value) VALUES ('main', ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value")

    const getKeyStmt = db.prepare('SELECT value FROM keys WHERE type = ? AND id = ?')
    const setKeyStmt = db.prepare('INSERT INTO keys (type, id, value) VALUES (?, ?, ?) ON CONFLICT(type, id) DO UPDATE SET value = excluded.value')
    const delKeyStmt = db.prepare('DELETE FROM keys WHERE type = ? AND id = ?')

    let creds = null
    const existingCredsRow = getCredsStmt.get()

    if (existingCredsRow) {
        try {
            creds = JSON.parse(existingCredsRow.value, BufferJSON.reviver)
        } catch {}
    }

    if (!creds && fs.existsSync(legacySessionFile)) {
        try {
            const dataStr = fs.readFileSync(legacySessionFile, 'utf-8')
            const parsed = JSON.parse(dataStr, BufferJSON.reviver)

            if (parsed.creds) {
                creds = parsed.creds
                setCredsStmt.run(JSON.stringify(creds, BufferJSON.replacer))
            }

            if (parsed.keys && typeof parsed.keys === 'object') {
                db.exec('BEGIN TRANSACTION')
                for (const fullKey of Object.keys(parsed.keys)) {
                    const separatorIndex = fullKey.indexOf('-')
                    if (separatorIndex !== -1) {
                        const type = fullKey.slice(0, separatorIndex)
                        const id = fullKey.slice(separatorIndex + 1)
                        const val = parsed.keys[fullKey]
                        if (val) {
                            setKeyStmt.run(type, id, JSON.stringify(val, BufferJSON.replacer))
                        }
                    }
                }
                db.exec('COMMIT')
            }

            fs.renameSync(legacySessionFile, legacySessionFile + '.bak')
        } catch {}
    }

    if (!creds) {
        creds = initAuthCreds()
        setCredsStmt.run(JSON.stringify(creds, BufferJSON.replacer))
    }

    const saveCreds = () => {
        try {
            setCredsStmt.run(JSON.stringify(creds, BufferJSON.replacer))
        } catch {}
    }

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {}
                    for (const id of ids) {
                        try {
                            const row = getKeyStmt.get(type, String(id))
                            if (row && row.value) {
                                data[id] = JSON.parse(row.value, BufferJSON.reviver)
                            }
                        } catch {}
                    }
                    return data
                },
                set: (data) => {
                    db.exec('BEGIN TRANSACTION')
                    try {
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id]
                                if (value) {
                                    setKeyStmt.run(category, String(id), JSON.stringify(value, BufferJSON.replacer))
                                } else {
                                    delKeyStmt.run(category, String(id))
                                }
                            }
                        }
                        db.exec('COMMIT')
                    } catch {
                        db.exec('ROLLBACK')
                    }
                }
            }
        },
        saveCreds
    }
}