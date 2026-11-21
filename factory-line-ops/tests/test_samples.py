#!/usr/bin/env python3
"""Validate sample HEC payloads and required OT fields. No network, no secrets."""

from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "samples" / "events"
REQUIRED = ("vertical", "site", "system", "device_id", "device_type")
ALLOWED_INDEXES = {"factory_ops", "factory_workforce", "factory_summary"}
IDEV_STATIC_NAMES = frozenset({"logo.png", "index.html", "style.css", "app.js"})
SKIP_CONTENT_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".spl",
    ".gz",
    ".tgz",
    ".zip",
    ".pyc",
}
# Concatenated so this file does not itself contain product-branding phrases.
FOREIGN_BRANDING = (
    "soft" + "ball",
    "game" + "changer",
    "player" + " development",
    "alpha" + " logo",
    "coach" + " login",
)
REQUIRED_ICONS = (
    "appIcon.png",
    "appIcon_2x.png",
    "appLogo.png",
    "appLogo_2x.png",
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _iter_product_files():
    skip_dirs = {".git", "__pycache__", "dist"}
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        yield path


def _idev_static_dir() -> Path | None:
    for candidate in (Path("/workspace/static"), ROOT.parent / "static"):
        if candidate.is_dir():
            return candidate
    return None


class SampleEventsTest(unittest.TestCase):
    def test_event_files_exist(self) -> None:
        files = list(EVENTS.glob("*.json"))
        self.assertGreaterEqual(len(files), 6, "expected sample event files")

    def test_each_event_is_hec_json(self) -> None:
        for path in sorted(EVENTS.glob("*.json")):
            with self.subTest(file=path.name):
                payload = json.loads(path.read_text())
                self.assertIn("sourcetype", payload)
                self.assertTrue(str(payload["sourcetype"]).startswith("factory:"))
                self.assertIn(payload.get("index"), ALLOWED_INDEXES)
                event = payload.get("event")
                self.assertIsInstance(event, dict)
                for field in REQUIRED:
                    self.assertTrue(event.get(field), f"{path.name} missing {field}")
                self.assertEqual(event["vertical"], "manufacturing")
                self.assertNotIn("display_name", event)
                self.assertNotIn("first_name", event)
                self.assertNotIn("badge_id", event)
                self.assertNotIn("ssn", event)
                blob = json.dumps(payload).lower()
                self.assertNotIn("splunk ", blob)
                self.assertNotIn("-----begin", blob)


class PackageLayoutTest(unittest.TestCase):
    def test_app_ids_match_folders(self) -> None:
        for app in ("TA-factory_line", "factory_line_ops"):
            app_conf = (ROOT / "packages" / app / "default" / "app.conf").read_text()
            self.assertIn(f"id = {app}", app_conf)

    def test_ta_default_has_no_secrets(self) -> None:
        ta_default = ROOT / "packages" / "TA-factory_line" / "default"
        self.assertTrue(ta_default.is_dir())
        self.assertFalse((ta_default / "inputs.conf").exists())
        blob = ""
        for path in ta_default.rglob("*"):
            if path.is_file():
                blob += path.read_text(errors="ignore").lower()
        self.assertNotIn("-----begin", blob)
        self.assertNotIn("akia", blob)
        for line in blob.splitlines():
            stripped = line.strip()
            if stripped.startswith("token") and "=" in stripped:
                rhs = stripped.split("=", 1)[1].strip()
                self.assertIn(rhs, {"", "<value>"})

    def test_line_floor_has_no_name_lookup(self) -> None:
        view = (
            ROOT
            / "packages"
            / "factory_line_ops"
            / "default"
            / "data"
            / "ui"
            / "views"
            / "flo_line_floor.json"
        ).read_text()
        self.assertNotIn("first_name", view)
        self.assertNotIn("flo_kv_worker_display", view)
        self.assertIn("flo_kv_roster_presence", view)


class IndependentProductTest(unittest.TestCase):
    """Factory Line Operations must not ship another product's assets or copy."""

    def test_no_idev_static_filenames(self) -> None:
        hits = [p for p in _iter_product_files() if p.name in IDEV_STATIC_NAMES]
        self.assertEqual(
            hits,
            [],
            "factory-line-ops must not contain idev static filenames: " + ", ".join(str(p) for p in hits),
        )

    def test_no_matching_idev_static_checksums(self) -> None:
        idev_static = _idev_static_dir()
        if idev_static is None:
            self.skipTest("idev static directory not present (standalone checkout)")
        idev_digests = {
            _sha256(path): path.name
            for path in idev_static.iterdir()
            if path.is_file()
        }
        self.assertTrue(idev_digests, "expected files under idev static/")
        matches = []
        for path in _iter_product_files():
            digest = _sha256(path)
            if digest in idev_digests:
                matches.append(f"{path} matches {idev_digests[digest]}")
        self.assertEqual(matches, [], "copied idev static bytes: " + "; ".join(matches))

    def test_no_foreign_product_branding(self) -> None:
        hits = []
        for path in _iter_product_files():
            if path.suffix.lower() in SKIP_CONTENT_SUFFIXES:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            lower = text.lower()
            for needle in FOREIGN_BRANDING:
                if needle.lower() in lower:
                    hits.append(f"{path.relative_to(ROOT)}: {needle}")
        self.assertEqual(hits, [], "foreign product branding leftovers: " + "; ".join(hits))

    def test_splunk_icons_are_original_flo_marks(self) -> None:
        for app in ("TA-factory_line", "factory_line_ops"):
            static = ROOT / "packages" / app / "appserver" / "static"
            for name in REQUIRED_ICONS:
                icon = static / name
                self.assertTrue(icon.is_file(), f"missing {icon.relative_to(ROOT)}")
                self.assertGreater(icon.stat().st_size, 64)
                self.assertEqual(icon.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            self.assertFalse((static / "logo.png").exists())


if __name__ == "__main__":
    sys.exit(not unittest.main(verbosity=2))
