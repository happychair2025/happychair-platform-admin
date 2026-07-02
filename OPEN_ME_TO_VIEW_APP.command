#!/bin/zsh
set +e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile"
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"

cd "$(dirname "$0")"

APP_MARKER="Happy Chair Platform Admin"
PORT=""

echo "Starting Happy Chair Platform Admin..."
echo "Folder: $PWD"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found in this double-click launcher."
  echo
  echo "Open Terminal and run this exact command instead:"
  echo "cd \"$PWD\" && npm run dev -- --host 127.0.0.1 --port 5188 --strictPort"
  echo
  read "unused?Press Return to close..."
  exit 1
fi

echo "Using npm: $(command -v npm)"
echo

for candidate in {5188..5195}; do
  URL="http://127.0.0.1:${candidate}/"
  PAGE=$(/usr/bin/curl -fsS --max-time 1 "$URL" 2>/dev/null)
  if echo "$PAGE" | /usr/bin/grep -q "$APP_MARKER"; then
    echo "Platform Admin is already running."
    echo "Opening $URL"
    /usr/bin/open "$URL"
    echo
    echo "You can close this window."
    read "unused?Press Return to close..."
    exit 0
  fi

  if ! /usr/sbin/lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
    PORT="$candidate"
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "No free Platform Admin preview port found between 5188 and 5195."
  echo "Close old preview windows or send this message to Codex."
  read "unused?Press Return to close..."
  exit 1
fi

URL="http://127.0.0.1:${PORT}/"

echo "Starting local Platform Admin server on $URL"
echo "Leave this window open while viewing the app."
echo

npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort &
SERVER_PID=$!

for attempt in {1..25}; do
  sleep 1
  PAGE=$(/usr/bin/curl -fsS --max-time 1 "$URL" 2>/dev/null)
  if echo "$PAGE" | /usr/bin/grep -q "$APP_MARKER"; then
    echo
    echo "Opening $URL"
    /usr/bin/open "$URL"
    wait "$SERVER_PID"
    exit $?
  fi
done

echo
echo "The Platform Admin server did not start correctly on $URL."
echo "Leave this window open and send the error above to Codex."
kill "$SERVER_PID" >/dev/null 2>&1
read "unused?Press Return to close..."
exit 1
