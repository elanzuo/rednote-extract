import {
  type ExtendedNoteContent,
  extractExtendedNoteContent,
  extractMediaFromPage,
  extractNoteContent,
  type FeedApiResponse,
  type MediaItem,
  type NoteContent,
  setCachedFeedData,
} from "@/utils/downloader";
import { detectPageType, type PageInfo } from "@/utils/pageDetector";

export default defineContentScript({
  matches: ["*://*.xiaohongshu.com/*"],
  main() {
    console.log("RedNote Extract content script loaded");

    // Intercept feed API requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Check if this is a feed API request
      const url = args[0] as string;
      if (url.includes("/api/sns/web/v1/feed") && response.ok) {
        try {
          // Clone the response to avoid consuming it
          const clonedResponse = response.clone();
          const feedData: FeedApiResponse = await clonedResponse.json();

          if (feedData.success && feedData.data?.items?.length > 0) {
            console.log("Intercepted feed API response, caching data");
            setCachedFeedData(feedData);
          }
        } catch (error) {
          console.error("Failed to parse feed API response:", error);
        }
      }

      return response;
    };

    // Listen for messages from popup
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "getPageInfo") {
        const pageInfo: PageInfo = detectPageType(window.location.href);
        sendResponse({ pageInfo });
      }

      if (message.action === "extractMedia") {
        (async () => {
          try {
            const mediaItems: MediaItem[] = await extractMediaFromPage();
            sendResponse({ success: true, mediaItems });
          } catch (error) {
            console.error("Failed to extract media:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();
      }

      if (message.action === "extractNoteContent") {
        try {
          const noteContent: NoteContent | null = extractNoteContent();
          sendResponse({ success: true, noteContent });
        } catch (error) {
          console.error("Failed to extract note content:", error);
          sendResponse({ success: false, error: error.message });
        }
      }

      if (message.action === "extractExtendedNoteContent") {
        (async () => {
          try {
            const extendedContent: ExtendedNoteContent | null =
              await extractExtendedNoteContent();
            sendResponse({ success: true, extendedContent });
          } catch (error) {
            console.error("Failed to extract extended note content:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();
      }

      // Return true to indicate we'll respond asynchronously
      return true;
    });
  },
});
