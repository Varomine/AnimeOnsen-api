const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MAPPING_FILE = path.join(__dirname, '..', 'mapping.json');

app.use(cors());
app.use(express.json());

// In-memory mapping cache
let mapping = { malToContent: {}, contentToMal: {} };

function loadMapping() {
    if (fs.existsSync(MAPPING_FILE)) {
        try {
            mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
            mapping.malToContent = mapping.malToContent || {};
            mapping.contentToMal = mapping.contentToMal || {};
            console.log(`Loaded ${Object.keys(mapping.contentToMal).length} mappings from mapping.json`);
        } catch (error) {
            console.error("Failed to parse mapping.json:", error.message);
        }
    } else {
        console.warn("mapping.json not found. MAL-to-Content resolving will be limited until cache is built.");
    }
}

// Watch mapping file for external updates
fs.watch(path.dirname(MAPPING_FILE), (eventType, filename) => {
    if (filename === 'mapping.json') {
        console.log("mapping.json changed on disk, reloading...");
        loadMapping();
    }
});

// Load mapping on startup
loadMapping();

// Token caching variables
let cachedToken = null;
let tokenExpiry = 0;

async function getAuthToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && tokenExpiry > now + 300) { // 5 minutes buffer
        return cachedToken;
    }
    
    console.log("Fetching new AnimeOnsen session token...");
    try {
        const response = await axios.get('https://www.animeonsen.xyz/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        let aoSession = null;
        const cookies = response.headers['set-cookie'] || [];
        for (const cookie of cookies) {
            if (cookie.startsWith('ao.session=')) {
                aoSession = cookie.split('ao.session=')[1].split(';')[0];
                break;
            }
        }
        
        if (!aoSession) {
            throw new Error("ao.session cookie not found in response headers.");
        }
        
        const decodedUri = decodeURIComponent(aoSession);
        const decodedBase64 = Buffer.from(decodedUri, 'base64').toString('utf-8');
        const token = decodedBase64.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 1)).join('');
        
        // Parse JWT payload for expiration
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                if (payload && payload.exp) {
                    tokenExpiry = payload.exp;
                    console.log(`New token obtained. Expires in: ${Math.round((tokenExpiry - now) / 3600)} hours`);
                }
            }
        } catch (e) {
            tokenExpiry = now + 3600; // Default to 1 hour if parse fails
        }
        
        cachedToken = token;
        return token;
    } catch (error) {
        console.error("Failed to obtain Bearer token from AnimeOnsen:", error.message);
        throw error;
    }
}

// Helper to construct local subtitle proxy URLs
function buildLocalSubtitleUrls(req, contentId, rawSubtitles, episodeNumber) {
    const localSubtitles = {};
    if (rawSubtitles) {
        const host = `${req.protocol}://${req.get('host')}`;
        for (const lang of Object.keys(rawSubtitles)) {
            localSubtitles[lang] = `${host}/api/subtitles/${contentId}/${lang}/${episodeNumber}`;
        }
    }
    return localSubtitles;
}

// 1. General Info & Documentation Overview
app.get('/', (req, res) => {
    res.json({
        name: "AnimeOnsen API Wrapper",
        description: "Unofficial high-performance REST API wrapper for AnimeOnsen.xyz",
        version: "1.0.0",
        endpoints: {
            search: "/api/search?q={query}",
            animeDetails: "/api/anime/{contentId}",
            animeEpisodes: "/api/anime/{contentId}/episodes",
            episodeStream: "/api/anime/{contentId}/episode/{episodeNumber}",
            subtitleProxy: "/api/subtitles/{contentId}/{lang}/{episodeNumber}",
            malIdResolver: "/api/source/{malId}",
            malIdEpisodeStream: "/api/source/{malId}/episode/{episodeNumber}",
            updateCache: "POST /api/update-cache"
        },
        mappings_loaded: Object.keys(mapping.contentToMal).length
    });
});

// 2. Search endpoint (Queries MeiliSearch)
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: "Missing search query parameter 'q'." });
    }
    
    try {
        const host = 'https://search.animeonsen.xyz';
        const apiKey = '0e36d0275d16b40d7cf153634df78bc229320d073f565db2aaf6d027e0c30b13';
        
        const response = await axios.post(`${host}/indexes/content/search`, {
            q: query,
            limit: req.query.limit ? parseInt(req.query.limit) : 20
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Origin': 'https://www.animeonsen.xyz',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error("Search failed:", error.message);
        res.status(500).json({ error: "Search query failed.", details: error.message });
    }
});

