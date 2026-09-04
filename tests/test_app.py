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
        self.store.delete_note(note["id"])
        self.store.delete_player(player["id"])
        with self.assertRaises(KeyError):
            self.store.get_player(player["id"])

    def test_rejects_invalid_score(self) -> None:
        skill = self.store.add_skill("Pop time")
        player = self.store.add_player({"name": "Casey", "position": "Catcher"})
        with self.assertRaises(ValueError):
            self.store.add_rating(player["id"], {"skill_id": skill["id"], "score": 6})

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


class HttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        store = app.Store(Path(self.tmp.name) / "data.json")
        self.server = app.make_server(store, "127.0.0.1", 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address[:2]

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
        conn.request(method, path, body=payload, headers=headers)
        response = conn.getresponse()
        data = response.read()
        conn.close()
        try:
            return response.status, json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            return response.status, data.decode("utf-8", errors="replace")

    def test_health_and_home_page(self) -> None:
        status, payload = self.call("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["app"], "idev")
        status, html = self.call("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("idev", html)
        self.assertIn("Softball player development", html)
        status, script = self.call("GET", "/static/app.js")
        self.assertEqual(status, 200)
        self.assertIn("GameChanger stats", script)
        self.assertIn("Offense", script)
        self.assertIn("Defense", script)

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


if __name__ == "__main__":
    unittest.main()
