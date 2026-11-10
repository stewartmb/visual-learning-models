# Working on this project

- This is the UTEC Visual Learning Models assignment. The user's assignment is the primary requirement; see `docs/requirements.md`.
- Preserve T1 (epochs, fixed layer) and T2 (layers, fixed epoch), the persistent observation IDs, and the visualization mantra.
- Keep both trail-bundling views, linked selection, raw-image inspection and static comparisons. Design decisions are in `docs/design.md`.
- Keep one epoch selector per task (T1 thumbnails; T2 dropdown), one class/error filter area and read-only prediction history. The user's latest direction requires fixed peripheral controls and a stable right preview; hover updates detail without dimming the map, click pins and dims. Filters retain a faint full-cohort reference with class labels. Settings must not expand above or displace the map.
- Use only D3 for visualization. Flask serves precomputed data; page loads must never train models or fetch graphics dependencies.
- Never substitute synthetic results for measured ones. Retain the true untrained epoch 0 and separate training/validation/test sets.
- Distinguish drawing, projection, representation and model-output metrics. Bundling by class is a drawing aid, not independent evidence of learned separation.
- Class recommendations are documented from the locally generated exhaustive HTML, not the SRT; see `docs/presentation-guide.md` for timestamps. Do not publish the supplied PDFs or the class recording.
- Browser controls and the offline export use the same source. After changing the interface, regenerate the export with `scripts/export.py` and run the relevant browser checks.
- Data integrity: `python -m pytest tests/test_integrity.py -q`. Browser: run `python app.py` then `npm test`.
- `work/`, environments and caches are ignored. Keep secrets and local absolute paths out of the public repository.
