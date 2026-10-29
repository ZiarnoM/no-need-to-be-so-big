#!/usr/bin/env bash
# Downloads the ShallKnow benchmark files from Zenodo (https://zenodo.org/records/15390036)
set -euo pipefail

cd "$(dirname "$0")/../data/raw"
for f in BPDP_train_reified_wikidata_final.ttl BPDP_test_reified_wikidata_final.ttl \
         Factbench_train_final.ttl Factbench_test_final.ttl \
         Favel_train_combined.ttl Favel_test_combined.ttl; do
    if [ -f "$f" ]; then
        echo "$f already there"
        continue
    fi
    echo "downloading $f"
    curl -sSfL -o "$f" "https://zenodo.org/api/records/15390036/files/$f/content"
done
