#!/usr/bin/env python3
"""Tests for pulling a GameChanger schedule in through its calendar link."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
for path in (ROOT, HERE):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import app
import test_app


def vevent(uid: str, summary: str, start: str, end: str = "", extra: str = "") -> str:
    lines = ["BEGIN:VEVENT", f"UID:{uid}", f"SUMMARY:{summary}", f"DTSTART{start}"]
    if end:
        lines.append(f"DTEND{end}")
    if extra:
        lines.append(extra)
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def calendar(*events: str) -> str:
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//GameChanger//Schedule//EN",
            "X-WR-TIMEZONE:America/Los_Angeles",
            *events,
            "END:VCALENDAR",
            "",
        ]
    )


GAME_1 = vevent(
    "gc-game-1",
    "vs. Thunder",
    ":20300321T170000Z",
    ":20300321T183000Z",
    "LOCATION:Field 3\\, Central Park\r\nDESCRIPTION:Arrive 45 min early.\\nWear white.",
)
GAME_2 = vevent("gc-game-2", "@ Lightning", ";TZID=America/Los_Angeles:20300322T090000")
TOURNEY = vevent("gc-tourney", "Spring Classic Tournament", ";VALUE=DATE:20300404", ";VALUE=DATE:20300406")


class CalendarParseTests(unittest.TestCase):
    def test_parses_gamechanger_style_feed(self) -> None:
        folded = GAME_1.replace("Arrive 45 min early.", "Arrive 45 min\r\n  early.")
        items = {item["external_uid"]: item for item in app.parse_calendar(calendar(folded, GAME_2, TOURNEY))}
        game = items["gc-game-1"]
        self.assertEqual(game["type"], "game")
        self.assertEqual(game["title"], "vs. Thunder")
        # 17:00 UTC in March (daylight time) is 10:00 in Los Angeles.
        self.assertEqual((game["date"], game["start_time"], game["end_time"]), ("2030-03-21", "10:00", "11:30"))
        self.assertEqual(game["location"], "Field 3, Central Park")
        self.assertEqual(game["notes"], "Arrive 45 min early.\nWear white.")
        self.assertFalse(game["cancelled"])
        away = items["gc-game-2"]
        self.assertEqual((away["date"], away["start_time"]), ("2030-03-22", "09:00"))
        tourney = items["gc-tourney"]
        self.assertEqual(tourney["type"], "tournament")
        self.assertTrue(tourney["all_day"])
        self.assertEqual((tourney["date"], tourney["end_date"]), ("2030-04-04", "2030-04-05"))

    def test_cancelled_status_and_bad_input(self) -> None:
        cancelled = vevent("gc-x", "vs. Rain", ":20300321T170000Z", extra="STATUS:CANCELLED")
        self.assertTrue(app.parse_calendar(calendar(cancelled))[0]["cancelled"])
        with self.assertRaises(ValueError):
            app.parse_calendar("not a calendar")
        with self.assertRaises(ValueError):
            app.parse_calendar(None)

    def test_calendar_url_rules(self) -> None:
        self.assertEqual(app.parse_calendar_url("webcal://api.team-manager.gc.com/ics/abc.ics"),
                         "https://api.team-manager.gc.com/ics/abc.ics")
        self.assertEqual(app.parse_calendar_url("  "), "")
        for bad in ("javascript:alert(1)", "ftp://x/y.ics", "file:///etc/passwd"):
            with self.assertRaises(ValueError):
                app.parse_calendar_url(bad)


class CalendarStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = app.Store(Path(self.tmp.name) / "data.json")
        self.team_id = self.store.list_teams()[0]["id"]
        self.store.set_team_calendar(self.team_id, {"url": "https://example.com/team.ics"})
        self.feed = calendar(GAME_1, GAME_2, TOURNEY)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def sync(self) -> dict:
        return self.store.sync_team_calendar(self.team_id, fetcher=lambda _url: self.feed)

    def games(self) -> dict:
        return {e["external_uid"]: e for e in self.store.data["events"] if e.get("source") == app.CALENDAR_SOURCE}

    def test_sync_adds_updates_cancels_and_restores(self) -> None:
        result = self.sync()
        self.assertEqual((result["added"], result["total"]), (3, 3))
        self.assertTrue(result["team"]["gc_synced_at"])
        self.assertEqual(self.sync()["unchanged"], 3)

        self.feed = calendar(GAME_1.replace("T170000Z", "T180000Z"), TOURNEY)
        result = self.sync()
        self.assertEqual((result["updated"], result["cancelled"]), (1, 1))
        games = self.games()
        self.assertEqual(games["gc-game-1"]["start_time"], "11:00")
        self.assertTrue(games["gc-game-2"]["cancelled"])
        self.assertEqual(len(games), 3)

        self.feed = calendar(GAME_1, GAME_2, TOURNEY)
        self.sync()
        self.assertFalse(self.games()["gc-game-2"]["cancelled"])

    def test_past_games_missing_from_feed_are_left_alone(self) -> None:
        self.feed = calendar(vevent("gc-old", "vs. Old", ":20200321T170000Z"))
        self.sync()
        self.feed = calendar(GAME_1)
        self.assertEqual(self.sync()["cancelled"], 0)
        self.assertFalse(self.games()["gc-old"]["cancelled"])

    def test_synced_games_are_read_only_until_unlinked(self) -> None:
        self.sync()
        game = self.games()["gc-game-1"]
        edit = {"type": "game", "title": "Mine", "date": "2030-03-21", "start_time": "10:00"}
        with self.assertRaises(ValueError):
            self.store.update_event(game["id"], edit, None)
        self.store.set_team_calendar(self.team_id, {"url": ""})
        self.assertEqual(self.store.update_event(game["id"], edit, None)["title"], "Mine")
        self.assertNotIn("source", self.store._event_unlocked(game["id"]))

    def test_file_import_never_cancels_missing_games(self) -> None:
        self.sync()
        result = self.store.import_team_calendar(self.team_id, {"ics": calendar(GAME_1)})
        self.assertEqual((result["unchanged"], result["cancelled"]), (1, 0))
        self.assertFalse(any(g["cancelled"] for g in self.games().values()))

    def test_failed_sync_is_recorded(self) -> None:
        def broken(_url):
            raise ValueError("Couldn't reach that calendar link.")

        with self.assertRaises(ValueError):
            self.store.sync_team_calendar(self.team_id, fetcher=broken)
        self.assertIn("Couldn't reach", self.store.list_teams()[0]["gc_sync_error"])
        self.store.set_team_calendar(self.team_id, {"url": ""})
        with self.assertRaises(ValueError):
            self.sync()


class CalendarHttpTests(unittest.TestCase):
    setUp = test_app.HttpTests.setUp
    tearDown = test_app.HttpTests.tearDown
    call = test_app.HttpTests.call
    _login = test_app.HttpTests._login
    login_coach = test_app.HttpTests.login_coach
    login_staff = test_app.HttpTests.login_staff
    make_staff = test_app.HttpTests.make_staff
    sign_out = test_app.HttpTests.sign_out

    def team_id(self) -> str:
        _status, payload = self.call("GET", "/api/teams")
        return payload["teams"][0]["id"]

    def test_link_sync_and_file_import(self) -> None:
        team = self.team_id()
        status, saved = self.call("PUT", f"/api/teams/{team}/calendar", {"url": "webcal://example.com/t.ics"})
        self.assertEqual(status, 200, saved)
        self.assertEqual(saved["gc_calendar_url"], "https://example.com/t.ics")
        with mock.patch.object(app, "fetch_calendar", return_value=calendar(GAME_1, GAME_2)):
            status, result = self.call("POST", f"/api/teams/{team}/calendar/sync", {})
        self.assertEqual(status, 200, result)
        self.assertEqual(result["added"], 2)
        status, payload = self.call("GET", "/api/events?from=2030-03-01&to=2030-03-31")
        self.assertEqual(len(payload["events"]), 2)
        game = payload["events"][0]
        self.assertEqual(game["source"], "gamechanger")
        status, error = self.call(
            "PUT", f"/api/events/{game['id']}",
            {"type": "game", "title": "x", "date": "2030-03-21", "start_time": "10:00"},
        )
        self.assertEqual(status, 400)
        self.assertIn("GameChanger", error["error"])

        status, result = self.call("POST", f"/api/teams/{team}/calendar/import", {"ics": calendar(TOURNEY)})
        self.assertEqual(status, 200, result)
        self.assertEqual(result["added"], 1)
        status, _ = self.call("POST", f"/api/teams/{team}/calendar/import", {"ics": "hello"})
        self.assertEqual(status, 400)

    def test_private_addresses_are_refused(self) -> None:
        team = self.team_id()
        self.call("PUT", f"/api/teams/{team}/calendar", {"url": "http://127.0.0.1:9/secret.ics"})
        with mock.patch.object(app, "CALENDAR_ALLOW_PRIVATE", False):
            status, error = self.call("POST", f"/api/teams/{team}/calendar/sync", {})
        self.assertEqual(status, 400)
        self.assertIn("private", error["error"])

    def test_calendar_settings_are_coach_only(self) -> None:
        team = self.team_id()
        self.make_staff("Robin", "Manager", "staff-pass")
        self.sign_out()
        self.login_staff("Robin", "staff-pass")
        status, _ = self.call("PUT", f"/api/teams/{team}/calendar", {"url": "https://example.com/t.ics"})
        self.assertEqual(status, 403)
        status, _ = self.call("POST", f"/api/teams/{team}/calendar/import", {"ics": calendar(GAME_1)})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
