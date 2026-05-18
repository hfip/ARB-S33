// api/index.js
const { addonBuilder } = require("stremio-addon-sdk");
const cheerio = require("cheerio");
const querystring = require("querystring");

// ============ 1. إعدادات البروكسي والدومين الرئيسي الفعال ============
const GOOGLE_PROXY_URL = "https://script.google.com/macros/s/AKfycbwzwsaeYrNMVo39ot5D2ah72SWsN1NaKa-_0yagRowbZNnByWwBiu94mO6mAUjwVGhSrQ/exec";
const BASE_URL = "https://m.asd.ink";

// خريطة المسارات المحدثة بالكامل للأقسام
const CATALOG_MAP = {
    "as_arabic_movies": "/category/arabic-movies-6/",
    "as_foreign_movies": "/category/foreign-movies-6/",
    "as_netflix_movies": "/category/netfilx/%d8%a7%d9%81%d9%84%d8%a7%d9%85-netfilx/",
    "as_indian_movies": "/category/indian-movies/",
    "as_asian_movies": "/category/asian-movies/",
    "as_turkish_movies": "/category/turkish-movies/",
    "as_dubbed_movies": "/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d9%85%d8%af%d8%a8%d9%84%d8%ac%d8%a9-1/",
    "as_animation_movies": "/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d9%86%d9%8a%d9%85%d9%8a%d8%b4%d9%86/",
    "as_wrestling": "/category/wwe-shows/",
    "as_plays": "/category/%d9%85%d8%b3%d8%b1%d8%ad%d9%8a%d8%a7%d8%aa-%d8%b9%d8%b1%d8%a8%d9%8a/",
    "as_arabic_series": "/category/arabic-series-6/",
    "as_egyptian_series": "/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%85%d8%b5%d8%b1%d9%8a%d9%87/",
    "as_foreign_series": "/category/foreign-series-3/",
    "as_netflix_series": "/category/netfilx/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-netfilx-1/",
    "as_turkish_series": "/category/turkish-series-2/",
    "as_indian_series": "/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%8e%d9%86%d8%af%d9%8a%d8%a9/",
    "as_korean_series": "/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%8a%d9%8f%d9%8وريه/",
    "as_dubbed_series": "/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%85%d8%af%d8%a8%d9%84%d8%ac%d8%a9/",
    "as_cartoon_series": "/category/cartoon-series/",
    "as_tv_shows": "/category/%d8%a8%d8%b1%d8%a7%d9%85%d8%ac-%d8%aa%d9%84%d9%81%d8%b2%d9%8a%d9%88%d9%86%d9%8a%d8%a9/",
    "as_ramadan_2025": "/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b1%d9%85%d8%b6%d8%a7%d9%86/ramadan-series-2025/"
};

// ============ 2. بناء الـ Manifest الرسمي لستريميو ============
const manifest = {
    id: "org.dexworld.arabseed.premium.max",
    name: "ArabSeed Premium Max",
    version: "1.6.0",
    description: "نسخة مصلحة بالكامل لعرض الكتالوجات والصور والتشغيل المباشر لجميع الأقسام",
    logo: "https://m.asd.ink/wp-content/uploads/2023/01/cropped-Untitled-1-1-192x192.png",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt", "as_"],
    catalogs: [
        { type: "movie", id: "as_arabic_movies", name: "عرب سيد - أفلام عربية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_foreign_movies", name: "عرب سيد - أفلام أجنبية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_netflix_movies", name: "عرب سيد - أفلام Netflix", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_indian_movies", name: "عرب سيد - أفلام هندية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_turkish_movies", name: "عرب سيد - أفلام تركية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_animation_movies", name: "عرب سيد - أنيميشن كرتون", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_wrestling", name: "عرب سيد - مصارعة حرة", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "movie", id: "as_plays", name: "عرب سيد - مسرحيات عربية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_arabic_series", name: "عرب سيد - مسلسلات عربية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_egyptian_series", name: "عرب سيد - مسلسلات مصرية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_foreign_series", name: "عرب سيد - مسلسلات أجنبية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_netflix_series", name: "عرب سيد - مسلسلات Netflix", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_turkish_series", name: "عرب سيد - مسلسلات تركية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_korean_series", name: "عرب سيد - مسلسلات كورية / آسيوية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_cartoon_series", name: "عرب سيد - مسلسلات كرتون", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_tv_shows", name: "عرب سيد - برامج تلفزيونية", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] },
        { type: "series", id: "as_ramadan_2025", name: "عرب سيد - مسلسلات رمضان", extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }] }
    ]
};

const builder = new addonBuilder(manifest);

