# Uploads Architecture - Shared Volume Solution

## Overview
This implementation uses Docker named volumes to share uploaded files between containers, following best practices for containerized applications.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Named Volume                      │
│                      "uploads_data"                          │
│                (Persistent, Shared Storage)                  │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │                  │                  │
         │                  │                  │
    ┌────▼─────┐       ┌────▼─────┐      ┌────▼─────┐
    │  Server  │       │  Client  │      │  Nginx   │
    │Container │       │Container │      │Container │
    └──────────┘       └──────────┘      └──────────┘
```

## Container Mount Points

### 1. Server Container (Backend)
- **Mount Path**: `/usr/src/app/uploads`
- **Purpose**: Write uploaded files
- **Process**:
  1. User uploads file via POST `/api/upload`
  2. Backend authenticates user via JWT cookie
  3. File saved to `/usr/src/app/uploads/{filename}`
  4. Database updated with file URL: `/uploads/{filename}`
  5. Socket.IO broadcasts profile update

### 2. Client Container (Next.js)
- **Mount Path**: `/app/public/uploads`
- **Purpose**: Serve static files in development/fallback
- **Access**: Files available at `http://client:3000/uploads/{filename}`
- **Note**: In production, Nginx serves these files directly

### 3. Nginx Container (Reverse Proxy)
- **Mount Path**: `/usr/share/nginx/uploads`
- **Purpose**: Serve uploaded files with optimal caching
- **Configuration**:
  ```nginx
  location /uploads/ {
      alias /usr/share/nginx/uploads/;
      expires 30d;
      add_header Cache-Control "public, immutable";
      access_log off;
  }
  ```
- **Benefits**:
  - Direct file serving (no proxy overhead)
  - 30-day browser caching
  - Reduced backend load

## Flow Diagram

### Upload Flow
```
Browser → Nginx → Server → Shared Volume
                    ↓
                 Database
                    ↓
                Socket.IO
```

### Download Flow
```
Browser → Nginx → Shared Volume → Browser
```

## File URL Structure

When a file is uploaded:
1. Original filename: `profile.jpg`
2. Stored as: `1732800000000-abc123def.jpg`
3. Database stores: `/uploads/1732800000000-abc123def.jpg`
4. Browser requests: `https://yourdomain.com/uploads/1732800000000-abc123def.jpg`
5. Nginx serves from: `/usr/share/nginx/uploads/1732800000000-abc123def.jpg`

## Benefits of This Approach

### 1. **Decoupling**
- Containers don't depend on each other's filesystem
- Backend and frontend are truly independent

### 2. **Persistence**
- Files survive container restarts/rebuilds
- Volume persists on host machine

### 3. **Performance**
- Nginx serves static files directly (fastest method)
- No backend processing for file serving
- Browser caching reduces server load

### 4. **Scalability**
- Easy to scale horizontally (multiple backend containers)
- Can migrate to cloud storage (S3, GCS) with minimal code changes
- Volume can be backed by network storage

### 5. **Security**
- Backend validates authentication before upload
- Only authenticated users can upload
- Nginx serves files without authentication (public URLs)

## Docker Volume Commands

### View volume details
```bash
docker volume inspect dockerv_uploads_data
```

### Backup uploads
```bash
docker run --rm -v dockerv_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz /data
```

### Restore uploads
```bash
docker run --rm -v dockerv_uploads_data:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/uploads-backup.tar.gz --strip 1"
```

### Clear all uploads (WARNING: Destructive)
```bash
docker volume rm dockerv_uploads_data
```

## Environment Variables

No environment variables needed! The paths are hardcoded in docker-compose.yml:
- Server: `/usr/src/app/uploads`
- Client: `/app/public/uploads`
- Nginx: `/usr/share/nginx/uploads`

## Security Considerations

1. **Upload Validation**
   - File size limit: 5MB (configurable in uploadroute.js)
   - File type validation: Images only
   - Authentication required via JWT cookie

2. **File Naming**
   - Random filenames prevent collisions
   - Timestamp prefix for chronological ordering
   - Original extension preserved for MIME type

3. **Public Access**
   - Uploaded files are publicly accessible via URL
   - Consider adding authentication to Nginx location if needed
   - Sensitive files should use different storage strategy

## Migration to Cloud Storage

To migrate to S3/GCS/Azure Blob:

1. Install SDK: `npm install @aws-sdk/client-s3`
2. Update `uploadroute.js`:
   ```javascript
   // Instead of: fs.writeFile(filePath, buffer)
   await s3Client.send(new PutObjectCommand({
       Bucket: 'your-bucket',
       Key: fileName,
       Body: buffer
   }));
   ```
3. Update file URL to S3 URL
4. Remove Nginx `/uploads/` location (files now served by S3)
5. Remove uploads volume from docker-compose.yml

## Troubleshooting

### Files not appearing
```bash
# Check if volume exists
docker volume ls | grep uploads

# Check server container can write
docker exec server ls -la /usr/src/app/uploads

# Check nginx can read
docker exec nginx ls -la /usr/share/nginx/uploads

# Check permissions
docker exec server touch /usr/src/app/uploads/test.txt
docker exec nginx cat /usr/share/nginx/uploads/test.txt
```

### Permission issues
```bash
# Fix permissions (if needed)
docker exec -u root server chmod -R 755 /usr/src/app/uploads
docker exec -u root nginx chmod -R 755 /usr/share/nginx/uploads
```

## Summary

This architecture provides:
- ✅ Shared storage between containers
- ✅ Persistent file storage
- ✅ Optimal performance (Nginx serves static files)
- ✅ Authentication before upload
- ✅ Easy backup and restore
- ✅ Scalable and maintainable
- ✅ Cloud-ready (easy migration)
