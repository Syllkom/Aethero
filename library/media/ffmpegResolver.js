// ./library/media/ffmpegResolver.js
import { execSync } from 'child_process'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
let cachedFFmpegPath = null

const KNOWN_PATHS = [
    '/data/data/com.termux/files/usr/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/bin/ffmpeg',
    path.resolve('./storage/bin/ffmpeg'),
    path.resolve('./storage/temp/ffmpeg')
]

export function getFFmpegPath() {
    if (cachedFFmpegPath) return cachedFFmpegPath

    for (const p of KNOWN_PATHS) {
        if (fs.existsSync(p)) {
            try {
                fs.accessSync(p, fs.constants.X_OK)
                cachedFFmpegPath = p
                return cachedFFmpegPath
            } catch {}
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

    const isAndroid = process.platform === 'android' || !!process.env.PREFIX?.includes('com.termux')

    if (!isAndroid) {
        try {
            const staticPath = require('ffmpeg-static')
            if (typeof staticPath === 'string' && fs.existsSync(staticPath)) {
                cachedFFmpegPath = staticPath
                return cachedFFmpegPath
            }
        } catch {}
    }

    cachedFFmpegPath = 'ffmpeg'
    return cachedFFmpegPath
}

export default getFFmpegPath