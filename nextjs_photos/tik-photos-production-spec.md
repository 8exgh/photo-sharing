# Tik Photos: Productionization Specification

## Document Purpose

This specification outlines the changes required to take an existing personal photo-sharing application from a development environment to a production-ready, self-hostable solution with built-in upgrade capabilities.

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Goals & Constraints](#2-goals--constraints)
3. [Production Architecture](#3-production-architecture)
4. [Data Structure & Versioning](#4-data-structure--versioning)
5. [Upgrade System](#5-upgrade-system)
6. [Orchestrator Service](#6-orchestrator-service)
7. [Admin UI Changes](#7-admin-ui-changes)
8. [Reverse Proxy Configuration](#8-reverse-proxy-configuration)
9. [Public Release Repository](#9-public-release-repository)
10. [Initial Deployment Procedure](#10-initial-deployment-procedure)
11. [Debug & Troubleshooting Features](#11-debug--troubleshooting-features)
12. [Security Considerations](#12-security-considerations)

---

## 1. Project Context

### 1.1 Application Overview

Tik Photos is a personal photo-sharing application with the following characteristics:

- **Framework:** Next.js with backend API routes
- **Users:** Single administrator (Tik)
- **Purpose:** Upload, organize, and share photos via revocable links
- **Storage:** File-based (no database), photos stored as compressed JPEGs (max 1920x1080)
- **Expected scale:** 100-500 photos per year, 1-3 GB total over many years

### 1.2 Current State

- Running in development on a homelab via Cloudflare tunnel
- Private GitHub repository
- Docker containerized

### 1.3 Target State

- Self-hosted on a VPS controlled by the end user (Tik)
- Staging and production environments
- Self-service upgrade system via admin UI
- Developer (Sean) has no access to production server or data
- Reliable, rollback-capable upgrade path

---

## 2. Goals & Constraints

### 2.1 Primary Goals

| Goal | Description |
|------|-------------|
| **Self-service upgrades** | User can upgrade via UI without SSH or technical knowledge |
| **Staging verification** | User can preview upgrades against real data before promoting to production |
| **Data safety** | Upgrades cannot destroy data; rollback is always possible |
| **Blind support** | Developer can troubleshoot via exported debug info without server access |
| **Independence** | Once deployed, app has zero dependency on developer's infrastructure |

### 2.2 Constraints

| Constraint | Rationale |
|------------|-----------|
| Developer has no production access | Privacy, liability, user data ownership |
| File-based storage (no database) | Existing architecture, simplicity |
| Single-user (non-multi-tenant) | Scope of application |
| VPS hosting (not home NAS) | Security isolation (ref: Next.js middleware vulnerability) |

---

## 3. Production Architecture

### 3.1 Infrastructure Overview

**Recommended Provider:** Hetzner CPX21 (3 vCPU, 4GB RAM, 80GB disk, ~€8.50/mo)

```
┌─────────────────────────────────────────────────────────────────┐
│  VPS Host                                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Docker Network: tik-network                             │   │
│  │                                                          │   │
│  │  ┌─────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │  caddy  │  │tik-production│  │ tik-staging  │        │   │
│  │  │  :80    │  │    :3000     │  │    :3001     │        │   │
│  │  │  :443   │  │  (internal)  │  │  (internal)  │        │   │
│  │  └────┬────┘  └──────────────┘  └──────────────┘        │   │
│  │       │                                                  │   │
│  │       │       ┌──────────────────────────────┐          │   │
│  │       │       │     tik-orchestrator         │          │   │
│  │       │       │     (internal only)          │          │   │
│  │       │       │     - docker.sock access     │          │   │
│  │       │       └──────────────────────────────┘          │   │
│  │       │                                                  │   │
│  └───────┼──────────────────────────────────────────────────┘   │
│          │                                                       │
│          │ exposed to internet                                   │
│          ▼                                                       │
│   photos.example.com ──────▶ tik-production                     │
│   staging.example.com ─────▶ tik-staging (basic auth protected) │
│                                                                  │
│  Volumes:                                                        │
│   /opt/tik/data/production/                                     │
│   /opt/tik/data/staging/                                        │
│   /opt/tik/backups/                                             │
│   /opt/tik/caddy_data/                                          │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Container Inventory

| Container | Purpose | External Access | Special Mounts |
|-----------|---------|-----------------|----------------|
| `caddy` | Reverse proxy, TLS termination | Ports 80, 443 | Caddyfile, cert storage |
| `tik-production` | Production app instance | None (via Caddy) | `/data/production` |
| `tik-staging` | Staging app instance | None (via Caddy) | `/data/staging` |
| `tik-orchestrator` | Upgrade coordinator | None (internal API) | docker.sock, `/data`, `/backups` |

### 3.3 Docker Compose Configuration

```yaml
# /opt/tik/docker-compose.yml

version: "3.8"

services:
  caddy:
    image: caddy:2-alpine
    container_name: tik-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - tik-network

  tik-production:
    image: ghcr.io/OWNER/tik-photos:${PRODUCTION_VERSION:-latest}
    container_name: tik-production
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - INSTANCE_TYPE=production
      - ORCHESTRATOR_URL=http://tik-orchestrator:4000
    volumes:
      - ./data/production:/app/data
    networks:
      - tik-network

  tik-staging:
    image: ghcr.io/OWNER/tik-photos:${STAGING_VERSION:-latest}
    container_name: tik-staging
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - INSTANCE_TYPE=staging
      - ORCHESTRATOR_URL=http://tik-orchestrator:4000
    volumes:
      - ./data/staging:/app/data
    networks:
      - tik-network

  tik-orchestrator:
    image: ghcr.io/OWNER/tik-orchestrator:latest
    container_name: tik-orchestrator
    restart: unless-stopped
    environment:
      - RELEASES_URL=https://raw.githubusercontent.com/OWNER/tik-photos-releases/main/releases.json
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/data
      - ./backups:/backups
      - ./docker-compose.yml:/compose/docker-compose.yml
      - ./.env:/compose/.env
    networks:
      - tik-network

networks:
  tik-network:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
```

---

## 4. Data Structure & Versioning

### 4.1 Directory Structure

```
/opt/tik/
├── docker-compose.yml
├── Caddyfile
├── .env                          # PRODUCTION_VERSION, STAGING_VERSION
├── data/
│   ├── production/
│   │   ├── .version              # e.g., "3"
│   │   ├── .instance             # "production"
│   │   ├── 2024/
│   │   │   └── albums/
│   │   │       └── {album-uuid}/
│   │   │           ├── meta.json
│   │   │           └── photos/
│   │   │               └── {photo-uuid}.jpg
│   │   ├── 2025/
│   │   │   └── albums/...
│   │   └── links/
│   │       └── {link-uuid}.json
│   └── staging/
│       └── (same structure)
└── backups/
    ├── production-2025-01-15T10-30-00Z.tar.gz
    └── production-2025-01-20T14-22-00Z.tar.gz
```

### 4.2 Version File

**Location:** `/data/.version`

**Content:** Single integer representing the data schema version.

```
3
```

### 4.3 Instance Marker

**Location:** `/data/.instance`

**Content:** Either `production` or `staging`. Used by app to determine which UI elements to show.

### 4.4 Migration Naming Convention

Migrations are shipped inside the app container at `/app/migrations/`:

```
/app/migrations/
├── 001_initial.js
├── 002_add_link_expiry.js
├── 003_reorganize_albums.js
└── migrate.js                    # Migration runner
```

Each migration file exports:

```javascript
module.exports = {
  version: 2,  // Target version after this migration
  description: "Add link expiry field to all link configs",
  
  async up(dataPath) {
    // Migration logic
    // Modify files in dataPath
  },
  
  async verify(dataPath) {
    // Return true if migration succeeded
    // Return false or throw if verification fails
  }
};
```

### 4.5 Migration Execution

Migrations run automatically on container startup before the app begins serving requests.

**Entrypoint logic:**

```
Container starts
    │
    ▼
Read /data/.version (default to 0 if missing)
    │
    ▼
Compare to APP_SCHEMA_VERSION (built into image)
    │
    ├── Versions match → Start app normally
    │
    └── Data version < App version
            │
            ▼
        Run migrations sequentially (001, 002, ...)
            │
            ▼
        Each migration:
          1. Execute up()
          2. Execute verify()
          3. If verify fails → Exit with error code
          4. If verify passes → Continue
            │
            ▼
        Update /data/.version
            │
            ▼
        Start app normally
```

---

## 5. Upgrade System

### 5.1 Release Manifest

Hosted in the public release repository as `releases.json`:

```json
{
  "latest": "1.2.0",
  "releases": [
    {
      "version": "1.2.0",
      "date": "2025-01-15",
      "schemaVersion": 3,
      "image": "ghcr.io/OWNER/tik-photos:v1.2.0",
      "notes": "### New Features\n- Bulk delete photos\n- Album sorting options\n\n### Fixes\n- Fixed link expiry timezone bug",
      "breaking": false
    },
    {
      "version": "1.1.0",
      "date": "2025-01-02",
      "schemaVersion": 2,
      "image": "ghcr.io/OWNER/tik-photos:v1.1.0",
      "notes": "### New Features\n- Link expiry dates\n- Admin activity log",
      "breaking": false
    },
    {
      "version": "1.0.0",
      "date": "2024-12-15",
      "schemaVersion": 1,
      "image": "ghcr.io/OWNER/tik-photos:v1.0.0",
      "notes": "Initial release",
      "breaking": false
    }
  ]
}
```

### 5.2 Upgrade Flow: Deploy to Staging

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "Deploy v1.2.0 to Staging" in Production Admin UI │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Pre-flight Checks                                      │
├─────────────────────────────────────────────────────────────────┤
│  □ Is another upgrade already in progress? → Abort             │
│  □ Pull image: docker pull ghcr.io/.../tik-photos:v1.2.0       │
│    └── Image pull failed? → Abort with error                   │
│  □ Check disk space: need 2x current data size free            │
│    └── Insufficient? → Abort with error                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Snapshot Production State                              │
├─────────────────────────────────────────────────────────────────┤
│  Record:                                                        │
│    • file_count = $(find /data/production -type f | wc -l)     │
│    • total_size = $(du -sb /data/production | cut -f1)         │
│    • file_tree  = $(find /data/production -type f | sort)      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Copy Production → Staging                              │
├─────────────────────────────────────────────────────────────────┤
│  rm -rf /data/staging/*                                         │
│  cp -rp /data/production/* /data/staging/                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Verify Copy Integrity                                  │
├─────────────────────────────────────────────────────────────────┤
│  Compare against snapshot:                                      │
│    • staging_file_count == production_file_count               │
│    • staging_total_size == production_total_size               │
│    • diff file_tree (must be empty)                            │
│                                                                 │
│  ┌─────────────────────────────┬──────────────────────────────┐│
│  │  All checks pass            │  Any check fails             ││
│  │          │                  │          │                   ││
│  │          ▼                  │          ▼                   ││
│  │  Continue to Step 5         │  ABORT                       ││
│  │                             │  • Log detailed mismatch     ││
│  │                             │  • Clean up staging          ││
│  │                             │  • Return error to UI        ││
│  └─────────────────────────────┴──────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Update Staging Container                               │
├─────────────────────────────────────────────────────────────────┤
│  docker stop tik-staging                                        │
│  Update .env: STAGING_VERSION=v1.2.0                           │
│  docker compose up -d tik-staging                               │
│                                                                 │
│  (Container starts, runs migrations against /data/staging)     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Health Check                                           │
├─────────────────────────────────────────────────────────────────┤
│  Wait for staging to be healthy:                                │
│    • Poll GET http://tik-staging:3001/api/health               │
│    • Timeout after 60 seconds → Abort, rollback staging        │
│                                                                 │
│  Return success to UI                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Upgrade Flow: Promote to Production

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "Promote to Production" in Staging Admin UI       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Pre-flight Checks                                      │
├─────────────────────────────────────────────────────────────────┤
│  □ Confirm staging is running newer version than production    │
│  □ Confirm staging is healthy                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Backup Production                                      │
├─────────────────────────────────────────────────────────────────┤
│  TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)                      │
│  tar -czf /backups/production-$TIMESTAMP.tar.gz /data/production│
│                                                                 │
│  Verify backup:                                                 │
│    • File exists and size > 0                                  │
│    • tar -tzf (can list contents)                              │
│                                                                 │
│  Keep last 5 backups, delete older                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Stop Production (downtime starts)                      │
├─────────────────────────────────────────────────────────────────┤
│  docker stop tik-production                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Update Production Container                            │
├─────────────────────────────────────────────────────────────────┤
│  Update .env: PRODUCTION_VERSION=v1.2.0                        │
│  docker compose up -d tik-production                            │
│                                                                 │
│  (Container starts, runs migrations against /data/production)  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Health Check (downtime ends when healthy)             │
├─────────────────────────────────────────────────────────────────┤
│  Wait for production to be healthy:                             │
│    • Poll GET http://tik-production:3000/api/health            │
│    • Timeout after 60 seconds → ALERT (manual intervention)    │
│                                                                 │
│  Return success to UI                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Rollback Flow

Available from Admin UI if production is in a bad state:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Select Backup                                          │
├─────────────────────────────────────────────────────────────────┤
│  List available backups in /backups/                            │
│  User selects which backup to restore                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Stop Production                                        │
├─────────────────────────────────────────────────────────────────┤
│  docker stop tik-production                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Restore Data                                           │
├─────────────────────────────────────────────────────────────────┤
│  rm -rf /data/production/*                                      │
│  tar -xzf /backups/{selected-backup}.tar.gz -C /                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Restore Previous Container Version                     │
├─────────────────────────────────────────────────────────────────┤
│  Read .version from restored data                               │
│  Look up corresponding app version in releases.json            │
│  Update .env: PRODUCTION_VERSION={matching-version}            │
│  docker compose up -d tik-production                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Orchestrator Service

### 6.1 Overview

The orchestrator is a minimal, stable service that coordinates upgrades. It should rarely need updates itself.

**Design principles:**

- Dumb as possible; all migration logic lives in app images
- Stateless; reads state from filesystem and Docker
- No UI; exposes internal API only, called by the app containers

### 6.2 API Endpoints

All endpoints are internal (only accessible within Docker network).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/releases` | Fetch and cache releases.json |
| GET | `/api/status` | Current state of both instances |
| POST | `/api/staging/deploy` | Deploy version to staging |
| POST | `/api/production/promote` | Promote staging to production |
| POST | `/api/production/rollback` | Rollback production to backup |
| GET | `/api/backups` | List available backups |

### 6.3 Status Response

```json
{
  "production": {
    "version": "1.1.0",
    "schemaVersion": 2,
    "healthy": true,
    "dataSize": "1.2 GB",
    "photoCount": 2847
  },
  "staging": {
    "version": "1.2.0",
    "schemaVersion": 3,
    "healthy": true,
    "dataSize": "1.2 GB",
    "photoCount": 2847,
    "pendingPromotion": true
  },
  "available": {
    "latest": "1.2.0",
    "current": "1.1.0",
    "updateAvailable": true,
    "releases": [...]
  },
  "backups": [
    {
      "filename": "production-2025-01-15T10-30-00Z.tar.gz",
      "timestamp": "2025-01-15T10:30:00Z",
      "size": "1.1 GB"
    }
  ]
}
```

### 6.4 Deploy to Staging Request/Response

**Request:**

```json
POST /api/staging/deploy
{
  "version": "1.2.0"
}
```

**Success Response:**

```json
{
  "success": true,
  "steps": [
    { "step": "preflight", "status": "completed" },
    { "step": "snapshot", "status": "completed", "fileCount": 2847, "size": 1288490188 },
    { "step": "copy", "status": "completed" },
    { "step": "verify", "status": "completed" },
    { "step": "deploy", "status": "completed" },
    { "step": "healthcheck", "status": "completed" }
  ]
}
```

**Failure Response:**

```json
{
  "success": false,
  "failedStep": "verify",
  "error": {
    "type": "file_count_mismatch",
    "expected": 2847,
    "actual": 2831,
    "details": "16 files missing after copy"
  },
  "steps": [
    { "step": "preflight", "status": "completed" },
    { "step": "snapshot", "status": "completed", "fileCount": 2847, "size": 1288490188 },
    { "step": "copy", "status": "completed" },
    { "step": "verify", "status": "failed", "error": "..." }
  ]
}
```

### 6.5 Host-Level Escape Hatch

For the rare case the orchestrator itself needs updating, place a script on the host:

```bash
#!/bin/bash
# /opt/tik/update-orchestrator.sh

set -e

echo "Pulling latest orchestrator image..."
docker pull ghcr.io/OWNER/tik-orchestrator:latest

echo "Restarting orchestrator..."
cd /opt/tik
docker compose up -d tik-orchestrator

echo "Done. Orchestrator updated."
```

---

## 7. Admin UI Changes

### 7.1 System Status Section

Add to the admin dashboard a "System" section showing:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️  System Status                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current Version: v1.1.0                                        │
│  Data Version: 2                                                │
│  Photos: 2,847 │ Albums: 43 │ Active Links: 12                 │
│  Storage Used: 1.2 GB                                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🔔 Update Available: v1.2.0                              │ │
│  │                                                           │ │
│  │  [View Release Notes]  [Deploy to Staging]                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Release Notes Modal

When "View Release Notes" is clicked, show all release notes between current and latest:

```
┌─────────────────────────────────────────────────────────────────┐
│  Release Notes                                            [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  v1.2.0 (January 15, 2025)                                     │
│  ─────────────────────────                                     │
│  New Features                                                   │
│  • Bulk delete photos                                          │
│  • Album sorting options                                       │
│                                                                 │
│  Fixes                                                          │
│  • Fixed link expiry timezone bug                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  v1.1.0 (January 2, 2025) ✓ Installed                          │
│  ─────────────────────────                                     │
│  New Features                                                   │
│  • Link expiry dates                                           │
│  • Admin activity log                                          │
│                                                                 │
│                                              [Close]           │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Deploy Progress Modal

When deploying to staging, show real-time progress:

```
┌─────────────────────────────────────────────────────────────────┐
│  Deploying v1.2.0 to Staging                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Pre-flight checks passed                                    │
│  ✓ Production snapshot recorded (2,847 files, 1.2 GB)          │
│  ✓ Data copied to staging                                      │
│  ✓ Copy verified                                               │
│  ◐ Starting staging with v1.2.0...                             │
│  ○ Health check                                                │
│                                                                 │
│  ──────────────────────────────────────────────────────────── │
│  [Cancel]                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Staging Environment Banner

When accessing staging, show prominent banner:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  STAGING ENVIRONMENT                                        │
│  Running v1.2.0 (Production: v1.1.0)                           │
│  This is a preview with a copy of production data.             │
│                                                                 │
│  [Promote to Production]    [Discard Staging]                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Promote Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Promote to Production                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You are about to upgrade production to v1.2.0.                │
│                                                                 │
│  This will:                                                     │
│  • Create a backup of production data                          │
│  • Apply any pending data migrations                           │
│  • Cause ~30 seconds of downtime                               │
│                                                                 │
│  ⚠️  Warning: If you uploaded new photos to production since   │
│  deploying to staging, they are NOT included in this preview.  │
│  Consider whether you need to re-deploy to staging first.      │
│                                                                 │
│                        [Cancel]  [Promote to Production]       │
└─────────────────────────────────────────────────────────────────┘
```

### 7.6 Rollback Section

In production admin, under System:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 Backup & Rollback                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Available Backups:                                             │
│                                                                 │
│  • Jan 15, 2025 10:30 AM (1.1 GB) ─ before v1.2.0 upgrade     │
│    [Rollback to this backup]                                   │
│                                                                 │
│  • Jan 10, 2025 3:45 PM (1.0 GB) ─ before v1.1.0 upgrade      │
│    [Rollback to this backup]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Reverse Proxy Configuration

### 8.1 Caddyfile

```
# /opt/tik/Caddyfile

{
    email {$ADMIN_EMAIL}
}

photos.example.com {
    reverse_proxy tik-production:3000
    
    # Optional: security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}

staging.example.com {
    # Basic auth to prevent public access
    basicauth {
        {$STAGING_USER} {$STAGING_PASSWORD_HASH}
    }
    
    reverse_proxy tik-staging:3001
}
```

### 8.2 Environment Variables

Add to `/opt/tik/.env`:

```bash
ADMIN_EMAIL=tik@example.com
STAGING_USER=tik
STAGING_PASSWORD_HASH=$2a$14$... # Generate with: caddy hash-password
```

---

## 9. Public Release Repository

### 9.1 Repository Structure

Separate public repository: `tik-photos-releases`

```
tik-photos-releases/
├── README.md                     # Deployment instructions
├── LICENSE                       # License (restrictive or permissive)
├── releases.json                 # Release manifest (see 5.1)
├── docker-compose.yml            # Ready-to-use compose file
├── Caddyfile.example             # Template Caddyfile
├── .env.example                  # Template environment file
├── install.sh                    # First-time setup script
└── releases/
    ├── v1.0.0/
    │   ├── CHANGELOG.md
    │   └── source.tar.gz         # Optional: source snapshot
    ├── v1.1.0/
    │   ├── CHANGELOG.md
    │   └── source.tar.gz
    └── v1.2.0/
        ├── CHANGELOG.md
        └── source.tar.gz
```

### 9.2 README.md Contents

The README should include:

1. **Overview** — What this app does
2. **Requirements** — Docker, docker compose, VPS with 2GB+ RAM
3. **Quick Start** — Run install.sh, configure domain, done
4. **Configuration** — Environment variables reference
5. **Upgrading** — "Use the Admin UI, or see manual upgrade steps"
6. **Troubleshooting** — Common issues
7. **Manual Rollback** — Emergency steps if UI is inaccessible

### 9.3 Install Script

```bash
#!/bin/bash
# install.sh - First-time setup

set -e

echo "=== Tik Photos Installer ==="
echo ""

# Check requirements
command -v docker >/dev/null 2>&1 || { echo "Docker required but not installed. Aborting."; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Docker Compose required but not installed. Aborting."; exit 1; }

# Get configuration
read -p "Production domain (e.g., photos.example.com): " PROD_DOMAIN
read -p "Staging domain (e.g., staging.example.com): " STAGING_DOMAIN
read -p "Admin email (for SSL certificates): " ADMIN_EMAIL
read -p "Staging password: " -s STAGING_PASS
echo ""

# Create directory structure
INSTALL_DIR="/opt/tik"
mkdir -p $INSTALL_DIR/{data/production,data/staging,backups}

# Generate staging password hash
STAGING_HASH=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$STAGING_PASS")

# Download compose and config files
curl -sL https://raw.githubusercontent.com/OWNER/tik-photos-releases/main/docker-compose.yml -o $INSTALL_DIR/docker-compose.yml

# Create .env
cat > $INSTALL_DIR/.env << EOF
PRODUCTION_VERSION=v1.0.0
STAGING_VERSION=v1.0.0
ADMIN_EMAIL=$ADMIN_EMAIL
STAGING_USER=admin
STAGING_PASSWORD_HASH=$STAGING_HASH
EOF

# Create Caddyfile
cat > $INSTALL_DIR/Caddyfile << EOF
{
    email $ADMIN_EMAIL
}

$PROD_DOMAIN {
    reverse_proxy tik-production:3000
}

$STAGING_DOMAIN {
    basicauth {
        admin $STAGING_HASH
    }
    reverse_proxy tik-staging:3001
}
EOF

# Initialize data version
echo "1" > $INSTALL_DIR/data/production/.version
echo "production" > $INSTALL_DIR/data/production/.instance
echo "1" > $INSTALL_DIR/data/staging/.version
echo "staging" > $INSTALL_DIR/data/staging/.instance

# Pull images and start
cd $INSTALL_DIR
docker compose pull
docker compose up -d

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Production: https://$PROD_DOMAIN"
echo "Staging:    https://$STAGING_DOMAIN"
echo ""
echo "Default admin login will be created on first access."
echo ""
```

---

## 10. Initial Deployment Procedure

### 10.1 Prerequisites

1. Hetzner account (or other VPS provider)
2. Domain with DNS control
3. SSH key pair

### 10.2 Step-by-Step

1. **Provision VPS**
   - Hetzner CPX21 (3 vCPU, 4GB RAM, 80GB)
   - Ubuntu 24.04 LTS
   - Add SSH key during creation

2. **Configure DNS**
   - A record: `photos.example.com` → VPS IP
   - A record: `staging.example.com` → VPS IP

3. **SSH into server**
   ```bash
   ssh root@<vps-ip>
   ```

4. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

5. **Run installer**
   ```bash
   curl -sL https://raw.githubusercontent.com/OWNER/tik-photos-releases/main/install.sh | bash
   ```

6. **Set admin password**
   - Navigate to `https://photos.example.com`
   - Complete initial admin setup

7. **Transfer ownership**
   - Create Hetzner account with Tik's email
   - Transfer server to his account
   - He changes SSH keys and passwords
   - Developer no longer has access

---

## 11. Debug & Troubleshooting Features

### 11.1 Health Endpoint

```
GET /api/health

Response:
{
  "status": "healthy",
  "version": "1.2.0",
  "schemaVersion": 3,
  "uptime": 86400,
  "checks": {
    "dataDirectory": "ok",
    "diskSpace": "ok"
  }
}
```

### 11.2 Debug Page

Accessible at `/admin/debug` — shows:

- App version and schema version
- Data folder structure (names only, no content)
- Disk usage breakdown
- Recent errors from application log
- Link validity summary
- Photo count per year

### 11.3 Debug Export

Button to download a debug bundle:

```
debug-export-2025-01-15.zip
├── system-info.json          # Versions, uptime, disk usage
├── folder-structure.txt      # Tree output (no file contents)
├── link-summary.json         # Link IDs, creation dates, expiry (no URLs)
├── album-summary.json        # Album IDs, photo counts, dates
├── recent-errors.log         # Last 100 error log entries
└── config-redacted.json      # Config with secrets removed
```

This bundle contains no photos and no sensitive data, safe to email to developer.

---

## 12. Security Considerations

### 12.1 Staging Access

- Staging is behind basic auth via Caddy
- Alternatively, implement IP allowlist
- Never expose staging without authentication

### 12.2 Orchestrator Security

- Orchestrator has docker.sock access (powerful)
- Orchestrator API is internal only (no port exposure)
- Only app containers can call orchestrator
- Validate all input to orchestrator endpoints

### 12.3 Data Isolation

- Production and staging have separate data directories
- Copy operations are one-way (prod → staging for preview)
- Promotion runs migrations on production data, does not copy from staging

### 12.4 Backup Security

- Backups contain all user photos
- Ensure `/opt/tik/backups` is not web-accessible
- Consider encrypting backups if VPS provider is untrusted

### 12.5 Post-Handover

After transferring VPS ownership:

- Developer has no SSH access
- Developer has no access to photos or data
- Developer cannot push updates without user action
- User can delete everything and re-deploy if trust is broken

---

## Appendix A: Version Mapping

| App Version | Schema Version | Notes |
|-------------|----------------|-------|
| v1.0.0 | 1 | Initial release |
| v1.1.0 | 2 | Added link expiry |
| v1.2.0 | 3 | Album reorganization |

---

## Appendix B: Error Codes

| Code | Meaning | User Action |
|------|---------|-------------|
| `UPGRADE_IN_PROGRESS` | Another upgrade is running | Wait and retry |
| `IMAGE_PULL_FAILED` | Could not download new version | Check internet, retry |
| `INSUFFICIENT_DISK` | Not enough disk space | Free space or expand disk |
| `COPY_VERIFY_FAILED` | Data copy was incomplete | Contact developer |
| `MIGRATION_FAILED` | Data migration error | Rollback, contact developer |
| `HEALTH_CHECK_TIMEOUT` | App didn't start properly | Check logs, rollback if needed |

---

## Appendix C: Checklist Before First Production Deploy

- [ ] All secrets removed from git history
- [ ] Private dev repo cleaned
- [ ] Public release repo created with v1.0.0
- [ ] Docker images pushed to registry (ghcr.io or Docker Hub)
- [ ] releases.json published and accessible
- [ ] install.sh tested on fresh VPS
- [ ] DNS configured and propagated
- [ ] Staging basic auth tested
- [ ] Upgrade flow tested (v1.0.0 → v1.0.1 dummy release)
- [ ] Rollback tested
- [ ] Debug export tested and reviewed for sensitive data
- [ ] README documentation complete
