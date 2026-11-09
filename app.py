"""Serve the precomputed explorer. Running the app never retrains the model."""
from pathlib import Path
import json
import os
from flask import Flask, abort, jsonify, render_template, send_from_directory

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'static/data'
app = Flask(__name__, root_path=str(ROOT))
app.config['TEMPLATES_AUTO_RELOAD'] = True


@app.get('/')
def index():
    return render_template('index.html')


@app.get('/health')
def health():
    ready = (DATA / 'dataset.json').exists()
    return jsonify(status='ok' if ready else 'preparing', data_ready=ready), 200 if ready else 503


@app.get('/api/manifest')
def manifest():
    if not (DATA / 'manifest.json').exists():
        abort(503, 'Los datos todavía se están preparando.')
    return send_from_directory(DATA, 'manifest.json')


@app.get('/api/data')
def dataset():
    if not (DATA / 'dataset.json').exists():
        abort(503, 'Los datos todavía se están preparando.')
    return send_from_directory(DATA, 'dataset.json')


@app.get('/api/sequence/<experiment>/<sequence>')
def sequence(experiment, sequence):
    if experiment not in ('base', 'refined'):
        abort(404)
    file = DATA / f'{experiment}.json'
    if not file.exists():
        abort(503)
    sequences = json.loads(file.read_text())['sequences']
    if sequence not in sequences:
        abort(404)
    return jsonify(sequences[sequence])


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '5123')), debug=False)
