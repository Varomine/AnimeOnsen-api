# AnimeOnsen API Wrapper

A clean, high-performance, and ready-to-deploy Node.js API wrapper for AnimeOnsen.xyz. Features automatic Bearer token extraction/rotation, MeiliSearch search integrations, and built-in MyAnimeList (MAL) ID resolving to direct streaming sources.

## Features

- ⚡ **Auto Token Extraction:** Automatically reads and decodes the obfuscated `ao.session` cookie from the main site to maintain authorized requests.
- 🔍 **MeiliSearch Integration:** Performs fast, fuzzy searches on the AnimeOnsen database.
- 📦 **Zero-Configuration Deployment:** Ready to be deployed instantly to Vercel, Render, or Railway.
- 🔗 **MyAnimeList ID Resolver:** Maps MyAnimeList IDs to AnimeOnsen streaming URLs (`GET /api/source/[malId]`).

---

## API Endpoints

### 1. General Info
- **Endpoint:** `GET /`
- **Response:**
```json
{
  "name": "AnimeOnsen API Wrapper",
  "description": "Unofficial high-performance REST API wrapper for AnimeOnsen.xyz",
  "version": "1.0.0",
  "endpoints": { ... },
  "mappings_loaded": 1250
}
```

### 2. Search Anime
- **Endpoint:** `GET /api/search?q={query}&limit={limit}`
- **Response:**
```json
{
  "hits": [
    {
      "content_title": "Kamiina Botan, Yoeru Sugata wa Yuri no Hana",
      "content_title_en": "Botan Kamiina Fully Blossoms When Drunk",
      "content_title_jp": "上伊那ぼたん、酔へる姿は百合の花",
      "content_id": "9QYrPOwl3sfnTFf4"
    }
  ],
  "query": "Botan",
  "processingTimeMs": 0,
  "limit": 20,
  "offset": 0,
  "estimatedTotalHits": 1
}
```

### 3. Anime Details
- **Endpoint:** `GET /api/anime/{contentId}`
- **Response:**
```json
{
  "content_id": "9QYrPOwl3sfnTFf4",
  "content_title": "Kamiina Botan, Yoeru Sugata wa Yuri no Hana",
  "content_title_en": "Botan Kamiina Fully Blossoms When Drunk",
  "is_movie": false,
  "subtitle_support": true,
  "total_episodes": 10,
  "mal_id": 61186,
  "genres": [ "4", "26", "47", "50" ],
  "available": true,
  "date_added": 1781307596
}
```

### 4. Episode List
- **Endpoint:** `GET /api/anime/{contentId}/episodes`
- **Response:**
```json
{
  "content_id": "9QYrPOwl3sfnTFf4",
  "total_episodes": 10,
  "episodes": [
    {
      "episode_number": 1,
      "title": "Episode 1",
      "title_jp": ""
    },
    {
      "episode_number": 2,
      "title": "Episode 2",
      "title_jp": ""
    }
  ]
}
```

### 5. Episode Stream & Subtitles
- **Endpoint:** `GET /api/anime/{contentId}/episode/{episodeNumber}`
- **Response:**
```json
{
  "content_id": "9QYrPOwl3sfnTFf4",
  "episode_number": 1,
  "stream_url": "https://cdn.animeonsen.xyz/video/mp4-dash/9QYrPOwl3sfnTFf4/1/manifest.mpd",
  "stream_type": "dash",
  "subtitles": {
    "de-DE": "http://localhost:3000/api/subtitles/9QYrPOwl3sfnTFf4/de-DE/1",
    "en-US": "http://localhost:3000/api/subtitles/9QYrPOwl3sfnTFf4/en-US/1"
  },
  "subtitle_languages": {
    "de-DE": "Deutsch",
    "en-US": "English"
  },
  "skip_intro": {
    "start": 238,
    "end": 328
  },
  "next_episode_start": 1330,
  "referer": "https://www.animeonsen.xyz/"
}
```

### 6. Subtitle CORS & WebVTT Proxy
- **Endpoint:** `GET /api/subtitles/{contentId}/{lang}/{episodeNumber}`
- **Description:** Proxies requests to the AnimeOnsen subtitle server with the correct authorization and referer headers to avoid Cloudflare 403 blocks. Additionally, it detects if the source subtitle is in SubStation Alpha (`.ass`/`.ssa`) format and automatically parses and converts it to standard WebVTT (`.vtt`) format on the fly with wide compatibility for HTML5 video players.
- **Headers Returned:**
  - `Content-Type: text/vtt`
  - `Access-Control-Allow-Origin: *`

### 7. MyAnimeList (MAL) Resolver
- **Endpoint:** `GET /api/source/{malId}`
- **Response:**
```json
{
  "mal_id": 61186,
  "animeonsen_content_id": "9QYrPOwl3sfnTFf4",
  "details": { ... }
}
```

### 8. MyAnimeList (MAL) Episode Stream Resolver
- **Endpoint:** `GET /api/source/{malId}/episode/{episodeNumber}`
- **Response:** (Same schema as Endpoint 5)

---

## Local Setup & Deployment

### Installation
1. Clone the repository and navigate inside.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
Start the local server (runs on port 3000 by default):
```bash
npm start
```

### Updating the Mapping Cache
The MAL mappings are stored locally in `mapping.json` for lightning-fast lookups. You can trigger a background update of the cache:
- **CLI Command:** `npm run update-cache`
- **HTTP Request:** Send a `POST` request to `http://localhost:3000/api/update-cache`.

### Deploying to GitHub / Vercel
The repository is fully configured with `vercel.json`.
1. Push this directory to your GitHub repository.
2. Go to **Vercel**, import the repository, and click **Deploy**. Vercel will automatically configure the serverless function and route all traffic to `index.js`.
