# No Need to Be So Big

Semantic Web course project (PUT, 2026/27).

We reproduce the knowledge-extraction part of **ShallKnow**
([paper](https://papers.dice-research.org/2026/ESWC_shallknow/public.pdf),
[code](https://github.com/dice-group/ShallKnow)) and then check how far the 14B LLM used
there (`deepseek-r1:14b`) can be replaced with smaller, quantized models before the quality
of the extracted shallow knowledge drops.

Team: Bartosz Tarnachowicz, Piotr Szymiec, Michał Żarnowski, Cezary Suchorski, Piotr Renk

## Repository layout

```
shallknow/      code taken from the original repo (with small changes, see below)
tools/          our helper scripts (data download, input preparation, model check)
data/raw/       benchmark files from Zenodo (not in git, use tools/download_data.sh)
data/input/     inputs prepared for the extractor (not in git)
notebooks/      exploratory analysis
results/        outputs of the runs (not in git)
```

## Setup

Python 3.10 (same as upstream; the pinned torch 2.3.1 has no wheels for Python 3.13+).

```bash
uv venv --python 3.10 .venv        # or: python3.10 -m venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt # or: pip install -r requirements.txt
```

`requirements.txt` is a subset of the upstream one, without the CUDA-only packages, so it
installs on macOS as well as on Linux.

### LLM

The extractor talks to an [Ollama](https://ollama.com) server.

- local Ollama: `ollama pull deepseek-r1:14b`, nothing else to set
- remote Ollama behind an API-key gateway: set `ADRES_MODELU` (base URL, e.g. `http://my-server:11434`)
  and `TOKEN_MODELU` (sent as `X-Api-Key`). Keep the token in your shell profile, never in the repo.

`tools/check_model.sh` shows if the server is reachable and which models it has.

## Data

```bash
tools/download_data.sh
python tools/prepare_input.py data/raw/BPDP_train_reified_wikidata_final.ttl data/input/BPDP_train_reified.nt
```

The Zenodo files ([record 15390036](https://zenodo.org/records/15390036)) use Wikidata IRIs,
but the extractor builds Wikipedia article titles from the subject/object IRIs (it was written
for the DBpedia version of the benchmarks). `prepare_input.py` maps every Wikidata entity to its
English Wikipedia title and writes it back as `http://dbpedia.org/resource/<Title>`.
Entities without an English article are left unchanged and later skipped by the extractor
(9 of 125 in BPDP train, 15 of 136 in BPDP test).

## Running the paragraph simplification step

```bash
cd shallknow
python wikipedia_extractor_final.py deepseek-r1:14b \
    --input ../data/input/BPDP_train_reified.nt \
    --output-dir ../results/bpdp_train_deepseek-r1-14b
```

For each true statement in the input, the script downloads the Wikipedia pages of the
subject and the object **and of every page they link to**, asks the LLM to keep only the
text about the two entities, runs coreference resolution (Maverick) on the answer and saves
one JSONL file per page in the output dir. The run can be stopped and restarted, it skips
pages that are already done (the bookkeeping files are in the output dir).

This means one LLM call per linked page. A typical article has a few hundred links
(e.g. Winnipeg 771, Bing Crosby 1118), so a full BPDP train run is tens of thousands of calls.
For quick tests use:

- `--limit N` only the first N true statements (sorted, so always the same ones)
- `--max-links N` follow at most N links per page

Without these flags the script behaves like the original.

### Changes compared to upstream

- `llm_query_final.py`: endpoint taken from `ADRES_MODELU` (default `localhost:11434`),
  `X-Api-Key` header when `TOKEN_MODELU` is set; `OLLAMA_URL` still works as before.
- `wikipedia_extractor_final.py`:
  - input file, output dir, `--limit`, `--max-links` from the command line, bookkeeping files in the output dir;
  - proper `User-Agent` for the Wikipedia API (the default one from `requests` now gets HTTP 403);
  - Maverick runs on CUDA if available, otherwise on CPU (`COREF_DEVICE` to override).
    It does not work on Apple MPS, it creates float64 tensors.

## Status

- [x] repo structure, environment, data download
- [x] extractor runs end to end on a Mac (tested with `--limit 1 --max-links 2`)
- [ ] baseline run with `deepseek-r1:14b`
- [ ] exploratory analysis of the datasets (milestone 2)
- [ ] smaller / quantized models
