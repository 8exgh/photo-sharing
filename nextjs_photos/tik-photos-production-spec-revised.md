# Tik Photos: Current Implementation Specification

## Document Purpose

This specification documents the **actual current state** of the Tik Photos application as implemented. It serves as a reference for the existing architecture, data structures, and features.

> **Note:** The companion document `tik-photos-production-spec.md` describes a future vision for productionization with orchestration, staging environments, and self-service upgrades. This document describes what exists today.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture](#2-architecture)
3. [Data Structure](#3-data-structure)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Admin Features](#6-admin-features)
7. [Docker Configuration](#7-docker-configuration)
8. [Environment Variables](#8-environment-variables)
9. [Current Deployment](#9-current-deployment)

---

## 1. Application Overview

### 1.1 What It Is

Tik Photos is a personal photo-sharing application with the following characteristics:

- **Framework:** Next.js 15 with App Router and API routes
- **Language:** TypeScript with React 19
- **Styling:** Tailwind CSS v4
- **Storage:** File-based (no database)
- **Users:** Single administrator + guests via access keys
- **Purpose:** Upload, organize, and share photos via revocable links

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **Album Management** | Create, edit, delete albums organized by year |
| **Group Support** | Albums can be organized into groups within a year |
| **Photo Upload** | Images auto-optimized to max 1920px, converted to JPEG |
| **Thumbnails** | Auto-generated 300x300 smart-cropped thumbnails |
| **Video Links** | Embed YouTube/Vimeo links within albums |
| **Access Keys** | Revocable share links for guest access |
| **Admin Dashboard** | Full management interface at `/admin` |

### 1.3 Current Hosting

- Running in Docker container on homelab
- Exposed via Cloudflare tunnel
- Private GitHub repository

---

## 2. Architecture

### 2.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 15 Application                                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Frontend (React 19 + Tailwind CSS)                         ││
│  │  • /albums - Public album viewing                           ││
│  │  • /admin - Admin dashboard                                 ││
│  │  • /admin/login - Authentication                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  API Routes (/api/*)                                        ││
│  │  • Albums, Groups, Photos, Videos CRUD                      ││
│  │  • Authentication (login/logout)                            ││
│  │  • Access key management                                    ││
│  │  • Image/thumbnail serving                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Middleware                                                 ││
│  │  • Session validation                                       ││
│  │  • Route protection (/albums/*, /admin/*)                   ││
│  │  • Access key → session conversion                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  File Storage                                               ││
│  │  • /app/data/albums/ - Photos and metadata                  ││
│  │  • /app/data/access-keys.json - Access keys                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Libraries

| Library | Purpose |
|---------|---------|
| `next` (15.x) | Framework |
| `react` (19.x) | UI library |
| `iron-session` | Encrypted session cookies |
| `sharp` | Image processing |
| `tailwindcss` (4.x) | Styling |

---

## 3. Data Structure

### 3.1 Directory Layout

```
/app/data/                              # Docker volume mount
├── access-keys.json                    # Access key storage
└── albums/
    └── [YEAR]/                         # e.g., 2024, 2025
        ├── [ALBUM_NAME]/               # Ungrouped album
        │   ├── album.json              # Album metadata
        │   ├── thumbnails/             # Generated thumbnails
        │   │   └── [FILENAME].jpg
        │   └── [FILENAME].jpg          # Photo files
        │
        └── [GROUP_ID]/                 # Group folder
            ├── group.json              # Group metadata
            └── [ALBUM_NAME]/           # Album within group
                ├── album.json
                ├── thumbnails/
                └── [PHOTOS]
```

### 3.2 Album Metadata (album.json)

```typescript
{
  "name": string,              // Display name
  "location": string,          // Location text
  "description": string,       // Short description
  "text": string,              // Multi-line content (markdown supported)
  "created": string,           // ISO timestamp
  "displayOrder": number,      // Sort order (optional)
  "photos": [
    {
      "filename": string,      // e.g., "1754969132580-photo.jpg"
      "title": string,         // Display title
      "uploadDate": string,    // ISO timestamp
      "description": string,   // Photo description
      "text": string,          // Multi-line content
      "width": number,         // Pixels (optional)
      "height": number,        // Pixels (optional)
      "fileSize": number       // Bytes (optional)
    }
  ],
  "videos": [
    {
      "url": string,           // YouTube/Vimeo URL
      "title": string,         // Display title
      "addedDate": string,     // ISO timestamp
      "text": string           // Multi-line content
    }
  ]
}
```

### 3.3 Group Metadata (group.json)

```typescript
{
  "id": string,                // Group identifier (folder name)
  "displayName": string,       // Display name
  "description": string,       // Group description
  "created": string,           // ISO timestamp
  "albumCount": number,        // Number of albums in group
  "displayOrder": number,      // Sort order (optional)
  "nestedAlbums": string[]     // Album names (optional, for UI hints)
}
```

### 3.4 Access Keys (access-keys.json)

```typescript
[
  {
    "key": string,             // Random key string
    "created": string,         // ISO timestamp
    "expires": string          // ISO timestamp (optional)
  }
]
```

### 3.5 Photo Filename Convention

Photos are renamed on upload with a timestamp prefix:
```
[UNIX_TIMESTAMP]-[ORIGINAL_FILENAME].jpg
```

Example: `1754969132580-vacation_photo.jpg`

This prevents naming collisions and provides chronological ordering.

---

## 4. API Endpoints

### 4.1 Authentication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Admin login (password) |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/validate-key` | Validate access key |

### 4.2 Albums

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/albums` | List all years |
| GET | `/api/albums?year=YYYY` | List albums for year |
| POST | `/api/albums` | Create new album |
| GET | `/api/albums/[year]/[album]` | Get album details |
| PUT | `/api/albums/[year]/[album]` | Update album metadata |
| DELETE | `/api/albums/[year]/[album]` | Delete album |
| PUT | `/api/albums/[year]/[album]/text` | Update album text only |
| POST | `/api/albums/[year]/[album]/upload` | Upload photo |
| POST | `/api/albums/reorder` | Reorder albums |
| POST | `/api/albums/move` | Move album to/from group |

### 4.3 Photos

| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/api/albums/[year]/[album]/photos/[filename]` | Update photo text |
| DELETE | `/api/albums/[year]/[album]/photos/[filename]` | Delete photo |
| POST | `/api/albums/[year]/[album]/photos/[filename]/rotate` | Rotate photo 90° |
| POST | `/api/albums/[year]/[album]/photos/[filename]/move` | Move to another album |

### 4.4 Videos

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/albums/[year]/[album]/videos` | Add video link |
| DELETE | `/api/albums/[year]/[album]/videos` | Remove video link |
| PUT | `/api/albums/[year]/[album]/videos/[index]` | Update video metadata |

### 4.5 Groups

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/groups?year=YYYY` | List groups for year |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/[year]/[groupId]` | Get group details |
| PUT | `/api/groups/[year]/[groupId]` | Update group |
| DELETE | `/api/groups/[year]/[groupId]` | Delete group (must be empty) |
| POST | `/api/groups/reorder` | Reorder groups |

### 4.6 Unified Items

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/items?year=YYYY` | Get groups + albums unified list |
| POST | `/api/items/reorder` | Reorder any item (group or album) |

### 4.7 File Serving

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/images/[...path]` | Serve full-size images |
| GET | `/api/thumbnails/[...path]` | Serve thumbnails |

### 4.8 Admin & System

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/access-keys` | List access keys (admin) |
| POST | `/api/access-keys` | Create access key |
| DELETE | `/api/access-keys` | Delete access key |
| GET | `/api/build-info` | Get version/build info |
| GET/POST | `/api/admin/migrate-photo-metadata` | Backfill photo dimensions |

---

## 5. Authentication & Authorization

### 5.1 Session Management

- Uses `iron-session` library with encrypted cookies
- Cookie name: `photo-album-session`
- Session duration: 7 days
- HttpOnly, Secure (production), SameSite: lax

### 5.2 Authorization Levels

| Level | Access | How to Obtain |
|-------|--------|---------------|
| **Admin** | Full access to all features | Login with password at `/admin/login` |
| **Guest** | View-only access to albums | Access via URL with `?key=...` parameter |
| **Public** | None | Redirected to `/access-denied` |

### 5.3 Access Key Flow

1. Admin creates access key in dashboard
2. System generates URL: `https://domain.com/albums?key=abc123...`
3. Guest visits URL
4. Middleware validates key and creates session
5. Key is removed from URL (clean redirect)
6. Guest can browse albums until session expires or key is revoked

### 5.4 Session Data Structure

```typescript
{
  isAuthenticated: boolean,    // User has valid session
  isAdmin: boolean,            // User is admin
  accessKey?: string,          // Access key (if guest)
  validatedAt?: string         // Last validation timestamp
}
```

---

## 6. Admin Features

### 6.1 Dashboard (`/admin`)

The admin dashboard provides:

**Album Management:**
- Create new albums (with year, name, location, description)
- View all albums organized by year
- Edit album metadata and text
- Upload photos (drag & drop or click)
- Delete albums

**Photo Management:**
- View all photos in album
- Rotate photos (90° clockwise)
- Move photos between albums
- Delete photos
- Edit photo text/description

**Video Management:**
- Add YouTube/Vimeo links
- Edit video titles and text
- Remove videos

**Group Management:**
- Create groups within years
- Move albums into/out of groups
- Edit group metadata
- Reorder groups and albums

**Access Keys:**
- View all active keys
- Generate new keys (with optional expiry)
- Copy shareable URLs
- Revoke keys

### 6.2 Build Info Display

The admin footer shows:
- Git commit hash (short)
- Git branch name
- Build number (from CI/CD)
- Build timestamp
- "DEV MODE" indicator (if not production)

### 6.3 Album Edit Page (`/admin/albums/[year]/[album]/edit`)

Dedicated page for editing:
- Album name, location, description
- Moving album to different year
- Renaming album folder

---

## 7. Docker Configuration

### 7.1 Dockerfile (Multi-stage)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
# Installs dependencies, builds Next.js
# Captures git info as build args

# Runtime stage
FROM node:20-alpine AS runner
# Minimal production image
# Uses su-exec for privilege dropping
# Sets DATA_DIR and ALBUMS_DIR
# Exposes port 3000
```

### 7.2 Build Arguments

| Arg | Purpose |
|-----|---------|
| `NEXT_PUBLIC_GIT_HASH` | Git commit SHA |
| `NEXT_PUBLIC_GIT_BRANCH` | Git branch name |
| `NEXT_PUBLIC_BUILD_NUMBER` | CI/CD build number |
| `NEXT_PUBLIC_BUILD_TIME` | Build timestamp |

### 7.3 Volume Mount

```
./data:/app/data
```

This persists:
- All albums and photos
- Access keys
- Any other application data

---

## 8. Environment Variables

### 8.1 Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Session encryption key (32+ chars) | `your-secure-random-string...` |
| `ADMIN_PASSWORD` | Admin login password | `secure-password` |

### 8.2 Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `DATA_DIR` | Data directory path | `data` |
| `ALBUMS_DIR` | Albums directory path | `public/albums` |

### 8.3 Build-time (Auto-detected)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_GIT_HASH` | Git commit SHA |
| `NEXT_PUBLIC_GIT_BRANCH` | Branch name |
| `NEXT_PUBLIC_BUILD_NUMBER` | CI build number |
| `NEXT_PUBLIC_BUILD_TIME` | Build timestamp |

---

## 9. Current Deployment

### 9.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│  Homelab Server                                                  │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Docker          │    │  Cloudflare Tunnel               │  │
│  │  ┌────────────┐  │    │  (cloudflared daemon)            │  │
│  │  │ tik-photos │◄─┼────┼──────────────────────────────────┤  │
│  │  │   :3000    │  │    │                                  │  │
│  │  └────────────┘  │    └──────────────────────────────────┘  │
│  │        │         │                    │                      │
│  │        ▼         │                    │                      │
│  │  ./data volume   │                    │                      │
│  └──────────────────┘                    │                      │
│                                          │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Cloudflare  │
                                    │   (DNS/CDN)  │
                                    └──────────────┘
                                           │
                                           ▼
                                    photos.domain.com
```

### 9.2 Update Process (Current)

Updates are manual:

1. Developer pushes to GitHub
2. GitHub Actions builds Docker image
3. Admin SSHs to server
4. Pulls new image: `docker pull ...`
5. Restarts container: `docker compose up -d`

### 9.3 Backup (Current)

No automated backup system. Manual options:
- Copy `./data` directory
- Docker volume backup

---

## Appendix A: File Reference

### Source Structure

```
src/
├── app/
│   ├── admin/                 # Admin pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── login/page.tsx     # Login form
│   │   ├── groups/page.tsx    # Group management
│   │   └── albums/[year]/[album]/
│   │       ├── page.tsx       # Album view
│   │       └── edit/page.tsx  # Album edit
│   ├── albums/
│   │   ├── page.tsx           # Album list (guest view)
│   │   └── [year]/[album]/page.tsx  # Album view (guest)
│   ├── api/                   # API routes (see Section 4)
│   ├── access-denied/         # Error page
│   ├── page.tsx               # Home (redirects)
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Tailwind styles
├── lib/
│   ├── albums.ts              # Album CRUD operations
│   ├── groups.ts              # Group operations
│   ├── access-keys.ts         # Access key management
│   ├── session.ts             # Session helpers
│   ├── logger.ts              # JSON logging
│   └── security.ts            # Input validation
├── types/
│   └── index.ts               # TypeScript interfaces
└── middleware.ts              # Route protection
```

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js config (captures git info) |
| `tailwind.config.ts` | Tailwind configuration |
| `tsconfig.json` | TypeScript configuration |
| `Dockerfile` | Docker build instructions |
| `docker-compose.yml` | Container orchestration |
| `.env.local` | Local environment variables |

---

## Appendix B: Comparison to Vision Spec

The original `tik-photos-production-spec.md` describes a future vision. Here's what's **not yet implemented**:

| Vision Feature | Status |
|----------------|--------|
| Orchestrator service | Not implemented |
| Staging environment | Not implemented |
| Self-service upgrade UI | Not implemented |
| releases.json manifest | Not implemented |
| Schema versioning (`.version` file) | Not implemented |
| Numbered migrations | Not implemented (only photo metadata migration exists) |
| Caddy reverse proxy | Using Cloudflare tunnel instead |
| Automated backups | Not implemented |
| Rollback system | Not implemented |
| Debug export bundle | Not implemented |
| Health check endpoint | Partial (`/api/build-info` exists) |
| Public release repository | Using private repo |
| VPS deployment | Using homelab |

---

## Appendix C: Logging

The application uses JSON-formatted logging with:

- Timestamps (ISO 8601)
- IP addresses (from headers)
- Request metadata
- Error details with stack traces

Log output goes to stdout/stderr (Docker logs).

Example:
```json
{"ts":"2025-01-15T10:30:45.123Z","tag":"POST /api/auth/login","ip":"192.168.1.100","msg":"Login attempt"}
```
