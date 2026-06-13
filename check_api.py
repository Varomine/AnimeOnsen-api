import urllib.parse
import base64
import requests
import json

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

def test_episode_api():
    token = get_token()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': f'Bearer {token}'
    }
    
    # Fetching episode 1 of Botan Kamiina
    url = 'https://api.animeonsen.xyz/v4/content/9QYrPOwl3sfnTFf4/video/1'
    print("Fetching episode video details...")
    r = requests.get(url, headers=headers)
    print("Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print(json.dumps(data, indent=2))
    else:
        print(r.text)

if __name__ == '__main__':
    test_episode_api()