async function fetchViaProxy(action, targetUrl = '', searchQuery = '') {
    try {
        let proxyUrl = `${GOOGLE_PROXY_URL}?action=${action}`;
        if (action === 'search') proxyUrl += `&q=${encodeURIComponent(searchQuery)}`;
        else if (action === 'get_links') proxyUrl += `&url=${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl, { method: 'GET' });
        if (!response.ok) return null;
        
        const buffer = await response.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
    } catch (err) {
        return null;
    }
}

// ============ 3. معالج الكتالوجات المصلح لتفادي مشاكل البوسترات ============
async function catalogHandler({ type, id, extra }) {
    const skip = parseInt(extra.skip) || 0;
    const search = extra.search || '';
    const page = Math.floor(skip / 30) + 1;

    let htmlData = "";
    if (search) {
        htmlData = await fetchViaProxy('search', '', search);
    } else {
        const categoryPath = CATALOG_MAP[id] || "/category/arabic-movies-6/";
        const targetUrl = page > 1 ? `${BASE_URL}${categoryPath}page/${page}/` : `${BASE_URL}${categoryPath}`;
        htmlData = await fetchViaProxy('get_links', targetUrl);
    }

    if (!htmlData) return { metas: [] };
    const $ = cheerio.load(htmlData);
    const metas = [];

    // السيلكتور الذكي والمصلح لقراءة البنية الجديدة مباشرة
    $('.MovieBlock, .Block--Item, article, .Small--Box, .movie__block, .post-list, a.movie__block').each((i, el) => {
        const $el = $(el);
        
        // إصلاح التقاط الرابط والعنوان سواء كان العنصر نفسه رابطاً أو حاوياً
        let link = $el.attr('href') || $el.find('a').first().attr('href');
        let title = $el.attr('title') || $el.find('h3, h4, .BlockTitle, .Title, p').first().text().trim() || $el.find('img').first().attr('alt');
        let poster = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');

        if (link && title) {
            if (!link.startsWith('http')) link = new URL(link, BASE_URL).href;
            
            // تحويل وتطهير دومينات الصور المحظورة وتوجيهها للدومين الفعال لتعرض فوراً في ستريميو
            if (poster) {
                if (!poster.startsWith('http')) poster = new URL(poster, BASE_URL).href;
                poster = poster.replace(/https?:\/\/[^/]+/g, BASE_URL);
            }

            metas.push({
                id: 'as_' + Buffer.from(link).toString('base64url'),
                type: type,
                name: title,
                poster: poster || '',
                posterShape: 'poster'
            });
        }
    });

    return { metas };
}

// ============ 4. معالج الميتا ============
async function metaHandler({ type, id }) {
    if (!id.startsWith('as_')) return { meta: {} };
    try {
        const pageUrl = Buffer.from(id.replace('as_', ''), 'base64url').toString();
        const htmlData = await fetchViaProxy('get_links', pageUrl);
        if (!htmlData) return { meta: {} };

        const $ = cheerio.load(htmlData);
        const name = $('h1').first().text().trim() || $('title').text().trim();
        let poster = $('.Poster img, .single-thumb img, .movie-poster img').first().attr('src') || $('.post__image img').first().attr('data-src');
        const description = $('.descrip, .StoryLine, .story').first().text().trim();

        if (poster) {
            poster = poster.replace(/https?:\/\/[^/]+/g, BASE_URL);
        }

        const meta = { id, type, name, poster, background: poster, description, genres: [] };
        $('.Genre a, .genres a').each((i, el) => meta.genres.push($(el).text().trim()));

        if (type === 'series') {
            const videos = [];
            $('.EpisodesList a, .episodes-list a, .EpsList a').each((i, el) => {
                const epUrl = $(el).attr('href');
                const epTitle = $(el).text().trim() || `الحلقة ${i + 1}`;
                if (epUrl) {
                    videos.push({
                        id: 'as_' + Buffer.from(epUrl).toString('base64url'),
                        title: epTitle,
                        season: 1,
                        episode: parseInt(epTitle.match(/\d+/)?.[0]) || (i + 1),
                        released: new Date().toISOString()
                    });
                }
            });
            if (videos.length > 0) meta.videos = videos.reverse();
        }
        return { meta };
    } catch (err) {
        return { meta: {} };
    }
}

// ============ 5. معالج البث وفك سيرفر GameHub والـ Base64 ============
async function streamHandler({ type, id }) {
    const streams = [];
    try {
        let watchUrl = "";
        
        if (id.startsWith('as_')) {
            const pageUrl = Buffer.from(id.replace('as_', ''), 'base64url').toString();
            watchUrl = pageUrl.endsWith('/watch/') ? pageUrl : pageUrl.replace(/\/$/, '') + '/watch/';
        } 
        else if (id.startsWith('tt')) {
            const metaResponse = await fetch(`https://v3-cinemeta.stremio.com/meta/${type}/${id}.json`);
            const metaData = await metaResponse.json();
            const mediaTitle = metaData.meta ? metaData.meta.name : "";
            if (!mediaTitle) return { streams: [] };

            const searchHtml = await fetchViaProxy('search', '', mediaTitle);
            if (!searchHtml) return { streams: [] };
            
            const $s = cheerio.load(searchHtml);
            let targetPageUrl = $s('.MovieBlock a, .Block--Item a, article a, .movie__block a, a.movie__block').first().attr('href');
            if (!targetPageUrl) return { streams: [] };

            watchUrl = targetPageUrl.endsWith('/watch/') ? targetPageUrl : targetPageUrl.replace(/\/$/, '') + '/watch/';
        }

        const watchHtml = await fetchViaProxy('get_links', watchUrl);
        if (!watchHtml) return { streams: [] };
        
        const servers = [];

        // فك شفرات روابط Base64 (play.php)
        const b64Regex = /play\.php\?url=([a-zA-Z0-9+/=]+)/g;
        let match;
        while ((match = b64Regex.exec(watchHtml)) !== null) {
            try {
                let b64Str = match[1];
                const padding = 4 - (b64Str.length % 4);
                if (padding !== 4) b64Str += '='.repeat(padding);
                const decoded = Buffer.from(b64Str, 'base64').toString('utf-8');
                if (decoded.startsWith('http') && !servers.some(s => s.link === decoded)) {
                    servers.push({ name: 'عرب سيد مباشر ⚡', link: decoded });
                }
            } catch (e) {}
        }

        const $w = cheerio.load(watchHtml);
        $w('iframe').each((i, elem) => {
            const src = $w(elem).attr('src');
            if (src && src.startsWith('http') && !servers.some(s => s.link === src)) {
                servers.push({ name: `سيرفر بث ${i + 1}`, link: src });
            }
        });

        const optimizedServers = servers.slice(0, 3);
        for (const server of optimizedServers) {
            let serverHtml = await fetchViaProxy('get_links', server.link);
            if (!serverHtml) continue;

            // منطق فك حزم GameHub المشفرة
            if (serverHtml.includes("eval(function(p,a,c,k,e,")) {
                const matchJS = /eval\(function\(p,a,c,k,e,[dr]\).*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/s.exec(serverHtml);
                if (matchJS) {
                    try {
                        let payload = matchJS[1]; const radix = parseInt(matchJS[2]); const symtab = matchJS[4].split('|');
                        const unbase = (str) => { let res = 0; for (let i = 0; i < str.length; i++) { const c = str[i]; const v = /[0-9]/.test(c) ? parseInt(c) : c.charCodeAt(0) - 87; res = res * radix + v; } return res; };
                        const unpacked = payload.replace(/\b\w+\b/g, (word) => { const idx = unbase(word); return (symtab[idx] && symtab[idx] !== '') ? symtab[idx] : word; });
                        serverHtml += "\n" + unpacked;
                    } catch (e) {}
                }
            }

            const m3u8Matches = serverHtml.match(/https?:\/\/[^\s"'<>\\)]+\.m3u8[^\s"'<>\\)]*/gi);
            if (m3u8Matches) {
                [...new Set(m3u8Matches)].forEach(videoUrl => {
                    streams.push({
                        title: `▶️ ${server.name}\n🔗 الجودة: تلقائية HLS`,
                        url: videoUrl.replace(/\\\//g, '/'),
                        behaviorHints: { notWebReady: false, proxyHeaders: { request: { "Referer": server.link, "User-Agent": "Mozilla/5.0" } } }
                    });
                });
            }

            const mp4Matches = serverHtml.match(/https?:\/\/[^\s"'<>\\)]+\.mp4[^\s"'<>\\)]*/gi);
            if (mp4Matches) {
                [...new Set(mp4Matches)].forEach(videoUrl => {
                    streams.push({
                        title: `▶️ ${server.name}\n🔗 الجودة: سورس مباشر MP4`,
                        url: videoUrl.replace(/\\\//g, '/'),
                        behaviorHints: { notWebReady: false, proxyHeaders: { request: { "Referer": server.link, "User-Agent": "Mozilla/5.0" } } }
                    });
                });
            }
        }

        if (streams.length === 0) {
            streams.push({ name: "ArabSeed Web", title: "🌐 فتح صفحة المشاهدة الخارجية المباشرة", externalUrl: watchUrl });
        }

        return { streams };
    } catch (err) {
        return { streams: [] };
    }
}

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);

const addonInterface = builder.getInterface();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.url;
    if (url === '/' || url === '/manifest.json') {
        return res.status(200).json(addonInterface.manifest);
    }

    const catalogMatch = url.match(/^\/catalog\/([^/]+)\/([^/]+)(?:\/(.+))?\.json$/);
    if (catalogMatch) {
        const [, type, id, extraStr] = catalogMatch;
        const extra = extraStr ? querystring.parse(extraStr) : {};
        const result = await catalogHandler({ type, id, extra });
        return res.status(200).json(result);
    }

    const metaMatch = url.match(/^\/meta\/([^/]+)\/(.+)\.json$/);
    if (metaMatch) {
        const [, type, id] = metaMatch;
        const result = await metaHandler({ type, id: decodeURIComponent(id) });
        return res.status(200).json(result);
    }

    const streamMatch = url.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
    if (streamMatch) {
        const [, type, id] = streamMatch;
        const result = await streamHandler({ type, id: decodeURIComponent(id) });
        return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Not found' });
}