// 3. Get Anime details
app.get('/api/anime/:contentId', async (req, res) => {
    const { contentId } = req.params;
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Authorization': `Bearer ${token}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error(`Fetching details failed for ${contentId}:`, error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to fetch anime details.", details: error.message });
    }
});

// 4. Get Anime episodes list
app.get('/api/anime/:contentId/episodes', async (req, res) => {
    const { contentId } = req.params;
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}/video/1`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const metadata = response.data.metadata;
        if (!metadata || !metadata.episode || metadata.episode.length < 3) {
            return res.json([]);
        }
        
        const episodesObj = metadata.episode[2];
        const episodesList = Object.entries(episodesObj).map(([num, epData]) => ({
            episode_number: parseInt(num),
            title: epData.contentTitle_episode_en || `Episode ${num}`,
            title_jp: epData.contentTitle_episode_jp || ''
        })).sort((a, b) => a.episode_number - b.episode_number);
        
        res.json({
            content_id: contentId,
            total_episodes: metadata.total_episodes,
            episodes: episodesList
        });
    } catch (error) {
        console.error(`Fetching episodes list failed for ${contentId}:`, error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to fetch episodes list.", details: error.message });
    }
});

// 5. Get Episode streaming source (with Subtitle CORS proxy rewrite)
app.get('/api/anime/:contentId/episode/:episodeNumber', async (req, res) => {
    const { contentId, episodeNumber } = req.params;
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}/video/${episodeNumber}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = response.data;
        if (!data || !data.uri) {
            return res.status(404).json({ error: "Episode streaming source not found." });
        }
        
        const metadata = data.metadata || {};
        const epDetails = (metadata.episode && metadata.episode[1]) || {};
        
        res.json({
            content_id: contentId,
            episode_number: parseInt(episodeNumber),
            stream_url: data.uri.stream || '',
            stream_type: data.uri.stream ? (data.uri.stream.endsWith('.mpd') ? 'dash' : 'hls') : 'unknown',
            subtitles: buildLocalSubtitleUrls(req, contentId, data.uri.subtitles, episodeNumber),
            subtitle_languages: metadata.subtitles || {},
            skip_intro: {
                start: parseInt(epDetails.skipIntro_s) || null,
                end: parseInt(epDetails.skipIntro_e) || null
            },
            next_episode_start: parseInt(epDetails.nextEpisode_s) || null,
            referer: "https://www.animeonsen.xyz/"
        });
    } catch (error) {
        console.error(`Fetching episode stream failed for ${contentId} ep ${episodeNumber}:`, error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to fetch episode stream details.", details: error.message });
    }
});

// Helper to convert SubStation Alpha (ASS) subtitles to WebVTT format
function convertAssToVtt(assContent) {
    const lines = assContent.split(/\r?\n/);
    const vttLines = ['WEBVTT', ''];
    
    let formatFields = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
    for (const line of lines) {
        if (line.startsWith('Format:')) {
            const fields = line.substring(7).split(',').map(f => f.trim());
            if (fields.includes('Start') && fields.includes('End') && fields.includes('Text')) {
                formatFields = fields;
            }
            break;
        }
    }
    
    const startIndex = formatFields.indexOf('Start');
    const endIndex = formatFields.indexOf('End');
    const textIndex = formatFields.indexOf('Text');
    const nameIndex = formatFields.indexOf('Name');
    
    function convertTime(assTime) {
        const parts = assTime.split(':');
        if (parts.length < 3) return '00:00:00.000';
        
        let hours = parts[0].trim();
        if (hours.length === 1) hours = '0' + hours;
        
        const minutes = parts[1].trim().padStart(2, '0');
        
        const secondsPart = parts[2].trim();
        const secondsSubParts = secondsPart.split('.');
        const seconds = secondsSubParts[0].padStart(2, '0');
        let ms = '000';
        if (secondsSubParts.length > 1) {
            ms = secondsSubParts[1].padEnd(3, '0').substring(0, 3);
        }
        
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
    
    for (const line of lines) {
        if (line.startsWith('Dialogue:')) {
            const content = line.substring(9).trim();
            const fields = [];
            let current = '';
            let commaCount = 0;
            const maxCommas = formatFields.length - 1;
            
            for (let i = 0; i < content.length; i++) {
                if (content[i] === ',' && commaCount < maxCommas) {
                    fields.push(current.trim());
                    current = '';
                    commaCount++;
                } else {
                    current += content[i];
                }
            }
            fields.push(current.trim());
            
            if (fields.length <= Math.max(startIndex, endIndex, textIndex)) {
                continue;
            }
            
            const start = convertTime(fields[startIndex]);
            const end = convertTime(fields[endIndex]);
            let text = fields[textIndex];
            
            text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n');
            text = text.replace(/\{[^}]+\}/g, '');
            
            vttLines.push(`${start} --> ${end}`);
            const name = nameIndex !== -1 ? fields[nameIndex] : '';
            if (name) {
                vttLines.push(`<v ${name}>${text}`);
            } else {
                vttLines.push(text);
            }
            vttLines.push('');
        }
    }
    
    return vttLines.join('\n');
}

// 6. Subtitle CORS Proxy Endpoint
app.get('/api/subtitles/:contentId/:lang/:episode', async (req, res) => {
    const { contentId, lang, episode } = req.params;
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/subtitles/${contentId}/${lang}/${episode}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${token}`,
                'Referer': 'https://www.animeonsen.xyz/'
            },
            responseType: 'text'
        });
        
        // Ensure standard WebVTT mime-type and CORS headers are returned
        res.setHeader('Content-Type', 'text/vtt');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // If it's already WebVTT, send it; otherwise convert ASS to WebVTT
        const subtitleData = response.data || '';
        if (subtitleData.trim().startsWith('WEBVTT')) {
            res.send(subtitleData);
        } else {
            const vttContent = convertAssToVtt(subtitleData);
            res.send(vttContent);
        }
    } catch (error) {
        console.error(`Subtitle proxy failed for ${contentId}/${lang}/${episode}:`, error.message);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(error.response?.status || 500).send("Failed to retrieve subtitle file.");
    }
});

