const B2 = require("backblaze-b2");
const axios = require("axios");

const b2 = new B2({
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

let authCache = {
  downloadUrl: null,
  token: null,
  expiresAt: 0,
};

const getB2DownloadUrl = async () => {
  const now = Date.now();

  if (authCache.downloadUrl && authCache.token && authCache.expiresAt > now) {
    console.log("✅ Using cached B2 credentials");
    return { downloadUrl: authCache.downloadUrl, token: authCache.token };
  }

  console.log("🔄 Getting new B2 credentials...");

  try {
    const authResponse = await b2.authorize();
    console.log("✅ B2 authorized");

    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID,
      fileNamePrefix: "shorts/",
      validDurationInSeconds: 3600,
    });

    console.log("✅ Download authorization received");

    authCache.downloadUrl = authResponse.data.downloadUrl;
    authCache.token = downloadAuth.data.authorizationToken;
    authCache.expiresAt = now + 3500000; // ~58 phút

    return {
      downloadUrl: authCache.downloadUrl,
      token: authCache.token,
    };
  } catch (error) {
    console.error("❌ B2 Authorization failed:", error.message);
    throw error;
  }
};

const proxyPlaylist = async (req, res) => {
  try {
    const { shortId } = req.params;
    const fileName = `shorts/${shortId}/playlist.m3u8`;

    console.log("\n=== PROXY PLAYLIST ===");
    console.log("Short ID:", shortId);
    console.log("File:", fileName);

    const { downloadUrl, token } = await getB2DownloadUrl();
    const bucketName = process.env.B2_BUCKET_NAME;

    const url = `${downloadUrl}/file/${bucketName}/${fileName}`;
    console.log("URL:", url);

    const response = await axios.get(url, {
      headers: {
        Authorization: token,
      },
      timeout: 10000, // 10s timeout
    });

    console.log("Status:", response.status);

    if (response.status !== 200) {
      throw new Error(`B2 returned status ${response.status}`);
    }

    let playlist = response.data;
    console.log(
      "Original playlist (first 200 chars):",
      playlist.substring(0, 200)
    );

    if (!playlist.startsWith("#EXTM3U")) {
      throw new Error("Invalid M3U8 format");
    }

    // Replace segments
    const lines = playlist.split("\n");
    const modifiedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.endsWith(".ts")) {
        return `${process.env.REACT_APP_DOMAIN_BACKEND}/api/v1/shorts/segment/${shortId}/${trimmed}`;
      }
      return line;
    });

    playlist = modifiedLines.join("\n");
    console.log(
      "Modified playlist (first 200 chars):",
      playlist.substring(0, 200)
    );

    // Set proper headers cho HLS
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Range, Content-Type");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.send(playlist);

    console.log("✅ Playlist sent successfully\n");
  } catch (error) {
    console.error("❌ Proxy playlist error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    res.status(500).json({
      message: "Error loading playlist",
      error: error.message,
    });
  }
};

const proxySegment = async (req, res) => {
  try {
    const { shortId, segmentName } = req.params;
    const fileName = `shorts/${shortId}/${segmentName}`;

    console.log("\n=== PROXY SEGMENT ===");
    console.log("Segment:", segmentName);
    console.log("Short ID:", shortId);

    const { downloadUrl, token } = await getB2DownloadUrl();
    const bucketName = process.env.B2_BUCKET_NAME;

    const url = `${downloadUrl}/file/${bucketName}/${fileName}`;
    console.log("B2 URL:", url);

    const headers = {
      Authorization: token,
    };

    if (req.headers.range) {
      headers.Range = req.headers.range;
      console.log("📍 Range request:", req.headers.range);
    }

    const response = await axios.get(url, {
      headers,
      responseType: "stream",
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });

    console.log("✅ B2 Response Status:", response.status);
    console.log("   Content-Length:", response.headers["content-length"]);
    if (response.headers["content-range"]) {
      console.log("   Content-Range:", response.headers["content-range"]);
    }

    res.status(response.status);

    // Set proper headers
    res.set("Content-Type", "video/mp2t");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Range, Content-Type");
    res.set("Accept-Ranges", "bytes");
    res.set("Cache-Control", "public, max-age=31536000, immutable");

    if (response.headers["content-length"]) {
      res.set("Content-Length", response.headers["content-length"]);
    }
    if (response.headers["content-range"]) {
      res.set("Content-Range", response.headers["content-range"]);
    }

    response.data.pipe(res);

    response.data.on("end", () => {
      console.log("✅ Segment streaming completed\n");
    });

    response.data.on("error", (err) => {
      console.error("❌ Stream error:", err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on("close", () => {
      if (response.data) {
        response.data.destroy();
      }
    });
  } catch (error) {
    console.error("❌ Proxy segment error:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", error.response.data);
    }
    if (!res.headersSent) {
      res.status(500).json({
        message: "Error loading segment",
        error: error.message,
      });
    }
  }
};

module.exports = {
  proxyPlaylist,
  proxySegment,
};
