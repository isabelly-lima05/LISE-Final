"""Configure the static client's API origin and CSP together."""
import argparse,json
from pathlib import Path
from urllib.parse import urlsplit
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('origin',help='https://sua-api.vercel.app (sem /api/v1)')
args=parser.parse_args(); parsed=urlsplit(args.origin)
if (parsed.scheme not in ('https','http') or not parsed.hostname or parsed.username or parsed.password
    or parsed.path not in ('','/') or parsed.query or parsed.fragment
    or (parsed.scheme=='http' and parsed.hostname not in ('localhost','127.0.0.1'))):
    parser.error('Informe somente uma origem HTTPS, sem caminho. HTTP apenas em localhost.')
origin=f'{parsed.scheme}://{parsed.netloc}'
root=Path(__file__).resolve().parents[1]/'frontend_spa'
config=json.loads((root/'vercel.json').read_text())
for group in config['headers']:
    for header in group['headers']:
        if header['key']=='Content-Security-Policy':
            header['value']='; '.join("connect-src 'self' "+origin+' http://127.0.0.1:5000 http://localhost:5000' if d.startswith('connect-src ') else d for d in header['value'].split('; '))
(root/'config.js').write_text('window.LISE_CONFIG = '+json.dumps({'API_BASE_URL':origin},indent=2)+';\n')
(root/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
print('API e connect-src atualizados. Publique o frontend e confira FRONTEND_ORIGINS no backend.')
