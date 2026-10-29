#!/usr/bin/env bash
# Quick check that the Ollama endpoint is reachable and which models it has.
# Uses ADRES_MODELU / TOKEN_MODELU if set, otherwise a local Ollama.
set -uo pipefail

URL="${ADRES_MODELU:-http://localhost:11434}"
HDR=()
[ -n "${TOKEN_MODELU:-}" ] && HDR=(-H "X-Api-Key: $TOKEN_MODELU")

code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "${HDR[@]}" "$URL/api/tags")
echo "GET $URL/api/tags -> $code"
[ "$code" = "200" ] || exit 1

echo "available models:"
curl -s "${HDR[@]}" "$URL/api/tags" | python3 -c 'import json,sys; [print("  " + m["name"]) for m in json.load(sys.stdin)["models"]]'
echo "loaded right now:"
curl -s "${HDR[@]}" "$URL/api/ps" | python3 -c 'import json,sys; [print("  " + m["name"]) for m in json.load(sys.stdin)["models"]]'
