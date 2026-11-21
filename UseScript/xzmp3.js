const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.xzmp3.com';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

// 网易云用的 cookie（非登录态，仅模拟）
function neteaseCookie() {
    const nmtid = (Math.random().toString(36) + '00000000').slice(2, 14);
    return 'os=pc; appver=2.0.3; channel=netease; MUSIC_A=373411b361e4048a5298c9413f5047384e8019e11b8e43407a759331a368438c; NMTID=' + nmtid;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 跟随 301/302 跳转，拿到"真实"的资源地址，并按 content-type 判断是否为音频
async function followRedirects(startUrl, refererBase) {
    let current = startUrl;
    let finalContentType = '';
    for (let i = 0; i < 5; i++) {
        let stepReferer = refererBase || BASE_URL;
        if (current.includes('music.163.com') || current.includes('music.126.net')) {
            stepReferer = 'https://music.163.com/';
        }
        const res = await axios.get(current, {
            headers: {
                'User-Agent': DEFAULT_HEADERS['User-Agent'],
                'Referer': stepReferer,
                'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
            },
            maxRedirects: 0,
            validateStatus: () => true,
            responseType: 'stream',
            timeout: 15000
        });
        if (res.data && typeof res.data.destroy === 'function') {
            try { res.data.destroy(); } catch (_) { }
        }
        const ctype = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '';
        if (ctype) finalContentType = ctype;
        if (res.status >= 300 && res.status < 400 && res.headers && res.headers.location) {
            let loc = res.headers.location;
            if (loc.startsWith('//')) loc = 'https:' + loc;
            if (!loc.startsWith('http')) {
                const u = new URL(current);
                loc = new URL(loc, `${u.protocol}//${u.host}`).href;
            }
            current = loc;
        } else {
            break;
        }
    }
    return { url: current, contentType: finalContentType };
}

// 网易云 player/url 接口：批量查询多个 id，返回其中有 url 的歌曲
async function neteasePlayerUrls(ids) {
    if (!ids || !ids.length) return [];
    try {
        const res = await axios.get('https://music.163.com/api/song/enhance/player/url', {
            params: { ids: '[' + ids.join(',') + ']', br: 128000 },
            headers: {
                'User-Agent': DEFAULT_HEADERS['User-Agent'],
                'Referer': 'https://music.163.com/',
                'Cookie': neteaseCookie()
            },
            timeout: 15000
        });
        return (res.data && res.data.data) || [];
    } catch (e) { return []; }
}

// 网易云搜索接口：按关键词找 top 10
async function neteaseSearch(keyword) {
    try {
        const res = await axios.get('https://music.163.com/api/search/get/web', {
            params: { s: keyword, type: 1, offset: 0, limit: 10 },
            headers: {
                'User-Agent': DEFAULT_HEADERS['User-Agent'],
                'Referer': 'https://music.163.com/',
                'Cookie': neteaseCookie()
            },
            timeout: 15000
        });
        if (res.data && res.data.result && res.data.result.songs) {
            return res.data.result.songs.map(s => ({
                id: s.id,
                title: s.name,
                artist: (s.artists || []).map(a => a.name).join('/'),
                album: (s.album && s.album.name) || ''
            }));
        }
        return [];
    } catch (e) { return []; }
}

module.exports = {
    platform: 'xzmp3',
    version: '0.0.2',
    author: 'Rotion',
    type: 'music',
    cacheControl: 'no-cache',
    name: 'xzmp3',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        try {
            const encoded = encodeURIComponent(query);
            const searchUrl = `${BASE_URL}/xiazai/${encoded}.htm`;

            const res = await axios.get(searchUrl, { headers: { ...DEFAULT_HEADERS } });
            const $ = cheerio.load(res.data);

            const songs = [];
            $('.list_body .list_row').each((i, el) => {
                const $row = $(el);
                const $nameLink = $row.find('.item.name a');
                let detailHref = $nameLink.attr('href');
                let title = $nameLink.text().trim();
                let artist = $row.find('.item.singer a').text().trim() || '未知';

                title = title.replace(/\s*(mp3|MP3|Mp3)\s*下载\s*$/, '').trim();
                if (!detailHref || !title) return;

                let id = '';
                const idMatch = detailHref.match(/\/mp3\/([^/]+)\.htm/);
                if (idMatch) id = idMatch[1];
                else id = String(Date.now()) + '_' + i;

                songs.push({
                    id: id,
                    title: title,
                    artist: artist,
                    album: '',
                    artwork: '',
                    duration: 0
                });
            });

            return { isEnd: songs.length < 20, data: songs };
        } catch (e) {
            return { isEnd: true, data: [] };
        }
    },

    async getMediaSource(musicItem, quality) {
        try {
            await sleep(200);
            // 第一层：按 xzmp3 官方 /down/{id}.mp3 跳转链查找
            const primary = `${BASE_URL}/down/${musicItem.id}.mp3`;
            const r1 = await followRedirects(primary, `${BASE_URL}/mp3/${musicItem.id}.htm`);
            if (r1.contentType && r1.contentType.toLowerCase().includes('audio') && r1.url && !r1.url.includes('/404')) {
                return {
                    url: r1.url,
                    headers: {
                        'User-Agent': DEFAULT_HEADERS['User-Agent'],
                        'Referer': 'https://music.163.com/'
                    }
                };
            }

            // 第二层：用"歌曲名+歌手名"在网易云搜索，拿 128kbps mp3 作为兜底
            await sleep(200);
            const keyword = [musicItem.title, musicItem.artist].filter(Boolean).join(' ').trim() || musicItem.title;
            const neteaseHits = await neteaseSearch(keyword);
            if (neteaseHits && neteaseHits.length) {
                const ids = neteaseHits.slice(0, 8).map(s => s.id);
                const urlList = await neteasePlayerUrls(ids);
                const valid = (urlList || []).find(d => d.url);
                if (valid && valid.url) {
                    return {
                        url: valid.url,
                        headers: {
                            'User-Agent': DEFAULT_HEADERS['User-Agent'],
                            'Referer': 'https://music.163.com/',
                            'Range': 'bytes=0-'
                        }
                    };
                }
            }

            // 最后兜底：把原始跳转 URL 返回给播放器
            return {
                url: primary,
                headers: {
                    'User-Agent': DEFAULT_HEADERS['User-Agent'],
                    'Referer': `${BASE_URL}/mp3/${musicItem.id}.htm`
                }
            };
        } catch (e) {
            throw new Error('无法获取音频链接: ' + e.message);
        }
    },

    async getLyric(musicItem) {
        try {
            const detailUrl = `${BASE_URL}/mp3/${musicItem.id}.htm`;
            const res = await axios.get(detailUrl, {
                headers: { ...DEFAULT_HEADERS }
            });

            let lrc = '';
            const dataMatch = res.data.match(/var\s+data\s*=\s*(\{[\s\S]*?\})\s*;?\s*setMusic/);
            if (dataMatch) {
                const lrcMatch = dataMatch[1].match(/['"]lrc['"]\s*:\s*['"]([\s\S]*?)['"]\s*,\s*['"]link['"]/);
                if (lrcMatch) {
                    lrc = lrcMatch[1]
                        .replace(/\\n/g, '\n')
                        .replace(/\\'/g, "'")
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                }
            }

            if (lrc && lrc.includes('[00:')) {
                return { rawLrc: lrc };
            }

            // xzmp3 没有歌词时，尝试用网易云兜底
            await sleep(200);
            const keyword = [musicItem.title, musicItem.artist].filter(Boolean).join(' ').trim() || musicItem.title;
            const neteaseHits = await neteaseSearch(keyword);
            if (neteaseHits && neteaseHits.length) {
                const firstId = neteaseHits[0].id;
                try {
                    const lrcRes = await axios.get('https://music.163.com/api/song/lyric', {
                        params: { id: firstId, lv: -1 },
                        headers: {
                            'User-Agent': DEFAULT_HEADERS['User-Agent'],
                            'Referer': 'https://music.163.com/',
                            'Cookie': neteaseCookie()
                        },
                        timeout: 15000
                    });
                    const lrcText = (lrcRes.data && lrcRes.data.lrc && lrcRes.data.lrc.lyric) || '';
                    if (lrcText && lrcText.includes('[00:')) {
                        return { rawLrc: lrcText };
                    }
                } catch (_) {}
            }

            return { rawLrc: lrc || '' };
        } catch (e) {
            return { rawLrc: '' };
        }
    },

    async getTopLists() {
        return [];
    },

    async getTopListDetail(topListItem, page) {
        return { isEnd: true, musicList: [], topListItem };
    }
};
