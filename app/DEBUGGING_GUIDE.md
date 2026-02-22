# Authorization Debugging Guide

## Overview
Enhanced server-side logging has been added to help diagnose authorization issues, particularly with POST requests to `/api/albums` in production environments.

## Key Areas with Enhanced Logging

### 1. API Endpoints

#### POST /api/albums
- Logs request headers (cookie, origin, referer, content-type)
- Logs session state (isAuthenticated, isAdmin, accessKey presence)
- Logs environment configuration (NODE_ENV, SESSION_SECRET presence)
- Returns debug information in non-production environments
- Includes CORS headers for production
- Handles OPTIONS preflight requests

#### GET /api/albums
- Logs request details and session state
- Logs access key validation for non-admin sessions
- Tracks authorization flow

#### POST /api/auth/login
- Logs login attempts with headers
- Logs session creation details
- Tracks admin session establishment

### 2. Session Management (/lib/session.ts)
- Logs session configuration on initialization
- Logs cookie settings (secure, httpOnly, sameSite)
- Logs session retrieval details
- Shows environment-specific settings

### 3. Middleware
- Already has comprehensive logging
- Logs URL keys and session states
- Tracks authentication flow

## Environment Variables Required

Create a `.env.local` file with:
```env
# Session Configuration (REQUIRED in production)
SESSION_SECRET=your-secure-session-secret-at-least-32-characters-long

# Admin Configuration
ADMIN_PASSWORD=your-secure-admin-password

# Node Environment
NODE_ENV=production  # Set this in production
```

## Common Issues and Solutions

### 1. "Unauthorized" on POST /api/albums
**Check logs for:**
- `[POST /api/albums] Session state:` - Verify isAdmin is true
- `[getSession] Session retrieved:` - Check if session exists
- Cookie presence in request headers

**Possible causes:**
- Session not persisting between requests
- Cookie not being sent with requests
- SESSION_SECRET mismatch between deployments
- Secure cookie issues (HTTPS required in production)

### 2. Session Not Persisting
**Check logs for:**
- `[Session Config] Initializing with:` - Verify cookie settings
- Check if `cookieSecure` matches your environment (true for HTTPS)
- Verify `sameSite` policy is appropriate

**Solutions:**
- Ensure SESSION_SECRET is consistent
- Check HTTPS configuration in production
- Verify domain/subdomain cookie scope

### 3. CORS Issues
**Check logs for:**
- `[OPTIONS /api/albums] Preflight request handled`
- Origin headers in request logs

**Solutions:**
- CORS headers are automatically added in production
- Check if origin matches expected domain

## Reading the Logs

### Session State Example:
```
[POST /api/albums] Session state: {
  isAuthenticated: true,    // Must be true
  isAdmin: true,            // Must be true for POST
  accessKey: 'none',        // 'present' if using access key
  sessionKeys: ['isAuthenticated', 'isAdmin']
}
```

### Authorization Failure Example:
```
[POST /api/albums] Authorization failed - not admin: {
  sessionData: {...},
  reason: 'not authenticated'  // or 'not admin'
}
```

## Testing Authorization

1. **Login as Admin:**
   ```bash
   curl -X POST https://your-domain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"password":"your-admin-password"}' \
     -c cookies.txt
   ```

2. **Create Album (with cookies):**
   ```bash
   curl -X POST https://your-domain.com/api/albums \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","year":"2025"}' \
     -b cookies.txt
   ```

3. **Check Response Headers:**
   Look for debug information in non-production:
   ```json
   {
     "error": "Unauthorized",
     "debug": {
       "isAuthenticated": false,
       "isAdmin": false,
       "hasAccessKey": false
     }
   }
   ```

## Production Deployment Checklist

- [ ] Set `SESSION_SECRET` environment variable (32+ characters)
- [ ] Set `ADMIN_PASSWORD` environment variable
- [ ] Set `NODE_ENV=production`
- [ ] Ensure HTTPS is configured (required for secure cookies)
- [ ] Verify domain configuration for cookies
- [ ] Check server logs after deployment
- [ ] Test login flow immediately after deployment

## Log Locations

The logs will appear in your server's console output or logging service:
- Vercel: Function logs in dashboard
- Docker: Container logs
- PM2: `pm2 logs`
- systemd: `journalctl -u your-service`

## Removing Debug Logs

Once issues are resolved, you can remove verbose logging by:
1. Removing console.log statements from modified files
2. Or set a DEBUG environment variable to conditionally enable logs