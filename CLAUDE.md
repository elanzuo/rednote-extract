# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RedNote Extract is a Chrome browser extension built for Xiaohongshu (RedNote) that provides media downloading and content extraction functionality. The extension is built using WXT framework with React 19, TypeScript, and Biome for code quality.

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

### Message Flow

1. Popup requests page info from content script
2. Content script detects page type and responds
3. Popup loads appropriate component based on page type
4. User interactions trigger content script functions via message passing

## Key Configuration

### WXT Configuration (`wxt.config.ts`)

- Manifest V3 extension
- Permissions: `activeTab`, `downloads`, `storage`
- Host permissions restricted to `*://*.xiaohongshu.com/*`
- React module integration

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
- All media extraction happens client-side through content script injection
- No external API calls - extracts content directly from DOM
