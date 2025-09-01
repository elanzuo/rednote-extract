import {
  type ExtendedNoteContent,
  extractExtendedNoteContent,
  extractMediaFromPage,
  extractNoteContent,
  type MediaItem,
  type NoteContent,
} from "@/utils/downloader";
import { detectPageType, type PageInfo } from "@/utils/pageDetector";

export default defineContentScript({
  matches: ["*://*.xiaohongshu.com/*"],
  main() {
    console.log("RedNote Extract content script loaded");

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
