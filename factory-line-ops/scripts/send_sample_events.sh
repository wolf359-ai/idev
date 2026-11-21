#!/usr/bin/env bash
# Post fictional sample events to Splunk HEC.
# Token and URL come from the environment — never from git.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENT_DIR="${ROOT}/samples/events"

if [[ -z "${SPLUNK_HEC_URL:-}" ]]; then
  echo "Set SPLUNK_HEC_URL (see .env.example)" >&2
  exit 1
fi
if [[ -z "${SPLUNK_HEC_TOKEN:-}" ]]; then
  echo "Set SPLUNK_HEC_TOKEN from your secret store. Do not put it in git." >&2
  exit 1
fi

curl_opts=(-sS -X POST "${SPLUNK_HEC_URL}"
  -H "Authorization: Splunk ${SPLUNK_HEC_TOKEN}"
  -H "Content-Type: application/json")

if [[ "${SPLUNK_HEC_INSECURE:-0}" == "1" ]]; then
  echo "Warning: TLS verification disabled (lab only)." >&2
  curl_opts+=(-k)
fi

shopt -s nullglob
files=("${EVENT_DIR}"/*.json)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No sample JSON files in ${EVENT_DIR}" >&2
  exit 1
fi

for f in "${files[@]}"; do
  echo "Sending $(basename "$f")"
  curl "${curl_opts[@]}" --data-binary @"${f}"
  echo
done
