// ./core/library/hyperDBAdapter.js
import { HyperDB } from '@syllkom/hyper-db'
import path from 'path'
import fs from 'fs'

const sessionName = process.env.SESSION_NAME || 'main'

const dbFolder = sessionName === 'main'
    ? path.resolve('./storage/store')
    : path.resolve(`./storage/subs/${sessionName}/store`)

if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true })
}

const db = new HyperDB({
    folder: dbFolder,
    memory: 64,
    depth: 2,
    maps: { threshold: 20, debounce: 1000 },
    nodes: { threshold: 10, debounce: 500 }
})

db.start = async () => {
    console.log(`ϟ HyperDB (Store) Started -> Session:[${sessionName}]`)
    return db
}

db.open = async (shardPath) => {
    if (!db.data[shardPath]) {
        db.data[shardPath] = {}
    }
    return db.data[shardPath]
}

export default db