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

    def test_access_code_roundtrip_and_not_leaked(self) -> None:
        player = self.store.add_player({"name": "Sam Lee", "position": "Catcher"})
        self.assertNotIn("access_code_hash", player)
        code = self.store.set_player_access_code(player["id"])
        self.assertEqual(self.store.find_player_by_access_code(code), player["id"])
        self.assertIsNone(self.store.find_player_by_access_code("nope"))
        detail = self.store.get_player(player["id"])
        self.assertTrue(detail["has_access_code"])
        self.assertNotIn("access_code_hash", detail)
        # Stored value is a SHA-256 hash, never the plaintext code.
        stored = self.store.data["players"][0]["access_code_hash"]
        self.assertEqual(len(stored), 64)
        self.assertNotEqual(stored, code)
        self.store.clear_player_access_code(player["id"])
        self.assertIsNone(self.store.find_player_by_access_code(code))

    def test_public_player_hides_access_code_hash(self) -> None:
        player = self.store.add_player({"name": "Pat", "position": "Utility"})
        self.store.set_player_access_code(player["id"])
        listed = self.store.list_players()
        self.assertTrue(all("access_code_hash" not in item for item in listed))


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
        return self._login({"mode": "coach", "password": password})

    def login_player(self, code: str) -> tuple[int, object]:
        return self._login({"mode": "player", "code": code})

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
        status, _payload = self.login_player(code="not-a-real-code")
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
        status, code_payload = self.call(
            "POST", f"/api/players/{mine['id']}/access-code"
        )
        self.assertEqual(status, 201)
        code = code_payload["code"]

        self.sign_out()
        status, session = self.login_player(code)
        self.assertEqual(status, 200)
        self.assertEqual(session["role"], "player")
        self.assertEqual(session["player"]["id"], mine["id"])

        # Can read only their own player.
        status, detail = self.call("GET", f"/api/players/{mine['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["name"], "Mine")
        self.assertNotIn("access_code_hash", detail)

        # Cannot list the roster, read another player, or make changes.
        status, _payload = self.call("GET", "/api/players")
        self.assertEqual(status, 403)
        status, _payload = self.call("GET", f"/api/players/{other['id']}")
        self.assertEqual(status, 403)
        status, _payload = self.call(
            "POST", f"/api/players/{mine['id']}/notes", {"text": "no writes"}
        )
        self.assertEqual(status, 403)

    def test_access_code_login_and_revocation(self) -> None:
        _status, player = self.call(
            "POST", "/api/players", {"name": "Rae", "position": "Pitcher"}
        )
        _status, code_payload = self.call(
            "POST", f"/api/players/{player['id']}/access-code"
        )
        code = code_payload["code"]
        # Revoke as coach.
        status, _payload = self.call("DELETE", f"/api/players/{player['id']}/access-code")
        self.assertEqual(status, 200)
        self.sign_out()
        status, _payload = self.login_player(code)
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
