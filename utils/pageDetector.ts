export enum PageType {
  NOTE_DETAIL = "note_detail",
  USER_PROFILE = "user_profile",
  OTHER = "other",
  UNSUPPORTED = "unsupported",
}

export interface PageInfo {
  type: PageType;
  url: string;
  noteId?: string;
  userId?: string;
}

export function detectPageType(url: string): PageInfo {
  const urlObj = new URL(url);

  // Check if it's a Xiaohongshu domain
  if (!urlObj.hostname.includes("xiaohongshu.com")) {
    return { type: PageType.OTHER, url };
  }

  // Note detail page pattern: /explore/{noteId}
  const noteDetailMatch = urlObj.pathname.match(/^\/explore\/([a-f0-9]+)/);
  if (noteDetailMatch) {
    return {
      type: PageType.NOTE_DETAIL,
      url,
      noteId: noteDetailMatch[1],
    };
  }

  // User profile page pattern: /user/profile/{userId}
  const profileMatch = urlObj.pathname.match(/^\/user\/profile\/([a-f0-9]+)/);
  if (profileMatch) {
    return {
      type: PageType.USER_PROFILE,
      url,
      userId: profileMatch[1],
    };
  }

  return { type: PageType.OTHER, url };
}

export function isXiaohongshuPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes("xiaohongshu.com");
  } catch {
    return false;
  }
}
