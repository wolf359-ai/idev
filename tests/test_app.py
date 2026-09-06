#!/usr/bin/env python3
"""Tests for the local idev softball tracker."""

from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app


class StoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = app.Store(Path(self.tmp.name) / "data.json")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_add_player_and_list(self) -> None:
        created = self.store.add_player(
            {"name": "  Sam Lee  ", "position": "Catcher", "number": 9}
        )
        self.assertTrue(created["id"].startswith("player-"))
        self.assertEqual(created["name"], "Sam Lee")
        listed = self.store.list_players()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["name"], "Sam Lee")

    def test_rejects_empty_name(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player({"name": "   ", "position": "Pitcher"})

    def test_rejects_unknown_position(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player({"name": "Pat", "position": "Quarterback"})

    def test_secondary_position(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "secondary_position": "Second Base"}
        )
        self.assertEqual(created["secondary_position"], "Second Base")
        # Omitted or blank secondary position stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["secondary_position"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "secondary_position": "  "}
        )
        self.assertEqual(blank["secondary_position"], "")
        # Updating just the secondary position leaves the primary intact.
        updated = self.store.update_player(
            created["id"], {"secondary_position": "Third Base"}
        )
        self.assertEqual(updated["position"], "Shortstop")
        self.assertEqual(updated["secondary_position"], "Third Base")

    def test_rejects_unknown_secondary_position(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "secondary_position": "Quarterback"}
            )

    def test_team_year(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "team_year": "2025"}
        )
        self.assertEqual(created["team_year"], "2025")
        # Omitted or blank team year stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["team_year"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "team_year": "  "}
        )
        self.assertEqual(blank["team_year"], "")
        # Numeric input is accepted and stored as a string.
        numeric = self.store.add_player(
            {"name": "Alexis", "position": "Utility", "team_year": 2026}
        )
        self.assertEqual(numeric["team_year"], "2026")
        updated = self.store.update_player(created["id"], {"team_year": "2024-25"})
        self.assertEqual(updated["team_year"], "2024-25")

    def test_rejects_overlong_team_year(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "team_year": "x" * 21}
            )

    def test_grad_year(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "grad_year": "2028"}
        )
        self.assertEqual(created["grad_year"], "2028")
        # Omitted or blank graduation year stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["grad_year"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "grad_year": "  "}
        )
        self.assertEqual(blank["grad_year"], "")
        numeric = self.store.add_player(
            {"name": "Alexis", "position": "Utility", "grad_year": 2029}
        )
        self.assertEqual(numeric["grad_year"], "2029")
        updated = self.store.update_player(created["id"], {"grad_year": "2030"})
        self.assertEqual(updated["grad_year"], "2030")

    def test_rejects_overlong_grad_year(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "grad_year": "2" * 10}
            )

    def test_team_type(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "team_type": "12u-1y"}
        )
        self.assertEqual(created["team_type"], "12u-1y")
        # Omitted or blank team type stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["team_type"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "team_type": "  "}
        )
        self.assertEqual(blank["team_type"], "")
        updated = self.store.update_player(created["id"], {"team_type": "14u-2y"})
        self.assertEqual(updated["team_type"], "14u-2y")

    def test_rejects_unknown_team_type(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "team_type": "16u-3"}
            )

    def test_exit_velo(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "exit_velo": "72.5"}
        )
        self.assertEqual(created["exit_velo"], 72.5)
        # Omitted or blank exit velo stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["exit_velo"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "exit_velo": "  "}
        )
        self.assertEqual(blank["exit_velo"], "")
        # Updating just the exit velo leaves other fields intact.
        updated = self.store.update_player(created["id"], {"exit_velo": 80})
        self.assertEqual(updated["position"], "Shortstop")
        self.assertEqual(updated["exit_velo"], 80.0)
        # Clearing it back to blank works.
        cleared = self.store.update_player(created["id"], {"exit_velo": ""})
        self.assertEqual(cleared["exit_velo"], "")

    def test_rejects_invalid_exit_velo(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "exit_velo": "fast"}
            )
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Lee", "position": "Utility", "exit_velo": 250}
            )

    def test_distance(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "distance": "220.5"}
        )
        self.assertEqual(created["distance"], 220.5)
        # Omitted or blank distance stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["distance"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "distance": "  "}
        )
        self.assertEqual(blank["distance"], "")
        updated = self.store.update_player(created["id"], {"distance": 240})
        self.assertEqual(updated["distance"], 240.0)
        cleared = self.store.update_player(created["id"], {"distance": ""})
        self.assertEqual(cleared["distance"], "")

    def test_rejects_invalid_distance(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "distance": "far"}
            )
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Lee", "position": "Utility", "distance": 1200}
            )

    def test_personal_record_distance_higher_is_better(self) -> None:
        created = self.store.add_player({"name": "Sky", "position": "Shortstop"})
        pid = created["id"]
        # First value is a baseline, not a PR.
        self.store.update_player(pid, {"distance": "200"})
        self.assertEqual(len(self.store.get_player(pid)["records"]), 0)
        # A longer hit is a PR with a positive delta.
        self.store.update_player(pid, {"distance": "230.5"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 1)
        self.assertEqual(detail["records"][0]["metric"], "distance")
        self.assertEqual(detail["records"][0]["label"], "Distance")
        self.assertEqual(detail["records"][0]["unit"], "Feet")
        self.assertEqual(detail["records"][0]["delta"], 30.5)

    def test_base_time(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "base_time": "3.45"}
        )
        self.assertEqual(created["base_time"], 3.45)
        # Omitted or blank base time stays empty, not an error.
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["base_time"], "")
        blank = self.store.add_player(
            {"name": "Quinn", "position": "Pitcher", "base_time": "  "}
        )
        self.assertEqual(blank["base_time"], "")
        updated = self.store.update_player(created["id"], {"base_time": 4})
        self.assertEqual(updated["position"], "Shortstop")
        self.assertEqual(updated["base_time"], 4.0)
        cleared = self.store.update_player(created["id"], {"base_time": ""})
        self.assertEqual(cleared["base_time"], "")

    def test_rejects_invalid_base_time(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "base_time": "slow"}
            )
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Lee", "position": "Utility", "base_time": 120}
            )

    def test_pitch_velo(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Pitcher", "pitch_velo": "58.25"}
        )
        self.assertEqual(created["pitch_velo"], 58.25)
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["pitch_velo"], "")
        updated = self.store.update_player(created["id"], {"pitch_velo": 61})
        self.assertEqual(updated["pitch_velo"], 61.0)
        cleared = self.store.update_player(created["id"], {"pitch_velo": ""})
        self.assertEqual(cleared["pitch_velo"], "")

    def test_rejects_invalid_pitch_velo(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "pitch_velo": "fast"}
            )
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Lee", "position": "Utility", "pitch_velo": 250}
            )

    def test_throw_speed(self) -> None:
        created = self.store.add_player(
            {"name": "Sky", "position": "Shortstop", "throw_speed": "62.4"}
        )
        self.assertEqual(created["throw_speed"], 62.4)
        plain = self.store.add_player({"name": "Rowan", "position": "Catcher"})
        self.assertEqual(plain["throw_speed"], "")
        updated = self.store.update_player(created["id"], {"throw_speed": 70})
        self.assertEqual(updated["throw_speed"], 70.0)
        cleared = self.store.update_player(created["id"], {"throw_speed": ""})
        self.assertEqual(cleared["throw_speed"], "")

    def test_rejects_invalid_throw_speed(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Pat", "position": "Utility", "throw_speed": "hard"}
            )
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Lee", "position": "Utility", "throw_speed": 250}
            )

    def test_personal_record_higher_is_better(self) -> None:
        created = self.store.add_player({"name": "Sky", "position": "Shortstop"})
        pid = created["id"]
        # First value only establishes a baseline; it is not a PR.
        self.store.update_player(pid, {"exit_velo": "60"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 0)
        # A higher value is the first real PR, with a positive delta.
        self.store.update_player(pid, {"exit_velo": "65.5"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 1)
        self.assertEqual(detail["records"][0]["metric"], "exit_velo")
        self.assertEqual(detail["records"][0]["delta"], 5.5)
        # A lower value is not a PR (no new note).
        self.store.update_player(pid, {"exit_velo": "62"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 1)

    def test_personal_record_lower_time_is_better(self) -> None:
        created = self.store.add_player({"name": "Sky", "position": "Shortstop"})
        pid = created["id"]
        # First time is only a baseline, not a PR.
        self.store.update_player(pid, {"base_time": "4.0"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 0)
        # A faster (lower) time is a new PR; delta is negative (the time drop).
        self.store.update_player(pid, {"base_time": "3.6"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 1)
        self.assertEqual(detail["records"][0]["metric"], "base_time")
        self.assertEqual(detail["records"][0]["label"], "Running speed")
        self.assertEqual(detail["records"][0]["delta"], -0.4)
        self.assertFalse(detail["records"][0]["higher_better"])
        # A slower (higher) time is not a PR.
        self.store.update_player(pid, {"base_time": "3.9"})
        detail = self.store.get_player(pid)
        self.assertEqual(len(detail["records"]), 1)

    def test_staff_add_list_delete(self) -> None:
        created = self.store.add_staff(
            {
                "name": "  Jamie Fox  ",
                "role": "Assistant Coach",
                "contact": "jamie@example.com",
                "access_level": "Manager",
            }
        )
        self.assertTrue(created["id"].startswith("staff-"))
        self.assertEqual(created["name"], "Jamie Fox")
        self.assertEqual(created["role"], "Assistant Coach")
        self.assertEqual(created["contact"], "jamie@example.com")
        self.assertEqual(created["access_level"], "Manager")
        # Contact is optional.
        plain = self.store.add_staff(
            {"name": "Sam", "role": "Trainer", "access_level": "Read-only"}
        )
        self.assertEqual(plain["contact"], "")
        self.assertEqual(len(self.store.list_staff()), 2)
        self.store.delete_staff(created["id"])
        remaining = self.store.list_staff()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["name"], "Sam")
        with self.assertRaises(KeyError):
            self.store.delete_staff("staff-does-not-exist")

    def test_staff_validation(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_staff({"name": "  ", "role": "Coach", "access_level": "Full"})
        with self.assertRaises(ValueError):
            self.store.add_staff({"name": "Pat", "role": "", "access_level": "Full"})
        with self.assertRaises(ValueError):
            self.store.add_staff({"name": "Pat", "role": "Coach", "access_level": "Emperor"})

    def test_team_information_set_and_get(self) -> None:
        # Defaults to empty before anything is stored.
        self.assertEqual(self.store.get_team(), {})

        saved = self.store.set_team(
            {
                "name": "  Boston Caps  ",
                "year": "2025",
                "season": "Summer",
                "age_bracket": "12u",
                "play_year": "First year",
            }
        )
        self.assertEqual(saved["name"], "Boston Caps")
        self.assertEqual(saved["year"], "2025")
        self.assertEqual(saved["season"], "Summer")
        self.assertEqual(saved["age_bracket"], "12u")
        self.assertEqual(saved["play_year"], "First year")
        self.assertEqual(self.store.get_team(), saved)

        # All fields are optional and may be cleared.
        cleared = self.store.set_team({})
        self.assertEqual(
            cleared,
            {
                "name": "",
                "year": "",
                "season": "",
                "age_bracket": "",
                "play_year": "",
            },
        )

    def test_team_information_validation(self) -> None:
        with self.assertRaises(ValueError):
            self.store.set_team({"season": "Monsoon"})
        with self.assertRaises(ValueError):
            self.store.set_team({"play_year": "Third year"})
        with self.assertRaises(ValueError):
            self.store.set_team({"year": "x" * 21})
        with self.assertRaises(ValueError):
            self.store.set_team({"age_bracket": "9u"})

    def test_drills_add_list_delete(self) -> None:
        player = self.store.add_player({"name": "Sky", "position": "Shortstop"})
        drill = self.store.add_drill(
            player["id"],
            {
                "name": "  Tee work  ",
                "frequency": "3x per week",
                "link": "https://example.com/tee",
            },
        )
        self.assertTrue(drill["id"].startswith("drill-"))
        self.assertEqual(drill["name"], "Tee work")
        self.assertEqual(drill["frequency"], "3x per week")
        self.assertEqual(drill["link"], "https://example.com/tee")

        # Frequency and link are optional.
        plain = self.store.add_drill(player["id"], {"name": "Soft toss"})
        self.assertEqual(plain["frequency"], "")
        self.assertEqual(plain["link"], "")

        detail = self.store.get_player(player["id"])
        self.assertEqual(len(detail["drills"]), 2)

        self.store.delete_drill(player["id"], drill["id"])
        detail = self.store.get_player(player["id"])
        self.assertEqual(len(detail["drills"]), 1)
        self.assertEqual(detail["drills"][0]["name"], "Soft toss")
        with self.assertRaises(KeyError):
            self.store.delete_drill(player["id"], "drill-missing")

    def test_drill_link_must_be_http(self) -> None:
        player = self.store.add_player({"name": "Pat", "position": "Catcher"})
        for bad in ("javascript:alert(1)", "data:text/html,x", "ftp://host/f", "notaurl"):
            with self.assertRaises(ValueError):
                self.store.add_drill(player["id"], {"name": "X", "link": bad})
        # http and https are both accepted.
        ok = self.store.add_drill(
            player["id"], {"name": "Y", "link": "http://example.com"}
        )
        self.assertEqual(ok["link"], "http://example.com")

    def test_drill_name_required_and_max_ten(self) -> None:
        player = self.store.add_player({"name": "Max", "position": "Utility"})
        with self.assertRaises(ValueError):
            self.store.add_drill(player["id"], {"name": "   "})
        for i in range(10):
            self.store.add_drill(player["id"], {"name": f"Drill {i}"})
        with self.assertRaises(ValueError):
            self.store.add_drill(player["id"], {"name": "Overflow"})

    def test_activity_add_list_and_cap(self) -> None:
        player = self.store.add_player({"name": "Riley", "position": "Pitcher"})
        entry = self.store.add_activity(
            player["id"], {"text": "  Reviewed drill: Tee work  "}
        )
        self.assertTrue(entry["id"].startswith("act-"))
        self.assertEqual(entry["text"], "Reviewed drill: Tee work")
        detail = self.store.get_player(player["id"])
        self.assertEqual(len(detail["activity"]), 1)
        self.assertEqual(detail["activity"][0]["text"], "Reviewed drill: Tee work")

        # Text is required.
        with self.assertRaises(ValueError):
            self.store.add_activity(player["id"], {"text": "   "})

        # The log is capped at MAX_ACTIVITY most-recent entries per player.
        for i in range(app.MAX_ACTIVITY + 5):
            self.store.add_activity(player["id"], {"text": f"open {i}"})
        detail = self.store.get_player(player["id"])
        self.assertEqual(len(detail["activity"]), app.MAX_ACTIVITY)

    def test_activity_removed_with_player(self) -> None:
        player = self.store.add_player({"name": "Sam", "position": "Catcher"})
        self.store.add_activity(player["id"], {"text": "open a"})
        self.store.delete_player(player["id"])
        self.assertEqual(self.store.data["activity"], [])

    def test_save_writes_timestamped_backups(self) -> None:
        self.store.add_player({"name": "Backup One", "position": "Catcher"})
        self.store.add_player({"name": "Backup Two", "position": "Pitcher"})
        backups = list((Path(self.tmp.name) / "data_backups").glob("data-*.json"))
        # Each save creates a snapshot; two players means at least two snapshots.
        self.assertGreaterEqual(len(backups), 2)

    def test_recovers_roster_when_data_file_deleted(self) -> None:
        self.store.add_player({"name": "Allison Harrop", "position": "Shortstop"})
        self.store.add_player({"name": "Whitney Wallace", "position": "Center Field"})
        # Simulate an accidental deletion of the main data file.
        (Path(self.tmp.name) / "data.json").unlink()

        # A fresh store must recover the roster from the newest backup instead
        # of coming up empty.
        recovered = app.Store(Path(self.tmp.name) / "data.json")
        names = {p["name"] for p in recovered.list_players()}
        self.assertIn("Allison Harrop", names)
        self.assertIn("Whitney Wallace", names)
        # Recovery also re-materializes the main data file.
        self.assertTrue((Path(self.tmp.name) / "data.json").exists())

    def test_recovers_from_corrupt_data_file(self) -> None:
        self.store.add_player({"name": "Robin Vale", "position": "Utility"})
        (Path(self.tmp.name) / "data.json").write_text("{ not valid json", encoding="utf-8")
        recovered = app.Store(Path(self.tmp.name) / "data.json")
        names = {p["name"] for p in recovered.list_players()}
        self.assertIn("Robin Vale", names)

    def test_staff_password_set_and_clear(self) -> None:
        member = self.store.add_staff(
            {"name": "Pat", "role": "Coach", "access_level": "Full"}
        )
        # New staff have no password, and the hash never appears in the view.
        self.assertFalse(member["has_password"])
        self.assertNotIn("password_hash", member)

        updated = self.store.set_staff_password(member["id"], "secret1")
        self.assertTrue(updated["has_password"])
        self.assertNotIn("password_hash", updated)

        listed = self.store.list_staff()[0]
        self.assertTrue(listed["has_password"])
        self.assertNotIn("password_hash", listed)

        cleared = self.store.clear_staff_password(member["id"])
        self.assertFalse(cleared["has_password"])

        # Too-short passwords are rejected and unknown ids raise KeyError.
        with self.assertRaises(ValueError):
            self.store.set_staff_password(member["id"], "no")
        with self.assertRaises(KeyError):
            self.store.set_staff_password("staff-missing", "secret1")

    def test_rejects_bad_jersey(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_player({"name": "Pat", "position": "Utility", "number": 100})

    def test_rating_note_progress_and_delete(self) -> None:
        skill = self.store.add_skill("Slapping")
        player = self.store.add_player({"name": "Riley", "position": "Utility"})
        first = self.store.add_rating(
            player["id"], {"skill_id": skill["id"], "score": 2}
        )
        self.assertEqual(first["score"], 2)
        self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 4})
        note = self.store.add_note(player["id"], {"text": "Stay short to the ball."})
        detail = self.store.get_player(player["id"])
        slap = next(item for item in detail["progress"] if item["skill_id"] == skill["id"])
        self.assertEqual(slap["first"], 2)
        self.assertEqual(slap["current"], 4)
        self.assertEqual(slap["delta"], 2)
        self.assertEqual(len(detail["notes"]), 1)
        self.assertEqual(detail["notes"][0]["text"], "Stay short to the ball.")
        # Notes default to the "focus" category when none is given.
        self.assertEqual(detail["notes"][0]["category"], "focus")
        self.store.delete_note(note["id"])
        self.store.delete_player(player["id"])
        with self.assertRaises(KeyError):
            self.store.get_player(player["id"])

    def test_note_categories(self) -> None:
        player = self.store.add_player({"name": "Sky", "position": "Utility"})
        top = self.store.add_note(
            player["id"], {"text": "Great glove work.", "category": "top"}
        )
        focus = self.store.add_note(
            player["id"], {"text": "Work on plate discipline.", "category": "focus"}
        )
        self.assertEqual(top["category"], "top")
        self.assertEqual(focus["category"], "focus")
        detail = self.store.get_player(player["id"])
        cats = {note["text"]: note["category"] for note in detail["notes"]}
        self.assertEqual(cats["Great glove work."], "top")
        self.assertEqual(cats["Work on plate discipline."], "focus")

    def test_rejects_unknown_note_category(self) -> None:
        player = self.store.add_player({"name": "Robin", "position": "Utility"})
        with self.assertRaises(ValueError):
            self.store.add_note(player["id"], {"text": "Hi", "category": "bogus"})

    def test_alarm_targets_all_or_specific_player(self) -> None:
        one = self.store.add_player({"name": "Ann", "position": "Pitcher"})
        two = self.store.add_player({"name": "Bea", "position": "Catcher"})
        broadcast = self.store.add_alarm({"text": "Practice at 5", "target": "all"})
        direct = self.store.add_alarm({"text": "See me", "target": one["id"]})
        self.assertEqual(broadcast["target"], "all")
        self.assertEqual(direct["target_name"], "Ann")

        # Everyone sees the broadcast; only Ann sees the direct alarm.
        ann = self.store.alarms_for_player(one["id"])
        bea = self.store.alarms_for_player(two["id"])
        self.assertEqual({a["text"] for a in ann}, {"Practice at 5", "See me"})
        self.assertEqual({a["text"] for a in bea}, {"Practice at 5"})
        self.assertTrue(all(a["read"] is False for a in ann))

        # Marking read is per player and does not leak into stored payloads.
        self.store.mark_alarm_read(broadcast["id"], one["id"])
        ann = self.store.alarms_for_player(one["id"])
        by_text = {a["text"]: a for a in ann}
        self.assertTrue(by_text["Practice at 5"]["read"])
        self.assertFalse(by_text["See me"]["read"])
        # Bea's copy of the broadcast is still unread.
        self.assertFalse(self.store.alarms_for_player(two["id"])[0]["read"])
        for a in self.store.list_alarms():
            self.assertNotIn("read", a)

    def test_alarm_rejects_unknown_target(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_alarm({"text": "Hi", "target": "player-does-not-exist"})

    def test_mark_all_alarms_read(self) -> None:
        player = self.store.add_player({"name": "Cy", "position": "Utility"})
        self.store.add_alarm({"text": "A", "target": "all"})
        self.store.add_alarm({"text": "B", "target": player["id"]})
        self.store.mark_all_alarms_read(player["id"])
        self.assertTrue(all(a["read"] for a in self.store.alarms_for_player(player["id"])))

    def test_message_audiences(self) -> None:
        player = self.store.add_player({"name": "Dee", "position": "Shortstop"})
        other = self.store.add_player({"name": "Eve", "position": "Catcher"})
        staff = self.store.add_staff(
            {"name": "Coach Kay", "role": "Assistant", "access_level": "Full"}
        )
        self.store.add_message({"body": "Go team", "audience": "team"})
        self.store.add_message({"body": "Staff sync", "audience": "staff"})
        self.store.add_message(
            {"body": "For Dee", "audience": "player", "recipient_id": player["id"]}
        )
        self.store.add_message(
            {"body": "Hi Kay", "audience": "staff_member", "recipient_id": staff["id"]}
        )
        # Dee sees the team message and her direct message; not staff or Eve's.
        dee = {m["body"] for m in self.store.messages_for_player(player["id"])}
        self.assertEqual(dee, {"Go team", "For Dee"})
        eve = {m["body"] for m in self.store.messages_for_player(other["id"])}
        self.assertEqual(eve, {"Go team"})
        # Coach outbox has all four.
        self.assertEqual(len(self.store.list_messages()), 4)

    def test_message_rejects_invalid(self) -> None:
        with self.assertRaises(ValueError):
            self.store.add_message({"body": "x", "audience": "nobody"})
        with self.assertRaises(ValueError):
            self.store.add_message(
                {"body": "x", "audience": "player", "recipient_id": "player-missing0"}
            )

    def test_deleting_player_removes_their_alarms_and_messages(self) -> None:
        player = self.store.add_player({"name": "Fin", "position": "Utility"})
        keep = self.store.add_player({"name": "Gus", "position": "Pitcher"})
        broadcast = self.store.add_alarm({"text": "All", "target": "all"})
        self.store.add_alarm({"text": "Direct", "target": player["id"]})
        self.store.mark_alarm_read(broadcast["id"], player["id"])
        self.store.add_message(
            {"body": "For Fin", "audience": "player", "recipient_id": player["id"]}
        )
        self.store.add_message({"body": "Team", "audience": "team"})
        self.store.delete_player(player["id"])
        # The direct alarm/message are gone; broadcasts remain for others.
        alarms = self.store.list_alarms()
        self.assertEqual({a["text"] for a in alarms}, {"All"})
        self.assertNotIn(player["id"], alarms[0].get("reads", []))
        messages = self.store.list_messages()
        self.assertEqual({m["body"] for m in messages}, {"Team"})
        self.assertEqual(self.store.messages_for_player(keep["id"]), self.store.messages_for_player(keep["id"]))

    def test_deleting_staff_removes_their_messages(self) -> None:
        staff = self.store.add_staff(
            {"name": "Hal", "role": "Assistant", "access_level": "Full"}
        )
        self.store.add_message(
            {"body": "Hi Hal", "audience": "staff_member", "recipient_id": staff["id"]}
        )
        self.store.add_message({"body": "All staff", "audience": "staff"})
        self.store.delete_staff(staff["id"])
        self.assertEqual({m["body"] for m in self.store.list_messages()}, {"All staff"})

    def test_rejects_invalid_score(self) -> None:
        skill = self.store.add_skill("Pop time")
        player = self.store.add_player({"name": "Casey", "position": "Catcher"})
        with self.assertRaises(ValueError):
            self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 6})

    def test_accepts_half_step_scores(self) -> None:
        skill = self.store.add_skill("Slap")
        player = self.store.add_player({"name": "Dana", "position": "Utility"})
        first = self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 2})
        self.assertEqual(first["score"], 2)
        half = self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 3.5})
        self.assertEqual(half["score"], 3.5)
        detail = self.store.get_player(player["id"])
        entry = next(item for item in detail["progress"] if item["skill_id"] == skill["id"])
        self.assertEqual(entry["current"], 3.5)
        self.assertEqual(entry["delta"], 1.5)
        # Whole numbers stay ints, not floats.
        whole = self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 4})
        self.assertIsInstance(whole["score"], int)

    def test_rejects_non_half_step_scores(self) -> None:
        skill = self.store.add_skill("Bunt")
        player = self.store.add_player({"name": "Pat", "position": "Utility"})
        for bad in (3.3, 0.5, 5.5, 0):
            with self.assertRaises(ValueError):
                self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": bad})

    def test_seed_demo_only_once(self) -> None:
        self.store.seed_demo_if_empty()
        self.store.seed_demo_if_empty()
        self.assertEqual(len(self.store.list_players()), 2)
        self.assertEqual(len(self.store.list_skills()), len(app.DEFAULT_SKILLS))
        alex = next(
            player for player in self.store.list_players() if player["name"] == "Alex Rivera"
        )
        fielding = next(
            item
            for item in self.store.get_player(alex["id"])["progress"]
            if item["skill_name"] == "Fielding"
        )
        self.assertEqual(fielding["first"], 3)
        self.assertEqual(fielding["current"], 4)
        self.assertEqual(fielding["delta"], 1)
        alex_stats = self.store.get_player(alex["id"])["stats"]
        self.assertEqual(alex_stats["computed"]["avg"], 0.375)
        self.assertEqual(alex_stats["computed"]["obp"], 0.444)
        self.assertEqual(alex_stats["computed"]["slg"], 0.625)
        self.assertEqual(alex_stats["computed"]["ops"], 1.069)
        self.assertEqual(alex_stats["computed"]["fpct"], 0.952)

    def test_gamechanger_stats_compute_and_validate(self) -> None:
        player = self.store.add_player({"name": "Riley", "position": "Utility"})
        empty = self.store.get_player(player["id"])["stats"]
        self.assertEqual(empty["computed"]["avg"], None)
        self.assertEqual(empty["computed"]["tc"], 0)
        self.assertEqual(
            next(item["display"] for item in empty["offense"] if item["key"] == "avg"),
            "—",
        )
        updated = self.store.update_stats(
            player["id"],
            {
                "ab": 32,
                "h": 12,
                "doubles": 3,
                "triples": 1,
                "hr": 1,
                "bb": 3,
                "hbp": 1,
                "sf": 0,
                "po": 18,
                "a": 22,
                "e": 2,
                "secret": "ignore-me",
            },
        )
        self.assertEqual(updated["counts"]["ab"], 32)
        self.assertNotIn("secret", updated["counts"])
        self.assertEqual(updated["computed"]["avg"], 0.375)
        self.assertEqual(updated["computed"]["tb"], 20)
        self.assertEqual(updated["computed"]["xbh"], 5)
        self.assertEqual(updated["computed"]["tc"], 42)
        self.assertEqual(
            next(item["display"] for item in updated["offense"] if item["key"] == "avg"),
            ".375",
        )
        with self.assertRaises(ValueError):
            self.store.update_stats(player["id"], {"ab": -1})
        with self.assertRaises(ValueError):
            self.store.update_stats(player["id"], {"h": 10000})

    def test_pitches_seen_and_per_pa(self) -> None:
        player = self.store.add_player({"name": "Blake", "position": "Utility"})
        # Pitches seen is an editable offense count; P/PA is derived from PA.
        updated = self.store.update_stats(
            player["id"], {"pa": 8, "pitches": 30}
        )
        self.assertEqual(updated["counts"]["pitches"], 30)
        self.assertEqual(updated["computed"]["p_pa"], 3.75)
        self.assertEqual(
            next(i["display"] for i in updated["offense"] if i["key"] == "pitches"),
            "30",
        )
        self.assertEqual(
            next(i["display"] for i in updated["offense"] if i["key"] == "p_pa"),
            "3.75",
        )
        # With no plate appearances, P/PA is undefined and shows a dash.
        zeroed = self.store.update_stats(player["id"], {"pa": 0, "pitches": 5})
        self.assertIsNone(zeroed["computed"]["p_pa"])
        self.assertEqual(
            next(i["display"] for i in zeroed["offense"] if i["key"] == "p_pa"),
            "—",
        )

    def test_preview_and_import_gamechanger_roster(self) -> None:
        csv_text = (
            "#,Roster,GP,PA,AB,H\n"
            '7,"Rivera, Alex",10,36,32,12\n'
            "21,Jordan Blake,10,28,24,6\n"
            ",Team,10,64,56,18\n"
        )
        preview = self.store.import_roster({"text": csv_text, "preview": True})
        self.assertEqual(len(preview["players"]), 2)
        self.assertEqual(preview["players"][0]["name"], "Rivera, Alex")
        self.assertEqual(preview["players"][0]["number"], 7)
        self.assertEqual(preview["players"][0]["position"], "Utility")
        self.assertEqual(self.store.list_players(), [])

        result = self.store.import_roster({"text": csv_text, "preview": False})
        self.assertEqual(len(result["imported"]), 2)
        self.assertEqual(len(self.store.list_players()), 2)
        duplicate = self.store.import_roster({"text": csv_text, "preview": True})
        self.assertEqual(duplicate["players"], [])
        self.assertEqual(len(duplicate["skipped"]), 2)
        self.assertTrue(all("already on the roster" in row["reason"] for row in duplicate["skipped"]))

    def test_import_pasted_roster_with_positions(self) -> None:
        result = self.store.import_roster(
            {
                "text": "7,Alex Rivera,SS\n21,Jordan Blake,P\nTaylor Brooks",
                "preview": False,
            }
        )
        self.assertEqual(len(result["imported"]), 3)
        players = {player["name"]: player for player in self.store.list_players()}
        self.assertEqual(players["Alex Rivera"]["position"], "Shortstop")
        self.assertEqual(players["Jordan Blake"]["position"], "Pitcher")
        self.assertEqual(players["Taylor Brooks"]["position"], "Utility")

    def test_import_rejects_empty_and_invalid_rosters(self) -> None:
        with self.assertRaises(ValueError):
            self.store.import_roster({"text": "", "preview": True})
        with self.assertRaises(ValueError):
            self.store.import_roster({"text": "#,Roster\n100,Bad Jersey", "preview": True})
        with self.assertRaises(ValueError):
            self.store.import_roster({"text": "x" * (app.MAX_ROSTER_TEXT_BYTES + 1)})

    def test_admin_password_is_hashed_not_stored_plaintext(self) -> None:
        self.assertIsNone(self.store.ensure_admin_password("s3cret-pass"))
        self.assertTrue(self.store.verify_admin_password("s3cret-pass"))
        self.assertFalse(self.store.verify_admin_password("wrong"))
        record = self.store.data["auth"]["admin"]
        self.assertEqual(record["algo"], "pbkdf2_sha256")
        self.assertGreaterEqual(record["iterations"], 600_000)
        self.assertNotIn("s3cret-pass", json.dumps(record))

    def test_default_admin_password_returned_once(self) -> None:
        generated = self.store.ensure_admin_password(None)
        self.assertEqual(generated, "123")
        self.assertEqual(generated, app.DEFAULT_ADMIN_PASSWORD)
        self.assertTrue(self.store.verify_admin_password("123"))
        # Already set: the default is not re-created on later runs.
        self.assertIsNone(self.store.ensure_admin_password(None))
        # A coach-chosen password still overrides the default.
        self.assertIsNone(self.store.ensure_admin_password("my-own-pass"))
        self.assertTrue(self.store.verify_admin_password("my-own-pass"))
        self.assertFalse(self.store.verify_admin_password("123"))

    def test_player_login_roundtrip_and_not_leaked(self) -> None:
        player = self.store.add_player({"name": "Sam Lee", "position": "Catcher"})
        self.assertNotIn("password_hash", player)
        self.assertFalse(player["has_login"])
        self.store.set_player_login(player["id"], "samlee", "secret-pass")
        self.assertEqual(
            self.store.find_player_by_login("samlee", "secret-pass"), player["id"]
        )
        # Username match is case-insensitive; wrong password does not match.
        self.assertEqual(
            self.store.find_player_by_login("SamLee", "secret-pass"), player["id"]
        )
        self.assertIsNone(self.store.find_player_by_login("samlee", "nope"))
        self.assertIsNone(self.store.find_player_by_login("nobody", "secret-pass"))
        detail = self.store.get_player(player["id"])
        self.assertTrue(detail["has_login"])
        self.assertEqual(detail["username"], "samlee")
        self.assertNotIn("password_hash", detail)
        # Stored value is a salted PBKDF2 hash, never the plaintext password.
        stored = self.store.data["players"][0]["password_hash"]
        self.assertIsInstance(stored, dict)
        self.assertNotIn("secret-pass", json.dumps(stored))
        self.store.clear_player_login(player["id"])
        self.assertIsNone(self.store.find_player_by_login("samlee", "secret-pass"))

    def test_player_login_validation_and_uniqueness(self) -> None:
        one = self.store.add_player({"name": "Sam Lee", "position": "Catcher"})
        two = self.store.add_player({"name": "Pat Roe", "position": "Utility"})
        self.store.set_player_login(one["id"], "rivera7", "good-pass")
        # Duplicate username (case-insensitive) is rejected.
        with self.assertRaises(ValueError):
            self.store.set_player_login(two["id"], "RIVERA7", "other-pass")
        # Invalid username characters / length are rejected.
        with self.assertRaises(ValueError):
            self.store.set_player_login(two["id"], "ab", "good-pass")
        with self.assertRaises(ValueError):
            self.store.set_player_login(two["id"], "has spaces", "good-pass")
        # Too-short password is rejected.
        with self.assertRaises(ValueError):
            self.store.set_player_login(two["id"], "patroe", "no")
        # The admin username is reserved.
        with self.assertRaises(ValueError):
            self.store.set_player_login(two["id"], app.ADMIN_USERNAME, "good-pass")

    def test_public_player_hides_password_hash(self) -> None:
        player = self.store.add_player({"name": "Pat", "position": "Utility"})
        self.store.set_player_login(player["id"], "patutil", "secret-pass")
        listed = self.store.list_players()
        self.assertTrue(all("password_hash" not in item for item in listed))

    def test_add_player_with_login_credentials(self) -> None:
        player = self.store.add_player(
            {
                "name": "New Kid",
                "position": "Pitcher",
                "username": "newkid",
                "password": "kid-pass",
            }
        )
        self.assertTrue(player["has_login"])
        self.assertEqual(player["username"], "newkid")
        self.assertEqual(
            self.store.find_player_by_login("newkid", "kid-pass"), player["id"]
        )
        # A username with no password (or vice versa) is rejected.
        with self.assertRaises(ValueError):
            self.store.add_player(
                {"name": "Half", "position": "Catcher", "username": "halfonly"}
            )
        # Duplicate usernames are rejected at creation time.
        with self.assertRaises(ValueError):
            self.store.add_player(
                {
                    "name": "Clash",
                    "position": "Catcher",
                    "username": "NEWKID",
                    "password": "other-pass",
                }
            )

    def test_add_staff_with_password(self) -> None:
        member = self.store.add_staff(
            {
                "name": "Coach Kim",
                "role": "Head Coach",
                "access_level": "Full",
                "password": "kim-pass",
            }
        )
        self.assertTrue(member["has_password"])
        self.assertNotIn("password_hash", member)
        found = self.store.find_staff_by_credentials("Coach Kim", "kim-pass")
        self.assertIsNotNone(found)
        self.assertEqual(found["id"], member["id"])

    def test_add_staff_with_username_login(self) -> None:
        member = self.store.add_staff(
            {
                "name": "Kyle Wallace",
                "role": "Assistant Coach",
                "access_level": "Manager",
                "username": "kwallace",
                "password": "manager-pass",
            }
        )
        self.assertEqual(member["username"], "kwallace")
        self.assertTrue(member["has_password"])
        self.assertNotIn("password_hash", member)
        # Sign-in is by username, not the display name.
        by_username = self.store.find_staff_by_credentials("kwallace", "manager-pass")
        self.assertIsNotNone(by_username)
        self.assertEqual(by_username["id"], member["id"])
        self.assertIsNone(
            self.store.find_staff_by_credentials("Kyle Wallace", "manager-pass")
        )

    def test_add_staff_username_must_be_unique(self) -> None:
        self.store.add_player(
            {
                "name": "Rowan",
                "position": "Center Field",
                "username": "shared1",
                "password": "pw12",
            }
        )
        with self.assertRaises(ValueError):
            self.store.add_staff(
                {
                    "name": "Sam",
                    "role": "Coach",
                    "access_level": "Full",
                    "username": "shared1",
                    "password": "staff-pass",
                }
            )
        with self.assertRaises(ValueError):
            self.store.add_staff(
                {
                    "name": "Reserved",
                    "role": "Coach",
                    "access_level": "Full",
                    "username": app.ADMIN_USERNAME,
                    "password": "staff-pass",
                }
            )

    def test_update_staff_access(self) -> None:
        member = self.store.add_staff(
            {"name": "Dana", "role": "Coach", "access_level": "Assistant"}
        )
        updated = self.store.update_staff_access(member["id"], "Manager")
        self.assertEqual(updated["access_level"], "Manager")
        # The change persists on the stored record.
        self.assertEqual(
            self.store._staff_unlocked(member["id"])["access_level"], "Manager"
        )
        with self.assertRaises(ValueError):
            self.store.update_staff_access(member["id"], "Emperor")
        with self.assertRaises(KeyError):
            self.store.update_staff_access("staff-does-not-exist", "Full")


