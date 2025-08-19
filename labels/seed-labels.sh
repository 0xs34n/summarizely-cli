#!/usr/bin/env bash
set -euo pipefail

LABELS_FILE="${1:-labels/labels.json}"

if ! command -v gh >/dev/null; then echo "Install gh: https://cli.github.com/"; exit 1; fi
if ! command -v jq >/dev/null; then echo "Install jq first"; exit 1; fi

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [[ -z "$repo" ]]; then
  echo "Not in a GitHub repo. Set GH repo then rerun."
  exit 1
fi

echo "Seeding labels in $repo from $LABELS_FILE"

count=$(jq '.labels | length' "$LABELS_FILE")
for i in $(seq 0 $((count-1))); do
  name=$(jq -r ".labels[$i].name" "$LABELS_FILE")
  color=$(jq -r ".labels[$i].color" "$LABELS_FILE")
  desc=$(jq -r ".labels[$i].description" "$LABELS_FILE")
  echo "=> $name"
  gh label create "$name" --color "$color" --description "$desc" 2>/dev/null || \
  gh label edit "$name" --color "$color" --description "$desc"
done

echo "Done."

