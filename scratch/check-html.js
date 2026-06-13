const axios = require('axios');

async function test() {
    try {
        console.log("Fetching home page HTML...");
        const res = await axios.get('https://www.animeonsen.xyz/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = res.data;
        console.log("HTML length:", html.length);
        
        // Find links to scripts or json or config
        const matches = html.match(/src=["']([^"']+)["']/g) || [];
        console.log("All src matches:", matches);
        
        // Print anything mentioning search or apiKey or config
        const lines = html.split('\n');
        lines.forEach((l, i) => {
            if (l.includes('search') || l.includes('key') || l.includes('Key') || l.includes('meili') || l.includes('Meili')) {
                console.log(`Line ${i}: ${l.trim()}`);
            }
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
