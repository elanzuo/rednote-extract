# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RedNote Extract is a Chrome browser extension built for Xiaohongshu (RedNote) that provides comprehensive media downloading and content extraction functionality. The extension supports basic content extraction (title, author, text) as well as extended analysis features (word count, comment extraction). Built using WXT framework with React 19, TypeScript, and Biome for code quality.

## Development Commands

### Essential Development Commands

```bash
pnpm run dev           # Start development mode with hot reload
pnpm run build         # Build production version for distribution
pnpm run zip           # Create distribution zip file

# Code Quality (use these before committing)
pnpm run check         # Run Biome linter and formatter checks
pnpm run check:fix     # Auto-fix Biome issues
pnpm run lint          # Run linter only
pnpm run format        # Run formatter only
```

### Extension Loading

1. Run `pnpm run build` to generate the `.output/chrome-mv3` directory
2. Load the `.output/chrome-mv3` directory as an unpacked extension in Chrome

## Architecture

### Core Components Structure

- **Content Script** (`entrypoints/content.ts`): Injected into Xiaohongshu pages, handles message passing between popup and page content
- **Popup Interface** (`entrypoints/popup/`): React-based UI for the extension popup
- **Page-specific Components**:
  - `NotePagePopup.tsx`: Handles note detail pages (`/explore/{noteId}`)
  - `ProfilePagePopup.tsx`: Handles user profile pages (future feature)

### Utility System

- **Page Detection** (`utils/pageDetector.ts`): Identifies page types using URL patterns
  - `NOTE_DETAIL`: `/explore/{noteId}` pattern
  - `USER_PROFILE`: `/user/profile/{userId}` pattern
  - `OTHER`: Unsupported pages
- **Media Extraction** (`utils/downloader.ts`): Core logic for extracting and downloading media/content
  - `extractNoteContent()`: Basic content extraction (title, author, text) with Feed API priority
  - `extractExtendedNoteContent()`: Enhanced extraction with word count and comments
  - `extractComments()`: Multi-strategy comment extraction (API + DOM fallback)
  - `extractMediaFromPage()`: Multi-layer media extraction strategy (Feed API → Direct API → DOM)

### Data Extraction Strategy

The system uses a multi-layer extraction approach with automatic fallback:

1. **Feed API Interception (Primary)**: Intercepts official Xiaohongshu Feed API responses
   - **Network Interception**: `public/injected.js` runs in main world context to intercept fetch/XHR
   - **Background Monitoring**: `entrypoints/background.ts` uses webRequest API to detect API calls
   - **Data Caching**: Chrome Storage + memory cache for cross-tab data sharing
   - **High Quality Media**: Direct access to original quality images and video streams

2. **Direct API Calls (Secondary)**: Direct requests to Xiaohongshu APIs
   - **Comment API**: `/api/sns/web/v2/comment/page` for detailed comment data
   - **Authentication**: Uses page xsec_token for API access
   - **Structured Data**: Returns complete comment metadata (likes, replies, location)

3. **DOM Parsing (Fallback)**: Traditional DOM-based content extraction
   - **Multiple Selectors**: Robust CSS selector strategies for different page layouts
   - **Lazy Loading Support**: Waits for dynamic content to load
   - **Content Filtering**: Intelligently filters out navigation and UI elements

### Message Flow

1. **Initialization**: Content script injects main world script for API interception
2. **Data Interception**: Main world script captures Feed API responses and caches data
3. **Popup Communication**: Popup requests data through content script message passing
4. **Multi-strategy Extraction**: System attempts extraction methods in priority order:
   - `extractMedia`: Extract media files (Feed API → Direct API → DOM)
   - `extractNoteContent`: Basic text content extraction (Feed API → DOM)
   - `extractExtendedNoteContent`: Enhanced extraction with comments (Direct API → DOM)

## Key Configuration

### WXT Configuration (`wxt.config.ts`)

- Manifest V3 extension
- Permissions: `activeTab`, `downloads`, `storage`, `webRequest`
- Host permissions restricted to `*://*.xiaohongshu.com/*`
- React module integration
- Main world script injection: `public/injected.js` for network interception

### Code Style (Biome)

- 2-space indentation
- 80 character line width
- Double quotes for JSX
- Semicolons required
- ES5 trailing commas

### TypeScript Setup

- Strict mode enabled
- Path alias `@/*` points to project root
- React JSX transform
- DOM and ES2020 lib support

## Development Notes

- Extension only works on Xiaohongshu domains for security
- Uses modern React 19 features and TypeScript strict mode
- **Network Interception Architecture**: Dual-layer interception (main world + background) for reliable data capture
- **Feed API Priority**: Primary extraction method uses intercepted official API data for highest quality results
- **Graceful Degradation**: Three-tier fallback system ensures functionality even when API interception fails
- **Cross-context Communication**: Complex message passing between main world, content script, background, and popup
- **Chrome Storage Integration**: Persistent caching with timestamp tracking for optimal performance
- Comment extraction uses official comment API with xsec_token authentication
- Extended content extraction includes word count analysis and structured comment metadata
