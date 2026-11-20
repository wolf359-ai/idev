#!/usr/bin/env python3
"""Update idev to the latest version on GitHub, then start it.

Double-click "Start idev.command" (Mac) or "Start idev.bat" (Windows), or run:

    python3 start.py

Your data (data.json and data_backups/) is never replaced by an update.
If the computer is offline, idev starts with the version you already have.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import webbrowser
import zipfile
from pathlib import Path

REPO = "wolf359-ai/idev"
BRANCH = "main"
COMMIT_URL = f"https://api.github.com/repos/{REPO}/commits/{BRANCH}"
ZIP_URL = f"https://github.com/{REPO}/archive/refs/heads/{BRANCH}.zip"

ROOT = Path(__file__).resolve().parent
VERSION_FILE = ROOT / ".idev_version"
DATA_FILE = ROOT / "data.json"
BACKUP_DIR = ROOT / "data_backups"
# Never overwritten by an update: the coach's data and local-only files.
KEEP = {
    "data.json",
    "data.json.tmp",
    "data_backups",
    ".idev_version",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
}
PORT = int(os.environ.get("IDEV_PORT", "8765"))
URL = f"http://127.0.0.1:{PORT}"


def fetch(url: str, timeout: float = 20) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "idev-updater"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.URLError as exc:
        # Python from python.org on a Mac often has no certificates installed
        # until "Install Certificates.command" is run; curl uses the system ones.
        if not isinstance(exc.reason, ssl.SSLError) or not shutil.which("curl"):
            raise
    return subprocess.run(
        ["curl", "-fsSL", "--max-time", str(int(timeout)), "-A", "idev-updater", url],
        check=True,
        capture_output=True,
    ).stdout


def latest_commit() -> str:
    return json.loads(fetch(COMMIT_URL, timeout=10))["sha"]


def backup_data() -> None:
    if not DATA_FILE.exists():
        return
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%S")
    shutil.copy2(DATA_FILE, BACKUP_DIR / f"data-before-update-{stamp}.json")


def install_zip(payload: bytes) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            archive.extractall(tmp)
        (source,) = [p for p in Path(tmp).iterdir() if p.is_dir()]
        for item in source.iterdir():
            if item.name in KEEP:
                continue
            target = ROOT / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)
    launcher = ROOT / "Start idev.command"
    if launcher.exists():
        launcher.chmod(0o755)


def update_with_git() -> None:
    if not shutil.which("git"):
        print("This folder is a Git checkout but Git is not installed; skipping update.")
        return
    result = subprocess.run(
        ["git", "pull", "--ff-only", "origin", BRANCH],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print("idev is up to date.")
    else:
        print("Could not update with Git; starting the version you have.")
        print(result.stderr.strip())


def update() -> None:
    print("Checking for updates...", flush=True)
    if (ROOT / ".git").exists():
        update_with_git()
        return
    try:
        sha = latest_commit()
        current = VERSION_FILE.read_text().strip() if VERSION_FILE.exists() else ""
        if sha == current:
            print("idev is up to date.")
            return
        print("Downloading the latest version...", flush=True)
        payload = fetch(ZIP_URL, timeout=60)
        backup_data()
        install_zip(payload)
        VERSION_FILE.write_text(sha + "\n")
        print("Updated to the latest version.")
    except Exception as exc:  # noqa: BLE001 - any failure falls back to the current copy
        print(f"Could not check for updates ({exc}). Starting the version you have.")


def already_running() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", PORT)) == 0


def main() -> int:
    if already_running():
        print("idev is already running in another window. Opening it in your browser.")
        print("To get updates, close that window first, then start idev again.")
        webbrowser.open(URL)
        return 0
    update()
    threading.Timer(1.5, webbrowser.open, args=(URL,)).start()
    try:
        return subprocess.call([sys.executable, str(ROOT / "app.py")], cwd=ROOT)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
