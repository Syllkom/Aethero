export class PathTree {
    constructor() {
        this.map = new Map();
    }

    mapS(path, key) {
        if (!this.map.has(path)) {
            this.map.set(path, new Set());
        } else this.map.get(path).add(key);
    }

    mapD(path, key) {
        const set = this.map.get(path);
        if (!set) return false
        set.delete(key);
        if (set.size === 0) {
            this.map.delete(path);
        }
    }

    pathSteps(array) {
        const result = [];
        for (let i = 0; i < array.length; i++) {
            const a0 = array.slice(0, i + 1).join('/');
            const a1 = (i + 1 < array.length) ? array[i + 1] : 0;
            result.push([a0, a1]);
        } return result;
    }

    create(array) {
        if (!array || array.length === 0) return;
        const steps = this.pathSteps(array);
        for (let [path, key] of steps) {
            if (key !== 0) this.mapS(path, key);
            else this.map.set(path, 1);
        } return true
    }

    delete(array) {
        if (!array || array.length === 0) return;
        const steps = this.pathSteps(array);
        const fullPath = steps[steps.length - 1][0], toDelete = [];
        for (const key of this.map.keys()) if (key === fullPath
            || key.startsWith(fullPath + '/')) toDelete.push(key);
        for (const key of toDelete) this.map.delete(key);
        for (let i = steps.length - 2; i >= 0; i--) {
            const [path, key] = steps[i];
            if (key === 0) continue
            if (!this.map.has(path)) continue;
            this.mapD(path, key);
        } return true;
    }

    inspect() {
        const result = {};
        for (const [path, value] of this.map) {
            result[path] = value instanceof Set
                ? Array.from(value) : value;
        } return result;
    }
}


export class pathStore {
    constructor() {
        this.pathReg = new PathTree()
    }

    get size() { return this.pathReg.map.size }
    keys() { return Array.from(this.pathReg.map.keys()) }
    entries() { return Array.from(this.pathReg.map.entries()); }
    values() { return Array.from(this.pathReg.map.values()); }
    clear() { return this.pathReg.map.clear() }

    splitPath(path) {
        const array = path.split(
            /[/\\]+/).filter(Boolean);
        return array;
    }

    has(path) {
        if (typeof path !== 'string') return false;
        const parts = this.splitPath(path);
        if (!parts.length) return false;
        const fullPath = parts.join('/');
        return this.pathReg.map.has(fullPath);
    }

    set(path) {
        if (typeof path !== 'string') return;
        const parts = this.splitPath(path);
        if (!parts?.length) return undefined;
        return this.pathReg.create(parts)
    }

    get(path) {
        if (typeof path !== 'string') return;
        const parts = this.splitPath(path);
        if (!parts.length) return undefined;
        const fullPath = parts.join('/');
        const entry = this.pathReg.map.get(fullPath);
        if (entry === undefined) return undefined;
        if (entry instanceof Set) {
            return Array.from(entry);
        } else return entry;
    }

    delete(path) {
        if (typeof path !== 'string') return;
        const parts = this.splitPath(path);
        if (!parts?.length) return undefined;
        return this.pathReg.delete(parts)
    }

    isLeaf(path) {
        if (typeof path !== 'string') return false;
        const parts = this.splitPath(path);
        if (!parts.length) return false;
        const fullPath = parts.join('/');
        const entry = this.pathReg.map.get(fullPath);
        return entry !== undefined
            && !(entry instanceof Set);
    }

    forEach(callback) {
        if (typeof callback !== 'function') return;
        for (const [path, value] of this.pathReg.map) {
            callback(value, path, this.pathReg.map);
        }
    }

    toObject() {
        const result = {};
        for (const [path, value] of this.pathReg.map) {
            result[path] = value instanceof Set
                ? Array.from(value) : value;
        }; return result;
    }
}
