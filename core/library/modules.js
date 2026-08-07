import { isDeepStrictEqual } from 'util'
import { Watcher } from "./watcher.js"
import { pathToFileURL } from 'url'
import path from "path"

const FileImport = async function (filePath) {
    try {
        const fileURL = (pathToFileURL(filePath)).href
        const versionedURL = `${fileURL}?update=${Date.now()}`
        return await import(versionedURL)
    } catch (e) {
        if (e.code === 'ERR_UNSUPPORTED_DIR_IMPORT') return
        console.error(`Error (${filePath}):`, e)
        return null
    }
}

export class ModuleFolder {
    constructor(FolderWatcher,
        folder, suffix, defaultContext) {

        this.filesJS = new Map()
        this.folder = path.resolve(folder)
        this.store = FolderWatcher.storeManag
            .getStore(this.folder)

        this.moduleExport = {}
        this.exports = new Map()
        this.exportFiles = new Map()
        this.moduleExport.setFile = (filePath, module) => {
            if (!module || !module.export) return
            const exportsKeys = Object.keys(module.export)
            for (const key of exportsKeys) this.exports
                .set(key, module.export[key])
            this.exportFiles.set(filePath, exportsKeys)
            return true
        }

        this.moduleExport.delFile = (filePath) => {
            if (!this.exportFiles.has(filePath)) return
            const exportsKeys = this.exportFiles.get(filePath)
            for (const key of exportsKeys) this.exports.delete(key);
            this.exportFiles.delete(filePath)
            return true
        }

        this.suffix = suffix
        this.moduleSuffix = {}
        this.suffixFiles = new Map()
        this.defaultContext = defaultContext
        this.moduleSuffix.setFile = (filePath, module) => {
            for (const key of Object.keys(this.defaultContext))
                module[key] ??= this.defaultContext[key]
            module.fileName = path.basename(filePath)
            this.suffixFiles.set(filePath, module)
            return true
        }

        this.moduleSuffix.delFile = (filePath) => {
            this.suffixFiles.delete(filePath)
            return true
        }
    }

    file(path) {
        const file = this.suffixFiles.get(path)
        if (!file) return this.filesJS.get(path)
        else return file
    }

    folder(path) {
        const dir = this.store.get(path)
        if (Array.isArray(dir)) return dir
        else return undefined
    }

    import(query) {
        if (typeof query === 'string') {
            return this.exports.get(query)
        } else if (query?.file) return this
            .file(query.file)
        return null
    }

    export(key, value) {
        if (!this.exports.has(key))
            this.exports.set(key, value)
        else Object.assign(this
            .exports.get(key), value)
        return this.exports.get(key)
    }

    query(criteria) {
        if (Array.isArray(criteria)
            || typeof criteria !== 'object'
            || criteria === null) return []

        const result = []
        for (const [relPath, plugin] of this.suffixFiles) {
            if (!plugin || typeof plugin !== 'object') continue
            if (!relPath.endsWith(this.suffix)) continue
            const Entries = Object.entries(criteria)
            const matches = Entries.every(([key, expected]) => {
                const actual = plugin[key] !== undefined
                    ? plugin[key] : plugin.export?.[key]
                if (actual === undefined) return false
                return this.matchValue(expected, actual)
            }); if (matches) result.push(plugin)
        }

        return result
    }

    matchValue(a0, a1) {
        if (a0 === a1) return true
        if (a0 instanceof RegExp) return (
            typeof a1 === 'string' && a0.test(a1))
        if (Array.isArray(a0) && Array.isArray(a1))
            return a0.some(v => a1.includes(v))
        if (typeof a0 === 'string' && Array.isArray(a1))
            return a1.includes(a0)
        if (Array.isArray(a0) && typeof a1 === 'string')
            return a0.includes(a1)
        return isDeepStrictEqual(a0, a1)
    }

    async ImportFile(filePath) {
        if (typeof filePath !== 'string') return
        if (!filePath.endsWith('.js')) return null

        const relativePath = path
            .relative(this.folder, filePath)
        if (!relativePath) return

        this.moduleExport.delFile(relativePath)
        this.moduleSuffix.delFile(relativePath)
        const file = await FileImport(filePath)
        if (!file) return

        if (filePath.endsWith(this.suffix)) {
            const content = file.default ?? { ...file }
            this.moduleSuffix.setFile(relativePath, content)
            this.moduleExport.setFile(relativePath, content)
            return content
        } else {
            this.filesJS.set(relativePath, file)
            return file
        }
    }

    removeFile(filePath) {
        if (typeof filePath !== 'string') return
        if (!filePath.endsWith('.js')) return null

        const relativePath = path
            .relative(this.folder, filePath)
        if (!relativePath) return

        this.moduleExport.delFile(relativePath)
        this.moduleSuffix.delFile(relativePath)
        this.filesJS.delete(relativePath)
    }
}

export class ModuleRegistry {
    /*folders = [{
        folder: './handlers',
        suffix: '.handler.js',
        defaultContext: {}
    }, {
        folder: './plugins',
        suffix: '.plugin.js',
        defaultContext: {
            usePrefix: true,
            stubtype: false,
            command: false,
        }
    }]*/
    constructor(folders) {
        if (!Array.isArray(folders))
            throw new Error('Folders must be an array')
        const Folders = folders.filter(a => a.folder)
        if (!Folders.length) throw new Error('No valid folders')
        this.foldersMap = new Map()

        this.FolderWatcher = new Watcher(
            Folders.map(o => o.folder))

        this.FolderWatcher.eventHandler.add = async (filePath) => {
            const array = Array.from(this.foldersMap.keys())
            const findFolder = array.find((o) => filePath.startsWith(o))
            const folder = this.foldersMap.get(findFolder)
            if (folder) return folder.ImportFile(filePath)
        }

        this.FolderWatcher.eventHandler.change = async (filePath) => {
            const array = Array.from(this.foldersMap.keys())
            const findFolder = array.find((o) => filePath.startsWith(o))
            const folder = this.foldersMap.get(findFolder)
            if (folder) return folder.ImportFile(filePath)
        }

        this.FolderWatcher.eventHandler.unlink = (filePath) => {
            const array = Array.from(this.foldersMap.keys())
            const findFolder = array.find((o) => filePath.startsWith(o))
            const folder = this.foldersMap.get(findFolder)
            if (folder) return folder.removeFile(filePath)
        }

        for (let o of folders) {
            let folder = path.resolve(o.folder)
            this.foldersMap.set(folder, new ModuleFolder(
                this.FolderWatcher, o.folder, o.suffix,
                o.defaultContext))
        }
    }


    getFolder(identifier) {
        if (path.isAbsolute(identifier)) return this
            .foldersMap.get(path.resolve(identifier))
        return Array.from(this.foldersMap.entries())
            .find(([p]) => path.basename(p)
                === identifier)?.[1]
    }

    get folders() {
        const result = {}
        for (const [key, value] of this.foldersMap) {
            result[path.basename(key)] = value
        }; return result
    }

    async start() {
       await this.FolderWatcher.start()
       return this
    }

    async stop() {
        await this.FolderWatcher.stop()
        return this
    }
}