const { chromium } = require("playwright-core");
const chromiumPath = require("@sparticuz/chromium");

const BASE_URL = "https://m.asd.ink";

// ─── Chromium launcher ────────────────────────────────────────────────────────
async function launchBrowser() {
  const execPath = await chromiumPath.executablePath();
  const browser = await chromium.launch({
    args: chromiumPath.args,
    executablePath: execPath,
    headless: chromiumPath.headless,
  });
  return browser;
}

// ─── Cinemeta: get title from IMDb ID (مجاني بدون مفتاح) ─────────────────────
async function getTitleFromCinemeta(imdbId, type) {
  try {
    const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
    console.log(`[cinemeta] fetching: ${url}`);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.log(`[cinemeta] status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const meta = data?.meta;
    if (!meta) return null;

    // نرجع الاسم العربي إن وجد، وإلا الاسم الأصلي
    const name = meta.name || meta.title || "";
    console.log(`[cinemeta] title: ${name}`);
    return name;
  } catch (err) {
    console.error("[cinemeta] error:", err.message);
    return null;
  }
}

// ─── Search ArabSeed for a title ─────────────────────────────────────────────
async function searchArabSeed(browser, query) {
  const page = await browser.newPage();
  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    console.log(`[scraper] searching: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page
      .waitForSelector(".Block--Item, .movie-card, article.post", {
        timeout: 10000,
      })
      .catch(() => {});

    const link = await page.evaluate(() => {
      const selectors = [
        ".Block--Item a",
        ".movie-card a",
        "article.post a",
        ".entry-title a",
        "h3 a",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.href) return el.href;
      }
      return null;
    });

    console.log(`[scraper] search result: ${link}`);
    return link;
  } finally {
    await page.close();
  }
}

// ─── Get episode page URL for series ─────────────────────────────────────────
async function getEpisodeUrl(browser, showUrl, season, episode) {
  const page = await browser.newPage();
  try {
    console.log(`[scraper] opening show: ${showUrl}`);
    await page.goto(showUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const epLink = await page.evaluate(
      (s, e) => {
        const links = Array.from(document.querySelectorAll("a"));

        // محاولة 1: رابط يحتوي season + episode
        for (const link of links) {
          const href = link.href || "";
          if (
            (href.includes(`season-${s}`) ||
              href.includes(`s${String(s).padStart(2, "0")}`)) &&
            (href.includes(`episode-${e}`) ||
              href.includes(`ep${String(e).padStart(2, "0")}`) ||
              href.includes(`-${e}-`))
          ) {
            return href;
          }
        }

        // محاولة 2: نص الرابط يحتوي رقم الحلقة
        for (const link of links) {
          const text = (link.textContent || "").trim();
          if (
            text === String(e) ||
            text === `الحلقة ${e}` ||
            text === `حلقة ${e}`
          ) {
            return link.href;
          }
        }

        return null;
      },
      season,
      episode
    );

    console.log(`[scraper] episode url: ${epLink}`);
    return epLink;
  } finally {
    await page.close();
  }
}

// ─── Decode /play.php?url=BASE64 ─────────────────────────────────────────────
function decodePlayUrl(iframeSrc) {
  try {
    const fullUrl = iframeSrc.startsWith("http")
      ? iframeSrc
      : `https://placeholder.com${iframeSrc}`;

    const urlParam = new URL(fullUrl).searchParams.get("url");
    if (!urlParam) return null;

    const decoded = Buffer.from(urlParam, "base64").toString("utf-8");
    console.log(`[scraper] base64 decoded: ${decoded}`);

    if (
      decoded.startsWith("http") ||
      decoded.includes(".m3u8") ||
      decoded.includes(".mp4")
    ) {
      return decoded;
    }

    return null;
  } catch (err) {
    console.error("[scraper] decode error:", err.message);
    return null;
  }
}

// ─── Open iframe and intercept M3U8 ──────────────────────────────────────────
async function extractM3U8FromIframe(browser, iframeUrl) {
  const page = await browser.newPage();
  try {
    const found = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes(".m3u8")) {
        console.log(`[scraper] intercepted m3u8: ${url}`);
        found.push(url);
      }
    });

    await page
      .goto(iframeUrl, { waitUntil: "networkidle", timeout: 20000 })
      .catch(() => {});

    await page.waitForTimeout(4000);

    return found.length > 0 ? found[0] : null;
  } finally {
    await page.close();
  }
}

