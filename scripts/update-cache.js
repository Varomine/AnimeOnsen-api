const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, '..', 'mapping.json');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper to decode AnimeOnsen ao.session cookie to Bearer token
async function getBearerToken() {
    try {
        console.log("Fetching AnimeOnsen session cookie...");
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
        
        return token;
    } catch (error) {
        console.error("Failed to obtain Bearer token:", error.message);
        throw error;
    }
}

// Fetch details with automatic retry on 429
async function fetchContentDetailsWithRetry(contentId, token) {
    let retries = 5;
    let delay = 3000;
    while (retries > 0) {
        try {
            const response = await axios.get(`https://api.animeonsen.xyz/v4/content/${contentId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.warn(`Rate limited (429) on content ID ${contentId}. Retrying in ${delay / 1000}s...`);
                await sleep(delay);
                retries--;
                delay += 2000; // Exponential backoff
            } else {
                console.error(`Error fetching details for content ID ${contentId}:`, error.message);
                return null;
            }
        }
    }
    console.error(`Max retries reached for content ID ${contentId}. Skipping.`);
    return null;
}

// Main execution function
async function updateCache() {
    let mapping = { malToContent: {}, contentToMal: {} };
    if (fs.existsSync(MAPPING_FILE)) {
        try {
            mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
            mapping.malToContent = mapping.malToContent || {};
            mapping.contentToMal = mapping.contentToMal || {};
        } catch (e) {
            console.warn("Could not parse existing mapping.json, initializing clean mapping.");
        }
    }
    
    try {
        const token = await getBearerToken();
        console.log("Token obtained successfully.");
        
        const limit = 250;
        const allContent = [];
        
        console.log("Fetching first page of content index...");
        const firstResponse = await axios.get(`https://api.animeonsen.xyz/v4/content/index?start=0&limit=${limit}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const firstData = firstResponse.data;
        if (firstData && firstData.content) {
            allContent.push(...firstData.content);
            console.log(`Fetched index batch: start=0, count=${firstData.content.length}`);
        }
        
        if (firstData && firstData.cursor && firstData.cursor.next && firstData.cursor.next[0]) {
            let nextStart = firstData.cursor.next[1];
            while (nextStart > 0) {
                console.log(`Fetching index batch: start=${nextStart}, limit=${limit}`);
                const response = await axios.get(`https://api.animeonsen.xyz/v4/content/index?start=${nextStart}&limit=${limit}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const data = response.data;
                if (data && data.content) {
                    allContent.push(...data.content);
                    console.log(`Fetched index batch: start=${nextStart}, count=${data.content.length}`);
                }
                
                nextStart -= limit;
                await sleep(500);
            }
        }
        
        console.log(`Total content items in index: ${allContent.length}`);
        
        // Filter out content IDs already in the mapping
        const missingIds = allContent
            .map(item => item.content_id)
            .filter(cid => !mapping.contentToMal[cid]);
        
        console.log(`Found ${missingIds.length} content IDs missing details mapping.`);
        
        if (missingIds.length > 0) {
            let processedCount = 0;
            const batchSizeForSave = 30;
            
            for (const cid of missingIds) {
                processedCount++;
                console.log(`[${processedCount}/${missingIds.length}] Fetching: ${cid}...`);
                
                const details = await fetchContentDetailsWithRetry(cid, token);
                if (details) {
                    const malId = details.mal_id;
                    const title = details.content_title;
                    const titleEn = details.content_title_en;
                    
                    mapping.contentToMal[cid] = {
                        mal_id: malId || null,
                        title: title || '',
                        title_en: titleEn || ''
                    };
                    
                    if (malId) {
                        mapping.malToContent[String(malId)] = cid;
                    }
                }
                
                if (processedCount % batchSizeForSave === 0 || processedCount === missingIds.length) {
                    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2), 'utf8');
                    console.log(`--- Progress saved: ${processedCount} records processed ---`);
                }
                
                await sleep(250);
            }
            
            console.log("mapping.json cache updated successfully!");
        } else {
            console.log("No new content items found. Cache is already up to date.");
        }
        
    } catch (error) {
        console.error("Cache update failed:", error.message);
        process.exit(1);
    }
}

updateCache();
