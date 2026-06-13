import urllib.parse
import base64
import requests
import time
from concurrent.futures import ThreadPoolExecutor

def get_token():
    session = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    r = session.get('https://www.animeonsen.xyz/', headers=headers)
    ao_session = session.cookies.get('ao.session')
    if not ao_session:
        for h, v in r.headers.items():
            if 'set-cookie' in h.lower() and 'ao.session=' in v:
                ao_session = v.split('ao.session=')[1].split(';')[0]
                break
    raw = base64.b64decode(urllib.parse.unquote(ao_session))
    token = ''.join(chr(c + 1) for c in raw)
    return token

def fetch_content_details(content_id, token):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': f'Bearer {token}'
    }
    url = f'https://api.animeonsen.xyz/v4/content/{content_id}'
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        return content_id, data.get('mal_id'), data.get('content_title'), data.get('content_title_en')
    return content_id, None, None, None

def test_fetch_batch():
    token = get_token()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': f'Bearer {token}'
    }
    
    # Get first 30 content IDs
    r = requests.get('https://api.animeonsen.xyz/v4/content/index?start=0&limit=30', headers=headers)
    content_list = r.json().get('content', [])
    content_ids = [c['content_id'] for c in content_list]
    print(f"Fetched {len(content_ids)} content IDs from index.")
    
    start_time = time.time()
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_content_details, cid, token) for cid in content_ids]
        for f in futures:
            res = f.result()
            if res[1]:
                results.append(res)
    
    end_time = time.time()
    print(f"Fetched {len(results)} details in {end_time - start_time:.2f} seconds.")
    for r in results[:10]:
        print(f"Content ID: {r[0]} -> MAL ID: {r[1]} ({r[2]} / {r[3]})")

if __name__ == '__main__':
    test_fetch_batch()
