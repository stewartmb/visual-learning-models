"""Checks tied to the scientific meaning of the explorer and delivery contract."""
from pathlib import Path
import csv
import hashlib
import importlib.util
import json
import math

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'static/data'


def test_fixed_cohort_and_states():
    data = json.loads((DATA / 'dataset.json').read_text())
    ids, labels = data['samples']['ids'], data['samples']['labels']
    assert len(ids) == len(set(ids)) == 1000
    assert all(labels.count(c) == 100 for c in range(10))
    assert data['meta']['epochs'] == [0, 1, 2, 5, 10, 15, 20]
    assert data['meta']['train_count'] == 50000
    assert data['meta']['validation_count'] == data['meta']['test_count'] == 10000
    for experiment in data['experiments'].values():
        for seq, record in experiment['sequences'].items():
            assert len(record['frames']) == (4 if seq.startswith('t2-') else 7)
            for frame in record['frames']:
                assert len(frame) == 1000
                assert all(len(p) == 2 and all(math.isfinite(v) for v in p) for p in frame)
            assert all(0 <= m['neighborhood_hit'] <= 1 and 0 <= m['trustworthiness'] <= 1 for m in record['quality'])
        for probabilities, predictions in zip(experiment['probabilities'], experiment['predictions']):
            assert len(probabilities) == len(predictions) == 1000
            for vector, predicted in zip(probabilities, predictions):
                assert len(vector) == 10 and abs(sum(vector)-1) < .00011
                assert all(0 <= p <= 1 for p in vector)
                # Predictions use full precision; exported probabilities are rounded.
                assert vector[predicted] == max(vector)
        for rows in experiment['neighbors'].values():
            assert len(rows) == 1000
            assert all(len(row) == 6 and len(set(row)) == 6 and i not in row and all(0 <= j < 1000 for j in row) for i, row in enumerate(rows))
    # Both experiments genuinely start from the same untrained network.
    assert data['experiments']['base']['predictions'][0] == data['experiments']['refined']['predictions'][0]
    assert data['experiments']['base']['probabilities'][0] == data['experiments']['refined']['probabilities'][0]


def test_csv_edges_preserve_identity_and_consecutive_states():
    with (DATA / 'nodes.csv').open() as f:
        nodes = {row['node_id']: row for row in csv.DictReader(f)}
    assert len(nodes) == 112000
    count = 0
    with (DATA / 'edges.csv').open() as f:
        for edge in csv.DictReader(f):
            a, b = nodes[edge['source']], nodes[edge['target']]
            assert a['observation_id'] == b['observation_id'] == edge['observation_id']
            assert a['experiment'] == b['experiment'] == edge['experiment']
            assert a['sequence'] == b['sequence'] == edge['sequence']
            if edge['task'] == 'T1':
                assert a['layer'] == b['layer'] and int(a['epoch']) < int(b['epoch'])
            else:
                assert a['epoch'] == b['epoch'] and int(a['layer'])+1 == int(b['layer'])
            count += 1
    assert count == 90000


def test_published_file_hashes():
    hashes = json.loads((DATA / 'sha256.json').read_text())
    assert hashes
    for name, expected in hashes.items():
        assert hashlib.sha256((DATA / name).read_bytes()).hexdigest() == expected


def test_flask_contract():
    spec = importlib.util.spec_from_file_location('visual_learning_app', ROOT / 'app.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    client = module.app.test_client()
    assert client.get('/').status_code == 200
    assert client.get('/health').json == {'status': 'ok', 'data_ready': True}
    assert client.get('/api/data').status_code == 200
    assert client.get('/api/manifest').status_code == 200
    assert len(client.get('/api/sequence/base/t1-l3').json['frames']) == 7
    assert client.get('/api/sequence/nope/t1-l3').status_code == 404
    assert client.get('/api/sequence/base/nope').status_code == 404
