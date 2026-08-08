// ./index.js
await import('./config.js')

import path from 'path'
import { CoreI } from './core/index.js'

const bot = new CoreI(null, {
    STORAGE: path.resolve('./storage'),
    CONFIG: path.resolve('./config.js'),
    MODULEREGISTRY: [
        {
            folder: path.resolve('./plugins'),
            suffix: '.plugin.js',
            defaultContext: {
                usePrefix: true,
                stubtype: false,
                command: false
            }
        },
        {
            mainLogic: true,
            folder: path.resolve('./handlers'),
            suffix: '.handler.js',
            defaultContext: {
                enabled: true
            }
        },
        {
            folder: path.resolve('./scrapers'),
            suffix: '.scraper.js',
            defaultContext: {
                enable: true
            }
        }
    ]
})

await bot.start()