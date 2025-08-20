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

// Extract note content from detail page
function extractNoteContent(): NoteContent | null {
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

export async function extractMediaFromPage(): Promise<MediaItem[]> {
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

export { extractNoteContent };
