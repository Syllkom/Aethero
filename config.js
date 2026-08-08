// ./config.js
process.env.HOME = process.cwd()

import path from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'
dotenv.config()

import base from './core/library/hyperDBAdapter.js'
global.db = base

global.googleApiKey = process.env.GOOGLE_API_KEY || ''

global.readMore = String
    .fromCharCode(8206)
    .repeat(850)

global.font = {
    NunitoSans: { Bold: 'https://tinyurl.com/NunitoSans-Bold' },
    NotoSans: { Bold: 'https://tinyurl.com/NotoSans-Bold' },
    Anton: { Regular: 'https://tinyurl.com/Anton-Regular' },
    MonoSpace: { Regular: 'https://tinyurl.com/SpaceMono' },
    Montserrat: { Italic: 'https://tinyurl.com/Montserrat-LightItalic' },
    Raleway: { ExtraBold: 'https://tinyurl.com/Raleway-ExtraBold' }
}

global.config = {
    name: "Aethero",
    prefixes: ".¿?¡!#%&/,~@",
    saveHistory: true,
    autoRead: false,
    silentConsole: true,
    startupNotification: false
}

global.config.userRoles = {
    "447342719758": {
        root: true,
        owner: true,
        mod: true,
        vip: true
    }
}

global.REACT_EMOJIS = {
    wait: "⌛",
    done: "✔️",
    error: "✖️"
}

global.MSG = {
    root: 'Este comando solo puede ser utilizado por el *dueño*',
    owner: 'Este comando solo puede ser utilizado por un *propietario*',
    mod: 'Este comando solo puede ser utilizado por un *moderador*',
    vip: 'Esta solicitud es solo para usuarios *premium*',
    group: 'Este comando solo se puede usar en *grupos*',
    private: 'Este comando solo se puede usar por *chat privado*',
    admin: 'Este comando solo puede ser usado por los *administradores del grupo*',
    botAdmin: 'El bot necesita *ser administrador* para usar este comando',
    unreg: 'Regístrese para usar esta función escribiendo:\n\n.registrar nombre.edad',
    restrict: 'Esta función está desactivada'
}

global.PLUGINS_MSG = {
    newPlugin: `${chalk.bgRgb(119, 205, 255).rgb(0, 0, 0)('Nuevo plugin:')} `,
    updatedPlugin: `${chalk.bgRgb(239, 250, 142).rgb(0, 0, 0)('Recargando plugin:')} `,
    deletedPlugin: `${chalk.bgRgb(241, 114, 114).rgb(0, 0, 0)('Plugin eliminado:')} `
}

global.SCRAPERS_MSG = {
    newScraper: `${chalk.bgRgb(255, 165, 0).rgb(0, 0, 0)('Nuevo scraper:')} `,
    updatedScraper: `${chalk.bgRgb(255, 215, 0).rgb(0, 0, 0)('Recargando scraper:')} `,
    deletedScraper: `${chalk.bgRgb(220, 20, 60).rgb(0, 0, 0)('Scraper eliminado:')} `
}

global.$dir_main = {
    plugins: path.resolve('./plugins'),
    handlers: path.resolve('./handlers'),
    creds: path.resolve('./storage/creds'),
    store: path.resolve('./storage/store'),
    temp: path.resolve('./storage/temp'),
}