COACH_PASSWORD = "coach-secret-pass"


class HttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = app.Store(Path(self.tmp.name) / "data.json")
        self.store.ensure_admin_password(COACH_PASSWORD)
        self.server = app.make_server(
            self.store, "127.0.0.1", 0, app.SessionManager(), app.LoginRateLimiter()
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address[:2]
        self.cookie: str | None = None
        self.csrf: str | None = None
        # Most tests exercise the full app, so start signed in as the coach.
        self.login_coach()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def call(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        raw: bytes | None = None,
    ) -> tuple[int, object | str]:
        conn = HTTPConnection(self.host, self.port, timeout=5)
        headers = {}
        payload = raw
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.cookie:
            headers["Cookie"] = self.cookie
        if self.csrf and method not in ("GET", "HEAD"):
            headers["X-CSRF-Token"] = self.csrf
        conn.request(method, path, body=payload, headers=headers)
        response = conn.getresponse()
        data = response.read()
        conn.close()
        try:
            return response.status, json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            return response.status, data.decode("utf-8", errors="replace")

    def _login(self, body: dict) -> tuple[int, object]:
        conn = HTTPConnection(self.host, self.port, timeout=5)
        payload = json.dumps(body).encode("utf-8")
        conn.request("POST", "/api/login", body=payload, headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        data = response.read()
        set_cookie = response.getheader("Set-Cookie")
        conn.close()
        parsed = json.loads(data.decode("utf-8") or "{}")
        if response.status == 200 and set_cookie:
            self.cookie = set_cookie.split(";", 1)[0]
            self.csrf = parsed.get("csrf")
        return response.status, parsed

    def login_coach(self, password: str = COACH_PASSWORD) -> tuple[int, object]:
        return self._login({"username": app.ADMIN_USERNAME, "password": password})

    def login_player(self, username: str, password: str) -> tuple[int, object]:
        return self._login({"username": username, "password": password})

    def login_staff(self, name: str, password: str) -> tuple[int, object]:
        return self._login({"username": name, "password": password})

    def give_player_login(
        self, pid: str, username: str = "player1", password: str = "player-pass"
    ) -> tuple[str, str]:
        """Set a player's sign-in username/password (as the signed-in coach)."""
        status, member = self.call(
            "PUT",
            f"/api/players/{pid}/login",
            {"username": username, "password": password},
        )
        self.assertEqual(status, 200, member)
        return username, password

    def make_staff(self, name: str, access_level: str, password: str) -> str:
        """Create a staff member with a login password (as the signed-in coach)."""
        status, member = self.call(
            "POST",
            "/api/staff",
            {"name": name, "role": "Coach", "access_level": access_level},
        )
        self.assertEqual(status, 201, member)
        status, _ = self.call(
            "PUT", f"/api/staff/{member['id']}/password", {"password": password}
        )
        self.assertEqual(status, 200)
        return member["id"]

    def sign_out(self) -> None:
        self.cookie = None
        self.csrf = None

    def test_health_and_home_page(self) -> None:
        status, payload = self.call("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["app"], "idev")
        status, html = self.call("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("idev", html)
        self.assertIn("Softball player development", html)
        self.assertIn("Import roster", html)
        self.assertIn("Export Stats", html)
        status, script = self.call("GET", "/static/app.js")
        self.assertEqual(status, 200)
        self.assertIn("GameChanger stats", script)
        self.assertIn("Offense", script)
        self.assertIn("Defense", script)
        self.assertIn("/api/players/import", script)

    def test_player_rating_note_flow(self) -> None:
        status, skill = self.call("POST", "/api/skills", {"name": "Infield"})
        self.assertEqual(status, 201)
        status, player = self.call(
            "POST",
            "/api/players",
            {"name": "Morgan", "position": "Second Base", "number": 4},
        )
        self.assertEqual(status, 201)
        status, _rating = self.call(
            "POST",
            f"/api/players/{player['id']}/ratings",
            {"skill_id": skill["id"], "score": 3},
        )
        self.assertEqual(status, 201)
        status, _note = self.call(
            "POST",
            f"/api/players/{player['id']}/notes",
            {"text": "Good feeds to second."},
        )
        self.assertEqual(status, 201)
        status, detail = self.call("GET", f"/api/players/{player['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["name"], "Morgan")
        self.assertEqual(len(detail["ratings"]), 1)
        self.assertEqual(detail["notes"][0]["text"], "Good feeds to second.")
        infield = next(item for item in detail["progress"] if item["skill_name"] == "Infield")
        self.assertEqual(infield["current"], 3)
        self.assertIn("stats", detail)
        self.assertEqual(detail["stats"]["computed"]["avg"], None)
        status, stats = self.call(
            "PUT",
            f"/api/players/{player['id']}/stats",
            {"ab": 4, "h": 2, "po": 3, "a": 1, "e": 0},
        )
        self.assertEqual(status, 200)
        self.assertEqual(stats["computed"]["avg"], 0.5)
        self.assertEqual(stats["computed"]["fpct"], 1.0)
        status, detail = self.call("GET", f"/api/players/{player['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["stats"]["computed"]["avg"], 0.5)
        status, payload = self.call(
            "PUT",
            f"/api/players/{player['id']}/stats",
            {"ab": -3},
        )
        self.assertEqual(status, 400)
        self.assertIn("0 to 9999", payload["error"])

    def test_validation_and_missing_player(self) -> None:
        status, payload = self.call("POST", "/api/players", {"name": "", "position": "Pitcher"})
        self.assertEqual(status, 400)
        self.assertIn("required", payload["error"].lower())
        status, payload = self.call("GET", "/api/players/player-missing1")
        self.assertEqual(status, 404)

    def test_roster_import_preview_commit_and_duplicate_skip(self) -> None:
        roster = "#,Roster,Position,GP\n7,Alex Rivera,SS,10\n21,Jordan Blake,P,10\n"
        status, preview = self.call(
            "POST",
            "/api/players/import",
            {"text": roster, "preview": True},
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(preview["players"]), 2)
        status, listed = self.call("GET", "/api/players")
        self.assertEqual(listed["players"], [])

        status, imported = self.call(
            "POST",
            "/api/players/import",
            {"text": roster, "preview": False},
        )
        self.assertEqual(status, 201)
        self.assertEqual(len(imported["imported"]), 2)
        self.assertEqual(imported["imported"][0]["position"], "Shortstop")

        status, duplicate = self.call(
            "POST",
            "/api/players/import",
            {"text": roster, "preview": True},
        )
        self.assertEqual(status, 200)
        self.assertEqual(duplicate["players"], [])
        self.assertEqual(len(duplicate["skipped"]), 2)

    def test_xss_is_stored_as_text(self) -> None:
        status, player = self.call(
            "POST",
            "/api/players",
            {"name": "<script>alert(1)</script>", "position": "Left Field"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(player["name"], "<script>alert(1)</script>")
        status, listed = self.call("GET", "/api/players")
        self.assertEqual(status, 200)
        self.assertEqual(listed["players"][0]["name"], "<script>alert(1)</script>")

    def test_path_traversal_is_rejected(self) -> None:
        status, payload = self.call("GET", "/static/../app.py")
        self.assertEqual(status, 404)
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload["error"], "Not found")

    def test_login_page_and_health_are_public(self) -> None:
        self.sign_out()
        status, _html = self.call("GET", "/")
        self.assertEqual(status, 200)
        status, payload = self.call("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["app"], "idev")
        status, session = self.call("GET", "/api/session")
        self.assertEqual(status, 200)
        self.assertFalse(session["authenticated"])

    def test_unauthenticated_requests_are_blocked(self) -> None:
        self.sign_out()
        status, payload = self.call("GET", "/api/players")
        self.assertEqual(status, 401)
        self.assertIn("sign in", payload["error"].lower())
        status, _payload = self.call(
            "POST", "/api/players", {"name": "Sneaky", "position": "Utility"}
        )
        self.assertEqual(status, 401)

    def test_invalid_login_is_rejected(self) -> None:
        self.sign_out()
        status, payload = self.login_coach(password="wrong-password")
        self.assertEqual(status, 401)
        self.assertIsNone(self.cookie)
        status, _payload = self.login_player("nobody", "not-a-real-code")
        self.assertEqual(status, 401)

    def test_coach_session_and_logout(self) -> None:
        status, session = self.call("GET", "/api/session")
        self.assertEqual(status, 200)
        self.assertTrue(session["authenticated"])
        self.assertEqual(session["role"], "coach")
        status, _payload = self.call("GET", "/api/players")
        self.assertEqual(status, 200)
        status, _payload = self.call("POST", "/api/logout")
        self.assertEqual(status, 200)
        # The server-side session is gone even though we still send the cookie.
        status, _payload = self.call("GET", "/api/players")
        self.assertEqual(status, 401)

    def test_staff_management_is_coach_only(self) -> None:
        status, created = self.call(
            "POST",
            "/api/staff",
            {
                "name": "Robin Vale",
                "role": "Team Manager",
                "contact": "555-0100",
                "access_level": "Assistant",
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["access_level"], "Assistant")
        status, listing = self.call("GET", "/api/staff")
        self.assertEqual(status, 200)
        self.assertTrue(any(m["id"] == created["id"] for m in listing["staff"]))

        # A signed-in player cannot see or modify staff.
        status, player = self.call(
            "POST", "/api/players", {"name": "Pat Lane", "position": "Utility"}
        )
        self.assertEqual(status, 201)
        self.give_player_login(player["id"], "patlane", "player-pass")
        self.sign_out()
        self.login_player("patlane", "player-pass")
        status, _payload = self.call("GET", "/api/staff")
        self.assertEqual(status, 403)
        status, _payload = self.call(
            "POST",
            "/api/staff",
            {"name": "Sneaky", "role": "x", "access_level": "Full"},
        )
        self.assertEqual(status, 403)

        # A player cannot manage staff passwords either.
        status, _payload = self.call(
            "PUT", f"/api/staff/{created['id']}/password", {"password": "secret1"}
        )
        self.assertEqual(status, 403)

        # Back as coach, deletion works.
        self.sign_out()
        self.login_coach()
        status, _payload = self.call("DELETE", f"/api/staff/{created['id']}")
        self.assertEqual(status, 200)
        status, listing = self.call("GET", "/api/staff")
        self.assertFalse(any(m["id"] == created["id"] for m in listing["staff"]))

    def test_staff_password_endpoints(self) -> None:
        status, created = self.call(
            "POST",
            "/api/staff",
            {"name": "Dana Kim", "role": "Coach", "access_level": "Full"},
        )
        self.assertEqual(status, 201)
        self.assertFalse(created["has_password"])

        status, updated = self.call(
            "PUT", f"/api/staff/{created['id']}/password", {"password": "secret1"}
        )
        self.assertEqual(status, 200)
        self.assertTrue(updated["has_password"])
        self.assertNotIn("password_hash", updated)

        # Too-short passwords are rejected.
        status, _payload = self.call(
            "PUT", f"/api/staff/{created['id']}/password", {"password": "no"}
        )
        self.assertEqual(status, 400)

        status, cleared = self.call(
            "DELETE", f"/api/staff/{created['id']}/password"
        )
        self.assertEqual(status, 200)
        self.assertFalse(cleared["has_password"])

    def test_team_information_is_coach_only(self) -> None:
        status, payload = self.call(
            "PUT",
            "/api/team",
            {
                "name": "Boston Caps",
                "year": "2025",
                "season": "Fall",
                "play_year": "Second year",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["team"]["season"], "Fall")

        status, listing = self.call("GET", "/api/team")
        self.assertEqual(status, 200)
        self.assertEqual(listing["team"]["name"], "Boston Caps")

        # Invalid values are rejected.
        status, _payload = self.call("PUT", "/api/team", {"season": "Monsoon"})
        self.assertEqual(status, 400)

        # A signed-in player cannot read or edit team information.
        status, player = self.call(
            "POST", "/api/players", {"name": "Pat Lane", "position": "Utility"}
        )
        self.assertEqual(status, 201)
        self.give_player_login(player["id"], "patlane", "player-pass")
        self.sign_out()
        self.login_player("patlane", "player-pass")
        # A player may read team info (it appears in the header) ...
        status, listing = self.call("GET", "/api/team")
        self.assertEqual(status, 200)
        self.assertEqual(listing["team"]["name"], "Boston Caps")
        # ... but cannot edit it.
        status, _payload = self.call("PUT", "/api/team", {"name": "Hijack"})
        self.assertEqual(status, 403)

    def test_drills_coach_only_player_can_view(self) -> None:
        status, player = self.call(
            "POST", "/api/players", {"name": "Drew Kim", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]

        status, drill = self.call(
            "POST",
            f"/api/players/{pid}/drills",
            {"name": "Long toss", "frequency": "Daily", "link": "https://ex.com/d"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(drill["name"], "Long toss")

        # A javascript: link is rejected.
        status, _payload = self.call(
            "POST",
            f"/api/players/{pid}/drills",
            {"name": "Bad", "link": "javascript:alert(1)"},
        )
        self.assertEqual(status, 400)

        # Give the player a login and sign in as them.
        self.give_player_login(pid, "drewkim", "player-pass")
        self.sign_out()
        self.login_player("drewkim", "player-pass")

        # The player can see their own drills...
        status, detail = self.call("GET", f"/api/players/{pid}")
        self.assertEqual(status, 200)
        self.assertTrue(any(d["id"] == drill["id"] for d in detail["drills"]))

        # ...but cannot add or remove them.
        status, _payload = self.call(
            "POST", f"/api/players/{pid}/drills", {"name": "Sneaky"}
        )
        self.assertEqual(status, 403)
        status, _payload = self.call(
            "DELETE", f"/api/players/{pid}/drills/{drill['id']}"
        )
        self.assertEqual(status, 403)

        # Back as coach, deletion works.
        self.sign_out()
        self.login_coach()
        status, _payload = self.call("DELETE", f"/api/players/{pid}/drills/{drill['id']}")
        self.assertEqual(status, 200)
        status, detail = self.call("GET", f"/api/players/{pid}")
        self.assertFalse(any(d["id"] == drill["id"] for d in detail["drills"]))

    def test_activity_logged_by_coach_and_owning_player(self) -> None:
        status, player = self.call(
            "POST", "/api/players", {"name": "Jamie Fox", "position": "Center Field"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]

        # A coach can log activity for a player.
        status, entry = self.call(
            "POST",
            f"/api/players/{pid}/activity",
            {"text": "Reviewed drill: Long toss"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(entry["text"], "Reviewed drill: Long toss")

        # Give the player a login and sign in as them.
        self.give_player_login(pid, "jamiefox", "player-pass")
        self.sign_out()
        self.login_player("jamiefox", "player-pass")

        # The owning player can log their own activity and see it in Progress.
        status, _entry = self.call(
            "POST",
            f"/api/players/{pid}/activity",
            {"text": "Reviewed drill: Soft toss"},
        )
        self.assertEqual(status, 201)
        status, detail = self.call("GET", f"/api/players/{pid}")
        self.assertEqual(status, 200)
        texts = [a["text"] for a in detail["activity"]]
        self.assertIn("Reviewed drill: Soft toss", texts)
        self.assertIn("Reviewed drill: Long toss", texts)

    def test_player_cannot_log_activity_for_another_player(self) -> None:
        _status, mine = self.call(
            "POST", "/api/players", {"name": "Owner", "position": "Shortstop"}
        )
        _status, other = self.call(
            "POST", "/api/players", {"name": "Stranger", "position": "Catcher"}
        )
        self.give_player_login(mine["id"], "owner1", "player-pass")
        self.sign_out()
        self.login_player("owner1", "player-pass")
        # Logging to a different player's profile is forbidden.
        status, _payload = self.call(
            "POST",
            f"/api/players/{other['id']}/activity",
            {"text": "Reviewed drill: X"},
        )
        self.assertEqual(status, 403)

    def test_csrf_token_required_for_mutations(self) -> None:
        saved = self.csrf
        self.csrf = None  # drop the CSRF header while keeping the session cookie
        status, payload = self.call("POST", "/api/skills", {"name": "Slapping"})
        self.assertEqual(status, 403)
        self.assertIn("token", payload["error"].lower())
        self.csrf = saved
        status, _payload = self.call("POST", "/api/skills", {"name": "Slapping"})
        self.assertEqual(status, 201)

    def test_player_access_is_scoped_to_one_player(self) -> None:
        _status, mine = self.call(
            "POST", "/api/players", {"name": "Mine", "position": "Shortstop"}
        )
        _status, other = self.call(
            "POST", "/api/players", {"name": "Other", "position": "Catcher"}
        )
        self.give_player_login(mine["id"], "mineuser", "player-pass")

        self.sign_out()
        status, session = self.login_player("mineuser", "player-pass")
        self.assertEqual(status, 200)
        self.assertEqual(session["role"], "player")
        self.assertEqual(session["player"]["id"], mine["id"])

        # Can read only their own player.
        status, detail = self.call("GET", f"/api/players/{mine['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["name"], "Mine")
        self.assertNotIn("password_hash", detail)

        # Cannot list the roster, read another player, or make changes.
        status, _payload = self.call("GET", "/api/players")
        self.assertEqual(status, 403)
        status, _payload = self.call("GET", f"/api/players/{other['id']}")
        self.assertEqual(status, 403)
        status, _payload = self.call(
            "POST", f"/api/players/{mine['id']}/notes", {"text": "no writes"}
        )
        self.assertEqual(status, 403)

    def test_alarms_coach_creates_player_reads(self) -> None:
        status, player = self.call(
            "POST", "/api/players", {"name": "Nova", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]
        status, _alarm = self.call(
            "POST", "/api/alarms", {"text": "Bring cleats", "target": "all"}
        )
        self.assertEqual(status, 201)
        self.give_player_login(pid, "novauser", "player-pass")

        self.sign_out()
        self.login_player("novauser", "player-pass")
        # The player sees the alarm as unread and cannot create alarms.
        status, listing = self.call("GET", "/api/alarms")
        self.assertEqual(status, 200)
        self.assertEqual(len(listing["alarms"]), 1)
        self.assertFalse(listing["alarms"][0]["read"])
        status, _payload = self.call(
            "POST", "/api/alarms", {"text": "Sneaky", "target": "all"}
        )
        self.assertEqual(status, 403)
        # Marking all read clears the unread flag.
        status, _payload = self.call("POST", "/api/alarms/read")
        self.assertEqual(status, 200)
        status, listing = self.call("GET", "/api/alarms")
        self.assertTrue(listing["alarms"][0]["read"])

        # Coach can delete the alarm.
        self.sign_out()
        self.login_coach()
        alarm_id = self.store.list_alarms()[0]["id"]
        status, _payload = self.call("DELETE", f"/api/alarms/{alarm_id}")
        self.assertEqual(status, 200)
        status, listing = self.call("GET", "/api/alarms")
        self.assertEqual(len(listing["alarms"]), 0)

    def test_messages_coach_sends_player_inbox(self) -> None:
        status, player = self.call(
            "POST", "/api/players", {"name": "Oak", "position": "Catcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]
        status, _team_msg = self.call(
            "POST", "/api/messages", {"body": "Great game", "audience": "team"}
        )
        self.assertEqual(status, 201)
        status, _direct = self.call(
            "POST",
            "/api/messages",
            {"body": "See coach", "audience": "player", "recipient_id": pid},
        )
        self.assertEqual(status, 201)
        self.give_player_login(pid, "oakuser", "player-pass")

        self.sign_out()
        self.login_player("oakuser", "player-pass")
        status, listing = self.call("GET", "/api/messages")
        self.assertEqual(status, 200)
        self.assertEqual({m["body"] for m in listing["messages"]}, {"Great game", "See coach"})
        # A player cannot send messages.
        status, _payload = self.call(
            "POST", "/api/messages", {"body": "Nope", "audience": "team"}
        )
        self.assertEqual(status, 403)

    def test_player_login_and_revocation(self) -> None:
        _status, player = self.call(
            "POST", "/api/players", {"name": "Rae", "position": "Pitcher"}
        )
        self.give_player_login(player["id"], "raeuser", "player-pass")
        # The login works before it is cleared.
        self.sign_out()
        status, session = self.login_player("raeuser", "player-pass")
        self.assertEqual(status, 200)
        self.assertEqual(session["role"], "player")
        # Clear the login as coach.
        self.login_coach()
        status, cleared = self.call("DELETE", f"/api/players/{player['id']}/login")
        self.assertEqual(status, 200)
        self.assertFalse(cleared["has_login"])
        # The old credentials no longer work.
        self.sign_out()
        status, _payload = self.login_player("raeuser", "player-pass")
        self.assertEqual(status, 401)

    # -- staff login + role-based permissions ------------------------------
    def test_staff_login_reports_role_and_level(self) -> None:
        self.make_staff("Kyle Wallace", "Manager", "manager-pass")
        self.sign_out()
        status, payload = self.login_staff("Kyle Wallace", "manager-pass")
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["role"], "staff")
        self.assertEqual(payload["access_level"], "Manager")
        self.assertEqual(payload["staff_name"], "Kyle Wallace")
        self.assertTrue(payload["can"]["content"])
        self.assertFalse(payload["can"]["admin"])
        self.assertTrue(payload["can"]["view_all"])

    def test_staff_login_rejects_wrong_password(self) -> None:
        self.make_staff("Dana Lee", "Full", "right-pass")
        self.sign_out()
        status, _payload = self.login_staff("Dana Lee", "wrong-pass")
        self.assertEqual(status, 401)

    def test_staff_login_rejects_member_without_password(self) -> None:
        status, member = self.call(
            "POST",
            "/api/staff",
            {"name": "No Pass", "role": "Assistant Coach", "access_level": "Read-only"},
        )
        self.assertEqual(status, 201, member)
        self.sign_out()
        status, _payload = self.login_staff("No Pass", "anything")
        self.assertEqual(status, 401)

    def test_full_staff_has_admin_access(self) -> None:
        self.make_staff("Tom Harrop", "Full", "full-pass")
        self.sign_out()
        status, payload = self.login_staff("Tom Harrop", "full-pass")
        self.assertEqual(status, 200)
        self.assertTrue(payload["can"]["admin"])
        # Full staff can add players (an admin action).
        status, _player = self.call(
            "POST", "/api/players", {"name": "New Kid", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)

    def test_manager_can_edit_content_but_not_admin(self) -> None:
        status, skill = self.call("POST", "/api/skills", {"name": "Speed"})
        self.assertEqual(status, 201)
        status, player = self.call(
            "POST", "/api/players", {"name": "Sam", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]
        self.make_staff("Kyle Wallace", "Manager", "manager-pass")
        self.sign_out()
        self.login_staff("Kyle Wallace", "manager-pass")
        # Content actions allowed.
        status, _ = self.call(
            "POST", f"/api/players/{pid}/ratings", {"skill_id": skill["id"], "score": 4}
        )
        self.assertEqual(status, 201)
        status, _ = self.call("POST", f"/api/players/{pid}/notes", {"text": "Nice work"})
        self.assertEqual(status, 201)
        status, _ = self.call(
            "POST", "/api/alarms", {"text": "Practice at 5", "target": "all"}
        )
        self.assertEqual(status, 201)
        # Admin actions denied.
        status, _ = self.call(
            "POST", "/api/players", {"name": "Blocked", "position": "Pitcher"}
        )
        self.assertEqual(status, 403)
        status, _ = self.call("PUT", f"/api/players/{pid}", {"name": "Renamed"})
        self.assertEqual(status, 403)
        status, _ = self.call(
            "PUT",
            f"/api/players/{pid}/login",
            {"username": "blocked", "password": "player-pass"},
        )
        self.assertEqual(status, 403)

    def test_full_access_can_change_staff_access_level(self) -> None:
        # Coach (full access) can change another staff member's access level.
        target = self.make_staff("Jamie Reed", "Assistant", "reed-pass")
        status, updated = self.call(
            "PUT", f"/api/staff/{target}", {"access_level": "Manager"}
        )
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated["access_level"], "Manager")
        # A rejected level returns 400 and leaves the record unchanged.
        status, _ = self.call("PUT", f"/api/staff/{target}", {"access_level": "Boss"})
        self.assertEqual(status, 400)
        status, listing = self.call("GET", "/api/staff")
        self.assertEqual(status, 200)
        member = next(m for m in listing["staff"] if m["id"] == target)
        self.assertEqual(member["access_level"], "Manager")

    def test_manager_cannot_change_staff_access_level(self) -> None:
        target = self.make_staff("Alex Stone", "Assistant", "stone-pass")
        self.make_staff("Kyle Wallace", "Manager", "manager-pass")
        self.sign_out()
        self.login_staff("Kyle Wallace", "manager-pass")
        # Changing access level is an admin-only action.
        status, _ = self.call(
            "PUT", f"/api/staff/{target}", {"access_level": "Full"}
        )
        self.assertEqual(status, 403)

    def test_view_only_staff_is_read_only(self) -> None:
        status, skill = self.call("POST", "/api/skills", {"name": "Speed"})
        self.assertEqual(status, 201)
        status, player = self.call(
            "POST", "/api/players", {"name": "Riley", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]
        self.make_staff("Pat Viewer", "Read-only", "view-pass")
        self.sign_out()
        self.login_staff("Pat Viewer", "view-pass")
        # Can browse all players and their details.
        status, players = self.call("GET", "/api/players")
        self.assertEqual(status, 200)
        self.assertTrue(any(p["id"] == pid for p in players["players"]))
        status, _detail = self.call("GET", f"/api/players/{pid}")
        self.assertEqual(status, 200)
        # Cannot make any changes.
        status, _ = self.call(
            "POST", f"/api/players/{pid}/ratings", {"skill_id": skill["id"], "score": 4}
        )
        self.assertEqual(status, 403)
        status, _ = self.call("POST", f"/api/players/{pid}/notes", {"text": "nope"})
        self.assertEqual(status, 403)
        status, _ = self.call("POST", "/api/skills", {"name": "Blocked"})
        self.assertEqual(status, 403)
        status, _ = self.call(
            "POST", "/api/alarms", {"text": "nope", "target": "all"}
        )
        self.assertEqual(status, 403)

    def test_assistant_staff_is_read_only(self) -> None:
        status, player = self.call(
            "POST", "/api/players", {"name": "Jo", "position": "Pitcher"}
        )
        self.assertEqual(status, 201)
        pid = player["id"]
        self.make_staff("Trevor Robbins", "Assistant", "asst-pass")
        self.sign_out()
        status, payload = self.login_staff("Trevor Robbins", "asst-pass")
        self.assertEqual(status, 200)
        self.assertFalse(payload["can"]["content"])
        self.assertTrue(payload["can"]["view_all"])
        status, _ = self.call("POST", f"/api/players/{pid}/notes", {"text": "nope"})
        self.assertEqual(status, 403)

    def test_find_staff_by_credentials(self) -> None:
        sid = self.make_staff("Casey Match", "Manager", "secret-pass")
        member = self.store.find_staff_by_credentials("casey match", "secret-pass")
        self.assertIsNotNone(member)
        self.assertEqual(member["id"], sid)
        self.assertEqual(member["access_level"], "Manager")
        self.assertNotIn("password_hash", member)
        self.assertIsNone(
            self.store.find_staff_by_credentials("Casey Match", "nope")
        )


if __name__ == "__main__":
    unittest.main()
