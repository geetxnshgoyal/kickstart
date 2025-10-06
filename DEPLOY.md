Kickstart - Deployment notes

Required environment variables
- NODE_ENV=production
- PORT (default 3000)
- ADMIN_KEY (required)
- GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON inside container)
- CORS_ORIGIN (optional) - whitelist origin
- RATE_LIMIT_WINDOW_MS (optional)
- RATE_LIMIT_MAX (optional)

Quick Docker
1. Build: docker build -t kickstart:latest .
2. Run (local): docker run -p 3000:3000 -e ADMIN_KEY=your_key -e GOOGLE_APPLICATION_CREDENTIALS=/app/creds.json -v $(pwd)/kickstart-11324-firebase-adminsdk-fbsvc-97c2decb15.json:/app/creds.json:ro kickstart:latest

Docker Compose (local)
1. Ensure .env contains ADMIN_KEY and service account JSON is present.
2. docker-compose up --build

PM2
1. Install pm2 on the host: npm i -g pm2
2. Start: pm2 start pm2.config.js --env production
3. Logs: pm2 logs kickstart

Notes
- The server will exit if Firebase credentials are missing in production mode to avoid running with degraded functionality.
- For hosting behind a reverse proxy (NGINX), forward path-based requests and set x-forwarded headers.
