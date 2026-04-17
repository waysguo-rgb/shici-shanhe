"""
豆包 TTS 旧版 API (v1) - AppID + Access Token + Cluster
对应控制台里的"服务接口认证信息"三件套凭证.

环境变量:
  DOUBAO_APPID    — APP ID
  DOUBAO_TOKEN    — Access Token
  DOUBAO_CLUSTER  — Cluster (默认 volcano_tts)
  DOUBAO_VOICE    — Voice Type (默认 BV001_streaming)

用法:
  python tools/generate_doubao_tts_legacy.py --only 汴京
"""
import os, sys, json, uuid, base64, time, argparse
from pathlib import Path

try:
    import requests
except ImportError:
    print('缺 requests: pip install requests'); sys.exit(1)

HERE = Path(__file__).parent
ROOT = HERE.parent
LOCATIONS_JSON = ROOT / 'public' / 'assets' / 'locations' / 'locations.json'
AUDIO_DIR = ROOT / 'public' / 'assets' / 'audio'

APPID   = os.getenv('DOUBAO_APPID', '').strip()
TOKEN   = os.getenv('DOUBAO_TOKEN', '').strip()
CLUSTER = os.getenv('DOUBAO_CLUSTER', 'volcano_tts').strip()
VOICE   = os.getenv('DOUBAO_VOICE',   'BV001_streaming').strip()
API_URL = 'https://openspeech.bytedance.com/api/v1/tts'

if not APPID or not TOKEN:
    print('错误: 需要 DOUBAO_APPID 和 DOUBAO_TOKEN 环境变量'); sys.exit(1)

def build_text(poem):
    title = poem['title']; author = poem['author']; dynasty = poem['dynasty']
    dyn = dynasty if dynasty.endswith('代') else dynasty + '代'
    parts = [title, '。', dyn, '，', author, '。']
    for line in poem['lines']:
        parts.append(line); parts.append('。')
    return ''.join(parts)

def synthesize(text, out_path, retries=4):
    headers = {
        'Authorization': f'Bearer;{TOKEN}',
        'Content-Type':  'application/json',
    }
    body = {
        'app':  {'appid': APPID, 'token': TOKEN, 'cluster': CLUSTER},
        'user': {'uid': 'poetry-map'},
        'audio': {
            'voice_type': VOICE,
            'encoding':   'mp3',
            'speed_ratio': 0.9,
        },
        'request': {
            'reqid':     str(uuid.uuid4()),
            'text':      text,
            'text_type': 'plain',
            'operation': 'query',
        },
    }
    last_err = None
    for attempt in range(retries):
        try:
            r = requests.post(API_URL, headers=headers, json=body, timeout=60)
            if r.status_code != 200:
                last_err = f'HTTP {r.status_code}: {r.text[:300]}'
                time.sleep(2 * (attempt + 1)); continue
            j = r.json()
            # 成功 code: 3000
            if j.get('code') != 3000:
                last_err = f'code={j.get("code")}: {j.get("message", "")[:200]}'
                # 明确的配置错误不重试
                if j.get('code') in (4000, 4001, 4003, 4004, 4005):
                    break
                time.sleep(2 * (attempt + 1)); continue
            data = j.get('data', '')
            if not data:
                last_err = 'empty data'; time.sleep(2); continue
            mp3 = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(mp3)
            return len(mp3)
        except requests.RequestException as e:
            last_err = f'net: {type(e).__name__} {e}'
            time.sleep(2.5 * (attempt + 1))
    raise RuntimeError(last_err or 'unknown')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only',  help='只生成指定地点')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    with open(LOCATIONS_JSON, encoding='utf-8') as f:
        locs = json.load(f)
    only = set(args.only.split(',')) if args.only else None

    tasks = []
    for loc in locs:
        if only and loc['name'] not in only: continue
        for p in loc['poems']:
            tasks.append((loc['name'], p))

    total = len(tasks); ok = skip = fail = 0; bytes_total = 0
    print(f'待处理 {total} 首, voice={VOICE}, cluster={CLUSTER}')
    print('=' * 60)
    for i, (loc, poem) in enumerate(tasks):
        title = poem['title']
        out = AUDIO_DIR / loc / f'{title}.mp3'
        if out.exists() and not args.force:
            skip += 1
            print(f'[{i+1:3}/{total}] · 已存在: {loc}/{title}.mp3')
            continue
        try:
            sz = synthesize(build_text(poem), out)
            ok += 1; bytes_total += sz
            print(f'[{i+1:3}/{total}] ✓ {loc}/{title} | {sz//1024}KB')
        except Exception as e:
            fail += 1
            print(f'[{i+1:3}/{total}] ✗ {loc}/{title} | {e}')
        time.sleep(0.5)
    print('=' * 60)
    print(f'成功 {ok} / 跳过 {skip} / 失败 {fail}, 共 {bytes_total/1024/1024:.1f} MB')

if __name__ == '__main__':
    main()
