// ./core/library/garbageCollector.js
import path from 'path'
import fs from 'fs/promises'

const tempFolder = path.resolve('./storage/temp')

setInterval(async () => {
    try {
        const files = await fs.readdir(tempFolder).catch(() => [])
        if (!files.length) return

        for (const file of files) {
            try {
                await fs.unlink(path.join(tempFolder, file))
            } catch (e) {}
        }
    } catch (e) {}
}, 1000 * 60)