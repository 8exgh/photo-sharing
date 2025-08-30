# Docker Volume Migration Guide

## Overview
The application has been updated to properly use Docker volumes for persistent data storage. Previously, data was stored inside the container and would be lost on redeploy. Now, all user data is stored in mounted volumes.

## What Changed

### Storage Locations
- **Previous**: 
  - Albums stored in `public/albums/` (inside container)
  - Access keys stored in `.access-keys.json` (root directory)
  
- **New**:
  - Albums stored in `/app/data/albums` (volume mount)
  - Access keys stored in `/app/data/access-keys.json` (volume mount)

## Migration Steps for Existing Deployments

### 1. Backup Current Data
Before updating, backup your existing data:

```bash
# Create a backup of your current container's data
docker cp <container_name>:/app/public/albums ./backup_albums
docker cp <container_name>:/app/.access-keys.json ./backup_access_keys.json
```

### 2. Update Docker Compose
Ensure your `docker-compose.yml` has the correct volume configuration:

```yaml
services:
  app:
    image: your-image:latest
    volumes:
      - ./data:/app/data  # Maps local ./data to container /app/data
    environment:
      - DATA_DIR=/app/data
      - ALBUMS_DIR=/app/data/albums
```

### 3. Restore Data to Volume
After deploying the new container:

```bash
# Create the data directory structure
mkdir -p ./data/albums

# Copy backed up data to the volume mount
cp -r ./backup_albums/* ./data/albums/
cp ./backup_access_keys.json ./data/access-keys.json
```

### 4. Verify Permissions
Ensure the data directory has correct permissions:

```bash
# The container runs as node user (UID 1000)
chown -R 1000:1000 ./data
```

## Environment Variables

The application now uses these environment variables:
- `DATA_DIR`: Base directory for all application data (default: `/app/data`)
- `ALBUMS_DIR`: Directory for album storage (default: `/app/data/albums`)

These are set in the Dockerfile but can be overridden in your deployment configuration if needed.

## Development vs Production

- **Development**: Uses `public/albums` and `data/` in project root (no changes needed)
- **Production**: Uses volume-mounted `/app/data` directory

## Verification

After migration, verify:
1. Albums are accessible through the web interface
2. Access keys are working
3. New uploads are saved to the volume mount
4. Data persists after container restart:
   ```bash
   docker restart <container_name>
   ```

## Troubleshooting

### Data Not Persisting
- Check volume mount is correct: `docker inspect <container_name>`
- Verify directory permissions: `ls -la ./data`

### Access Denied Errors
- Ensure the data directory is owned by UID 1000 (node user in container)
- Check that volumes are mounted correctly in docker-compose.yml

### Missing Data After Update
- Check if data is still in the old location inside container
- Ensure backup was created before migration
- Verify the volume mount path matches your local data directory