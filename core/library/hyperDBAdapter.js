// ./core/library/hyperDBAdapter.js
import { HyperDB } from '@syllkom/hyper-db'
import { AsyncLocalStorage } from 'async_hooks'
import path from 'path'
import fs from 'fs'

export const dbStorage = new AsyncLocalStorage()

export function createDbInstance(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true })
    }

    const db = new HyperDB({
        folder: folderPath,
        memory: 64,
        depth: 2,
        maps: { threshold: 20, debounce: 1000 },
        nodes: { threshold: 10, debounce: 500 }
    })

    db.start = async () => {
        console.log(`ϟ HyperDB (Store) Started -> Folder:[${folderPath}]`)
        return db
    }

    db.open = async (shardPath) => {
        if (!db.data[shardPath]) {
            db.data[shardPath] = {}
        }
        return db.data[shardPath]
    }

    return db
}

const sessionName = process.env.SESSION_NAME || 'main'
const mainDbFolder = sessionName === 'main'
    ? path.resolve('./storage/store')
    : path.resolve(`./storage/subs/${sessionName}/store`)

const mainDb = createDbInstance(mainDbFolder)

const dbProxy = new Proxy(mainDb, {
    get(target, prop) {
        const scopedDb = dbStorage.getStore() || target
        const value = Reflect.get(scopedDb, prop)
        
        if (typeof value === 'function') {
            return value.bind(scopedDb)
        }
        return value
    }
})

export default dbProxy