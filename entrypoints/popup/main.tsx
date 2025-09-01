import { AlertCircle, Circle, FileText, User } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { NotePagePopup } from "@/components/NotePagePopup";
import { ProfilePagePopup } from "@/components/ProfilePagePopup";
import { type PageInfo, PageType } from "@/utils/pageDetector";
import "./style.css";

const App: React.FC = () => {
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectCurrentPage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) throw new Error("No active tab found");

      // Check if we're on a Xiaohongshu domain
      if (!tab.url || !tab.url.includes("xiaohongshu.com")) {
        setPageInfo({ type: PageType.UNSUPPORTED });
        return;
      }

      const response = await browser.tabs.sendMessage(tab.id, {
        action: "getPageInfo",
      });
      setPageInfo(response.pageInfo);
    } catch (err) {
      // Handle connection errors more gracefully
      if (
        err instanceof Error &&
        err.message.includes("Could not establish connection")
      ) {
        setPageInfo({ type: PageType.UNSUPPORTED });
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to detect page type"
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectCurrentPage();
  }, [detectCurrentPage]);

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">正在检测页面...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="popup-container">
        <div className="error">
          <div className="error-message">错误: {error}</div>
          <button
            type="button"
            onClick={detectCurrentPage}
            className="retry-btn"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!pageInfo) {
    return (
      <div className="popup-container">
        <div className="error">无法获取页面信息</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (pageInfo.type) {
      case PageType.NOTE_DETAIL:
        return pageInfo.noteId ? (
          <NotePagePopup noteId={pageInfo.noteId} />
        ) : null;

      case PageType.USER_PROFILE:
        return pageInfo.userId ? (
          <ProfilePagePopup userId={pageInfo.userId} />
        ) : null;

      default:
        return (
          <div className="unsupported-page">
            <div className="unsupported-icon">
              <AlertCircle size={32} color="#f44336" />
            </div>
            <div className="unsupported-text">
              <h3>不支持的页面</h3>
              <p>请访问小红书的笔记详情页或个人主页来使用此插件。</p>
            </div>
            <div className="supported-pages">
              <h4>支持的页面类型:</h4>
              <ul>
                <li>
                  <FileText
                    size={16}
                    style={{ verticalAlign: "middle", marginRight: "4px" }}
                  />
                  笔记详情页 (/explore/...)
                </li>
                <li>
                  <User
                    size={16}
                    style={{ verticalAlign: "middle", marginRight: "4px" }}
                  />
                  个人主页 (/user/profile/...)
                </li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="logo">
          <Circle size={20} fill="#f44336" color="#f44336" />
        </div>
        <div className="title">Rednote Extract</div>
      </div>

      <div className="popup-content">{renderContent()}</div>

      <div className="popup-footer">
        <div className="version">v0.0.1</div>
      </div>
    </div>
  );
};

// Mount the React app
const container = document.getElementById("root");
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
}
