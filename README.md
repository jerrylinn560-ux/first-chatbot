<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c37bdb16-add6-4d10-aece-a0d4d2344af3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

Import the repository into Vercel and deploy with the project settings in `vercel.json`.
In the Vercel project settings, add `GEMINI_API_KEY` under **Environment Variables**
for each environment you deploy to (Production, Preview, and/or Development), then
redeploy. The API key must not be added to frontend code or committed to the repository.
