set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  echo "usage: scripts/release.sh <cli|desktop|both> <major|minor|patch|X.Y.Z>" >&2
  exit 1
}

TARGET=${1:-}
BUMP=${2:-}
case "$TARGET" in
cli | desktop | both) ;;
*) usage ;;
esac

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  MODE=explicit
elif [[ "$BUMP" =~ ^(major|minor|patch)$ ]]; then
  MODE=bump
else
  usage
fi

DO_DESKTOP=0
DO_CLI=0
case "$TARGET" in
desktop) DO_DESKTOP=1 ;;
cli) DO_CLI=1 ;;
both)
  DO_DESKTOP=1
  DO_CLI=1
  ;;
esac

for dep in git gh node npm; do
  command -v "$dep" >/dev/null || {
    echo "error: $dep not found" >&2
    exit 1
  }
done

[[ $(git rev-parse --abbrev-ref HEAD) == "main" ]] || {
  echo "error: not on main" >&2
  exit 1
}
[[ -z $(git status --porcelain) ]] || {
  echo "error: working tree is not clean" >&2
  exit 1
}
git fetch origin main --quiet
if [[ $(git rev-list --count main..origin/main) -gt 0 ]]; then
  echo "error: main is behind origin/main; pull first" >&2
  exit 1
fi

read_version() {
  node -p "require('./$1/package.json').version"
}

bump_version() {
  IFS=. read -r major minor patch <<<"$1"
  case "$2" in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "$major.$((minor + 1)).0" ;;
  patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

next_of() {
  if [[ $MODE == explicit ]]; then
    echo "$BUMP"
  else
    bump_version "$1" "$BUMP"
  fi
}

DESKTOP_NEXT=""
CLI_NEXT=""
if ((DO_DESKTOP)); then
  DESKTOP_CURRENT=$(read_version desktop)
  DESKTOP_NEXT=$(next_of "$DESKTOP_CURRENT")
  echo "desktop: $DESKTOP_CURRENT -> $DESKTOP_NEXT"
fi
if ((DO_CLI)); then
  CLI_CURRENT=$(read_version cli)
  CLI_NEXT=$(next_of "$CLI_CURRENT")
  echo "cli:     $CLI_CURRENT -> $CLI_NEXT"
fi

tag_exists() {
  git rev-parse -q --verify "refs/tags/$1" >/dev/null && return 0
  git ls-remote --exit-code --tags origin "refs/tags/$1" >/dev/null 2>&1 && return 0
  return 1
}

if ((DO_DESKTOP)); then
  if tag_exists "v$DESKTOP_NEXT"; then
    echo "error: tag v$DESKTOP_NEXT already exists" >&2
    exit 1
  fi
fi
if ((DO_CLI)); then
  if tag_exists "cli-v$CLI_NEXT"; then
    echo "error: tag cli-v$CLI_NEXT already exists" >&2
    exit 1
  fi
  if npm view "@noy4/docserve@$CLI_NEXT" version >/dev/null 2>&1; then
    echo "error: @noy4/docserve@$CLI_NEXT is already published to npm" >&2
    exit 1
  fi
fi

if ((DO_CLI)); then
  echo "==> running cli tests"
  (cd cli && npm test)
fi

set_version() {
  node -e '
    const fs = require("fs");
    const [dir, oldVersion, newVersion] = process.argv.slice(1);
    const file = `${dir}/package.json`;
    const text = fs.readFileSync(file, "utf8");
    const needle = `"version": "${oldVersion}"`;
    if (!text.includes(needle)) {
      console.error(`error: ${needle} not found in ${file}`);
      process.exit(1);
    }
    fs.writeFileSync(file, text.replace(needle, `"version": "${newVersion}"`));
  ' "$1" "$2" "$3"
}

STAGED=()
if ((DO_DESKTOP)); then
  set_version desktop "$DESKTOP_CURRENT" "$DESKTOP_NEXT"
  STAGED+=(desktop/package.json)
fi
if ((DO_CLI)); then
  set_version cli "$CLI_CURRENT" "$CLI_NEXT"
  STAGED+=(cli/package.json)
fi

if ((DO_DESKTOP && DO_CLI)); then
  if [[ "$DESKTOP_NEXT" == "$CLI_NEXT" ]]; then
    MESSAGE="chore: bump version to $DESKTOP_NEXT"
  else
    MESSAGE="chore: bump desktop to $DESKTOP_NEXT, cli to $CLI_NEXT"
  fi
elif ((DO_DESKTOP)); then
  MESSAGE="chore: bump version to $DESKTOP_NEXT"
else
  MESSAGE="chore: bump version to $CLI_NEXT"
fi

git add "${STAGED[@]}"
git commit -m "$MESSAGE"
git push origin main

TAGS=()
if ((DO_DESKTOP)); then
  git tag -a "v$DESKTOP_NEXT" -m "Docserve $DESKTOP_NEXT"
  TAGS+=("v$DESKTOP_NEXT")
fi
if ((DO_CLI)); then
  git tag -a "cli-v$CLI_NEXT" -m "@noy4/docserve $CLI_NEXT"
  TAGS+=("cli-v$CLI_NEXT")
fi
git push origin "${TAGS[@]}"

echo "==> pushed main and tags: ${TAGS[*]}"

watch_workflow() {
  local workflow=$1 tag=$2 id
  for _ in $(seq 1 24); do
    id=$(gh run list --workflow="$workflow" --event push --limit 10 \
      --json databaseId,headBranch,createdAt \
      --jq "[.[] | select(.headBranch==\"$tag\") | select(.event==\"push\")] | sort_by(.createdAt) | last | .databaseId" 2>/dev/null || true)
    if [[ -n "$id" && "$id" != "null" ]]; then
      echo "$id"
      return 0
    fi
    sleep 5
  done
  return 1
}

wait_workflow() {
  local id
  if ! id=$(watch_workflow "$1" "$2"); then
    echo "error: no $1 run registered for $2 within timeout; check https://github.com/noy4/docserve/actions" >&2
    return 1
  fi
  if gh run watch "$id" --exit-status --interval 15 >/dev/null; then
    echo "==> $3: success (https://github.com/noy4/docserve/actions/runs/$id)"
    return 0
  fi
  echo "==> $3: FAILED (https://github.com/noy4/docserve/actions/runs/$id)" >&2
  gh run view "$id" --log-failed 2>/dev/null | tail -n 40 >&2 || true
  return 1
}

RC=0
if ((DO_DESKTOP)); then
  wait_workflow "release-desktop" "v$DESKTOP_NEXT" "release-desktop" || RC=1
fi
if ((DO_CLI)); then
  wait_workflow "publish-cli" "cli-v$CLI_NEXT" "publish-cli" || RC=1
fi

if ((RC == 0)); then
  echo "==> release complete"
  if ((DO_DESKTOP)); then
    echo "    https://github.com/noy4/docserve/releases/tag/v$DESKTOP_NEXT"
  fi
  if ((DO_CLI)); then
    echo "    https://www.npmjs.com/package/@noy4/docserve"
  fi
else
  echo "==> release finished with failures. Do NOT recreate tags before checking what was published (see RELEASE.md)." >&2
fi
exit $RC
