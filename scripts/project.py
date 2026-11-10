"""Precompute aligned embeddings and publish only measured data for the D3 explorer."""
from pathlib import Path
import argparse
import csv
import gc
import hashlib
import importlib.metadata
import json
import os
import time
import warnings

os.environ.setdefault('NUMBA_NUM_THREADS', '4')
os.environ.setdefault('OMP_NUM_THREADS', '4')
import numpy as np
from sklearn.manifold import TSNE, trustworthiness
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors
from threadpoolctl import threadpool_limits
from umap import AlignedUMAP

ROOT = Path(__file__).resolve().parents[1]
EPOCHS = [0, 1, 2, 5, 10, 15, 20]
PARAMS = dict(n_neighbors=15, min_dist=.1, n_components=2, metric='euclidean',
              n_epochs=200, random_state=42, alignment_regularisation=.01,
              alignment_window_size=2)


def dump(path, value):
    path.write_text(json.dumps(value, separators=(',', ':'), allow_nan=False))


def normalize(frames):
    joined = np.concatenate(frames)
    center = (joined.max(0) + joined.min(0)) / 2
    scale = float(np.ptp(joined, axis=0).max() / 2) or 1
    return [(f - center) / scale for f in frames]


def quality(original, projected, labels):
    idx = NearestNeighbors(n_neighbors=7).fit(projected).kneighbors(projected, return_distance=False)
    # Remove each query's own index explicitly; duplicates may change self position.
    neighbors = np.array([[j for j in row if j != i][:6] for i, row in enumerate(idx)])
    return {'neighborhood_hit': round(float((labels[neighbors] == labels[:, None]).mean()), 5),
            'trustworthiness': round(float(trustworthiness(original, projected, n_neighbors=10)), 5)}


