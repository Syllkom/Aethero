// ./plugins/gacha/@core.plugin.js
const TAG_TTL = 7 * 24 * 60 * 60 * 1000

const ECON = {
    BASE_VAL: 1200, LIKE_MULT: 670, VOLATILITY: 0.15
}

const TIERS = {
    GOD: { min: 150000, bonus: 30000, label: 'GOD' },
    S:   { min: 50000,  bonus: 18000, label: 'S' },
    A:   { min: 15000,  bonus: 8000,  label: 'A' },
    B:   { min: 5000,   bonus: 3000,  label: 'B' },
    C:   { min: 0,      bonus: 500,   label: 'C' }
}

const RARITY = {
    LR: { min: 45000, name: 'Legendaria', emoji: '🜲' },
    UR: { min: 28000, name: 'Ultra Rara', emoji: '✦' },
    SR: { min: 15000, name: 'Super Rara', emoji: '᳝ꥇ★᮫ָֺ' },
    R:  { min: 6000,  name: 'Rara',       emoji: '♢' },
    C:  { min: 0,     name: 'Comun',      emoji: '◯' }
}

const getDanbooruScraper = () => {
    const scrapersFolder = global.scraper || global.scrapers
    if (!scrapersFolder) return null

    if (scrapersFolder.suffixFiles) {
        for (const [relPath, content] of scrapersFolder.suffixFiles) {
            if (relPath.toLowerCase().includes('danbooru')) {
                if (typeof content?.getRandomCharacter === 'function') return content
                if (content?.default && typeof content.default.getRandomCharacter === 'function') return content.default
            }
        }
    }
    return null
}

const getVolumeTier = (count) => {
    if (count >= TIERS.GOD.min) return TIERS.GOD
    if (count >= TIERS.S.min) return TIERS.S
    if (count >= TIERS.A.min) return TIERS.A
    if (count >= TIERS.B.min) return TIERS.B
    return TIERS.C
}

const resolveTagData = async (tagName) => {
    if (!tagName || tagName === 'original' || tagName === 'Original') {
        return { count: 999999, tier: TIERS.GOD }
    }

    const db = await global.db.open('@rpg')
    db.gacha ||= { global: {}, tags: {} }
    db.gacha.tags ||= {}

    const now = Date.now()
    const entry = db.gacha.tags[tagName]

    if (entry && (now - entry.updated < TAG_TTL)) {
        return { count: entry.count, tier: getVolumeTier(entry.count) }
    }

    let count = 0
    try {
        const danbooru = getDanbooruScraper()
        if (danbooru?.getTagInfo) {
            const info = await danbooru.getTagInfo(tagName)
            count = info ? info.count : 0
        }
    } catch {}

    db.gacha.tags[tagName] = { count, updated: now }
    return { count, tier: getVolumeTier(count) }
}

const calculateValue = (likes = 0, tierData, isOriginal) => {
    const tierBonus = isOriginal ? (tierData.bonus * 0.1) : tierData.bonus
    const likeValue = likes * ECON.LIKE_MULT
    let total = ECON.BASE_VAL + likeValue + tierBonus
    
    const noise = total * ECON.VOLATILITY
    const fluctuation = (Math.random() * noise * 2) - noise
    total = Math.floor(Math.max(ECON.BASE_VAL, total + fluctuation))

    let rarityKey = 'C'
    if (total >= RARITY.LR.min) rarityKey = 'LR'
    else if (total >= RARITY.UR.min) rarityKey = 'UR'
    else if (total >= RARITY.SR.min) rarityKey = 'SR'
    else if (total >= RARITY.R.min) rarityKey = 'R'

    return { value: total, rarity: rarityKey, meta: RARITY[rarityKey] }
}

export default {
    before: true,
    priority: 1,
    description: 'Core de utilidades Gacha (Rolls, Reclamos y Valores).',
    export: {
        '@gacha': {
            roll: async () => {
                try {
                    const danbooru = getDanbooruScraper()
                    if (!danbooru?.getRandomCharacter) {
                        console.error('[Gacha Error] No se encontró la función getRandomCharacter')
                        return null
                    }

                    const raw = await danbooru.getRandomCharacter('')
                    if (!raw) return null

                    const tagData = await resolveTagData(raw.copyrightTag)
                    const isOriginal = raw.copyrightTag === 'original'
                    const stats = calculateValue(raw.favs || 0, tagData.tier, isOriginal)

                    return {
                        id: raw.id, name: raw.name, source: raw.source,
                        rarity: stats.rarity, value: stats.value,
                        image: raw.imageUrl, favs: raw.favs || 0,
                        tierLabel: tagData.tier.label,
                        franchiseVol: tagData.count, isOriginal
                    }
                } catch (e) {
                    console.error('[Gacha Roll Error]', e)
                    return null
                }
            },

            meta: (r) => RARITY[r] || RARITY.C,

            getStatus: async (id) => {
                const db = await global.db.open('@rpg')
                db.gacha ||= { global: {}, tags: {} }
                db.gacha.global ||= {}

                const data = db.gacha.global[id]
                const owner = (typeof data === 'object') ? data.owner : data
                return { isClaimed: !!owner, owner: owner || null }
            },

            claim: async (userId, char) => {
                const db = await global.db.open('@rpg')
                db.gacha ||= { global: {}, tags: {} }
                if (db.gacha.global[char.id]) return false
                
                db.gacha.global[char.id] = {
                    owner: userId,
                    minted: Date.now(),
                    val: char.value,
                    name: char.name,
                    source: char.source
                }
                
                db.users ||= {}
                db.users[userId] ||= { inventory: [], money: 0 }

                db.users[userId].inventory ||= []
                db.users[userId].inventory.push({
                    id: char.id,
                    name: char.name,
                    source: char.source,
                    rarity: char.rarity,
                    value: char.value,
                    image: char.image,
                    date: Date.now()
                })
                
                return true
            },
            
            getById: async (id) => {
                try {
                    const danbooru = getDanbooruScraper()
                    if (!danbooru?.getPost) return null
                    const raw = await danbooru.getPost(id)
                    
                    if (raw) {
                        const tagData = await resolveTagData(raw.copyrightTag)
                        const isOriginal = raw.copyrightTag === 'original'
                        const stats = calculateValue(raw.favs || 0, tagData.tier, isOriginal)
                        
                        return {
                            id: raw.id, name: raw.name, source: raw.source,
                            rarity: stats.rarity, value: stats.value,
                            image: raw.imageUrl, favs: raw.favs || 0,
                            tierLabel: tagData.tier.label
                        }
                    }
                } catch {}
                return null
            }
        }
    },
    script: async () => {}
}