import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
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

// Declare chrome global for types
declare const chrome: {
  runtime: {
    getURL: (path: string) => string;
  };
};

// Custom event types
interface CustomEventDetail {
  url: string;
  method: string;
  data: FeedApiResponse;
  timestamp: number;
}

interface Message {
  action: string;
}

interface Tab {
  id?: number;
  url?: string;
}

interface WindowWithState extends Window {
  __INITIAL_STATE__?: unknown;
  __NUXT__?: unknown;
  __APOLLO_STATE__?: unknown;
}

interface MessageWithData {
  action: string;
  data?: unknown;
}

interface MessageSender {
  tab?: Tab;
  frameId?: number;
  url?: string;
}

interface ResponseData {
  success?: boolean;
  pageInfo?: PageInfo;
  mediaItems?: MediaItem[];
  noteContent?: NoteContent | null;
  extendedContent?: ExtendedNoteContent | null;
  error?: string;
}

export default defineContentScript({
  matches: ["*://*.xiaohongshu.com/*"],
  runAt: "document_start",
  main() {
    // 使用一个特殊的前缀避免被小红书的代码干扰
    const logPrefix = "[REDNOTE-EXTRACT]";
    const _safeLog = (...args: unknown[]) => {
      try {
        console.log(logPrefix, ...args);
      } catch (_e) {
        // 如果 console.log 被劫持，尝试其他方法
        console.info(logPrefix, ...args);
      }
    };

    // 立即注入 main world script 进行网络拦截
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("injected.js");
      script.onload = function () {
        (this as HTMLScriptElement).remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (_error) {
      // Silently ignore injection errors
    }

    // 初始化与 background script 的通信
    if (window.location.pathname.includes("/explore/")) {
      browser.runtime
        .sendMessage({ action: "getFeedData" })
        .then((response) => {
          if (response?.success) {
            setCachedFeedData(response.data);
          } else {
            // 如果没有缓存数据，等待一段时间后再次尝试
            setTimeout(() => {
              browser.runtime
                .sendMessage({ action: "getFeedData" })
                .then((retryResponse) => {
                  if (retryResponse?.success) {
                    setCachedFeedData(retryResponse.data);
                  }
                })
                .catch(() => {
                  // Silently ignore errors
                });
            }, 3000);
          }
        })
        .catch(() => {
          // Silently ignore errors
        });
    }

    // 监听来自 background script 的消息
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "feedDataUpdated") {
        try {
          if (message.data?.success && message.data.data?.items?.length > 0) {
            setCachedFeedData(message.data);
            sendResponse({ success: true });
          }
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
      }

      if (message.action === "feedApiDetected") {
        // 对于 POST 请求，等待页面更新后再检查
        setTimeout(() => {
          try {
            const _windowData =
              (window as WindowWithState).__INITIAL_STATE__ ||
              (window as WindowWithState).__NUXT__ ||
              (window as WindowWithState).__APOLLO_STATE__;
            // 可以在这里添加窗口数据解析逻辑
          } catch (_error) {
            // Silently ignore errors
          }
        }, 1000);

        sendResponse({ success: true });
      }

      return true;
    });

    // 监听来自 main world script 的 feed 数据拦截
    window.addEventListener("feedDataIntercepted", (event: Event) => {
      const customEvent = event as CustomEvent<CustomEventDetail>;
      try {
        const { data, timestamp } = customEvent.detail;
        if (data.success && data.data?.items?.length > 0) {
          setCachedFeedData(data);

          // 同时保存到 Chrome storage
          browser.storage.local
            .set({
              cachedFeedData: data,
              feedDataTimestamp: timestamp,
              interceptMethod: "main-world",
            })
            .catch(() => {
              // Silently ignore storage errors
            });
        }
      } catch (_error) {
        // Silently ignore errors
      }
    });

    // 监听自定义事件（用于手动注入）
    window.addEventListener("manualFeedDataInjection", (event: Event) => {
      const customEvent = event as CustomEvent<FeedApiResponse>;
      try {
        const feedData = customEvent.detail;
        if (feedData.success && feedData.data?.items?.length > 0) {
          setCachedFeedData(feedData);
        }
      } catch (_error) {
        // Silently ignore errors
      }
    });

    // Listen for messages from popup
    browser.runtime.onMessage.addListener(
      (
        message: Message,
        _sender: MessageSender,
        sendResponse: (response?: ResponseData) => void
      ) => {
        if (message.action === "getPageInfo") {
          const pageInfo: PageInfo = detectPageType(window.location.href);
          sendResponse({ pageInfo });
        }

        // 手动注入 Feed 数据的支持
        if (message.action === "injectFeedData") {
          try {
            const feedData = (message as MessageWithData)
              .data as FeedApiResponse;
            if (feedData.success && feedData.data?.items?.length > 0) {
              setCachedFeedData(feedData);
              sendResponse({
                success: true,
              });
            } else {
              sendResponse({
                success: false,
                error: "Invalid feed data format",
              });
            }
          } catch (error) {
            sendResponse({ success: false, error: (error as Error).message });
          }
        }

        if (message.action === "extractMedia") {
          (async () => {
            try {
              // Wait a bit for any pending network requests
              await new Promise((resolve) => setTimeout(resolve, 500));

              const mediaItems: MediaItem[] = await extractMediaFromPage();
              sendResponse({ success: true, mediaItems });
            } catch (error) {
              sendResponse({ success: false, error: (error as Error).message });
            }
          })();
        }

        if (message.action === "extractNoteContent") {
          try {
            const noteContent: NoteContent | null = extractNoteContent();
            sendResponse({ success: true, noteContent });
          } catch (error) {
            sendResponse({ success: false, error: (error as Error).message });
          }
        }

        if (message.action === "extractExtendedNoteContent") {
          (async () => {
            try {
              const extendedContent: ExtendedNoteContent | null =
                await extractExtendedNoteContent();
              sendResponse({ success: true, extendedContent });
            } catch (error) {
              sendResponse({ success: false, error: (error as Error).message });
            }
          })();
        }

        // Return true to indicate we'll respond asynchronously
        return true;
      }
    );
  },
});
