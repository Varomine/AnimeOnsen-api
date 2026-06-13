const axios = require('axios');

async function testSearch(name, headers) {
    try {
        console.log(`\nTesting: ${name}`);
        const host = 'https://search.animeonsen.xyz';
        const apiKey = '0e36d0275d16b40d7cf153634df78bc229320d073f565db2aaf6d027e0c30b13';
        
        const response = await axios.post(`${host}/indexes/content/search`, {
            q: 'Botan',
            limit: 5
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...headers
            }
        });
        console.log(`SUCCESS! Status: ${response.status}`);
        console.log(`Hits count: ${response.data.hits?.length}`);
    } catch (e) {
        console.log(`FAILED: Status: ${e.response ? e.response.status : 'No response'}`);
        if (e.response && typeof e.response.data === 'string') {
            console.log(`Error body:`, e.response.data.substring(0, 300));
        } else if (e.response) {
            console.log(`Error body:`, JSON.stringify(e.response.data).substring(0, 300));
        } else {
            console.log(`Message:`, e.message);
        }
    }
}

async function run() {
    // 1. Standard search with Axios defaults (which failed on Vercel)
    await testSearch("Default Axios headers (No User-Agent, No Referer, No Origin)", {});

    // 2. Search with User-Agent only
    await testSearch("With User-Agent", {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 3. Search with User-Agent and Referer
    await testSearch("With User-Agent and Referer", {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeonsen.xyz/'
    });

    // 4. Search with User-Agent, Referer, and Origin
    await testSearch("With User-Agent, Referer, and Origin", {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeonsen.xyz/',
        'Origin': 'https://www.animeonsen.xyz'
    });
}

run();