// ─── Extract stream from watch page ──────────────────────────────────────────
async function extractStreamFromPage(browser, pageUrl) {
  const page = await browser.newPage();
  const streams = [];

  try {
    console.log(`[scraper] opening watch page: ${pageUrl}`);

    // اعتراض طلبات الشبكة مباشرة
    const m3u8Urls = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes(".m3u8")) {
        m3u8Urls.push(url);
      }
    });

    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // انتظار ظهور أزرار السيرفرات
    await page
      .waitForSelector(
        ".server-btn, .watch-btn, [class*='server'], [class*='watch']",
        { timeout: 8000 }
      )
      .catch(() => {});

    // اضغط زر "سيرفر عرب سيد" أولاً
    const clicked = await page.evaluate(() => {
      const all = Array.from(
        document.querySelectorAll("button, a, div, span")
      );
      for (const el of all) {
        const text = (el.textContent || "").trim();
        if (text.includes("عرب سيد") || text.includes("ArabSeed")) {
          el.click();
          return "arabseed";
        }
      }
      // fallback: أول زر سيرفر
      const first = document.querySelector(
        ".server-btn, .watch-btn, [class*='server']"
      );
      if (first) {
        first.click();
        return "first-btn";
      }
      return null;
    });

    console.log(`[scraper] clicked: ${clicked}`);
    await page.waitForTimeout(2000);

    // ── الطريقة 1: سحب iframe وفك Base64 ─────────────────────────────────────
    const iframeSrc = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (const f of iframes) {
        const src = f.src || f.getAttribute("src") || "";
        if (src.includes("play.php") || src.includes("url=")) return src;
      }
      return null;
    });

    if (iframeSrc) {
      console.log(`[scraper] iframe found: ${iframeSrc}`);

      // فك الـ Base64
      const direct = decodePlayUrl(iframeSrc);
      if (direct) {
        streams.push({
          name: "عرب سيد",
          title: "🎬 سيرفر عرب سيد",
          url: direct,
          behaviorHints: { notWebReady: false },
        });
      }

      // ── الطريقة 2: فتح الـ iframe واعتراض M3U8 ───────────────────────────
      if (streams.length === 0) {
        const fullIframe = iframeSrc.startsWith("http")
          ? iframeSrc
          : `${BASE_URL}${iframeSrc}`;

        const m3u8 = await extractM3U8FromIframe(browser, fullIframe);
        if (m3u8) {
          streams.push({
            name: "عرب سيد",
            title: "🎬 سيرفر عرب سيد",
            url: m3u8,
            behaviorHints: { notWebReady: false },
          });
        }
      }
    }

    // ── الطريقة 3: M3U8 من اعتراض الشبكة ────────────────────────────────────
    await page.waitForTimeout(3000);
    if (m3u8Urls.length > 0 && streams.length === 0) {
      streams.push({
        name: "عرب سيد",
        title: "🎬 بث مباشر",
        url: m3u8Urls[0],
        behaviorHints: { notWebReady: false },
      });
    }

    return streams;
  } finally {
    await page.close();
  }
}

// ─── Main getStreams ───────────────────────────────────────────────────────────
async function getStreams(type, id) {
  // تحليل الـ ID
  let imdbId, season, episode;
  if (id.includes(":")) {
    const parts = id.split(":");
    imdbId = parts[0];
    season = parseInt(parts[1]);
    episode = parseInt(parts[2]);
  } else {
    imdbId = id;
  }

  console.log(
    `[getStreams] type=${type} imdbId=${imdbId} s=${season} e=${episode}`
  );

  // جيب العنوان من Cinemeta — مجاني بدون أي مفتاح
  const title = await getTitleFromCinemeta(imdbId, type);
  if (!title) {
    console.log("[getStreams] could not get title from cinemeta");
    return [];
  }

  const browser = await launchBrowser();
  try {
    // بحث في عرب سيد
    let targetUrl = await searchArabSeed(browser, title);
    if (!targetUrl) {
      console.log("[getStreams] not found on arabseed");
      return [];
    }

    // للمسلسلات: انتقل لصفحة الحلقة
    if (type === "series" && season && episode) {
      const epUrl = await getEpisodeUrl(browser, targetUrl, season, episode);
      if (epUrl) targetUrl = epUrl;
    }

    // استخرج الروابط
    const streams = await extractStreamFromPage(browser, targetUrl);
    return streams;
  } finally {
    await browser.close();
  }
}

module.exports = { getStreams };
