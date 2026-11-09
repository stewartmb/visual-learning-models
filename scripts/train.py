"""Real MNIST training: fixed held-out IDs, genuine checkpoints, controlled intervention."""
from pathlib import Path
import argparse
import hashlib
import json
import time

import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
import torch
from torch import nn
from torch.nn import functional as F
from torchvision.datasets import MNIST

ROOT = Path(__file__).resolve().parents[1]
EPOCHS = [0, 1, 2, 5, 10, 15, 20]
SEED = 42


class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.hidden = nn.ModuleList([nn.Linear(784, 128)] + [nn.Linear(128, 128) for _ in range(3)])
        self.output = nn.Linear(128, 10)

    def forward(self, x, activations=False):
        saved = []
        for layer in self.hidden:
            x = F.relu(layer(x))
            saved.append(x)
        logits = self.output(x)
        return (logits, saved) if activations else logits


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cache):
    cache.mkdir(parents=True, exist_ok=True)
    out = ROOT / 'static/data'
    out.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    raw_train = MNIST(cache / 'mnist', train=True, download=True)
    raw_test = MNIST(cache / 'mnist', train=False, download=True)
    labels = raw_train.targets.numpy()
    train_ids, val_ids = train_test_split(np.arange(60000), test_size=10000, stratify=labels, random_state=SEED)
    rng = np.random.default_rng(SEED)
    test_labels = raw_test.targets.numpy()
    sample_ids = np.concatenate([rng.choice(np.flatnonzero(test_labels == c), 100, replace=False) for c in range(10)])
    rng.shuffle(sample_ids)
    np.savez_compressed(cache / 'splits.npz', train=train_ids, validation=val_ids, sample=sample_ids)
    xtrain = raw_train.data[torch.as_tensor(train_ids)].float().unsqueeze(1) / 255
    ytrain = raw_train.targets[torch.as_tensor(train_ids)]
    xval = raw_train.data[torch.as_tensor(val_ids)].float().flatten(1) / 255
    yval = raw_train.targets[torch.as_tensor(val_ids)]
    xtest = raw_test.data.float().flatten(1) / 255
    ytest = raw_test.targets
    xsubset = xtest[sample_ids]
    atlas = Image.new('L', (40 * 28, 25 * 28), 0)
    for i, obs in enumerate(sample_ids):
        atlas.paste(Image.fromarray(raw_test.data[int(obs)].numpy()), ((i % 40) * 28, (i // 40) * 28))
    atlas.save(out / 'digits.png', optimize=True)
    samples = {'ids': sample_ids.tolist(), 'labels': test_labels[sample_ids].tolist(), 'atlas': {'columns': 40, 'size': 28}}
    (out / 'samples.json').write_text(json.dumps(samples, separators=(',', ':')))
    initial = MLP().state_dict()
    torch.save(initial, cache / 'initial.pt')
    report = {'seed': SEED, 'epochs': EPOCHS, 'architecture': [784, 128, 128, 128, 128, 10],
              'train_count': 50000, 'validation_count': 10000, 'test_count': 10000, 'sample_count': 1000,
              'optimizer': {'name': 'Adam', 'learning_rate': .001, 'batch_size': 128},
              'intervention': {'name': 'dilation', 'kernel': 3, 'train_fraction': .25, 'validation_and_test': 'original'},
              'split_sha256': sha(cache / 'splits.npz'), 'experiments': {}}
    for name in ['base', 'refined']:
        target = cache / f'{name}-activations.npz'
        metrics_file = cache / f'{name}-training.json'
        if target.exists() and metrics_file.exists():
            report['experiments'][name] = json.loads(metrics_file.read_text())
            print(f'{name}: cached', flush=True)
            continue
        torch.manual_seed(SEED)
        model = MLP()
        model.load_state_dict(initial)
        opt = torch.optim.Adam(model.parameters(), lr=.001)
        x = xtrain.clone()
        if name == 'refined':
            dilation_rng = np.random.default_rng(SEED + 1)
            augmented = torch.as_tensor(dilation_rng.choice(len(x), len(x) // 4, replace=False))
            x[augmented] = F.max_pool2d(x[augmented], 3, stride=1, padding=1)
            np.save(cache / 'dilated-train-indices.npy', augmented.numpy())
        x = x.flatten(1)
        order_rng = torch.Generator().manual_seed(SEED)
        arrays = {}
        history = []
        begin = time.time()

        def snapshot(epoch, loss):
            model.eval()
            with torch.no_grad():
                logits, acts = model(xsubset, activations=True)
                probs = logits.softmax(1).numpy()
                arrays[f'prob_{epoch}'] = probs
                for layer, a in enumerate(acts):
                    arrays[f'act_{epoch}_{layer}'] = a.numpy()
                # Evaluate full held-out sets in batches to keep peak memory small.
                def accuracy(features, targets):
                    correct = 0
                    for j in range(0, len(features), 1000):
                        correct += int((model(features[j:j+1000]).argmax(1) == targets[j:j+1000]).sum())
                    return correct / len(features)
                item = {'epoch': epoch, 'loss': loss, 'validation_accuracy': accuracy(xval, yval),
                        'test_accuracy': accuracy(xtest, ytest),
                        'sample_accuracy': float((probs.argmax(1) == test_labels[sample_ids]).mean())}
            history.append(item)
            torch.save(model.state_dict(), cache / f'{name}-epoch-{epoch}.pt')
            print(f'{name} checkpoint {epoch}: test={item["test_accuracy"]:.4f}, subset={item["sample_accuracy"]:.4f}', flush=True)

        snapshot(0, None)
        for epoch in range(1, 21):
            model.train()
            permutation = torch.randperm(len(x), generator=order_rng)
            total = 0.
            for start in range(0, len(x), 128):
                idx = permutation[start:start+128]
                opt.zero_grad(set_to_none=True)
                loss = F.cross_entropy(model(x[idx]), ytrain[idx])
                loss.backward()
                opt.step()
                total += float(loss.detach()) * len(idx)
            avg_loss = total / len(x)
            print(f'{name} epoch {epoch}/20 loss={avg_loss:.4f} elapsed={time.time()-begin:.0f}s', flush=True)
            if epoch in EPOCHS:
                snapshot(epoch, avg_loss)
        np.savez_compressed(target, **arrays)
        record = {'history': history, 'activation_sha256': sha(target), 'training_seconds': round(time.time()-begin, 2)}
        metrics_file.write_text(json.dumps(record, indent=2))
        report['experiments'][name] = record
    (cache / 'training.json').write_text(json.dumps(report, indent=2))
    print('Training completed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / 'work')
    run(parser.parse_args().cache)