def run(cache):
    out = ROOT / 'static/data'
    info = json.loads((cache / 'training.json').read_text())
    info['experiments'] = {'base': info['experiments']['base']}
    info.pop('intervention', None)
    samples = json.loads((out / 'samples.json').read_text())
    labels = np.array(samples['labels'])
    result = {'meta': info, 'samples': samples, 'experiments': {}}
    start = time.time()
    for exp in ['base']:
        acts = np.load(cache / f'{exp}-activations.npz')
        pred = [acts[f'prob_{e}'].argmax(1).tolist() for e in EPOCHS]
        probs = [np.round(acts[f'prob_{e}'].astype(np.float64), 5).tolist() for e in EPOCHS]
        neighbors = {}
        for e in EPOCHS:
            for l in range(4):
                a = acts[f'act_{e}_{l}']
                idx = NearestNeighbors(n_neighbors=7).fit(a).kneighbors(a, return_distance=False)
                neighbors[f'{e}_{l}'] = [[int(j) for j in row if j != i][:6] for i, row in enumerate(idx)]
        record = {'predictions': pred, 'probabilities': probs, 'neighbors': neighbors, 'sequences': {}}
        tasks = [(f't1-l{l}', [acts[f'act_{e}_{l}'] for e in EPOCHS]) for l in range(4)]
        tasks += [(f't2-e{e}', [acts[f'act_{e}_{l}'] for l in range(4)]) for e in EPOCHS]
        for key, arrays in tasks:
            target = cache / f'{exp}-{key}-aligned.npz'
            print(f'{exp} {key}: {len(arrays)} states ...', flush=True)
            if target.exists():
                saved = np.load(target)
                frames = [saved[f'f{i}'] for i in range(len(arrays))]
            else:
                relations = [{i: i for i in range(len(labels))} for _ in arrays[1:]]
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore', UserWarning)
                    model = AlignedUMAP(**PARAMS).fit(arrays, relations=relations)
                frames = normalize([np.asarray(f, dtype=np.float32) for f in model.embeddings_])
                np.savez_compressed(target, **{f'f{i}': f for i, f in enumerate(frames)})
                del model
                gc.collect()
            metrics = [quality(a, f, labels) for a, f in zip(arrays, frames)]
            record['sequences'][key] = {'frames': [np.round(f.astype(np.float64), 4).tolist() for f in frames], 'quality': metrics}
            print(f'{exp} {key}: done ({time.time()-start:.0f}s)', flush=True)
        # Paper section 5.4 reference: all epochs in one t-SNE, last hidden layer.
        target = cache / f'{exp}-joint-tsne.npz'
        if not target.exists():
            print(f'{exp}: joint t-SNE reference ...', flush=True)
            stacked = np.concatenate([acts[f'act_{e}_3'] for e in EPOCHS])
            reduced = PCA(n_components=50, random_state=42).fit_transform(stacked)
            projected = TSNE(n_components=2, perplexity=30, max_iter=1000, init='pca',
                             learning_rate='auto', random_state=42, n_jobs=4).fit_transform(reduced)
            np.savez_compressed(target, projected=projected)
        joint = np.load(target)['projected']
        joint_frames = normalize(list(joint.reshape(7, len(labels), 2)))
        record['sequences']['reference-tsne'] = {'frames': [np.round(f.astype(np.float64), 4).tolist() for f in joint_frames],
            'quality': [quality(acts[f'act_{e}_3'], f, labels) for e, f in zip(EPOCHS, joint_frames)]}
        result['experiments'][exp] = record
        dump(out / f'{exp}.json', record)
        print(f'{exp}: JSON saved', flush=True)
    result['meta']['projection'] = {'name': 'AlignedUMAP', 'parameters': PARAMS,
        'input': 'hidden activations; class labels excluded',
        'coordinate_normalization': 'one isotropic affine transform per complete sequence',
        'reference': {'name': 'joint t-SNE last layer', 'perplexity': 30, 'pca': 50, 'iterations': 1000},
        'neighborhood_hit_k': 6, 'trustworthiness_k': 10,
        'interpretation': 'Embedding alignment regularizes motion; it does not prove causal learning or exact distance preservation.'}
    result['meta']['versions'] = {p: importlib.metadata.version(p) for p in ['torch', 'torchvision', 'numpy', 'scikit-learn', 'umap-learn', 'numba', 'Flask']}
    result['meta']['bundling'] = {'type': 'class-centroid attraction of cubic Bezier control points',
        'labels_used_in_drawing': True, 'labels_used_in_projection': False,
        'strength_default': .45, 'measured_waypoints_preserved': True,
        'max_control_offset_ratio': .25, 'monotonic_along_chord': True,
        'is_original_paper_CUBu': False}
    dump(out / 'manifest.json', result['meta'])
    dump(out / 'dataset.json', result)
    export_csv(result, out)
    hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file() and p.name != 'sha256.json'}
    dump(out / 'sha256.json', hashes)
    print(f'All projections published in {time.time()-start:.0f}s', flush=True)


def export_csv(data, out):
    with (out / 'nodes.csv').open('w', newline='') as fn, (out / 'edges.csv').open('w', newline='') as fe:
        nodes = csv.writer(fn, lineterminator='\n')
        edges = csv.writer(fe, lineterminator='\n')
        nodes.writerow(['node_id', 'experiment', 'task', 'sequence', 'epoch', 'layer', 'observation_id', 'true_class', 'predicted_class', 'x', 'y'])
        edges.writerow(['source', 'target', 'observation_id', 'experiment', 'task', 'sequence'])
        for exp, record in data['experiments'].items():
            for sequence, seq in record['sequences'].items():
                if sequence == 'reference-tsne':
                    continue
                temporal = sequence.startswith('t1')
                task = 'T1' if temporal else 'T2'
                for frame, positions in enumerate(seq['frames']):
                    epoch = EPOCHS[frame] if temporal else int(sequence[4:])
                    layer = int(sequence[4:]) if temporal else frame
                    for i, (x, y) in enumerate(positions):
                        obs = data['samples']['ids'][i]
                        nid = f'{exp}:{sequence}:{frame}:{obs}'
                        nodes.writerow([nid, exp, task, sequence, epoch, layer+1, obs, data['samples']['labels'][i], record['predictions'][EPOCHS.index(epoch)][i], round(x, 4), round(y, 4)])
                        if frame:
                            edges.writerow([f'{exp}:{sequence}:{frame-1}:{obs}', nid, obs, exp, task, sequence])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / 'work')
    args = parser.parse_args()
    with threadpool_limits(limits=4):
        run(args.cache)
