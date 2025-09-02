import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

// Type definitions for Chrome API parameters
interface WebRequestDetails {
  url: string;
  method: string;
  statusCode?: number;
}

interface TabInfo {
  id?: number;
  url?: string;
}

interface MessageSender {
  tab?: TabInfo;
  frameId?: number;
  url?: string;
}

// Message types
interface BaseMessage {
  action: string;
}

interface GetFeedDataMessage extends BaseMessage {
  action: "getFeedData";
}

interface ClearFeedCacheMessage extends BaseMessage {
  action: "clearFeedCache";
}

type BackgroundMessage = GetFeedDataMessage | ClearFeedCacheMessage;

// Response types
interface SuccessResponse {
  success: true;
  data?: unknown;
  timestamp?: number;
}

interface ErrorResponse {
  success: false;
  error: string;
}

type MessageResponse = SuccessResponse | ErrorResponse;

// Storage data types
interface StorageData {
  cachedFeedData?: unknown;
  feedDataTimestamp?: number;
  lastFeedRequestUrl?: string;
  lastFeedRequestTime?: number;
  lastFeedRequestMethod?: string;
}

export default defineBackground({
  main() {
    // Listen for webRequest events
    if (browser.webRequest?.onBeforeRequest) {
      browser.webRequest.onBeforeRequest.addListener(
        (details: WebRequestDetails) => {
          // Check if this is a feed API request
          if (
            details.url.includes("/api/sns/web/v1/feed") ||
            details.url.includes("edith.xiaohongshu.com/api/sns/web/v1/feed")
          ) {
            // Store request info for later use
            browser.storage.local.set({
              lastFeedRequestUrl: details.url,
              lastFeedRequestTime: Date.now(),
              lastFeedRequestMethod: details.method,
            });
          }

          return {}; // Don't block the request
        },
        {
          urls: [
            "*://*.xiaohongshu.com/*",
            "*://*.xhscdn.com/*",
            "*://edith.xiaohongshu.com/*",
          ],
        },
        ["requestBody"]
      );
    }

    // Listen for completed requests - simplified for POST requests
    if (browser.webRequest?.onCompleted) {
      browser.webRequest.onCompleted.addListener(
        async (details: WebRequestDetails) => {
          if (
            details.url.includes("/api/sns/web/v1/feed") &&
            details.statusCode === 200 &&
            details.method === "POST"
          ) {
            // Notify content script that feed API was called
            browser.tabs.query(
              { url: "*://*.xiaohongshu.com/*" },
              (tabs: TabInfo[]) => {
                tabs.forEach((tab: TabInfo) => {
                  if (tab.id) {
                    browser.tabs
                      .sendMessage(tab.id, {
                        action: "feedApiDetected",
                        url: details.url,
                        method: details.method,
                        timestamp: Date.now(),
                      })
                      .catch(() => {
                        // Ignore errors if content script not ready
                      });
                  }
                });
              }
            );
          }
        },
        {
          urls: ["*://*.xiaohongshu.com/*", "*://edith.xiaohongshu.com/*"],
        }
      );
    }

    // Listen for messages from content scripts
    browser.runtime.onMessage.addListener(
      (
        message: BackgroundMessage,
        _sender: MessageSender,
        sendResponse: (response?: MessageResponse) => void
      ) => {
        if (message.action === "getFeedData") {
          browser.storage.local.get(
            ["cachedFeedData", "feedDataTimestamp"],
            (result: StorageData) => {
              if (result.cachedFeedData) {
                sendResponse({
                  success: true,
                  data: result.cachedFeedData,
                  timestamp: result.feedDataTimestamp,
                });
              } else {
                sendResponse({
                  success: false,
                  error: "No cached feed data available",
                });
              }
            }
          );
          return true;
        }

        if (message.action === "clearFeedCache") {
          browser.storage.local.remove(
            ["cachedFeedData", "feedDataTimestamp"],
            () => {
              sendResponse({ success: true });
            }
          );
          return true;
        }

        return false;
      }
    );
  },
});