// 7. MAL ID Resolver (GET /api/source/:malId)
app.get('/api/source/:malId', async (req, res) => {
    const { malId } = req.params;
    const contentId = mapping.malToContent[String(malId)];
    
    if (!contentId) {
        return res.status(404).json({ error: `No AnimeOnsen source mapping found for MyAnimeList ID ${malId}.` });
    }
    
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Authorization': `Bearer ${token}`
            }
        });
        res.json({
            mal_id: parseInt(malId),
            animeonsen_content_id: contentId,
            details: response.data
        });
    } catch (error) {
        console.error(`Fetching details failed for resolved MAL ID ${malId} (Content: ${contentId}):`, error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to fetch details for resolved MAL ID source.", details: error.message });
    }
});

// 8. MAL ID Episode stream resolver
app.get('/api/source/:malId/episode/:episodeNumber', async (req, res) => {
    const { malId, episodeNumber } = req.params;
    const contentId = mapping.malToContent[String(malId)];
    
    if (!contentId) {
        return res.status(404).json({ error: `No AnimeOnsen source mapping found for MyAnimeList ID ${malId}.` });
    }
    
    try {
        const token = await getAuthToken();
        const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}/video/${episodeNumber}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.animeonsen.xyz/',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = response.data;
        if (!data || !data.uri) {
            return res.status(404).json({ error: "Episode streaming source not found." });
        }
        
        const metadata = data.metadata || {};
        const epDetails = (metadata.episode && metadata.episode[1]) || {};
        
        res.json({
            mal_id: parseInt(malId),
            animeonsen_content_id: contentId,
            episode_number: parseInt(episodeNumber),
            stream_url: data.uri.stream || '',
            stream_type: data.uri.stream ? (data.uri.stream.endsWith('.mpd') ? 'dash' : 'hls') : 'unknown',
            subtitles: buildLocalSubtitleUrls(req, contentId, data.uri.subtitles, episodeNumber),
            subtitle_languages: metadata.subtitles || {},
            skip_intro: {
                start: parseInt(epDetails.skipIntro_s) || null,
                end: parseInt(epDetails.skipIntro_e) || null
            },
            next_episode_start: parseInt(epDetails.nextEpisode_s) || null,
            referer: "https://www.animeonsen.xyz/"
        });
    } catch (error) {
        console.error(`Fetching episode stream failed for resolved MAL ID ${malId} (Content: ${contentId}) ep ${episodeNumber}:`, error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to fetch episode stream details.", details: error.message });
    }
});

// 9. Trigger Cache Update manually
app.post('/api/update-cache', (req, res) => {
    const { exec } = require('child_process');
    console.log("Triggered cache update manual request.");
    exec('node scripts/update-cache.js', (err, stdout, stderr) => {
        if (err) {
            console.error("Manual cache update failed:", err.message);
            return;
        }
        console.log("Manual cache update script finished.");
    });
    
    res.json({ message: "Cache update triggered in the background. File will reload automatically once done." });
});

// Only start Express listener if run locally
if (process.env.NODE_ENV !== 'production' || require.main === module) {
    app.listen(PORT, () => {
        console.log(`AnimeOnsen API wrapper is running on port ${PORT}`);
    });
}

// Export for Vercel Serverless environment
module.exports = app;
