import axios from 'axios'

const BASE_URL = 'https://danbooru.donmai.us/posts.json'
const TAG_URL = 'https://danbooru.donmai.us/tags.json'

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; HorekuOs/2.0; +http://github.com/Syllkom)',
    'Content-Type': 'application/json'
}

const cleanStr = (str) => {
    if (!str) return 'Original'
    return str
        .replace(/_/g, ' ')
        .replace(/\(.*\)/g, '')
        .trim()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

const processPost = (post) => {
    if (!post || !post.id) return null
    if (post.is_banned || post.is_deleted) return null

    const imgUrl = post.large_file_url || post.file_url || post.preview_file_url 
    
    if (!imgUrl) return null

    const charTags = (post.tag_string_character || '').split(' ')
    const copyrightTags = (post.tag_string_copyright || '').split(' ')
    const artistTags = (post.tag_string_artist || '').split(' ')

    const name = charTags.length > 0 && charTags[0] !== '' ? cleanStr(charTags[0]) : 'Personaje Original'
    const rawCopyright = copyrightTags.length > 0 && copyrightTags[0] !== '' ? copyrightTags[0] : 'original'
    const source = rawCopyright !== 'original' ? cleanStr(rawCopyright) : 'Original'

    return {
        id: String(post.id),
        name: name,
        source: source,
        copyrightTag: rawCopyright,
        imageUrl: imgUrl,
        favs: post.fav_count || 0,
        score: post.score || 0,
        rating: post.rating,
        artist: cleanStr(artistTags[0] || 'Desconocido'),
        createdAt: post.created_at
    }
}

export async function getRandomCharacter(tags = '') {
    try {
        const randomPage = Math.floor(Math.random() * 1000) + 1

        const { data } = await axios.get(BASE_URL, {
            params: {
                tags: `1girl ${tags}`, 
                limit: 20,
                page: randomPage
            },
            headers: HEADERS,
            timeout: 15000 
        })

        if (!data || !Array.isArray(data) || data.length === 0) return null

        const validPosts = data.filter(post => 
            !post.is_banned && 
            !post.is_deleted && 
            (post.large_file_url || post.file_url || post.preview_file_url)
        )

        if (validPosts.length === 0) return null

        const winner = validPosts[Math.floor(Math.random() * validPosts.length)]

        return processPost(winner)

    } catch (e) {
        console.error('Danbooru Scraper Error:', e.message)
        return null
    }
}

export async function getPost(id) {
    try {
        const url = BASE_URL.replace('posts.json', `posts/${id}.json`)
        const { data } = await axios.get(url, { headers: HEADERS })
        return processPost(data)
    } catch (e) {
        return null
    }
}

export async function getTagInfo(tagName) {
    try {
        if (!tagName || tagName === 'original') return null

        const { data } = await axios.get(TAG_URL, {
            params: {
                'search[name]': tagName,
                limit: 1
            },
            headers: HEADERS
        })

        if (data && data.length > 0) {
            return {
                name: data[0].name,
                count: data[0].post_count,
                category: data[0].category 
            }
        }
        return null
    } catch (e) {
        return null
    }
}

export async function getRandomVideo(tags = '') {
    try {
        const randomPage = Math.floor(Math.random() * 50) + 1

        const searchTags = `video rating:explicit ${tags}`.trim()

        const { data } = await axios.get(BASE_URL, {
            params: {
                tags: searchTags,
                limit: 20,
                page: randomPage
            },
            headers: HEADERS,
            timeout: 15000 
        })

        if (!data || !Array.isArray(data) || data.length === 0) return null

        const validPosts = data.filter(post => 
            !post.is_banned && 
            !post.is_deleted && 
            (post.file_url || post.large_file_url) &&
            /\.(mp4|webm)$/i.test(post.file_url || post.large_file_url)
        )

        if (validPosts.length === 0) return null

        const winner = validPosts[Math.floor(Math.random() * validPosts.length)]

        return processPost(winner)

    } catch (e) {
        console.error('Danbooru Video Error:', e.message)
        return null
    }
}
