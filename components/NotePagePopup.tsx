import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type DownloadProgress,
  MediaDownloader,
  type MediaItem,
  type NoteContent,
} from "@/utils/downloader";

interface NotePagePopupProps {
  noteId: string;
}

export const NotePagePopup: React.FC<NotePagePopupProps> = ({ noteId }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [noteContent, setNoteContent] = useState<NoteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const extractData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) throw new Error("No active tab found");

      // Extract media items
      const mediaResponse = await browser.tabs.sendMessage(tab.id, {
        action: "extractMedia",
      });

      if (mediaResponse.success) {
        setMediaItems(mediaResponse.mediaItems);
      } else {
        setError(mediaResponse.error || "Failed to extract media");
      }

      // Extract note content
      const contentResponse = await browser.tabs.sendMessage(tab.id, {
        action: "extractNoteContent",
      });

      if (contentResponse.success && contentResponse.noteContent) {
        setNoteContent(contentResponse.noteContent);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    extractData();
  }, [extractData]);

  const downloadSingle = async (media: MediaItem) => {
    const downloader = new MediaDownloader();
    const success = await downloader.downloadSingle(media);
    if (!success) {
      setError(`Failed to download ${media.filename}`);
    }
  };

  const downloadAll = async () => {
    if (mediaItems.length === 0) return;

    const downloader = new MediaDownloader(setDownloadProgress);
    const zipFilename = `xiaohongshu_${noteId}_media.zip`;

    const success = await downloader.downloadAsZip(mediaItems, zipFilename);
    if (!success) {
      setError("Failed to download ZIP file");
    }
  };

  const copyAuthor = async () => {
    if (!noteContent?.author) return;

    try {
      await navigator.clipboard.writeText(noteContent.author);
      setCopySuccess("author");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (_err) {
      setError("Failed to copy author name");
    }
  };

  const downloadTextContent = () => {
    if (!noteContent) return;

    const content = `标题: ${noteContent.title}\n作者: ${noteContent.author}\n\n内容:\n${noteContent.content}\n\n来源: ${noteContent.url}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xiaohongshu_${noteId}_content.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="note-popup">
        <div className="loading">正在检测媒体文件...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="note-popup">
        <div className="error">错误: {error}</div>
        <button type="button" onClick={extractData} className="retry-btn">
          重试
        </button>
      </div>
    );
  }

  const imageCount = mediaItems.filter((item) => item.type === "image").length;
  const videoCount = mediaItems.filter((item) => item.type === "video").length;

  return (
    <div className="note-popup">
      <div className="header">
        <h3>笔记内容</h3>
        <div className="media-count">
          {imageCount > 0 && <span>图片: {imageCount}</span>}
          {videoCount > 0 && <span>视频: {videoCount}</span>}
        </div>
      </div>

      {noteContent && (
        <div className="note-info">
          <div className="author-section">
            <span className="author-label">作者:</span>
            <span className="author-name">{noteContent.author}</span>
            <button
              type="button"
              onClick={copyAuthor}
              className="copy-btn"
              title="复制作者名"
            >
              {copySuccess === "author" ? "✓" : "📋"}
            </button>
          </div>
          <div className="content-actions">
            <button
              type="button"
              onClick={downloadTextContent}
              className="download-text-btn"
            >
              下载文本内容
            </button>
          </div>
        </div>
      )}

      {mediaItems.length === 0 ? (
        <div className="no-media">未找到媒体文件</div>
      ) : (
        <div className="media-section">
          <h4>媒体文件</h4>
          <div className="media-list">
            {mediaItems.map((media, index) => (
              <div key={`${media.url}-${index}`} className="media-item">
                <div className="media-info">
                  <span className="media-type">
                    {media.type === "image" ? "🖼️" : "🎥"}
                  </span>
                  <span className="media-name">{media.filename}</span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSingle(media)}
                  className="download-btn"
                >
                  下载
                </button>
              </div>
            ))}
          </div>

          <div className="media-actions">
            <button
              type="button"
              onClick={downloadAll}
              className="download-all-btn"
              disabled={downloadProgress?.status === "downloading"}
            >
              {downloadProgress?.status === "downloading"
                ? `下载中... ${downloadProgress.current}/${downloadProgress.total}`
                : "打包下载所有文件"}
            </button>
          </div>

          {downloadProgress && (
            <div className="progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                  }}
                />
              </div>
              <div className="progress-text">
                {downloadProgress.current} / {downloadProgress.total}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
