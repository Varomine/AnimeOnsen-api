import urllib.parse
import base64
import requests

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

def test_paging():
    token = get_token()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': f'Bearer {token}'
    }
    
    start = 0
    limit = 100
    has_next = True
    page = 1
    total_count = 0
    
    while has_next and page < 15:
        url = f'https://api.animeonsen.xyz/v4/content/index?start={start}&limit={limit}'
        r = requests.get(url, headers=headers)
        data = r.json()
        cursor = data.get('cursor', {})
        content = data.get('content', [])
        total_count += len(content)
        print(f"Page {page}: start={start}, limit={limit}, returned={len(content)}, next={cursor.get('next')}")
        
        has_next = cursor.get('next')[0]
        start = cursor.get('next')[1]
        page += 1
        
    print("Total count fetched:", total_count)

if __name__ == '__main__':
    test_paging()
