import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

async function getFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFiles(res) : res
    }))
    return Array.prototype.concat(...files).filter(file => file.endsWith('.js'))
}

export async function inspectPlugins(dirPath, options = {}) {
    const opts = { includeNonPrefixed: false, ...options }
    const result = { items: [] }

    const entries = await getFiles(dirPath).catch(() => [])

    for (const filePath of entries) {
        try {
            const url = pathToFileURL(filePath)
            const mod = await import(`${url.href}?update=${Date.now()}`)
            const exp = mod?.default || mod

            if (!exp.command) continue

            const meta = {
                fileName: path.relative(dirPath, filePath),
                usePrefix: !!exp.usePrefix,
                case: Array.isArray(exp.case) ? exp.case : [exp.case],
                description: exp.description || 'Sin descripción',
                list: Array.isArray(exp.list) ? exp.list : [],
                legacyCategory: Array.isArray(exp.category) ? exp.category : (exp.category ? [exp.category] : []),
                legacyUsage: Array.isArray(exp.usage) ? exp.usage : (exp.usage ? [exp.usage] : [])
            }

            if (opts.includeNonPrefixed || meta.usePrefix) {
                result.items.push(meta)
            }
        } catch (e) {
            console.error(`Error loading plugin ${filePath}:`, e.message)
            continue
        }
    }
    return result
}

export function listCategoryUsage(plugins, { category, withPrefix = true } = {}) {
    const rows = []
    const prefix = withPrefix ? (global.config.prefixes?.[0] || '.') : ''

    for (const p of plugins) {
        if (p.list.length > 0) {
            const entries = p.list.filter(item => item.category === category || item.cat === category)

            for (const entry of entries) {
                const txt = entry.usage || entry.text || entry.cmd
                rows.push(`╵${prefix}${txt}`)
            }
        } else if (p.legacyCategory.includes(category)) {
            for (const u of p.legacyUsage) {
                rows.push(`╵${prefix}${u}`)
            }
        }
    }

    return rows.join('\n')
}

export function countTotalCommands(plugins) {
    return plugins.reduce((acc, p) => {
        if (p.list.length > 0) return acc + p.list.length
        return acc + (p.legacyUsage.length || 1)
    }, 0)
}

export default { inspectPlugins, listCategoryUsage, countTotalCommands }