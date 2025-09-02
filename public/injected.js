// Main world script - injected into page's JavaScript context
// This runs in the same context as the website's JavaScript

(() => {
  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Override fetch
  window.fetch = async function (...args) {
    const [url, options] = args;

    if (
      url &&
      typeof url === "string" &&
      url.includes("/api/sns/web/v1/feed")
    ) {
      try {
        const response = await originalFetch.apply(this, args);
        const clonedResponse = response.clone();

        // Read response data
        const data = await clonedResponse.json();

        // Send data to content script via custom event
        window.dispatchEvent(
          new CustomEvent("feedDataIntercepted", {
            detail: {
              url,
              method: options?.method || "GET",
              data: data,
              timestamp: Date.now(),
            },
          })
        );

        return response;
      } catch (_error) {
        return originalFetch.apply(this, args);
      }
    }

    return originalFetch.apply(this, args);
  };

  // Override XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._method = method;
    this._url = url;

    if (
      url &&
      typeof url === "string" &&
      url.includes("/api/sns/web/v1/feed")
    ) {
      // Set up response handler
      this.addEventListener("readystatechange", function () {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const data = JSON.parse(this.responseText);

            // Send data to content script via custom event
            window.dispatchEvent(
              new CustomEvent("feedDataIntercepted", {
                detail: {
                  url,
                  method,
                  data: data,
                  timestamp: Date.now(),
                },
              })
            );
          } catch (_error) {
            // Silently ignore parsing errors
          }
        }
      });
    }

    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    return originalXHRSend.apply(this, args);
  };
})();
