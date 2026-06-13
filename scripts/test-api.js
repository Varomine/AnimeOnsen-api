const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log("Starting Express API wrapper server on port 4000...");
    const env = { ...process.env, PORT: '4000' };
    const serverProcess = spawn('node', [path.join(__dirname, '..', 'api', 'index.js')], { env });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server]: ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error]: ${data.toString().trim()}`);
    });

    // Wait for server to initialize
    await sleep(4000);

    const baseUrl = 'http://localhost:4000';
    let passed = true;

    const testEndpoints = [
        { name: "General Overview", path: "/" },
        { name: "Search (Botan)", path: "/api/search?q=Botan" },
        { name: "Anime Details (Botan)", path: "/api/anime/9QYrPOwl3sfnTFf4" },
        { name: "Anime Episodes List (Botan)", path: "/api/anime/9QYrPOwl3sfnTFf4/episodes" },
        { name: "Episode Stream details (Botan Ep 1)", path: "/api/anime/9QYrPOwl3sfnTFf4/episode/1" },
        { name: "Subtitle Proxy (Botan Ep 1)", path: "/api/subtitles/9QYrPOwl3sfnTFf4/en-US/1" },
        { name: "MAL ID Resolver (MAL 61186)", path: "/api/source/61186" },
        { name: "MAL ID Episode Stream Resolver (MAL 61186 Ep 1)", path: "/api/source/61186/episode/1" }
    ];

    for (const test of testEndpoints) {
        console.log(`\n--- Testing: ${test.name} (${test.path}) ---`);
        try {
            const res = await axios.get(baseUrl + test.path);
            console.log(`Response Status: ${res.status}`);
            console.log("Sample Data Output:");
            console.log(JSON.stringify(res.data, null, 2).substring(0, 400) + "...\n");
        } catch (error) {
            console.error(`FAILED: ${test.name}`);
            console.error(error.response ? error.response.data : error.message);
            passed = false;
        }
    }

    console.log("Shutting down the server...");
    serverProcess.kill();

    if (passed) {
        console.log("\nALL TESTS COMPLETED SUCCESSFULLY!");
        process.exit(0);
    } else {
        console.error("\nSOME TESTS FAILED!");
        process.exit(1);
    }
}

runTests();
