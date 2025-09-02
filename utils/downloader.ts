import JSZip from "jszip";
import { browser } from "wxt/browser";

export interface MediaItem {
  url: string;
  type: "image" | "video";
  filename: string;
}

export interface NoteContent {
  title: string;
  author: string;
  content: string;
  url: string;
}

export interface CommentItem {
  id: string;
  author: string;
  content: string;
  createTime: Date;
  likeCount: number;
  ipLocation: string;
  replies: Array<{
    author: string;
    content: string;
    createTime: Date;
    likeCount: number;
  }>;
}

export interface ExtendedNoteContent extends NoteContent {
  wordCount: number;
  charCount: number;
  comments: CommentItem[];
  extractedAt: string;
}

export interface FeedNoteCard {
  title: string;
  desc: string;
  note_id: string;
  type: "normal" | "video";
  user: {
    nickname: string;
    user_id: string;
    avatar: string;
  };
  image_list?: Array<{
    url_default: string;
    url_pre: string;
    width: number;
    height: number;
    info_list: Array<{
      image_scene: string;
      url: string;
    }>;
  }>;
  video?: {
    media: {
      stream: {
        h264: Array<{
          master_url: string;
          width: number;
          height: number;
          quality_type: string;
          format: string;
          backup_urls: string[];
        }>;
        h265: Array<{
          master_url: string;
          width: number;
          height: number;
          quality_type: string;
          format: string;
          backup_urls: string[];
        }>;
      };
    };
  };
  tag_list?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  interact_info: {
    liked_count: string;
    collected_count: string;
    comment_count: string;
    share_count: string;
  };
  time: number;
  ip_location?: string;
}

export interface FeedApiResponse {
  code: number;
  success: boolean;
  msg: string;
  data: {
    items: Array<{
      id: string;
      model_type: string;
      note_card: FeedNoteCard;
    }>;
    current_time: number;
    cursor_score: string;
  };
}

export interface DownloadProgress {
  current: number;
  total: number;
  status: "downloading" | "complete" | "error";
}

export class MediaDownloader {
  private downloadCallback?: (progress: DownloadProgress) => void;

  constructor(onProgress?: (progress: DownloadProgress) => void) {
    this.downloadCallback = onProgress;
  }

