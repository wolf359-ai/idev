#!/usr/bin/env python3
"""Validate sample HEC payloads and required OT fields. No network, no secrets."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "samples" / "events"
REQUIRED = ("vertical", "site", "system", "device_id", "device_type")
ALLOWED_INDEXES = {"factory_ops", "factory_workforce", "factory_summary"}


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


if __name__ == "__main__":
    sys.exit(not unittest.main(verbosity=2))
