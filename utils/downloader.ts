import JSZip from "jszip";

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
      const response = await fetch(media.url);
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.filename;
      a.click();

      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Download failed:", error);
      return false;
    }
  }

  async downloadAsZip(
    mediaItems: MediaItem[],
    zipFilename: string
  ): Promise<boolean> {
    try {
      const zip = new JSZip();
      const total = mediaItems.length;
      let current = 0;

      this.downloadCallback?.({ current, total, status: "downloading" });

      // Download all media items and add to zip
      for (const media of mediaItems) {
        try {
          const response = await fetch(media.url);
          const blob = await response.blob();
          zip.file(media.filename, blob);

          current++;
          this.downloadCallback?.({ current, total, status: "downloading" });
        } catch (error) {
          console.error(`Failed to download ${media.filename}:`, error);
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

// Get current note video (similar to RedConvert approach)
function getCurrentNoteVideoUrl(): string | null {
  // Direct video element
  let videoEl = document.querySelector("video") as HTMLVideoElement;
  if (videoEl?.src) return videoEl.src;

  // Video with source element
  if (videoEl) {
    const source = videoEl.querySelector("source") as HTMLSourceElement;
    if (source?.src) return source.src;
  }

  // Video containers
  videoEl = document.querySelector(
    ".video-container video, .note-video video"
  ) as HTMLVideoElement;
  if (videoEl?.src) return videoEl.src;
  if (videoEl) {
    const source = videoEl.querySelector("source") as HTMLSourceElement;
    if (source?.src) return source.src;
  }

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
  // Strategy 1: Try to get media from cached feed API response
  const feedData = getCachedFeedData();
  if (feedData) {
    const feedMedia = parseMediaFromFeed(feedData);
    if (feedMedia.length > 0) {
      console.log("Successfully extracted media from feed API");

      // Still try to get video from DOM as feed might not include video data
      const videoUrl = getCurrentNoteVideoUrl();
      if (videoUrl) {
        feedMedia.push({
          url: videoUrl,
          type: "video",
          filename: `video_1.mp4`,
        });
      }

      return feedMedia;
    }
  }

  // Strategy 2: Fallback to DOM extraction
  console.log("Falling back to DOM extraction for media");
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

  // Extract video from current note
  const videoUrl = getCurrentNoteVideoUrl();
  if (videoUrl && !seenUrls.has(videoUrl)) {
    seenUrls.add(videoUrl);
    mediaItems.push({
      url: videoUrl,
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

// Global cache for feed data
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

    if (!noteItem || !noteItem.note_card.image_list) return [];

    return noteItem.note_card.image_list.map((img, index) => {
      const highQualityUrl =
        img.info_list.find((info) => info.image_scene === "WB_DFT")?.url ||
        img.url_default;

      let extension = "webp";
      if (highQualityUrl.includes(".jpg") || highQualityUrl.includes(".jpeg")) {
        extension = "jpg";
      } else if (highQualityUrl.includes(".png")) {
        extension = "png";
      }

      return {
        url: highQualityUrl,
        type: "image" as const,
        filename: `image_${index + 1}.${extension}`,
      };
    });
  } catch (error) {
    console.error("Failed to parse media from feed:", error);
    return [];
  }
}

// Set cached feed data (called from network listener)
function setCachedFeedData(data: FeedApiResponse): void {
  cachedFeedData = data;
}

// Get cached feed data
function getCachedFeedData(): FeedApiResponse | null {
  return cachedFeedData;
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

export { extractNoteContent, extractExtendedNoteContent, setCachedFeedData };
