#!/bin/bash
# Double-click to update idev and start it.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start.py
else
  echo "Python 3 is not installed. Get it from https://www.python.org/downloads/"
fi
echo
read -r -p "idev has stopped. Press Return to close this window."
