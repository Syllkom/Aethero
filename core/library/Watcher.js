import path from "path";
import { pathToFileURL } from 'url';
import { isDeepStrictEqual } from 'util';
import { watch } from 'chokidar';

import { pathStore } from "./pathStore.js";

export class StoreColl {
    constructor(folders) {
        this.mapFolders = new Map();
        folders.forEach(f => this.mapFolders.set(path
            .resolve(f), new pathStore()));
    }

    getStore(identifier) {
        if (path.isAbsolute(identifier)) return this
            .mapFolders.get(path.resolve(identifier));
        return Array.from(this.mapFolders.entries())
            .find(([p]) => path.basename(p)
                === identifier)?.[1];
    }

    findStore(filePath) {
        const array = Array.from(this.mapFolders)
        const entry = array.find(([f]) => filePath.startsWith(f));
        if (!entry) return undefined;
        const relative = path.relative(entry[0], filePath)
        return { store: entry[1], relative: relative };
    }

    getFile(filePath) {
        const info = this.findStore(filePath);
        return info?.store.get(info.relative);
    }

    setFile(filePath) {
        const info = this.findStore(filePath);
        return info ? info.store.set(info
            .relative) : undefined;
    }

    deleteFile(filePath) {
        const info = this.findStore(filePath);
        return info ? info.store.delete(info
            .relative) : undefined;
    }

    get folders() {
        return Array.from(this.mapFolders, ([p, s]) => ({
            name: path.basename(p), path: p, store: s
        }));
    }
}

export class Watcher {
    constructor(foldersPath, eventHandler, watchOptions) {

        this.foldersPath = (Array.isArray(foldersPath)
            ? foldersPath : [foldersPath]).map(o => path.resolve(o))
        this.storeManag = new StoreColl(this.foldersPath)
        this.eventHandler = eventHandler || {};

        this.watch = watch(this.foldersPath, {
            persistent: true, depth: 99, awaitWriteFinish: true,
            ignoreInitial: false, ...(watchOptions || {})
        });
    }

    stop() { return this.watch.close(); }

    start() {
        return new Promise((resolve, reject) => {
            this.events(resolve, reject)
        });
    }

    events(resolve, reject) {
        this.watch.on('add', async (filePath) => {
            const info = this.storeManag.findStore(filePath);
            if (!info) return undefined;
            this.storeManag.setFile(filePath);
            if (this.eventHandler?.add) await this.eventHandler
                .add(filePath, info.relative, info.store);

        });

        this.watch.on('change', async (filePath) => {
            const info = this.storeManag.findStore(filePath);
            if (info && this.eventHandler?.change) await this.eventHandler
                .change(filePath, info.relative, info.store);
        });

        this.watch.on('unlink', async (filePath) => {
            const info = this.storeManag.findStore(filePath);
            if (!info) return undefined;
            this.storeManag.deleteFile(filePath);
            if (this.eventHandler?.unlink) await this.eventHandler
                .unlink(filePath, info.relative, info.store);
        });

        this.watch.on('error', (e) => {
            console.error("\x1b[31m[x] FolderWatchJS:\x1b[0m", e);
            reject(e);
        }).on('ready', () => {
            resolve();
        });
    }
}
