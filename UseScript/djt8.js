const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'http://www.djt8.com';
const AUDIO_BASE_URL = 'http://play.seopeixunwang.com';

const categories = [
    { id: '1', title: '震撼下载', description: '' },
    { id: '2', title: '现场火爆', description: '' },
    { id: '3', title: '中文舞曲', description: '' },
    { id: '4', title: '酒吧中文', description: '' },
    { id: '5', title: '外文舞曲', description: '' },
    { id: '7', title: '免费舞曲', description: '' },
    { id: '8', title: '派对舞曲', description: '' }
];

module.exports = {
    platform: 'DJ天堂',
    version: '1.0.0',
    author: 'Rotion',
    srcUrl: BASE_URL,
    supportedSearchType: ['music'],

    async search(query, page, type) {
        try {
            const res = await axios.get(BASE_URL + '/index.php/dance/so/key', {
                headers: { 'User-Agent': UA },
                params: { key: query },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.includes('/dance/play/id/')) {
                    const idMatch = href.match(/id\/(\d+)/);
                    if (idMatch) {
                        let cleanTitle = text;
                        
                        // 去掉文件扩展名和多余后缀
                        cleanTitle = cleanTitle.replace(/\.(m4a|mp3|wma)$/i, '');
                        
                        const titleParts = cleanTitle.split(/[-_]/);
                        let artist = 'DJ天堂';
                        let songTitle = cleanTitle;
                        
                        if (titleParts.length >= 2) {
                            const firstPart = titleParts[0].trim();
                            if (firstPart.length < 10 && (firstPart.includes('DJ') || firstPart.includes('dj'))) {
                                artist = firstPart;
                                songTitle = titleParts.slice(1).join('-').trim();
                            }
                        }

                        songs.push({
                            id: idMatch[1],
                            title: songTitle,
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'http://www.djt8.com/res/2014/logo.jpg'
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
            const detailUrl = BASE_URL + '/index.php/dance/play/id/' + songId;

            const res = await axios.get(detailUrl, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;

            // 方式1: 从script中的music数组提取
            const musicMatch = html.match(/var music\s*=\s*\[([^\]]+)\]/);
            if (musicMatch) {
                const urlMatch = musicMatch[1].match(/"([^"]+)"/);
                if (urlMatch) {
                    const audioUrl = urlMatch[1];
                    
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
                            type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                            size: headRes.headers['content-length'] || '',
                            headers: { 'Referer': detailUrl }
                        };
                    } catch (e) {
                        return {
                            url: audioUrl,
                            quality: '320',
                            type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                            size: '',
                            headers: { 'Referer': detailUrl }
                        };
                    }
                }
            }

            // 方式2: 提取danceFilePath
            const filePathMatch = html.match(/danceFilePath\s*=\s*['"]([^'"]+)['"]/);
            if (filePathMatch) {
                const audioUrl = AUDIO_BASE_URL + '/' + filePathMatch[1];
                
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
                        type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                        size: headRes.headers['content-length'] || '',
                        headers: { 'Referer': detailUrl }
                    };
                } catch (e) {
                    return {
                        url: audioUrl,
                        quality: '320',
                        type: audioUrl.endsWith('.m4a') ? 'm4a' : audioUrl.endsWith('.mp3') ? 'mp3' : 'mp4',
                        size: '',
                        headers: { 'Referer': detailUrl }
                    };
                }
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
            const listId = typeof topListItem.id === 'string' ? topListItem.id : String(topListItem.id);
            const pageNum = page || 1;

            const url = BASE_URL + '/index.php/dance/lists/id/' + listId + '/' + pageNum;

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.includes('/dance/play/id/')) {
                    const idMatch = href.match(/id\/(\d+)/);
                    if (idMatch) {
                        let cleanTitle = text;
                        
                        // 去掉文件扩展名和多余后缀
                        cleanTitle = cleanTitle.replace(/\.(m4a|mp3|wma)$/i, '');
                        cleanTitle = cleanTitle.replace(/^Gl\s*DJ\s*闄跺瓙\s*鏀?\s*/, '');
                        
                        const titleParts = cleanTitle.split(/[-_]/);
                        let artist = 'DJ天堂';
                        let songTitle = cleanTitle;
                        
                        if (titleParts.length >= 2) {
                            const firstPart = titleParts[0].trim();
                            if (firstPart.length < 10 && (firstPart.includes('DJ') || firstPart.includes('dj') || firstPart.includes('Dj'))) {
                                artist = firstPart;
                                songTitle = titleParts.slice(1).join('-').trim();
                            }
                        }

                        songs.push({
                            id: idMatch[1],
                            title: songTitle,
                            artist: artist,
                            album: '',
                            duration: '',
                            artwork: 'http://www.djt8.com/res/2014/logo.jpg'
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