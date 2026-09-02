// ./library/media/ffmpegResolver.js
import { execSync } from 'child_process'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
let cachedFFmpegPath = null

const KNOWN_PATHS = [
    '/data/data/com.termux/files/usr/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg'
]

export function getFFmpegPath() {
    if (cachedFFmpegPath) return cachedFFmpegPath

    for (const p of KNOWN_PATHS) {
        if (fs.existsSync(p)) {
            cachedFFmpegPath = p
            return cachedFFmpegPath
        }
    }

    try {
        const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
        const systemPath = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split('\n')[0]
        if (systemPath && fs.existsSync(systemPath)) {
            cachedFFmpegPath = systemPath
            return cachedFFmpegPath
        }
    } catch {}

    try {
        const staticPath = require('ffmpeg-static')
        if (typeof staticPath === 'string' && fs.existsSync(staticPath)) {
            cachedFFmpegPath = staticPath
            return cachedFFmpegPath
        }
    } catch {}

    cachedFFmpegPath = 'ffmpeg'
    return cachedFFmpegPath
}

export default getFFmpegPath