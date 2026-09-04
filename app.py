#!/usr/bin/env python3
"""idev — a tiny local web app for softball player development.

No packages to install. From this folder run:

    python3 app.py

Then open http://127.0.0.1:8765 in your browser.
"""

from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
STATIC_DIR = (ROOT / "static").resolve()
MAX_BODY_BYTES = 32 * 1024
MAX_NAME_LEN = 80
MAX_NOTE_LEN = 2000
MAX_SKILL_LEN = 40
HOST = os.environ.get("IDEV_HOST", "127.0.0.1")
PORT = int(os.environ.get("IDEV_PORT", "8765"))
DATA_PATH = Path(os.environ.get("IDEV_DATA", str(ROOT / "data.json")))

POSITIONS = (
    "Pitcher",
    "Catcher",
    "First Base",
    "Second Base",
    "Third Base",
    "Shortstop",
    "Left Field",
    "Center Field",
    "Right Field",
    "Utility",
    "DP/Flex",
)

DEFAULT_SKILLS = (
    "Hitting",
    "Power",
    "Bunting",
    "Throwing",
    "Fielding",
    "Footwork",
    "Base running",
    "Game IQ",
    "Pitching",
    "Catching",
)

SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")

# Standard GameChanger batting and fielding totals coaches copy from a season page.
OFFENSE_COUNT_FIELDS = (
    ("gp", "GP", "Games played"),
    ("pa", "PA", "Plate appearances"),
    ("ab", "AB", "At bats"),
    ("h", "H", "Hits"),
    ("doubles", "2B", "Doubles"),
    ("triples", "3B", "Triples"),
    ("hr", "HR", "Home runs"),
    ("r", "R", "Runs"),
    ("rbi", "RBI", "Runs batted in"),
    ("bb", "BB", "Walks"),
    ("so", "SO", "Strikeouts"),
    ("hbp", "HBP", "Hit by pitch"),
    ("sf", "SF", "Sacrifice flies"),
    ("sac", "SAC", "Sacrifice bunts"),
    ("sb", "SB", "Stolen bases"),
    ("cs", "CS", "Caught stealing"),
)

DEFENSE_COUNT_FIELDS = (
    ("inn", "INN", "Innings played"),
    ("po", "PO", "Putouts"),
    ("a", "A", "Assists"),
    ("e", "E", "Errors"),
    ("dp", "DP", "Double plays"),
)

OFFENSE_COMPUTED_FIELDS = (
    ("avg", "AVG", "Batting average"),
    ("obp", "OBP", "On-base percentage"),
    ("slg", "SLG", "Slugging percentage"),
    ("ops", "OPS", "On-base plus slugging"),
    ("tb", "TB", "Total bases"),
    ("xbh", "XBH", "Extra-base hits"),
)

DEFENSE_COMPUTED_FIELDS = (
    ("tc", "TC", "Total chances"),
    ("fpct", "FLD%", "Fielding percentage"),
)

COUNT_FIELDS = OFFENSE_COUNT_FIELDS + DEFENSE_COUNT_FIELDS
DECIMAL_COUNT_KEYS = {"inn"}
MAX_STAT = 9999


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def clean_text(value: object, field: str, max_len: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} is required")
    text = " ".join(value.split())
    if not text:
        raise ValueError(f"{field} is required")
    if len(text) > max_len:
        raise ValueError(f"{field} must be {max_len} characters or fewer")
    return text


def parse_number(value: object) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Jersey number must be a whole number from 0 to 99") from exc
    if number < 0 or number > 99:
        raise ValueError("Jersey number must be a whole number from 0 to 99")
    return number


def parse_score(value: object) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Rating must be a whole number from 1 to 5") from exc
    if score < 1 or score > 5:
        raise ValueError("Rating must be a whole number from 1 to 5")
    return score


def parse_position(value: object) -> str:
    position = clean_text(value, "Position", 40)
    if position not in POSITIONS:
        raise ValueError("Choose a position from the list")
    return position


def empty_stat_counts() -> dict:
    return {key: 0 for key, _abbr, _label in COUNT_FIELDS}


