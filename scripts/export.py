"""Package a fully offline HTML preview; Flask and the same source remain the app."""
from pathlib import Path
import base64
import hashlib
import json
import argparse

ROOT = Path(__file__).resolve().parents[1]


def compact(value):
    if isinstance(value, float):
        return round(value, 5)
    if isinstance(value, list):
        return [compact(v) for v in value]
    if isinstance(value, dict):
        return {k: compact(v) for k, v in value.items()}
    return value


def export(target):
    folder = ROOT / 'static/data'
    # Remove float32 representation noise, retaining 4-digit coordinates/5-digit probabilities.
    for p in folder.glob('*.json'):
        if p.name == 'sha256.json':
            continue
        p.write_text(json.dumps(compact(json.loads(p.read_text())), separators=(',', ':'), allow_nan=False))
    hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.iterdir() if p.is_file() and p.name != 'sha256.json'}
    (folder / 'sha256.json').write_text(json.dumps(hashes, indent=2))
    html = (ROOT / 'templates/index.html').read_text()
    css = (ROOT / 'static/style.css').read_text()
    d3 = (ROOT / 'static/vendor/d3.v7.min.js').read_text()
    trails = (ROOT / 'static/trails.js').read_text()
    js = (ROOT / 'static/explorer.js').read_text()
    data = (folder / 'dataset.json').read_text().replace('</', '<\\/')
    image = base64.b64encode((folder / 'digits.png').read_bytes()).decode()
    html = html.replace('  <link rel="stylesheet" href="/static/style.css">', '<style>'+css+'</style>')
    html = html.replace('  <script defer src="/static/vendor/d3.v7.min.js"></script>', '<script>'+d3+'</script>')
    html = html.replace('  <script defer src="/static/trails.js"></script>', '<script>'+trails+'</script>')
    html = html.replace('  <script defer src="/static/explorer.js"></script>', '')
    html = html.replace('</body>', f'<script>window.VLM_DATA={data};window.VLM_ATLAS="data:image/png;base64,{image}";</script>\n<script>{js}</script>\n</body>')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html)
    print(f'Offline preview: {target} ({target.stat().st_size:,} bytes)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT.parent / 'Visual_Learning_Models_interactivo.html')
    export(parser.parse_args().output)
