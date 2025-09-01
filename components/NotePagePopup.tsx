import { Check, Copy, Image, MessageCircle, Video } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type DownloadProgress,
  type ExtendedNoteContent,
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
  const [extendedContent, setExtendedContent] =
    useState<ExtendedNoteContent | null>(null);
  const [showExtendedContent, setShowExtendedContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingExtended, setLoadingExtended] = useState(false);
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

  const extractExtendedData = useCallback(async () => {
    try {
      setLoadingExtended(true);
      setError(null);

      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) throw new Error("No active tab found");

      const response = await browser.tabs.sendMessage(tab.id, {
        action: "extractExtendedNoteContent",
      });

      if (response.success && response.extendedContent) {
        setExtendedContent(response.extendedContent);
        setShowExtendedContent(true);
      } else {
        setError(response.error || "Failed to extract extended content");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoadingExtended(false);
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

    const success = await downloader.downloadAsZip(
      mediaItems,
      zipFilename,
      extendedContent,
      noteContent
    );
    if (!success) {
      setError("Failed to download ZIP file");
    }
  };

  const copyTextContent = async () => {
    if (!noteContent?.content) return;

    try {
      const cleanContent = noteContent.content.replace(/#\S+/g, "").trim();
      await navigator.clipboard.writeText(cleanContent);
      setCopySuccess("content");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (_err) {
      setError("Failed to copy text content");
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

  const downloadExtendedContent = () => {
    if (!extendedContent) return;

    let content = `标题: ${extendedContent.title}\n作者: ${extendedContent.author}\n\n内容:\n${extendedContent.content}\n\n`;

    if (extendedContent.comments.length > 0) {
      content += `评论 (${extendedContent.comments.length} 条):\n`;
      content += `${"=".repeat(50)}\n\n`;

      extendedContent.comments.forEach((comment, index) => {
        content += `评论 ${index + 1}:\n`;
        content += `作者: ${comment.author}\n`;
        content += `内容: ${comment.content}\n`;
        content += `点赞: ${comment.likeCount}\n`;
        if (comment.ipLocation) content += `地区: ${comment.ipLocation}\n`;
        content += `时间: ${comment.createTime.toLocaleString()}\n`;

        if (comment.replies.length > 0) {
          content += `  回复 (${comment.replies.length} 条):\n`;
          comment.replies.forEach((reply, replyIndex) => {
            content += `    回复 ${replyIndex + 1}: ${reply.author} - ${reply.content}\n`;
          });
        }
        content += `\n${"-".repeat(30)}\n\n`;
      });
    }

    content += `\n来源: ${extendedContent.url}\n提取时间: ${extendedContent.extractedAt}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xiaohongshu_${noteId}_comments.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExtendedAsJson = () => {
    if (!extendedContent) return;

    const jsonString = JSON.stringify(extendedContent, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xiaohongshu_${noteId}_comments.json`;
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
        <h3 title={noteContent?.title}>
          {noteContent?.title && noteContent.title !== "无标题"
            ? noteContent.title.length > 20
              ? `${noteContent.title.slice(0, 20)}...`
              : noteContent.title
            : "笔记内容"}
        </h3>
        <div className="media-count">
          {imageCount > 0 && <span>图片: {imageCount}</span>}
          {videoCount > 0 && <span>视频: {videoCount}</span>}
          {noteContent?.content && (
            <span>字数: {noteContent.content.length}</span>
          )}
        </div>
      </div>

      {noteContent && (
        <div className="note-info">
          <div className="author-section">
            <span className="author-label">作者:</span>
            <span className="author-name">{noteContent.author}</span>
            <button
              type="button"
              onClick={copyTextContent}
              className="copy-btn"
              data-tooltip="复制文本内容"
            >
              {copySuccess === "content" ? (
                <Check size={16} color="#4caf50" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
          <div className="content-actions">
            <button
              type="button"
              onClick={downloadTextContent}
              className="download-text-btn"
              data-tooltip="包括标题、作者、内容、标签"
            >
              下载内容
            </button>
            <button
              type="button"
              onClick={
                showExtendedContent
                  ? () => setShowExtendedContent(false)
                  : extractExtendedData
              }
              className="extract-extended-btn"
              disabled={loadingExtended}
            >
              {loadingExtended
                ? "提取评论..."
                : showExtendedContent
                  ? "关闭评论"
                  : "提取评论"}
            </button>
          </div>
        </div>
      )}

      {extendedContent && showExtendedContent && (
        <div className="extended-content">
          <h4>评论信息</h4>
          <div className="extended-stats">
            <div className="stat-item">
              <MessageCircle size={16} />
              <span>评论: {extendedContent.comments.length}</span>
            </div>
          </div>

          {extendedContent.comments.length > 0 && (
            <div className="comments-section">
              <h5>评论预览</h5>
              <div className="comments-list">
                {extendedContent.comments.slice(0, 3).map((comment, _index) => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-author">{comment.author}</div>
                    <div className="comment-content">{comment.content}</div>
                    <div className="comment-meta">
                      {comment.likeCount > 0 && (
                        <span>👍 {comment.likeCount}</span>
                      )}
                      {comment.ipLocation && (
                        <span>📍 {comment.ipLocation}</span>
                      )}
                    </div>
                    {comment.replies.length > 0 && (
                      <div className="comment-replies">
                        {comment.replies.length} 条回复
                      </div>
                    )}
                  </div>
                ))}
                {extendedContent.comments.length > 3 && (
                  <div className="comments-more">
                    还有 {extendedContent.comments.length - 3} 条评论...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="extended-actions">
            <button
              type="button"
              onClick={downloadExtendedContent}
              className="download-extended-btn"
              data-tooltip="包括标题、作者、内容、标签和评论"
            >
              下载完整内容
            </button>
            <button
              type="button"
              onClick={downloadExtendedAsJson}
              className="download-json-btn"
              data-tooltip="下载所有评论，json格式"
            >
              下载JSON
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
                    {media.type === "image" ? (
                      <Image
                        size={16}
                        style={{ verticalAlign: "middle", marginRight: "4px" }}
                      />
                    ) : (
                      <Video
                        size={16}
                        style={{ verticalAlign: "middle", marginRight: "4px" }}
                      />
                    )}
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
