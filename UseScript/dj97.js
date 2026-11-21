const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.dj97.com';
const M_BASE_URL = 'https://m.dj97.com';
const AUDIO_CDN_URL = 'http://m.oscaches.com/mp4/djmusic';

const categories = [
    { id: '现场舞曲', title: '现场舞曲', description: '' },
    { id: '慢摇串烧', title: '慢摇串烧', description: '' },
    { id: '中文舞曲', title: '中文舞曲', description: '' },
    { id: '英文舞曲', title: '英文舞曲', description: '' }
];

module.exports = {
    platform: '水晶DJ',
    version: '0.0.1',
    author: 'Rotion',
    srcUrl: BASE_URL,
    supportedSearchType: ['music'],

    async search(query, page, type) {
        try {
            const pageNum = page || 1;
            const url = `${M_BASE_URL}/search?keyword=${encodeURIComponent(query)}&page=${pageNum}`;

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            $('a[href*="/m/"]').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.match(/\/m\/\d+/)) {
                    const idMatch = href.match(/\/m\/(\d+)/);
                    if (idMatch && text.length > 3) {
                        const titleParts = text.split(/[-_]/);
                        let artist = '水晶DJ';
                        let songTitle = text;

                        if (titleParts.length >= 2) {
                            const firstPart = titleParts[0].trim();
                            if (firstPart.length < 15 && (firstPart.includes('DJ') || firstPart.includes('Dj') || firstPart.includes('dj'))) {
                                artist = firstPart;
                                songTitle = titleParts.slice(1).join('-').trim();
                            }
                        }

                        songs.push({
                            id: idMatch[1],
                            title: songTitle.replace(/\.mp3|\.m4a$/i, ''),
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'https://aka.doubaocdn.com/s/EQBr1wfWQz'
                        });
                    }
                }
            });

            return { isEnd: songs.length < 20, data: songs };
        } catch (e) {
            console.error('search error:', e.message);
            return { isEnd: true, data: [] };
        }
    },

    async getMediaSource(musicItem, quality) {
        try {
            const songId = typeof musicItem.id === 'string' ? musicItem.id : String(musicItem.id);
            const detailUrl = `${M_BASE_URL}/m/${songId}`;

            const res = await axios.get(detailUrl, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            let audioUrl = '';
            let filePath = '';

            const currMatch = html.match(/var curr\s*=\s*\{([^}]+)\}/);
            if (currMatch) {
                const currContent = currMatch[1];
                const fileMatch = currContent.match(/file:\s*['"]([^'"]+)['"]/);
                if (fileMatch) {
                    filePath = fileMatch[1];
                }
            }

            if (!filePath) {
                const filePathMatch = html.match(/["']file["']\s*:\s*["']([^"']+)["']|filePath\s*=\s*["']([^"']+)["']/);
                if (filePathMatch) {
                    filePath = filePathMatch[1] || filePathMatch[2];
                }
            }

            if (filePath) {
                audioUrl = `${AUDIO_CDN_URL}/${filePath}.mp4`;

                try {
                    const headRes = await axios.head(audioUrl, {
                        headers: {
                            'User-Agent': UA,
                            'Referer': detailUrl
                        },
                        timeout: 10000
                    });

                    return {
                        url: audioUrl,
                        quality: '320',
                        type: 'mp4',
                        size: headRes.headers['content-length'] || '',
                        headers: { 'Referer': detailUrl }
                    };
                } catch (e) {
                    return {
                        url: audioUrl,
                        quality: '320',
                        type: 'mp4',
                        size: '',
                        headers: { 'Referer': detailUrl }
                    };
                }
            }

            const audioMatch = html.match(/audio\}?\s*\}\s*\)\s*;|play\s*\(\s*['"]([^'"]+)['"]/);
            if (audioMatch) {
                const urlPart = audioMatch[1] || audioMatch[2];
                if (urlPart) {
                    audioUrl = urlPart.startsWith('http') ? urlPart : `${AUDIO_CDN_URL}${urlPart}`;

                    return {
                        url: audioUrl,
                        quality: '320',
                        type: 'mp4',
                        size: '',
                        headers: { 'Referer': detailUrl }
                    };
                }
            }

            const srcMatch = html.match(/<audio[^>]*src\s*=\s*["']([^"']+)["']/);
            if (srcMatch) {
                return {
                    url: srcMatch[1],
                    quality: '320',
                    type: 'mp4',
                    size: '',
                    headers: { 'Referer': detailUrl }
                };
            }

            throw new Error('No audio URL found');

        } catch (e) {
            console.error('getMediaSource error:', e.message);
            return null;
        }
    },

    async getLyric(musicItem) {
        return null;
    },

    async getTopLists() {
        return [{
            title: '舞曲分类',
            data: categories
        }];
    },

    async getTopListDetail(topListItem, page) {
        try {
            const categoryId = topListItem.id;
            const pageNum = page || 1;

            let url;
            if (pageNum === 1) {
                url = `${M_BASE_URL}/`;
            } else {
                url = `${M_BASE_URL}/?page=${pageNum}`;
            }

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            const seenIds = new Set();

            $('a[href*="/m/"]').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.match(/\/m\/(\d+)/)) {
                    const idMatch = href.match(/\/m\/(\d+)/);
                    const id = idMatch[1];

                    if (seenIds.has(id)) return;
                    seenIds.add(id);

                    if (text && text.length > 3) {
                        const titleParts = text.split(/[-_]/);
                        let artist = '水晶DJ';
                        let songTitle = text;

                        if (titleParts.length >= 2) {
                            const firstPart = titleParts[0].trim();
                            if (firstPart.length < 15 && (firstPart.includes('DJ') || firstPart.includes('Dj') || firstPart.includes('dj'))) {
                                artist = firstPart;
                                songTitle = titleParts.slice(1).join('-').trim();
                            }
                        }

                        songs.push({
                            id: id,
                            title: songTitle.replace(/\.mp3|\.m4a$/i, ''),
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'https://aka.doubaocdn.com/s/EQBr1wfWQz'
                        });
                    }
                }
            });

            return { isEnd: pageNum >= 3, data: songs };

        } catch (e) {
            console.error('getTopListDetail error:', e.message);
            return { isEnd: true, data: [] };
        }
    }
};
