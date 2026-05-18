// api/index.js
const { addonBuilder } = require("stremio-addon-sdk");
const cheerio = require("cheerio");

// ============ 1. إعدادات النطاقات والبروكسي ============
const GOOGLE_PROXY_URL = "https://script.google.com/macros/s/AKfycbwzwsaeYrNMVo39ot5D2ah72SWsN1NaKa-_0yagRowbZNnByWwBiu94mO6mAUjwVGhSrQ/exec";
const BASE_URL = "https://m.asd.ink";

// ============ 2. بناء الـ Manifest الرسمي لستريميو ============
const builder = new addonBuilder({
    id: "org.dexworld.arabseed.premium",
    name: "ArabSeed Premium Extractor",
    version: "1.3.0",
    description: "إضافة عرب سيد الاحترافية لفك تشفير مشغلات GameHub وسيرفرات البث عبر بروكسي جوجل الآمن",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt"] // قراءة معرفات IMDb العالمية
});

// دالة الاتصال الأمن عبر بروكسي جوجل لتفادي حظر Cloudflare على Vercel
async function fetchViaProxy(targetUrl) {
    try {
        const proxyUrl = `${GOOGLE_PROXY_URL}?action=get_links&url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl, { method: 'GET' });
        if (!response.ok) return null;
        
        const buffer = await response.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
    } catch (err) {
        return null;
    }
}

// ============ 3. منطق فك تشفير حزم الـ JS Packed (مستخلص من GameHub) ============
function unpackJS(source) {
    try {
        const match = /eval\(function\(p,a,c,k,e,[dr]\).*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/s.exec(source);
        if (!match) return null;
        
        let payload = match[1];
        const radix = parseInt(match[2]);
        const symtab = match[4].split('|');
        
        const unbase = (str) => {
            let result = 0;
            for (let i = 0; i < str.length; i++) {
                const c = str[i];
                const v = /[0-9]/.test(c) ? parseInt(c) : c.charCodeAt(0) - 87;
                result = result * radix + v;
            }
            return result;
        };
        
        return payload.replace(/\b\w+\b/g, (word) => {
            const idx = unbase(word);
            return (symtab[idx] && symtab[idx] !== '') ? symtab[idx] : word;
        });
    } catch (e) {
        return null;
    }
}

// ============ 4. معالج البحث واستخراج روابط الفيديو الصافية ============
async function getDirectLinks(imdbId, type) {
    const streams = [];
    try {
        // أ) جلب اسم العنوان من قاعدة بيانات ستريميو للبحث به في عرب سيد
        const metaResponse = await fetch(`https://v3-cinemeta.stremio.com/meta/${type}/${imdbId}.json`);
        const metaData = await metaResponse.json();
        const mediaTitle = metaData.meta ? metaData.meta.name : "";

        if (!mediaTitle) return [];

        // ب) استدعاء دالة البحث بالبروكَسي داخل واجهة عرب سيد
        const searchUrl = `${GOOGLE_PROXY_URL}?action=search&q=${encodeURIComponent(mediaTitle)}`;
        const searchHtml = await (await fetch(searchUrl)).text();
        const $s = cheerio.load(searchHtml);
        
        let targetPageUrl = $s('.MovieBlock a, .Block--Item a, article a, .movie__block a').first().attr('href');
        if (!targetPageUrl) return [];

        // ت) النفاذ لصفحة المشاهدة الإجبارية /watch/
        let watchUrl = targetPageUrl.endsWith('/') ? `${targetPageUrl}watch/` : `${targetPageUrl}/watch/`;
        const watchHtml = await fetchViaProxy(watchUrl);
        if (!watchHtml) return [];

        const $w = cheerio.load(watchHtml);
        const servers = [];

        // ث) تفكيك روابط الـ play.php المدمجة المشفرة بـ Base64
        const b64Regex = /play\.php\?url=([a-zA-Z0-9+/=]+)/g;
        let match;
        while ((match = b64Regex.exec(watchHtml)) !== null) {
            try {
                let b64Str = match[1];
                const padding = 4 - (b64Str.length % 4);
                if (padding !== 4) b64Str += '='.repeat(padding);
                const decoded = Buffer.from(b64Str, 'base64').toString('utf-8');
                if (decoded.startsWith('http')) {
                    servers.push({ name: 'عرب سيد مباشر ⚡', link: decoded });
                }
            } catch (e) {}
        }

        // ج) التقاط الـ iframes وسيرفرات تشغيل الـ GameHub
        $w('iframe').each((i, elem) => {
            const src = $w(elem).attr('src');
            if (src && src.startsWith('http')) {
                servers.push({ name: `سيرفر تشغيل ${i + 1}`, link: src });
            }
        });

        // ح) فك تشفير السيرفرات واستخراج الـ mp4/m3u8 المباشر
        const optimizedServers = servers.slice(0, 3);
        for (const server of optimizedServers) {
            let serverHtml = await fetchViaProxy(server.link);
            if (!serverHtml) continue;

            // إذا كان كود السيرفر مشفر بـ Packed JS (منطق GameHub) نقوم بفكه فوراً
            if (serverHtml.includes("eval(function(p,a,c,k,e,")) {
                const unpacked = unpackJS(serverHtml);
                if (unpacked) serverHtml += "\n" + unpacked;
            }

            // اقتناص ملفات البث m3u8
            const m3u8Matches = serverHtml.match(/https?:\/\/[^\s"'<>\\)]+\.m3u8[^\s"'<>\\)]*/gi);
            if (m3u8Matches) {
                [...new Set(m3u8Matches)].forEach(videoUrl => {
                    streams.push({
                        title: `▶️ ${server.name}\n🔗 الجودة: تلقائية HLS (ثبات عالي)`,
                        url: videoUrl.replace(/\\\//g, '/'),
                        behaviorHints: {
                            notWebReady: false,
                            proxyHeaders: { request: { "Referer": server.link, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
                        }
                    });
                });
            }

            // اقتناص ملفات الفيديو المباشرة MP4
            const mp4Matches = serverHtml.match(/https?:\/\/[^\s"'<>\\)]+\.mp4[^\s"'<>\\)]*/gi);
            if (mp4Matches) {
                [...new Set(mp4Matches)].forEach(videoUrl => {
                    streams.push({
                        title: `▶️ ${server.name}\n🔗 الجودة: سورس مباشر MP4`,
                        url: videoUrl.replace(/\\\//g, '/'),
                        behaviorHints: {
                            notWebReady: false,
                            proxyHeaders: { request: { "Referer": server.link, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
                        }
                    });
                });
            }
        }

        // خطة الإنقاذ البديلة لمنع ظهور الشاشة السوداء
        if (streams.length === 0) {
            streams.push({
                name: "ArabSeed External",
                title: "🌐 فتح صفحة المشاهدة الخارجية المباشرة",
                externalUrl: watchUrl
            });
        }

    } catch (error) {
        console.error("Scraper Error:", error);
    }
    return streams;
}

// ============ 5. إعداد مستمع الـ Stream للـ SDK ============
builder.defineStreamHandler(async (args) => {
    const streams = await getDirectLinks(args.id, args.type);
    return { streams };
});

const addonInterface = builder.getInterface();

// تصدير الدالة لتتوافق مع معايير Vercel Serverless Function
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.url;
    if (url === '/' || url === '/manifest.json') {
        return res.status(200).json(addonInterface.manifest);
    }

    const streamMatch = url.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
    if (streamMatch) {
        const [, type, id] = streamMatch;
        const result = await getDirectLinks(decodeURIComponent(id), type);
        return res.status(200).json({ streams: result });
    }

    return res.status(404).json({ error: 'Not found' });
}
