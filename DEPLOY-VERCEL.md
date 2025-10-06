Deploying to Vercel

Quick steps

1. Install Vercel CLI: npm i -g vercel
2. Login: vercel login
3. From project root:
   vercel --prod

Notes
- This repo uses a serverless Express wrapper at /api/index.js. All /api/* routes will be handled by Vercel functions.
- DO NOT commit your Firebase service account to the repo. Instead, add it to Vercel's Environment Variables as a secret and set GOOGLE_APPLICATION_CREDENTIALS to the path inside the build environment or provide the JSON contents in an env var and adapt server/firebase.js accordingly.
- Ensure ADMIN_KEY is set in Vercel's environment variables.
