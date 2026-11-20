#!/usr/bin/env python3
"""Tests for multiple teams/sports and the team schedule."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
for path in (ROOT, HERE):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import app
import test_app


class TeamMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "data.json"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_single_team_data_becomes_first_team(self) -> None:
        legacy = {
            "skills": [],
            "players": [{"id": "player-aaaaaaaa", "name": "Ava", "position": "Pitcher"}],
            "staff": [{"id": "staff-aaaaaaaa", "name": "Pat", "role": "Coach", "access_level": "Manager"}],
            "team": {"name": "Alpha 12U-2033", "season": "Fall", "age_bracket": "12u"},
        }
        self.path.write_text(json.dumps(legacy), encoding="utf-8")
        store = app.Store(self.path)
        teams = store.list_teams()
        self.assertEqual(len(teams), 1)
        self.assertEqual(teams[0]["name"], "Alpha 12U-2033")
        self.assertEqual(teams[0]["sport"], "Softball")
        self.assertEqual(teams[0]["player_count"], 1)
        self.assertEqual(store.data["players"][0]["team_id"], teams[0]["id"])
        self.assertEqual(store.data["staff"][0]["team_ids"], [teams[0]["id"]])
        # The migration is saved, so ids are stable across restarts.
        again = app.Store(self.path)
        self.assertEqual(again.list_teams()[0]["id"], teams[0]["id"])

    def test_fresh_store_has_a_default_team_without_writing_a_file(self) -> None:
        store = app.Store(self.path)
        self.assertEqual(store.list_teams()[0]["name"], "My team")
        self.assertFalse(self.path.exists())

    def test_demo_seed_players_get_a_team(self) -> None:
        store = app.Store(self.path)
        store.seed_demo_if_empty()
        team_id = store.list_teams()[0]["id"]
        self.assertTrue(store.data["players"])
        self.assertTrue(all(p.get("team_id") == team_id for p in store.data["players"]))


class TeamStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = app.Store(Path(self.tmp.name) / "data.json")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_team_crud_and_validation(self) -> None:
        team = self.store.add_team({"name": "Alpha Baseball 10U", "sport": "baseball"})
        self.assertEqual(team["sport"], "Baseball")
        with self.assertRaises(ValueError):
            self.store.add_team({"name": "alpha baseball 10u"})
        with self.assertRaises(ValueError):
            self.store.add_team({"name": "Hockey", "sport": "Hockey"})
        with self.assertRaises(ValueError):
            self.store.add_team({"name": "  "})
        updated = self.store.update_team(team["id"], {"name": "Alpha BB 10U", "sport": "Baseball"})
        self.assertEqual(updated["name"], "Alpha BB 10U")
        player = self.store.add_player({"name": "Max", "position": "Catcher", "team_id": team["id"]})
        self.assertEqual(player["team_id"], team["id"])
        with self.assertRaises(ValueError):
            self.store.delete_team(team["id"])
        self.store.delete_player(player["id"])
        self.store.delete_team(team["id"])
        self.assertEqual(len(self.store.list_teams()), 1)
        with self.assertRaises(ValueError):
            self.store.delete_team(self.store.list_teams()[0]["id"])

    def test_player_and_staff_team_assignment(self) -> None:
        first = self.store.list_teams()[0]["id"]
        other = self.store.add_team({"name": "Alpha 14U"})["id"]
        player = self.store.add_player({"name": "Ivy", "position": "Shortstop"})
        self.assertEqual(player["team_id"], first)
        moved = self.store.update_player(player["id"], {"team_id": other})
        self.assertEqual(moved["team_id"], other)
        with self.assertRaises(ValueError):
            self.store.update_player(player["id"], {"team_id": "team-nope0000"})
        member = self.store.add_staff(
            {"name": "Sam", "role": "Assistant", "access_level": "Manager", "team_ids": [other]}
        )
        self.assertEqual(member["team_ids"], [other])
        member = self.store.update_staff(member["id"], {"team_ids": []})
        self.assertEqual(member["team_ids"], [])
        with self.assertRaises(ValueError):
            self.store.update_staff(member["id"], {"team_ids": ["team-nope0000"]})

    def test_event_validation(self) -> None:
        good = {"type": "practice", "title": "Practice", "date": "2026-11-24", "start_time": "18:00"}
        event = self.store.add_event(good, None)
        self.assertEqual(event["end_date"], "2026-11-24")
        self.assertEqual(event["rsvp"], {"yes": 0, "no": 0, "roster": 0})
        bad_cases = [
            {**good, "type": "party"},
            {**good, "title": ""},
            {**good, "date": "11/24/2026"},
            {**good, "start_time": ""},
            {**good, "start_time": "6pm"},
            {**good, "end_time": "17:00"},
            {**good, "end_date": "2026-11-23"},
            {**good, "end_date": "2026-12-24"},
            {**good, "team_id": "team-nope0000"},
        ]
        for case in bad_cases:
            with self.assertRaises(ValueError, msg=case):
                self.store.add_event(case, None)
        tournament = self.store.add_event(
            {"type": "tournament", "title": "Turkey Bash", "date": "2026-11-21", "end_date": "2026-11-22", "all_day": True},
            None,
        )
        self.assertEqual(tournament["start_time"], "")
        # Range queries include multi-day events that overlap the window.
        ids = [e["id"] for e in self.store.list_events(None, "2026-11-22", "2026-11-22")]
        self.assertEqual(ids, [tournament["id"]])


class TeamScheduleHttpTests(unittest.TestCase):
    setUp = test_app.HttpTests.setUp
    tearDown = test_app.HttpTests.tearDown
    call = test_app.HttpTests.call
    _login = test_app.HttpTests._login
    login_coach = test_app.HttpTests.login_coach
    login_player = test_app.HttpTests.login_player
    login_staff = test_app.HttpTests.login_staff
    give_player_login = test_app.HttpTests.give_player_login
    make_staff = test_app.HttpTests.make_staff
    sign_out = test_app.HttpTests.sign_out

    def make_two_teams(self) -> tuple[str, str, str, str]:
        status, payload = self.call("GET", "/api/teams")
        self.assertEqual(status, 200)
        softball = payload["teams"][0]["id"]
        status, baseball = self.call("POST", "/api/teams", {"name": "Alpha Baseball 10U", "sport": "Baseball"})
        self.assertEqual(status, 201, baseball)
        _s, ava = self.call("POST", "/api/players", {"name": "Ava", "position": "Pitcher", "team_id": softball})
        _s, max_ = self.call("POST", "/api/players", {"name": "Max", "position": "Catcher", "team_id": baseball["id"]})
        return softball, baseball["id"], ava["id"], max_["id"]

    def add_event(self, team_id: str, title: str, date: str = "2026-11-24") -> dict:
        status, event = self.call(
            "POST",
            "/api/events",
            {"team_id": team_id, "type": "practice", "title": title, "date": date, "start_time": "18:00"},
        )
        self.assertEqual(status, 201, event)
        return event

    def test_player_sees_only_their_teams_events_and_can_rsvp(self) -> None:
        softball, baseball, ava, _max = self.make_two_teams()
        mine = self.add_event(softball, "Softball practice")
        theirs = self.add_event(baseball, "Baseball practice")
        self.give_player_login(ava, "ava7", "player-pass")
        self.sign_out()
        self.login_player("ava7", "player-pass")

        status, payload = self.call("GET", "/api/events?from=2026-11-01&to=2026-11-30")
        self.assertEqual(status, 200)
        self.assertEqual([e["id"] for e in payload["events"]], [mine["id"]])
        self.assertNotIn("rsvp", payload["events"][0])
        status, payload = self.call("GET", "/api/teams")
        self.assertEqual([t["id"] for t in payload["teams"]], [softball])

        status, answered = self.call("POST", f"/api/events/{mine['id']}/rsvp", {"status": "yes"})
        self.assertEqual(status, 200, answered)
        self.assertEqual(answered["my_rsvp"], "yes")
        status, _ = self.call("POST", f"/api/events/{theirs['id']}/rsvp", {"status": "yes"})
        self.assertEqual(status, 404)
        # Players can't create, edit or delete events.
        status, _ = self.call("POST", "/api/events", {"team_id": softball, "type": "game", "title": "x", "date": "2026-11-25", "all_day": True})
        self.assertEqual(status, 403)
        status, _ = self.call("DELETE", f"/api/events/{mine['id']}")
        self.assertEqual(status, 403)

        self.sign_out()
        self.login_coach()
        status, payload = self.call("GET", "/api/events")
        counts = {e["id"]: e["rsvp"] for e in payload["events"]}
        self.assertEqual(counts[mine["id"]], {"yes": 1, "no": 0, "roster": 1})
        self.assertEqual(len(payload["events"]), 2)

    def test_staff_limited_to_their_teams(self) -> None:
        softball, baseball, ava, max_ = self.make_two_teams()
        staff_id = self.make_staff("Robin", "Manager", "staff-pass")
        status, _ = self.call("PUT", f"/api/staff/{staff_id}", {"team_ids": [baseball]})
        self.assertEqual(status, 200)
        softball_event = self.add_event(softball, "Softball practice")
        self.sign_out()
        status, _ = self.login_staff("Robin", "staff-pass")
        self.assertEqual(status, 200)

        status, payload = self.call("GET", "/api/players")
        self.assertEqual([p["id"] for p in payload["players"]], [max_])
        status, _ = self.call("GET", f"/api/players/{ava}")
        self.assertEqual(status, 403)
        status, _ = self.call("POST", f"/api/players/{ava}/notes", {"text": "hi"})
        self.assertEqual(status, 403)
        status, _ = self.call("GET", f"/api/players/{max_}")
        self.assertEqual(status, 200)

        status, payload = self.call("GET", "/api/events")
        self.assertEqual(payload["events"], [])
        status, _ = self.call(
            "POST", "/api/events",
            {"team_id": softball, "type": "practice", "title": "Sneaky", "date": "2026-11-24", "start_time": "18:00"},
        )
        self.assertEqual(status, 403)
        status, _ = self.call("DELETE", f"/api/events/{softball_event['id']}")
        self.assertEqual(status, 404)
        own = self.add_event(baseball, "Baseball practice")
        status, edited = self.call(
            "PUT", f"/api/events/{own['id']}",
            {"type": "scrimmage", "title": "Scrimmage", "date": "2026-11-25", "start_time": "17:00"},
        )
        self.assertEqual(status, 200, edited)
        self.assertEqual(edited["type"], "scrimmage")
        # Only admins manage teams.
        status, _ = self.call("POST", "/api/teams", {"name": "Rogue"})
        self.assertEqual(status, 403)

    def test_staff_with_no_team_list_sees_every_team(self) -> None:
        _softball, _baseball, _ava, _max = self.make_two_teams()
        staff_id = self.make_staff("Lee", "Assistant", "staff-pass")
        status, _ = self.call("PUT", f"/api/staff/{staff_id}", {"team_ids": []})
        self.assertEqual(status, 200)
        self.sign_out()
        self.login_staff("Lee", "staff-pass")
        status, payload = self.call("GET", "/api/players")
        self.assertEqual(len(payload["players"]), 2)
        status, payload = self.call("GET", "/api/teams")
        self.assertEqual(len(payload["teams"]), 2)

    def test_event_update_delete_and_bad_query(self) -> None:
        softball, _baseball, _ava, _max = self.make_two_teams()
        event = self.add_event(softball, "Practice")
        status, _ = self.call("GET", "/api/events?from=nope")
        self.assertEqual(status, 400)
        status, _ = self.call("PUT", f"/api/events/{event['id']}", {"type": "game", "title": "", "date": "2026-11-24", "all_day": True})
        self.assertEqual(status, 400)
        status, _ = self.call("DELETE", f"/api/events/{event['id']}")
        self.assertEqual(status, 200)
        status, _ = self.call("DELETE", f"/api/events/{event['id']}")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
