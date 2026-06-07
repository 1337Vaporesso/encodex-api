// Background Service Worker for EncodeX

// Helper to safely check response status and JSON content-type
function handleJsonResponse(res) {
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Response was not JSON (probably Cloudflare or HTML rate-limit page)!");
  }
  return res.json();
}

// Listen for message events from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_ACTIVE_TIKTOK_USER") {
    // Queries the active user currently authenticated on TikTok web
    fetch("https://www.tiktok.com/passport/web/account/info/", {
      method: "GET",
      credentials: "include"
    })
      .then(handleJsonResponse)
      .then(json => {
        if (json.data && json.data.username) {
          sendResponse({
            success: true,
            username: "@" + json.data.username,
            avatar: json.data.avatar_url
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(err => {
        console.warn("[EncodeX] Error fetching active TikTok user:", err);
        sendResponse({ success: false });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === "FETCH_AVATAR") {
    const handle = message.username.replace("@", "").trim();
    fetch(`https://www.tikwm.com/api/user/info?unique_id=${handle}`)
      .then(handleJsonResponse)
      .then(json => {
        if (json.code === 0 && json.data && json.data.user) {
          sendResponse({
            success: true,
            avatar: json.data.user.avatarLarger || json.data.user.avatarThumb
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(err => {
        console.warn("[EncodeX] Error fetching avatar:", err);
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.action === "FETCH_TIKTOK_DATA") {
    const handle = message.username.replace("@", "").trim();
    console.log(`[EncodeX] Fetching recent uploads for user: ${handle}`);
    
    // We scrape recent videos using public Tikwm API
    fetch(`https://www.tikwm.com/api/user/posts?unique_id=${handle}&count=10`)
      .then(handleJsonResponse)
      .then(json => {
        if (json.code === 0 && json.data && json.data.videos) {
          const formattedVideos = json.data.videos.map(vid => {
            return {
              views: vid.play_count || 0,
              likes: vid.digg_count || 0,
              comments: vid.comment_count || 0,
              shares: vid.share_count || 0,
              title: vid.title || "",
              cover: vid.cover || "",
              playUrl: vid.play || vid.hdplay || "",
              musicUrl: vid.music || "",
              create_time: vid.create_time || Math.floor(Date.now() / 1000)
            };
          });
          sendResponse({ success: true, data: formattedVideos });
        } else {
          console.warn("[EncodeX] Tikwm user posts returned code != 0 or empty data:", json);
          sendResponse({ success: false, error: "NO_VIDEOS_FOUND" });
        }
      })
      .catch(err => {
        console.warn("[EncodeX] Service request error:", err);
        sendResponse({ success: false, error: "SERVER_OFFLINE" });
      });
    return true;
  }

  if (message.action === "DOWNLOAD_MEDIA") {
    console.log("[EncodeX] Starting file download:", message.url);
    chrome.downloads.download({
      url: message.url,
      filename: `encodex_downloads/${message.filename}`,
      saveAs: false
    });
    return true;
  }

  // Download processed file via SW (больше памяти чем content script)
  if (message.action === "DOWNLOAD_FILE") {
    console.log("[EncodeX] SW downloading:", message.url);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 600000); // 10 min timeout
    fetch(message.url, {
      headers: { 'Authorization': 'Bearer ' + message.token },
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(buf => {
        clearTimeout(t);
        sendResponse({ ok: true, buffer: buf });
      })
      .catch(e => {
        clearTimeout(t);
        console.error('[EncodeX] SW download error:', e.message);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // keep channel open
  }

  if (message.action === "ANALYZE_SINGLE_VIDEO") {
    const urlEncoded = encodeURIComponent(message.url);
    fetch(`https://www.tikwm.com/api/?url=${urlEncoded}`)
      .then(handleJsonResponse)
      .then(json => {
        if (json.code === 0 && json.data) {
          const detail = json.data;
          sendResponse({
            success: true,
            data: {
              cover: detail.cover,
              title: detail.title || "Untitled",
              playUrl: detail.play || detail.hdplay,
              musicUrl: detail.music,
              author: detail.author ? detail.author.nickname : "Creator",
              views: detail.play_count || 0,
              likes: detail.digg_count || 0
            }
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(err => {
        console.warn("[EncodeX] Error analyzing single video:", err);
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.action === "FETCH_HD_VIDEO") {
    console.log("[EncodeX] Triggering HD flow for:", message.url);
    handleHDProcess(message.url)
      .then(playUrl => {
        if (playUrl) {
          sendResponse({ success: true, data: { playUrl: playUrl } });
        } else {
          sendResponse({ success: false, error: "Link resolving failed." });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: err.toString() });
      });
    return true;
  }
});

// HD video retrieval algorithms
async function handleHDProcess(url) {
  try {
    const response = await fetch("https://www.tikwm.com/api/video/task/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.tikwm.com/originalDownloader.html",
        "Origin": "https://www.tikwm.com"
      },
      body: `url=${encodeURIComponent(url)}&web=1`
    });
    
    if (!response.ok) throw new Error("HTTP Error: " + response.status);
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response was not JSON!");
    }
    
    const json = await response.json();
    if (json.code === 0 && json.data && json.data.task_id) {
      const taskId = json.data.task_id;
      console.log(`[EncodeX] HD task created. Task ID: ${taskId}`);
      
      // Hold 2 seconds for processing to resolve on tikwm servers
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await checkTaskResult(taskId);
    }
    return null;
  } catch (err) {
    console.warn("[EncodeX] HD process exception:", err);
    return null;
  }
}

async function checkTaskResult(taskId) {
  try {
    const url = `https://www.tikwm.com/api/video/task/result?task_id=${taskId}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error("HTTP Error: " + response.status);
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response was not JSON!");
    }

    const json = await response.json();
    if (json.code === 0 && json.data) {
      const data = json.data.detail || json.data;
      const playUrl = data.play_url || data.download_url || data.play;
      return playUrl;
    }
    return null;
  } catch (err) {
    console.warn("[EncodeX] Result polling error:", err);
    return null;
  }
}