def parse_stat_value(value: object, label: str, decimal: bool = False) -> int | float:
    if value is None or value == "":
        return 0
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a number from 0 to {MAX_STAT}")
    try:
        number = float(value) if decimal else int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a number from 0 to {MAX_STAT}") from exc
    if number < 0 or number > MAX_STAT:
        raise ValueError(f"{label} must be a number from 0 to {MAX_STAT}")
    if not decimal:
        return int(number)
    rounded = round(number, 1)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


def parse_stat_counts(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object")
    counts = empty_stat_counts()
    for key, abbr, _label in COUNT_FIELDS:
        if key in payload:
            counts[key] = parse_stat_value(
                payload[key], abbr, decimal=key in DECIMAL_COUNT_KEYS
            )
    return counts


def normalize_stat_counts(raw: object) -> dict:
    counts = empty_stat_counts()
    if not isinstance(raw, dict):
        return counts
    for key, abbr, _label in COUNT_FIELDS:
        if key not in raw:
            continue
        try:
            counts[key] = parse_stat_value(
                raw[key], abbr, decimal=key in DECIMAL_COUNT_KEYS
            )
        except ValueError:
            counts[key] = 0
    return counts


def format_rate(value: float | None) -> str:
    if value is None:
        return "—"
    text = f"{value:.3f}"
    if text.startswith("0"):
        return text[1:]
    return text


def compute_game_stats(counts: dict) -> dict:
    at_bats = int(counts["ab"])
    hits = int(counts["h"])
    doubles = int(counts["doubles"])
    triples = int(counts["triples"])
    home_runs = int(counts["hr"])
    extra_base = doubles + triples + home_runs
    singles = max(hits - extra_base, 0)
    total_bases = singles + (2 * doubles) + (3 * triples) + (4 * home_runs)
    avg = (hits / at_bats) if at_bats else None
    on_base_chances = at_bats + int(counts["bb"]) + int(counts["hbp"]) + int(counts["sf"])
    on_base = hits + int(counts["bb"]) + int(counts["hbp"])
    obp = (on_base / on_base_chances) if on_base_chances else None
    slg = (total_bases / at_bats) if at_bats else None
    ops = (obp + slg) if obp is not None and slg is not None else None
    total_chances = int(counts["po"]) + int(counts["a"]) + int(counts["e"])
    fpct = ((int(counts["po"]) + int(counts["a"])) / total_chances) if total_chances else None
    return {
        "avg": None if avg is None else round(avg, 3),
        "obp": None if obp is None else round(obp, 3),
        "slg": None if slg is None else round(slg, 3),
        "ops": None if ops is None else round(ops, 3),
        "tb": total_bases,
        "xbh": extra_base,
        "tc": total_chances,
        "fpct": None if fpct is None else round(fpct, 3),
    }


def build_stats_view(raw: object) -> dict:
    counts = normalize_stat_counts(raw)
    computed = compute_game_stats(counts)

    def count_items(fields: tuple) -> list[dict]:
        items = []
        for key, abbr, label in fields:
            items.append(
                {
                    "key": key,
                    "abbr": abbr,
                    "label": label,
                    "kind": "count",
                    "value": counts[key],
                    "display": str(counts[key]),
                }
            )
        return items

    def computed_items(fields: tuple) -> list[dict]:
        items = []
        for key, abbr, label in fields:
            value = computed[key]
            if key in {"tb", "xbh", "tc"}:
                display = str(value)
            else:
                display = format_rate(value)
            items.append(
                {
                    "key": key,
                    "abbr": abbr,
                    "label": label,
                    "kind": "computed",
                    "value": value,
                    "display": display,
                }
            )
        return items

    return {
        "counts": counts,
        "computed": computed,
        "offense": count_items(OFFENSE_COUNT_FIELDS) + computed_items(OFFENSE_COMPUTED_FIELDS),
        "defense": count_items(DEFENSE_COUNT_FIELDS) + computed_items(DEFENSE_COMPUTED_FIELDS),
    }


class Store:
    """JSON file store for players, skills, ratings, and notes."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.lock = threading.Lock()
        self.data = self._load()

    def _empty(self) -> dict:
        return {"skills": [], "players": [], "ratings": [], "notes": []}

    def _load(self) -> dict:
        if not self.path.exists():
            return self._empty()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self._empty()
        if not isinstance(raw, dict):
            return self._empty()
        data = self._empty()
        for key in data:
            items = raw.get(key, [])
            if isinstance(items, list):
                data[key] = [item for item in items if isinstance(item, dict)]
        return data

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def seed_demo_if_empty(self) -> None:
        with self.lock:
            if self.data["players"] or self.data["skills"]:
                return
            skills = [
                {"id": new_id("skill"), "name": name} for name in DEFAULT_SKILLS
            ]
            by_name = {skill["name"]: skill["id"] for skill in skills}
            now = utc_now()
            earlier = (
                datetime.now(timezone.utc) - timedelta(days=14)
            ).replace(microsecond=0).isoformat()
            alex = {
                "id": new_id("player"),
                "name": "Alex Rivera",
                "position": "Shortstop",
                "number": 7,
                "created_at": earlier,
                "stats": {
                    "gp": 10,
                    "pa": 36,
                    "ab": 32,
                    "h": 12,
                    "doubles": 3,
                    "triples": 1,
                    "hr": 1,
                    "r": 9,
                    "rbi": 8,
                    "bb": 3,
                    "so": 5,
                    "hbp": 1,
                    "sf": 0,
                    "sac": 0,
                    "sb": 4,
                    "cs": 1,
                    "inn": 48,
                    "po": 18,
                    "a": 22,
                    "e": 2,
                    "dp": 3,
                },
            }
            jordan = {
                "id": new_id("player"),
                "name": "Jordan Blake",
                "position": "Pitcher",
                "number": 21,
                "created_at": earlier,
                "stats": {
                    "gp": 10,
                    "pa": 28,
                    "ab": 24,
                    "h": 6,
                    "doubles": 1,
                    "triples": 0,
                    "hr": 0,
                    "r": 3,
                    "rbi": 2,
                    "bb": 3,
                    "so": 7,
                    "hbp": 0,
                    "sf": 1,
                    "sac": 0,
                    "sb": 0,
                    "cs": 0,
                    "inn": 42,
                    "po": 3,
                    "a": 8,
                    "e": 1,
                    "dp": 0,
                },
            }
            self.data["skills"] = skills
            self.data["players"] = [alex, jordan]
            self.data["ratings"] = [
                {
                    "id": new_id("rating"),
                    "player_id": alex["id"],
                    "skill_id": by_name["Fielding"],
                    "score": 3,
                    "created_at": earlier,
                },
                {
                    "id": new_id("rating"),
                    "player_id": alex["id"],
                    "skill_id": by_name["Fielding"],
                    "score": 4,
                    "created_at": now,
                },
                {
                    "id": new_id("rating"),
                    "player_id": alex["id"],
                    "skill_id": by_name["Hitting"],
                    "score": 4,
                    "created_at": now,
                },
                {
                    "id": new_id("rating"),
                    "player_id": jordan["id"],
                    "skill_id": by_name["Pitching"],
                    "score": 4,
                    "created_at": now,
                },
            ]
            self.data["notes"] = [
                {
                    "id": new_id("note"),
                    "player_id": alex["id"],
                    "text": "Quiet feet on the backhand. Keep working the glove-side hop.",
                    "created_at": now,
                },
                {
                    "id": new_id("note"),
                    "player_id": jordan["id"],
                    "text": "Changeup is landing. Next: hold the same arm speed.",
                    "created_at": now,
                },
            ]
            self._save()

    def list_skills(self) -> list[dict]:
        with self.lock:
            return list(self.data["skills"])

    def add_skill(self, name: object) -> dict:
        skill_name = clean_text(name, "Skill name", MAX_SKILL_LEN)
        with self.lock:
            existing = {
                skill["name"].casefold()
                for skill in self.data["skills"]
                if isinstance(skill.get("name"), str)
            }
            if skill_name.casefold() in existing:
                raise ValueError("That skill already exists")
            skill = {"id": new_id("skill"), "name": skill_name}
            self.data["skills"].append(skill)
            self._save()
            return dict(skill)

    def list_players(self) -> list[dict]:
        with self.lock:
            players = [dict(player) for player in self.data["players"]]
        players.sort(key=lambda player: player.get("name", "").casefold())
        return players

    def _player_unlocked(self, player_id: str) -> dict:
        for player in self.data["players"]:
            if player.get("id") == player_id:
                return player
        raise KeyError("Player not found")

    def get_player(self, player_id: str) -> dict:
        with self.lock:
            player = dict(self._player_unlocked(player_id))
            ratings = [
                dict(item)
                for item in self.data["ratings"]
                if item.get("player_id") == player_id
            ]
            notes = [
                dict(item)
                for item in self.data["notes"]
                if item.get("player_id") == player_id
            ]
            skills = list(self.data["skills"])
        ratings.sort(key=lambda item: item.get("created_at", ""))
        notes.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        player["ratings"] = ratings
        player["notes"] = notes
        player["progress"] = build_progress(skills, ratings)
        player["stats"] = build_stats_view(player.get("stats"))
        return player

    def add_player(self, payload: dict) -> dict:
        player = {
            "id": new_id("player"),
            "name": clean_text(payload.get("name"), "Player name", MAX_NAME_LEN),
            "position": parse_position(payload.get("position")),
            "number": parse_number(payload.get("number")),
            "created_at": utc_now(),
            "stats": empty_stat_counts(),
        }
        with self.lock:
            self.data["players"].append(player)
            self._save()
            return dict(player)

    def update_player(self, player_id: str, payload: dict) -> dict:
        with self.lock:
            player = self._player_unlocked(player_id)
            if "name" in payload:
                player["name"] = clean_text(payload.get("name"), "Player name", MAX_NAME_LEN)
            if "position" in payload:
                player["position"] = parse_position(payload.get("position"))
            if "number" in payload:
                player["number"] = parse_number(payload.get("number"))
            self._save()
            return dict(player)

    def delete_player(self, player_id: str) -> None:
        with self.lock:
            self._player_unlocked(player_id)
            self.data["players"] = [
                player for player in self.data["players"] if player.get("id") != player_id
            ]
            self.data["ratings"] = [
                item for item in self.data["ratings"] if item.get("player_id") != player_id
            ]
            self.data["notes"] = [
                item for item in self.data["notes"] if item.get("player_id") != player_id
            ]
            self._save()

    def add_rating(self, player_id: str, payload: dict) -> dict:
        score = parse_score(payload.get("score"))
        skill_id = payload.get("skill_id")
        if not isinstance(skill_id, str) or not SAFE_ID.match(skill_id):
            raise ValueError("Choose a skill")
        with self.lock:
            self._player_unlocked(player_id)
            if not any(skill.get("id") == skill_id for skill in self.data["skills"]):
                raise ValueError("Choose a skill")
            rating = {
                "id": new_id("rating"),
                "player_id": player_id,
                "skill_id": skill_id,
                "score": score,
                "created_at": utc_now(),
            }
            self.data["ratings"].append(rating)
            self._save()
            return dict(rating)

    def add_note(self, player_id: str, payload: dict) -> dict:
        text = clean_text(payload.get("text"), "Note", MAX_NOTE_LEN)
        with self.lock:
            self._player_unlocked(player_id)
            note = {
                "id": new_id("note"),
                "player_id": player_id,
                "text": text,
                "created_at": utc_now(),
            }
            self.data["notes"].append(note)
            self._save()
            return dict(note)

    def update_stats(self, player_id: str, payload: dict) -> dict:
        counts = parse_stat_counts(payload)
        with self.lock:
            player = self._player_unlocked(player_id)
            player["stats"] = counts
            self._save()
        return build_stats_view(counts)

    def delete_note(self, note_id: str) -> None:
        with self.lock:
            before = len(self.data["notes"])
            self.data["notes"] = [
                note for note in self.data["notes"] if note.get("id") != note_id
            ]
            if len(self.data["notes"]) == before:
                raise KeyError("Note not found")
            self._save()


def build_progress(skills: list[dict], ratings: list[dict]) -> list[dict]:
    history_by_skill: dict[str, list[dict]] = {}
    for rating in ratings:
        skill_id = rating.get("skill_id")
        if not isinstance(skill_id, str):
            continue
        history_by_skill.setdefault(skill_id, []).append(
            {"score": rating.get("score"), "created_at": rating.get("created_at")}
        )
    progress = []
    for skill in skills:
        skill_id = skill.get("id")
        history = history_by_skill.get(skill_id, [])
        history.sort(key=lambda item: item.get("created_at") or "")
        current = history[-1]["score"] if history else None
        first = history[0]["score"] if history else None
        delta = None
        if isinstance(current, int) and isinstance(first, int):
            delta = current - first
        progress.append(
            {
                "skill_id": skill_id,
                "skill_name": skill.get("name"),
                "current": current,
                "first": first,
                "delta": delta,
                "history": history,
            }
        )
    return progress


def json_body(handler: BaseHTTPRequestHandler) -> dict:
    length_header = handler.headers.get("Content-Length", "0")
    try:
        length = int(length_header)
    except ValueError as exc:
        raise ValueError("Request is too large") from exc
    if length < 0 or length > MAX_BODY_BYTES:
        raise ValueError("Request is too large")
    raw = handler.rfile.read(length) if length else b"{}"
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Send JSON in the request body") from exc
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object")
    return payload


def send_json(handler: BaseHTTPRequestHandler, status: int, payload: object) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)


def send_bytes(
    handler: BaseHTTPRequestHandler,
    status: int,
    body: bytes,
    content_type: str,
) -> None:
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def safe_static_path(url_path: str) -> Path | None:
    relative = unquote(url_path).lstrip("/")
    if relative in {"", "index.html"}:
        candidate = (STATIC_DIR / "index.html").resolve()
    elif relative.startswith("static/"):
        candidate = (STATIC_DIR / relative[len("static/") :]).resolve()
    else:
        return None
    try:
        candidate.relative_to(STATIC_DIR)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class IdevHandler(BaseHTTPRequestHandler):
    store: Store

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        safe = message.replace("\r", " ").replace("\n", " ")
        print(f"{self.address_string()} {safe}", flush=True)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/health":
                send_json(self, 200, {"ok": True, "app": "idev"})
                return
            if path == "/api/skills":
                send_json(self, 200, {"skills": self.store.list_skills()})
                return
            if path == "/api/players":
                send_json(self, 200, {"players": self.store.list_players()})
                return
            player_match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})", path)
            if player_match:
                send_json(self, 200, self.store.get_player(player_match.group(1)))
                return
            static_path = safe_static_path(path)
            if static_path:
                content_type = CONTENT_TYPES.get(static_path.suffix, "application/octet-stream")
                send_bytes(self, 200, static_path.read_bytes(), content_type)
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            payload = json_body(self)
            if path == "/api/players":
                send_json(self, 201, self.store.add_player(payload))
                return
            if path == "/api/skills":
                send_json(self, 201, self.store.add_skill(payload.get("name")))
                return
            rating_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/ratings", path
            )
            if rating_match:
                send_json(self, 201, self.store.add_rating(rating_match.group(1), payload))
                return
            note_match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})/notes", path)
            if note_match:
                send_json(self, 201, self.store.add_note(note_match.group(1), payload))
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            payload = json_body(self)
            stats_match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})/stats", path)
            if stats_match:
                send_json(self, 200, self.store.update_stats(stats_match.group(1), payload))
                return
            player_match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})", path)
            if player_match:
                send_json(self, 200, self.store.update_player(player_match.group(1), payload))
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            player_match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})", path)
            if player_match:
                self.store.delete_player(player_match.group(1))
                send_json(self, 200, {"ok": True})
                return
            note_match = re.fullmatch(r"/api/notes/([a-zA-Z0-9_-]{8,64})", path)
            if note_match:
                self.store.delete_note(note_match.group(1))
                send_json(self, 200, {"ok": True})
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})


def make_server(store: Store, host: str = HOST, port: int = PORT) -> ThreadingHTTPServer:
    IdevHandler.store = store
    IdevHandler.protocol_version = "HTTP/1.1"
    return ThreadingHTTPServer((host, port), IdevHandler)


def main() -> None:
    store = Store(DATA_PATH)
    store.seed_demo_if_empty()
    server = make_server(store, HOST, PORT)
    print(f"idev is running at http://{HOST}:{PORT}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping idev.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