  async downloadSingle(media: MediaItem): Promise<boolean> {
    try {
      console.log(`Starting download for ${media.type}: ${media.filename}`);
      console.log(`URL: ${media.url}`);

      const response = await fetch(media.url, {
        method: "GET",
        // Add referrer to avoid potential blocking
        headers: {
          Referer: window.location.href,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(
        `Successfully fetched ${media.filename}, content length: ${response.headers.get("content-length")}`
      );
      const blob = await response.blob();
      console.log(`Blob created with size: ${blob.size} bytes`);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.filename;
      a.click();

      URL.revokeObjectURL(url);
      console.log(`Successfully downloaded ${media.filename}`);
      return true;
    } catch (error) {
      console.error(`Failed to download ${media.filename}:`, error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
      }
      return false;
    }
  }

  async downloadAsZip(
    mediaItems: MediaItem[],
    zipFilename: string,
    extendedContent?: ExtendedNoteContent | null,
    noteContent?: NoteContent | null
  ): Promise<boolean> {
    try {
      const zip = new JSZip();
      const hasExtendedContent = extendedContent != null;
      const hasContent = hasExtendedContent || noteContent != null;
      const total = mediaItems.length + (hasContent ? 1 : 0);
      let current = 0;

      this.downloadCallback?.({ current, total, status: "downloading" });

      // Download all media items and add to zip
      for (const media of mediaItems) {
        try {
          console.log(`Downloading ${media.filename} for ZIP archive...`);
          const response = await fetch(media.url, {
            method: "GET",
            headers: {
              Referer: window.location.href,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const blob = await response.blob();
          zip.file(media.filename, blob);
          console.log(`Added ${media.filename} to ZIP (${blob.size} bytes)`);

          current++;
          this.downloadCallback?.({ current, total, status: "downloading" });
        } catch (error) {
          console.error(`Failed to download ${media.filename} for ZIP:`, error);
          // Continue with other files even if one fails
        }
      }

      // Add content txt file if available
      if (hasContent) {
        try {
          let content = "";
          const noteId = extractNoteId() || "unknown";

          if (hasExtendedContent && extendedContent) {
            // Use extended content with comments
            content = `标题: ${extendedContent.title}\n作者: ${extendedContent.author}\n\n内容:\n${extendedContent.content}\n\n`;

            if (extendedContent.comments.length > 0) {
              content += `评论 (${extendedContent.comments.length} 条):\n`;
              content += `${"=".repeat(50)}\n\n`;

              extendedContent.comments.forEach((comment, index) => {
                content += `评论 ${index + 1}:\n`;
                content += `作者: ${comment.author}\n`;
                content += `内容: ${comment.content}\n`;
                content += `点赞: ${comment.likeCount}\n`;
                if (comment.ipLocation)
                  content += `地区: ${comment.ipLocation}\n`;
                content += `时间: ${comment.createTime.toLocaleString()}\n`;

                if (comment.replies.length > 0) {
                  content += `  回复 (${comment.replies.length} 条):\n`;
                  comment.replies.forEach((reply, replyIndex) => {
                    content += `    回复 ${replyIndex + 1}: ${reply.author} - ${reply.content}\n`;
                  });
                }
                content += `\n${"-".repeat(30)}\n\n`;
              });
            }

            content += `\n来源: ${extendedContent.url}\n提取时间: ${extendedContent.extractedAt}`;
            zip.file(`xiaohongshu_${noteId}_complete_content.txt`, content);
          } else if (noteContent) {
            // Use basic content only
            content = `标题: ${noteContent.title}\n作者: ${noteContent.author}\n\n内容:\n${noteContent.content}\n\n来源: ${noteContent.url}`;
            zip.file(`xiaohongshu_${noteId}_content.txt`, content);
          }

          current++;
          this.downloadCallback?.({ current, total, status: "downloading" });
        } catch (error) {
          console.error("Failed to add content to zip:", error);
        }
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFilename;
      a.click();

      URL.revokeObjectURL(url);

      this.downloadCallback?.({ current: total, total, status: "complete" });
      return true;
    } catch (error) {
      console.error("Zip download failed:", error);
      this.downloadCallback?.({ current: 0, total: 0, status: "error" });
      return false;
    }
  }
}

// Wait for elements to appear with timeout
function waitForSelector(
  selectors: string | string[],
  timeout = 5000,
  interval = 200
): Promise<string> {
  const selectorArr = Array.isArray(selectors) ? selectors : [selectors];
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      for (const sel of selectorArr) {
        if (document.querySelector(sel)) {
          clearInterval(timer);
          resolve(sel);
          return;
        }
      }
      if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error("Timeout waiting for selector"));
      }
    }, interval);
  });
}

// Get content images specifically from detail page (similar to RedConvert approach)
function getCurrentNoteImgEls(): HTMLImageElement[] {
  // Try detail page specific selectors first
  let els = Array.from(
    document.querySelectorAll(".img-container img")
  ) as HTMLImageElement[];
  if (els.length === 0) {
    els = Array.from(
      document.querySelectorAll(".note-content .img-container img")
    ) as HTMLImageElement[];
  }
  if (els.length === 0) {
    // Fallback to swiper slides in detail pages
    els = Array.from(
      document.querySelectorAll(".swiper-slide img")
    ) as HTMLImageElement[];
  }
  return els;
}

// Get current note video (enhanced detection)
function getCurrentNoteVideoUrl(): string | null {
  console.log("Attempting to detect video element...");

  // Try multiple video selectors for Xiaohongshu
  const videoSelectors = [
    "video", // Direct video element
    ".video-container video",
    ".note-video video",
    "[data-video] video",
    "xg-video-container video", // XGPlayer container
    ".xgplayer video",
  ];

  for (const selector of videoSelectors) {
    const videoEl = document.querySelector(selector) as HTMLVideoElement;
    if (videoEl) {
      console.log(`Found video element with selector: ${selector}`, videoEl);

      // Check currentSrc first (more reliable)
      if (videoEl.currentSrc) {
        console.log("Found video currentSrc:", videoEl.currentSrc);
        return videoEl.currentSrc;
      }

      // Check src attribute
      if (videoEl.src) {
        console.log("Found video src:", videoEl.src);
        return videoEl.src;
      }

      // Check source elements
      const sources = videoEl.querySelectorAll("source");
      for (const source of sources) {
        if (source.src) {
          console.log("Found source src:", source.src);
          return source.src;
        }
      }
    }
  }

  console.log("No video URL found via DOM detection");
  return null;
}

// Extract note content from detail page (DOM-based fallback)
function extractNoteContentFromDOM(): NoteContent | null {
  try {
    // Get title from page title or specific selectors
    let title = document.title.replace(" - 小红书", "").trim();

    // Try alternative title selectors if title is generic
    if (title === "小红书" || title === "") {
      const titleEl = document.querySelector(
        '.note-title, [class*="title"], h1'
      );
      if (titleEl) {
        title = titleEl.textContent?.trim() || title;
      }
    }

    // Extract author name
    let author = "";
    const authorSelectors = [
      ".username", // 优先：小红书用户名类
      ".info .name .username", // 信息区域内的用户名
      '[class*="info"] .username', // 任何info类中的username
      ".author-name",
      '[class*="author"] [class*="name"]',
      ".user-name",
      '[class*="user"] [class*="name"]',
      ".nickname",
      "[data-v-*] .name",
      '[class*="info"] [class*="name"]',
    ];

    for (const selector of authorSelectors) {
      const authorEl = document.querySelector(selector);
      if (authorEl?.textContent?.trim()) {
        author = authorEl.textContent.trim();
        break;
      }
    }

    // Extract main content text
    let content = "";
    const contentSelectors = [
      ".note-content .desc",
      ".note-text",
      '[class*="content"] [class*="desc"]',
      ".desc",
      '[class*="detail"] [class*="desc"]',
      ".note-content .text",
      '[class*="content"]',
    ];

    for (const selector of contentSelectors) {
      const contentEl = document.querySelector(selector);
      if (contentEl?.textContent?.trim()) {
        const text = contentEl.textContent.trim();
        if (text.length > content.length) {
          content = text;
        }
      }
    }

    // Fallback: try to extract from page text if selectors don't work
    if (!content) {
      const bodyText = document.body.textContent || "";
      const lines = bodyText
        .split("\n")
        .filter((line) => line.trim().length > 20);
      if (lines.length > 0) {
        content = lines.slice(0, 10).join("\n").trim();
      }
    }

    if (!title && !author && !content) {
      return null;
    }

    return {
      title: title || "无标题",
      author: author || "未知作者",
      content: content || "无内容",
      url: window.location.href,
    };
  } catch (error) {
    console.error("Failed to extract note content:", error);
    return null;
  }
}

// Extract note content with priority fallback strategy
function extractNoteContent(): NoteContent | null {
  // Strategy 1: Try to get data from cached feed API response
  const feedData = getCachedFeedData();
  if (feedData) {
    const feedContent = parseNoteContentFromFeed(feedData);
    if (feedContent) {
      console.log("Successfully extracted note content from feed API");
      return feedContent;
    }
  }

  // Strategy 2: Fallback to DOM extraction
  console.log("Falling back to DOM extraction for note content");
  return extractNoteContentFromDOM();
}

export async function extractMediaFromPage(): Promise<MediaItem[]> {
  console.log("🔍 Starting media extraction process...");

  // Strategy 1: Try to get media from cached feed API response
  const feedData = getCachedFeedData();
  if (feedData) {
    const feedMedia = parseMediaFromFeed(feedData);
    if (feedMedia.length > 0) {
      console.log("✅ Successfully extracted media from feed API", feedMedia);
      return feedMedia;
    } else {
      console.log(
        "⚠️ Feed API returned no media items, checking if note exists..."
      );
      // Check if we have the right note but no media
      const currentNoteId = extractNoteId();
      const noteItem = feedData.data.items.find(
        (item) => item.note_card.note_id === currentNoteId
      );
      if (noteItem) {
        console.log(
          `📝 Found note ${currentNoteId} in feed but no media extracted`
        );
        console.log(`🎥 Note type: ${noteItem.note_card.type}`);
        console.log(`🎬 Has video:`, !!noteItem.note_card.video);

        // If it's a video note but we couldn't extract, log more details
        if (noteItem.note_card.type === "video" && noteItem.note_card.video) {
          console.log("🔍 Video note detected, investigating stream data...");
          console.log("Video object:", noteItem.note_card.video);
        }
      } else {
        console.log(`❌ Note ${currentNoteId} not found in cached feed data`);
        console.log(
          "Available notes in feed:",
          feedData.data.items.map((item) => item.note_card.note_id)
        );
      }
    }
  }

  // Strategy 2: Try to fetch feed data directly if not cached
  console.log("🔄 Attempting to fetch fresh feed data...");
  const freshFeedData = await attemptDirectFeedFetch();
  if (freshFeedData) {
    const feedMedia = parseMediaFromFeed(freshFeedData);
    if (feedMedia.length > 0) {
      console.log(
        "✅ Successfully extracted media from fresh feed API",
        feedMedia
      );
      return feedMedia;
    }
  }

  // Strategy 3: Fallback to DOM extraction
  console.log("⚠️ Falling back to DOM extraction for media");
  return extractMediaFromPageDOM();
}

async function extractMediaFromPageDOM(): Promise<MediaItem[]> {
  const mediaItems: MediaItem[] = [];
  const seenUrls = new Set<string>();

  // Wait for content to load (especially important for detail pages with lazy loading)
  try {
    await waitForSelector(
      [
        ".img-container img",
        ".note-content .img-container img",
        ".swiper-slide img",
        "video",
      ],
      3000
    );

    // Small delay to ensure lazy loaded images are processed
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (_error) {
    console.log("Content loading timeout, proceeding with extraction");
  }

  // Get detail page specific images (avoiding avatars, icons, etc.)
  const imgEls = getCurrentNoteImgEls();
  const imageUrls = imgEls
    .map((img) => img.getAttribute("src"))
    .filter((src) => src?.includes("https://sns-webpic-qc.xhscdn.com/"))
    .filter((src) => src && !seenUrls.has(src));

  // Remove duplicates
  const uniqueImageUrls = Array.from(new Set(imageUrls)) as string[];

  uniqueImageUrls.forEach((url) => {
    seenUrls.add(url);

    // Get original quality image by removing size parameters
    const originalSrc = url.replace(/\?.*$/, "").replace(/_\d+x\d+\./, ".");

    // Determine extension based on URL
    let extension = "jpg";
    if (url.includes(".webp") || url.includes("webp")) extension = "webp";
    else if (url.includes(".png")) extension = "png";

    mediaItems.push({
      url: originalSrc,
      type: "image",
      filename: `image_${mediaItems.filter((item) => item.type === "image").length + 1}.${extension}`,
    });
  });

  // Extract video from current note (as fallback for DOM extraction)
  const videoUrl = getCurrentNoteVideoUrl();
  if (videoUrl && !seenUrls.has(videoUrl)) {
    seenUrls.add(videoUrl);
    console.log("Adding video from DOM detection:", videoUrl);
    console.log(
      "⚠️  Using DOM fallback - this may not work as well as Feed API"
    );
    mediaItems.push({
      url: videoUrl, // Keep URL as-is from DOM, don't modify parameters
      type: "video",
      filename: `video_1.mp4`,
    });
  }

  return mediaItems;
}

// Extract note ID from URL
function extractNoteId(): string | null {
  const match = window.location.pathname.match(/\/explore\/([a-f0-9]+)/);
  return match ? match[1] : null;
}

// Global cache for feed data (deprecated - now using Chrome storage)
// We keep this as a fallback for synchronous access
let cachedFeedData: FeedApiResponse | null = null;

// Parse note content from feed API data
function parseNoteContentFromFeed(
  feedData: FeedApiResponse
): NoteContent | null {
  try {
    const currentNoteId = extractNoteId();
    if (!currentNoteId) return null;

    const noteItem = feedData.data.items.find(
      (item) => item.note_card.note_id === currentNoteId
    );

    if (!noteItem || noteItem.model_type !== "note") return null;

    const noteCard = noteItem.note_card;
    return {
      title: noteCard.title || "无标题",
      author: noteCard.user.nickname || "未知作者",
      content: noteCard.desc || "无内容",
      url: window.location.href,
    };
  } catch (error) {
    console.error("Failed to parse note content from feed:", error);
    return null;
  }
}

// Parse media items from feed API data
function parseMediaFromFeed(feedData: FeedApiResponse): MediaItem[] {
  try {
    const currentNoteId = extractNoteId();
    if (!currentNoteId) return [];

    const noteItem = feedData.data.items.find(
      (item) => item.note_card.note_id === currentNoteId
    );

    if (!noteItem) return [];

    const mediaItems: MediaItem[] = [];
    const noteCard = noteItem.note_card;

    // Parse images
    if (noteCard.image_list && noteCard.image_list.length > 0) {
      noteCard.image_list.forEach((img, index) => {
        const highQualityUrl =
          img.info_list.find((info) => info.image_scene === "WB_DFT")?.url ||
          img.url_default;

        let extension = "webp";
        if (
          highQualityUrl.includes(".jpg") ||
          highQualityUrl.includes(".jpeg")
        ) {
          extension = "jpg";
        } else if (highQualityUrl.includes(".png")) {
          extension = "png";
        }

        mediaItems.push({
          url: highQualityUrl,
          type: "image" as const,
          filename: `image_${index + 1}.${extension}`,
        });
      });
    }

    // Parse video if it's a video note
    if (noteCard.type === "video" && noteCard.video?.media?.stream) {
      const stream = noteCard.video.media.stream;
      let bestVideoUrl = "";
      let selectedStream = null;

      console.log(
        "Processing video note, available streams:",
        Object.keys(stream)
      );
      console.log("h264 streams:", stream.h264?.length || 0);
      console.log("h265 streams:", stream.h265?.length || 0);

      // Prefer h264 streams for better compatibility, choose highest quality
      if (stream.h264 && stream.h264.length > 0) {
        // Sort by resolution (width * height) to get the highest quality
        const sortedH264 = stream.h264.sort(
          (a, b) => b.width * b.height - a.width * a.height
        );
        selectedStream = sortedH264[0];
        bestVideoUrl = selectedStream.master_url;
        console.log(
          `Selected h264 stream: ${selectedStream.width}x${selectedStream.height}`
        );
      } else if (stream.h265 && stream.h265.length > 0) {
        // Fallback to h265 if no h264 available
        const sortedH265 = stream.h265.sort(
          (a, b) => b.width * b.height - a.width * a.height
        );
        selectedStream = sortedH265[0];
        bestVideoUrl = selectedStream.master_url;
        console.log(
          `Selected h265 stream: ${selectedStream.width}x${selectedStream.height}`
        );
      }

      if (bestVideoUrl) {
        // IMPORTANT: Do NOT modify the video URL - keep all query parameters including sign and t
        console.log("Raw video URL from feed API:", bestVideoUrl);
        mediaItems.push({
          url: bestVideoUrl, // Keep the URL exactly as provided by the API
          type: "video" as const,
          filename: "video_1.mp4",
        });
        console.log(
          "✓ Added video to media items with original URL (preserving sign params)"
        );
      } else {
        console.log("✗ No video URL found in stream data");
      }
    } else {
      console.log(`Note is not a video type: ${noteCard.type}`);
      if (noteCard.type === "video" && !noteCard.video) {
        console.log("✗ Video note but no video data available");
      }
    }

    return mediaItems;
  } catch (error) {
    console.error("Failed to parse media from feed:", error);
    return [];
  }
}

// Set cached feed data (called from network listener and background script)
function setCachedFeedData(data: FeedApiResponse): void {
  console.log(
    "🔄 Caching feed data with",
    data.data?.items?.length || 0,
    "items"
  );

  // Update memory cache for synchronous access
  cachedFeedData = data;

  // Save to Chrome storage for persistence across script contexts
  if (browser?.storage?.local) {
    browser.storage.local
      .set({
        cachedFeedData: data,
        feedDataTimestamp: Date.now(),
      })
      .then(() => {
        console.log("💾 Feed data saved to Chrome storage");
      })
      .catch((error) => {
        console.error("❌ Failed to save feed data to Chrome storage:", error);
      });
  }

  // Log available notes for debugging
  if (data.data?.items) {
    data.data.items.forEach((item) => {
      if (item.model_type === "note") {
        console.log(
          `📝 Cached note: ${item.note_card.note_id} (type: ${item.note_card.type})`
        );
        if (item.note_card.type === "video" && item.note_card.video) {
          const streams = Object.keys(item.note_card.video.media?.stream || {});
          console.log(`🎥 Video streams available:`, streams);

          // Log first video URL for verification
          const h264Streams = item.note_card.video.media?.stream?.h264;
          if (h264Streams && h264Streams.length > 0) {
            console.log(`🔗 Sample video URL:`, h264Streams[0].master_url);
          }
        }
      }
    });
  }
}

// Get cached feed data (synchronous - uses memory cache only)
export function getCachedFeedData(): FeedApiResponse | null {
  if (cachedFeedData) {
    console.log(
      "✓ Using cached feed data from memory with",
      cachedFeedData.data?.items?.length || 0,
      "items"
    );
  } else {
    console.log(
      "✗ No cached feed data in memory - trying to load from Chrome storage..."
    );

    // Try to load from Chrome storage asynchronously
    loadCachedFeedDataFromStorage();
  }
  return cachedFeedData;
}

// Get cached feed data asynchronously from Chrome storage
export async function getCachedFeedDataAsync(): Promise<FeedApiResponse | null> {
  try {
    if (browser?.storage?.local) {
      const result = await browser.storage.local.get([
        "cachedFeedData",
        "feedDataTimestamp",
      ]);

      if (result.cachedFeedData) {
        const age = Date.now() - (result.feedDataTimestamp || 0);
        console.log(
          "✓ Using cached feed data from Chrome storage with",
          result.cachedFeedData.data?.items?.length || 0,
          "items (age:",
          age,
          "ms)"
        );

        // Update memory cache
        cachedFeedData = result.cachedFeedData;
        return result.cachedFeedData;
      }
    }

    console.log("✗ No cached feed data available in Chrome storage");
    return null;
  } catch (error) {
    console.error("❌ Error loading feed data from Chrome storage:", error);
    return null;
  }
}

// Load cached feed data from Chrome storage (fire-and-forget)
async function loadCachedFeedDataFromStorage(): Promise<void> {
  try {
    const data = await getCachedFeedDataAsync();
    if (data) {
      cachedFeedData = data;
    }
  } catch (error) {
    console.error("❌ Error loading cached feed data:", error);
  }
}

// API response interface for comments
interface ApiCommentResponse {
  data: {
    comments: Array<{
      id: string;
      content: string;
      create_time: number;
      like_count: string;
      ip_location: string;
      user_info: {
        user_id: string;
        nickname: string;
        image: string;
      };
      sub_comments: Array<{
        content: string;
        create_time: number;
        like_count: string;
        user_info: {
          nickname: string;
        };
      }>;
      sub_comment_count: string;
    }>;
  };
}

// Parse API comment data
function parseApiComments(apiResponse: ApiCommentResponse): CommentItem[] {
  if (!apiResponse?.data?.comments) return [];

  return apiResponse.data.comments.map((comment) => ({
    id: comment.id,
    author: comment.user_info.nickname,
    content: comment.content,
    createTime: new Date(comment.create_time),
    likeCount: parseInt(comment.like_count, 10) || 0,
    ipLocation: comment.ip_location,
    replies:
      comment.sub_comments?.map((subComment) => ({
        author: subComment.user_info.nickname,
        content: subComment.content,
        createTime: new Date(subComment.create_time),
        likeCount: parseInt(subComment.like_count, 10) || 0,
      })) || [],
  }));
}

// Fetch comments directly from API
async function fetchCommentsDirectly(noteId: string): Promise<CommentItem[]> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const xsecToken = urlParams.get("xsec_token");

    if (!xsecToken) {
      console.error("No xsec_token found in URL");
      return [];
    }

    const apiUrl = `https://edith.xiaohongshu.com/api/sns/web/v2/comment/page?note_id=${noteId}&cursor=&top_comment_id=&image_formats=jpg,webp,avif&xsec_token=${xsecToken}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Referer: window.location.href,
        "User-Agent": navigator.userAgent,
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: ApiCommentResponse = await response.json();
    return parseApiComments(data);
  } catch (error) {
    console.error("Direct API call failed:", error);
    return [];
  }
}

// Extract comments from DOM as fallback
function extractCommentsFromDOM(): CommentItem[] {
  const comments: CommentItem[] = [];

  const commentSelectors = [
    ".comment-item",
    ".comment",
    '[class*="comment"]:not([class*="count"])',
  ];

  commentSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);

    elements.forEach((element, index) => {
      const content = element.textContent?.trim();
      if (content && content.length > 5) {
        const authorEl = element.querySelector(
          '[class*="author"], [class*="user"], [class*="name"]'
        );
        const _timeEl = element.querySelector('[class*="time"]');

        comments.push({
          id: `dom_${index}`,
          author: authorEl?.textContent?.trim() || "匿名用户",
          content,
          createTime: new Date(),
          likeCount: 0,
          ipLocation: "",
          replies: [],
        });
      }
    });
  });

  return comments;
}

// Extract comments with multiple strategies
async function extractComments(): Promise<CommentItem[]> {
  const noteId = extractNoteId();
  if (!noteId) {
    console.error("Could not extract note ID from URL");
    return [];
  }

  // Strategy 1: Direct API call
  try {
    const apiComments = await fetchCommentsDirectly(noteId);
    if (apiComments && apiComments.length > 0) {
      console.log("Successfully extracted comments from API");
      return apiComments;
    }
  } catch (error) {
    console.error("API comment extraction failed:", error);
  }

  // Strategy 2: DOM extraction fallback
  console.log("Falling back to DOM extraction");
  return extractCommentsFromDOM();
}

// Enhanced note content extraction with word count and comments
async function extractExtendedNoteContent(): Promise<ExtendedNoteContent | null> {
  try {
    // Get basic content first
    const baseContent = extractNoteContent();
    if (!baseContent) return null;

    // Calculate word and character counts
    const wordCount = baseContent.content.replace(/\s+/g, "").length;
    const charCount = baseContent.content.length;

    // Extract comments
    const comments = await extractComments();

    return {
      ...baseContent,
      wordCount,
      charCount,
      comments,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to extract extended note content:", error);
    return null;
  }
}

// Attempt to fetch feed data directly (useful when cached data is not available)
async function attemptDirectFeedFetch(): Promise<FeedApiResponse | null> {
  try {
    const currentNoteId = extractNoteId();
    if (!currentNoteId) {
      console.log("❌ No note ID found, cannot fetch feed data");
      return null;
    }

    console.log(`🔍 Attempting to fetch feed data for note: ${currentNoteId}`);

    // Try to construct a feed API URL - this is experimental
    // The actual feed API might require specific parameters
    const _feedUrl = "/api/sns/web/v1/feed";

    console.log(
      "⚠️ Direct feed fetch not implemented - would require reverse engineering the exact API parameters"
    );
    console.log(
      "📝 Recommendation: Refresh the page to trigger natural feed API requests"
    );

    return null;
  } catch (error) {
    console.error("❌ Failed to fetch feed data directly:", error);
    return null;
  }
}

export { extractNoteContent, extractExtendedNoteContent, setCachedFeedData };
