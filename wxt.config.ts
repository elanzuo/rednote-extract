import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Rednote Extract",
    description: "用于小红书（Xiaohongshu）内容的提取和下载",
    version: "0.0.1",
    permissions: ["activeTab", "downloads", "storage"],
    host_permissions: ["*://*.xiaohongshu.com/*"],
    action: {
      default_popup: "popup.html",
      default_title: "Rednote Extract",
    },
    icons: {
      16: "icons/icon-16x16.png",
      32: "icons/icon-32x32.png",
      48: "icons/icon-48x48.png",
      128: "icons/icon-128x128.png",
    },
  },
  modules: ["@wxt-dev/module-react"],
});
