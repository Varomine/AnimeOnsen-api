const axios = require('axios');

async function test() {
    try {
        console.log("Fetching home page...");
        const res = await axios.get('https://www.animeonsen.xyz/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        // Find all script tags
        const html = res.data;
        const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/g;
        let match;
        const scripts = [];
        while ((match = scriptRegex.exec(html)) !== null) {
            scripts.push(match[1]);
        }
        
        console.log("Found scripts:", scripts);
        
        // Let's search script contents for "search.animeonsen.xyz" or MeiliSearch keys
        for (const scriptSrc of scripts) {
            const url = scriptSrc.startsWith('http') ? scriptSrc : `https://www.animeonsen.xyz${scriptSrc}`;
            console.log(`Checking script: ${url}`);
            try {
                const scriptRes = await axios.get(url);
                const content = scriptRes.data;
                
                if (content.includes('search.animeonsen.xyz')) {
                    console.log(`FOUND in ${url}!`);
                    // Print surrounding text
                    const idx = content.indexOf('search.animeonsen.xyz');
                    console.log("Surrounding content:", content.substring(Math.max(0, idx - 200), idx + 200));
                }
                
                // Also search for standard 64-char hex strings (common for MeiliSearch keys)
                const hexRegex = /[0-9a-fA-F]{64}/g;
                let hexMatch;
                while ((hexMatch = hexRegex.exec(content)) !== null) {
                    console.log("Found potential 64-char key in script:", hexMatch[0]);
                }
            } catch (err) {
                console.error(`Failed to fetch script ${url}:`, err.message);
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
