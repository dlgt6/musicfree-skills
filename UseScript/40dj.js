const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.40dj.com';

const categories = [
    { id: '8', title: '现场劲爆', description: '' },
    { id: '4', title: '弹跳劲爆', description: '' },
    { id: '17', title: '酒吧弹跳', description: '' },
    { id: '23', title: '车载劲爆', description: '' },
    { id: '24', title: 'M C 现场', description: '' },
    { id: '12', title: '中文/Funky/House', description: '' },
    { id: '10', title: '中文/Electro/House', description: '' },
    { id: '11', title: '中文/柔和/超柔', description: '' },
    { id: '19', title: '中文/House/Prog', description: '' },
    { id: '25', title: '流行金曲', description: '' },
    { id: '26', title: '发烧精选', description: '' },
    { id: '20', title: '车载电子鼓', description: '' },
    { id: '21', title: '抖音热门榜', description: '' },
    { id: '22', title: '快手热门榜', description: '' },
    { id: '13', title: 'Electro/House', description: '' },
    { id: '14', title: 'FunkyHouse/Prog', description: '' },
    { id: '15', title: 'Trap/HipHop/Rnb', description: '' },
    { id: '16', title: 'Hardstyle/Techno/Vina', description: '' },
    { id: '43', title: 'Hard/Big/Trance', description: '' },
    { id: '44', title: 'Dubstep/Bounce/Deep', description: '' },
    { id: '45', title: 'Bass/FUTURE', description: '' },
    { id: '46', title: '另类/私单/改版', description: '' },
    { id: '27', title: '周二', description: '' },
    { id: '28', title: '周三', description: '' },
    { id: '29', title: '跳四', description: '' },
    { id: '30', title: '中四', description: '' },
    { id: '31', title: '快四', description: '' },
    { id: '32', title: '贴面', description: '' },
    { id: '33', title: '伦巴', description: '' },
    { id: '34', title: '恰恰', description: '' }
];

function parseSongItem(item) {
    const title = item.titleText || '';
    const titleParts = title.split(' - ');
    let artist = '40DJ';
    let songTitle = title;

    if (titleParts.length >= 2) {
        const firstPart = titleParts[0].trim();
        if (firstPart.length < 20 && (firstPart.includes('DJ') || firstPart.includes('Dj') || firstPart.includes('dj'))) {
            artist = firstPart;
            songTitle = titleParts.slice(1).join(' - ').trim();
        }
    }

    songTitle = songTitle.replace(/\.(mp3|m4a|wma)$/i, '').trim();

    return {
        id: item.id,
        title: songTitle,
        artist: artist,
        album: '',
        duration: item.duration || '',
        artwork: item.artwork || 'https://www.40dj.com/static/images/ico.png'
    };
}

module.exports = {
    platform: '40DJ',
    version: '0.0.1',
    author: 'Rotion',
    srcUrl: BASE_URL,
    supportedSearchType: ['music'],

    async search(query, page, type) {
        try {
            if (type !== 'music') {
                return { isEnd: true, data: [] };
            }

            const pageNum = page || 1;
            const url = `${BASE_URL}/music/search?key=${encodeURIComponent(query)}`;

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            const seenIds = new Set();

            $('.single-item').each((i, el) => {
                const cover = $(el).find('.single-item__cover');
                const title = $(el).find('.single-item__title h4 a');
                const time = $(el).find('.single-item__time').first();

                const songId = cover.attr('data-url');
                const artwork = cover.attr('data-img');
                const titleText = title.text().trim();
                const duration = time.text().trim();

                if (songId && !seenIds.has(songId) && titleText.length > 3) {
                    seenIds.add(songId);
                    songs.push({
                        id: songId,
                        titleText: titleText,
                        artwork: artwork,
                        duration: duration
                    });
                }
            });

            return {
                isEnd: songs.length < 20,
                data: songs.map(parseSongItem)
            };
        } catch (e) {
            console.error('search error:', e.message);
            return { isEnd: true, data: [] };
        }
    },

    async getMediaSource(musicItem, quality) {
        try {
            const songId = typeof musicItem.id === 'string' ? musicItem.id : String(musicItem.id);
            const detailUrl = `${BASE_URL}/music/info-${songId}`;

            const res = await axios.get(`${BASE_URL}/dance/play/json`, {
                headers: {
                    'User-Agent': UA,
                    'Referer': detailUrl
                },
                params: { id: songId },
                timeout: 15000
            });

            const data = res.data;
            if (data && data.code === 1 && data.url) {
                const audioUrl = data.url;

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
                        type: /\.m4a/i.test(audioUrl) ? 'm4a' : /\.mp3/i.test(audioUrl) ? 'mp3' : 'mp4',
                        size: headRes.headers['content-length'] || '',
                        headers: { 'Referer': detailUrl }
                    };
                } catch (e) {
                    return {
                        url: audioUrl,
                        quality: '320',
                        type: /\.m4a/i.test(audioUrl) ? 'm4a' : /\.mp3/i.test(audioUrl) ? 'mp3' : 'mp4',
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

            const url = `${BASE_URL}/music/list-id-${listId}-${pageNum}`;

            const res = await axios.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const songs = [];
            const seenIds = new Set();

            $('.single-item').each((i, el) => {
                const cover = $(el).find('.single-item__cover');
                const title = $(el).find('.single-item__title h4 a');
                const time = $(el).find('.single-item__time').first();

                const songId = cover.attr('data-url');
                const artwork = cover.attr('data-img');
                const titleText = title.text().trim();
                const duration = time.text().trim();

                if (songId && !seenIds.has(songId) && titleText.length > 3) {
                    seenIds.add(songId);
                    songs.push({
                        id: songId,
                        titleText: titleText,
                        artwork: artwork,
                        duration: duration
                    });
                }
            });

            return {
                isEnd: songs.length < 20,
                musicList: songs.map(parseSongItem),
                topListItem: topListItem
            };
        } catch (e) {
            console.error('getTopListDetail error:', e.message);
            return { isEnd: true, musicList: [], topListItem: topListItem };
        }
    }
};