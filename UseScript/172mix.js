const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.172mix.com';

module.exports = {
    platform: '172Mix舞曲',
    version: '1.0.0',
    author: 'Rotion',
    srcUrl: BASE_URL,
    supportedSearchType: ['music'],

    async search(query, page, type) {
        try {
            const res = await axios.get(BASE_URL + '/searches', {
                headers: { 'User-Agent': UA },
                params: { query: query },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            $('.track-item').each((i, el) => {
                const titleEl = $(el).find('.track-name__text');
                const title = titleEl.text().trim();
                const href = $(el).find('a').attr('href');

                if (title && href) {
                    const idMatch = href.match(/\/(\d+)/);
                    if (idMatch) {
                        let cleanTitle = title;
                        
                        // 去掉前缀如 【172Mix独家】、【Dj某某提供】
                        cleanTitle = cleanTitle.replace(/^【[^】]+】\s*/, '');
                        cleanTitle = cleanTitle.replace(/^【[^】]+/, '');
                        
                        const titleParts = cleanTitle.split(' - ');
                        const artist = titleParts.length > 1 ? titleParts[0] : '172Mix';
                        const songTitle = titleParts.length > 1 ? titleParts[1] : cleanTitle;

                        songs.push({
                            id: idMatch[1],
                            title: songTitle,
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'https://www.172mix.com/assets/images/cover.png'
                        });
                    }
                }
            });

            return { isEnd: songs.length < 30, data: songs };
        } catch (e) {
            console.error('search error:', e.message);
            return { isEnd: true, data: [] };
        }
    },

    async getMediaSource(musicItem, quality) {
        try {
            const songId = typeof musicItem.id === 'string' ? musicItem.id.replace(/^172mix_/, '') : musicItem.id;
            const detailUrl = BASE_URL + '/play/' + songId;

            const res = await axios.get(detailUrl, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;

            const urlMatch = html.match(/https?:\/\/mp3\.172mix\.com\/mp3\/[^'"\s]+/);
            if (!urlMatch) {
                throw new Error('No audio URL found');
            }

            const audioUrl = urlMatch[0];

            // 验证音频链接
            try {
                const headRes = await axios.head(audioUrl, {
                    headers: { 'User-Agent': UA },
                    timeout: 10000
                });

                return {
                    url: audioUrl,
                    quality: '320',
                    type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                    size: headRes.headers['content-length'] || '',
                    headers: { 'Referer': detailUrl }
                };
            } catch (e) {
                // HEAD 失败，直接返回链接
                return {
                    url: audioUrl,
                    quality: '320',
                    type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                    size: '',
                    headers: { 'Referer': detailUrl }
                };
            }

        } catch (e) {
            console.error('getMediaSource error:', e.message);
            return null;
        }
    },

    async getLyric(musicItem) {
        return null;
    },

    async getTopLists() {
        try {
            const res = await axios.get(BASE_URL + '/', {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const items = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.match(/\/genre\/([^/]+)/) && text && text.length > 1 && text.length < 30) {
                    const idMatch = href.match(/\/genre\/([^/]+)/);
                    if (idMatch && !items.find(l => l.id === idMatch[1])) {
                        items.push({
                            id: idMatch[1],
                            title: text,
                            description: ''
                        });
                    }
                }
            });

            items.push({
                id: 'ranks_sole',
                title: '独家舞曲榜',
                description: ''
            });

            return [{
                title: '舞曲分类',
                data: items
            }];
        } catch (e) {
            console.error('getTopLists error:', e.message);
            return [];
        }
    },

    async getTopListDetail(topListItem, page) {
        try {
            const listId = typeof topListItem.id === 'string' ? topListItem.id : String(topListItem.id);
            const pageNum = page || 1;

            let url;
            if (listId === 'ranks_sole') {
                url = BASE_URL + '/ranks/sole';
            } else {
                url = BASE_URL + '/genre/' + listId + '/0-' + pageNum;
            }

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            $('.track-item').each((i, el) => {
                const titleEl = $(el).find('.track-name__text');
                const title = titleEl.text().trim();
                const href = $(el).find('a').attr('href');

                if (title && href) {
                    const idMatch = href.match(/\/(\d+)/);
                    if (idMatch) {
                        let cleanTitle = title;
                        
                        // 去掉前缀如 【172Mix独家】、【Dj某某提供】
                        cleanTitle = cleanTitle.replace(/^【[^】]+】\s*/, '');
                        cleanTitle = cleanTitle.replace(/^【[^】]+/, '');
                        
                        const titleParts = cleanTitle.split(' - ');
                        const artist = titleParts.length > 1 ? titleParts[0] : '172Mix';
                        const songTitle = titleParts.length > 1 ? titleParts[1] : cleanTitle;

                        songs.push({
                            id: idMatch[1],
                            title: songTitle,
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'https://www.172mix.com/assets/images/cover.png'
                        });
                    }
                }
            });

            return {
                ...topListItem,
                musicList: songs
            };
        } catch (e) {
            console.error('getTopListDetail error:', e.message);
            return { ...topListItem, musicList: [] };
        }
    }
};