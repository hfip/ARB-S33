const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { getStreams } = require("../src/scraper");

const manifest = {
  id: "community.arabseed",
  version: "1.0.0",
  name: "عرب سيد",
  description: "مشاهدة أفلام ومسلسلات من موقع عرب سيد",
  logo: "https://m.asd.ink/wp-content/themes/ArabSeed/assets/images/logo.png",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: {
    adult: false,
    configurable: false,
  },
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  try {
    console.log(`[arabseed] stream request: type=${type} id=${id}`);

    // id format: "tt1234567" for movies, "tt1234567:1:1" for series
    const streams = await getStreams(type, id);

    if (!streams || streams.length === 0) {
      console.log(`[arabseed] no streams found for ${id}`);
      return { streams: [] };
    }

    console.log(`[arabseed] found ${streams.length} stream(s) for ${id}`);
    return { streams };
  } catch (err) {
    console.error(`[arabseed] error:`, err.message);
    return { streams: [] };
  }
});

// Vercel serverless export
const addonInterface = builder.getInterface();

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const url = req.url || "/";

  // Manifest
  if (url === "/" || url === "/manifest.json") {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(addonInterface.manifest);
  }

  // Streams
  const streamMatch = url.match(/^\/stream\/([^/]+)\/([^/]+)\.json/);
  if (streamMatch) {
    const type = streamMatch[1];
    const id = decodeURIComponent(streamMatch[2]);
    try {
      const result = await getStreams(type, id);
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({ streams: result });
    } catch (err) {
      console.error(err);
      return res.status(200).json({ streams: [] });
    }
  }

  return res.status(404).json({ error: "not found" });
};
