#!/usr/bin/env python3
"""idev — a tiny local web app for softball player development.

No packages to install. From this folder run:

    python3 app.py

Then open http://127.0.0.1:8765 in your browser.
"""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
STATIC_DIR = (ROOT / "static").resolve()
MAX_BODY_BYTES = 256 * 1024
MAX_NAME_LEN = 80
MAX_NOTE_LEN = 2000
MAX_ACTIVITY_LEN = 200
MAX_ACTIVITY = 50
MAX_SKILL_LEN = 40
MAX_ROSTER_PLAYERS = 200
MAX_ROSTER_TEXT_BYTES = 200 * 1024
MAX_DRILLS = 10
MAX_DRILL_NAME_LEN = 80
MAX_DRILL_FREQ_LEN = 60
MAX_DRILL_LINK_LEN = 300
MAX_RECORDS = 50
# Numeric performance metrics that track a personal record (PR). "higher_better"
# marks speed/velocity (a new max is a PR); time metrics improve as they drop.
PR_METRICS = {
    "exit_velo": {"label": "Exit Velo", "unit": "MPH", "higher_better": True},
    "pitch_velo": {"label": "Velocity", "unit": "MPH", "higher_better": True},
    "throw_speed": {"label": "Throw Speed", "unit": "MPH", "higher_better": True},
    "base_time": {"label": "Running speed", "unit": "s", "higher_better": False},
}
# Keep this many timestamped snapshots in data_backups/ so an accidental
# deletion or corruption of the data file never loses the roster.
MAX_BACKUPS = int(os.environ.get("IDEV_MAX_BACKUPS", "40"))
HOST = os.environ.get("IDEV_HOST", "0.0.0.0")
PORT = int(os.environ.get("IDEV_PORT", "8765"))
DATA_PATH = Path(os.environ.get("IDEV_DATA", str(ROOT / "data.json")))

# --- Authentication / session configuration --------------------------------
# The session cookie is not marked Secure by default because idev is served
# over plain HTTP on localhost, where browsers refuse Secure cookies and login
# would silently break. Set IDEV_HTTPS=1 when serving behind TLS to add Secure.
SESSION_COOKIE = "id"
SESSION_IDLE_SECONDS = 30 * 60
SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60
COOKIE_SECURE = os.environ.get("IDEV_HTTPS", "").strip().lower() in {"1", "true", "yes", "on"}
# Human-chosen coach password: slow, salted KDF (PBKDF2-HMAC-SHA256, >=600k).
PBKDF2_ALGO = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000
# Player access codes are high-entropy random tokens, so a single SHA-256 is
# appropriate (brute force is infeasible) and keeps per-login lookup cheap.
ACCESS_CODE_BYTES = 18
GENERATED_ADMIN_BYTES = 12
# Weak, well-known default coach password used only until the coach picks their
# own (via IDEV_ADMIN_PASSWORD). Fine for a local, single-user app; change it
# before exposing idev on a network.
DEFAULT_ADMIN_PASSWORD = "123"
LOGIN_MAX_FAILURES = 10
LOGIN_WINDOW_SECONDS = 5 * 60
LOGIN_BLOCK_SECONDS = 5 * 60
ADMIN_PASSWORD_ENV = os.environ.get("IDEV_ADMIN_PASSWORD")

PERM_PUBLIC = "public"
PERM_COACH = "coach"
PERM_PLAYER_OWN = "player_own"
PERM_AUTHED = "authed"  # any signed-in user (coach or player)

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

# Levels of admin access a staff member can be granted.
STAFF_ACCESS_LEVELS = (
    "Full",
    "Manager",
    "Assistant",
    "Read-only",
)

TEAM_SEASONS = (
    "Spring",
    "Summer",
    "Fall",
    "Winter",
)
TEAM_PLAY_YEARS = (
    "First year",
    "Second year",
)

# Girls' softball age brackets a team competes in.
TEAM_AGE_BRACKETS = (
    "10u",
    "12u",
    "14u",
    "16u",
    "18u",
)

# Age-group / squad the player is playing with.
TEAM_TYPES = (
    "10u-1",
    "10u-2",
    "12u-1y",
    "12u-2y",
    "14u-1y",
    "14u-2y",
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

POSITION_ALIASES = {
    "p": "Pitcher",
    "c": "Catcher",
    "1b": "First Base",
    "2b": "Second Base",
    "3b": "Third Base",
    "ss": "Shortstop",
    "lf": "Left Field",
    "cf": "Center Field",
    "rf": "Right Field",
    "of": "Utility",
    "util": "Utility",
    "utility": "Utility",
    "dp": "DP/Flex",
    "flex": "DP/Flex",
    "dp/flex": "DP/Flex",
}


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


def parse_score(value: object) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Rating must be from 1 to 5 in steps of 0.5") from exc
    halves = round(score * 2)
    if abs(score * 2 - halves) > 1e-9:
        raise ValueError("Rating must be from 1 to 5 in steps of 0.5")
    if halves < 2 or halves > 10:
        raise ValueError("Rating must be from 1 to 5 in steps of 0.5")
    score = halves / 2
    # Keep whole numbers as ints so stored scores and JSON stay clean.
    return int(score) if score.is_integer() else score


def parse_position(value: object) -> str:
    position = clean_text(value, "Position", 40)
    if position not in POSITIONS:
        raise ValueError("Choose a position from the list")
    return position


def parse_optional_position(value: object) -> str:
    """Secondary position is optional; blank means none."""
    if value is None:
        return ""
    if isinstance(value, str) and not value.strip():
        return ""
    return parse_position(value)


def parse_team_year(value: object) -> str:
    """Optional team/season year, e.g. "2025" or "2024-25"; blank means unset."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if len(text) > 20:
        raise ValueError("Team year must be 20 characters or fewer")
    return text


def parse_grad_year(value: object) -> str:
    """Optional graduation year, e.g. "2028"; blank means unset."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if len(text) > 9:
        raise ValueError("Graduation year must be 9 characters or fewer")
    return text


def parse_team_type(value: object) -> str:
    """Optional squad/age-group type; blank means unset, else from TEAM_TYPES."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if text not in TEAM_TYPES:
        raise ValueError("Choose a team type from the list")
    return text


def parse_exit_velo(value: object) -> object:
    """Optional exit velocity in MPH; blank means unset, otherwise 0-200."""
    if value is None:
        return ""
    if isinstance(value, str) and not value.strip():
        return ""
    try:
        mph = float(value)
    except (TypeError, ValueError):
        raise ValueError("Exit velo must be a number")
    if mph != mph or mph in (float("inf"), float("-inf")):
        raise ValueError("Exit velo must be a number")
    if mph < 0 or mph > 200:
        raise ValueError("Exit velo must be between 0 and 200 MPH")
    return round(mph, 2)


def parse_pitch_velo(value: object) -> object:
    """Optional pitching velocity in MPH; blank means unset, otherwise 0-200."""
    if value is None:
        return ""
    if isinstance(value, str) and not value.strip():
        return ""
    try:
        mph = float(value)
    except (TypeError, ValueError):
        raise ValueError("Velocity must be a number")
    if mph != mph or mph in (float("inf"), float("-inf")):
        raise ValueError("Velocity must be a number")
    if mph < 0 or mph > 200:
        raise ValueError("Velocity must be between 0 and 200 MPH")
    return round(mph, 2)


def parse_throw_speed(value: object) -> object:
    """Optional throwing speed in MPH; blank means unset, otherwise 0-200."""
    if value is None:
        return ""
    if isinstance(value, str) and not value.strip():
        return ""
    try:
        mph = float(value)
    except (TypeError, ValueError):
        raise ValueError("Throw speed must be a number")
    if mph != mph or mph in (float("inf"), float("-inf")):
        raise ValueError("Throw speed must be a number")
    if mph < 0 or mph > 200:
        raise ValueError("Throw speed must be between 0 and 200 MPH")
    return round(mph, 2)


def parse_base_time(value: object) -> object:
    """Optional base-running time in seconds; blank means unset, otherwise 0-60."""
    if value is None:
        return ""
    if isinstance(value, str) and not value.strip():
        return ""
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        raise ValueError("Time must be a number")
    if seconds != seconds or seconds in (float("inf"), float("-inf")):
        raise ValueError("Time must be a number")
    if seconds < 0 or seconds > 60:
        raise ValueError("Time must be between 0 and 60 seconds")
    return round(seconds, 2)


def parse_optional_contact(value: object) -> str:
    """Contact info (email or phone) is optional; blank means none."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if len(text) > 120:
        raise ValueError("Contact must be 120 characters or fewer")
    return text


def parse_staff(payload: object) -> dict:
    """Validate a staff member: name, role, contact, and admin access level."""
    if not isinstance(payload, dict):
        raise ValueError("Send staff details in the request body")
    name = clean_text(payload.get("name"), "Staff name", 80)
    role = clean_text(payload.get("role"), "Role", 60)
    access_level = clean_text(payload.get("access_level"), "Access level", 40)
    if access_level not in STAFF_ACCESS_LEVELS:
        raise ValueError("Choose an access level from the list")
    contact = parse_optional_contact(payload.get("contact"))
    return {
        "name": name,
        "role": role,
        "contact": contact,
        "access_level": access_level,
    }


def parse_staff_password(value: object) -> str:
    """Validate a staff member's access password."""
    if not isinstance(value, str) or not value:
        raise ValueError("Password is required")
    if len(value) < 4:
        raise ValueError("Password must be at least 4 characters")
    if len(value) > 128:
        raise ValueError("Password must be 128 characters or fewer")
    return value


def parse_optional_name(value: object, field: str, max_len: int) -> str:
    """A free-text field that may be left blank."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if len(text) > max_len:
        raise ValueError(f"{field} must be {max_len} characters or fewer")
    return text


def parse_optional_season(value: object) -> str:
    """Optional season, chosen from a fixed list; blank means unset."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if text not in TEAM_SEASONS:
        raise ValueError("Choose a season from the list")
    return text


def parse_optional_play_year(value: object) -> str:
    """Optional years-of-play designation (first or second year); blank means unset."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if text not in TEAM_PLAY_YEARS:
        raise ValueError("Choose first or second year of play")
    return text


def parse_optional_age_bracket(value: object) -> str:
    """Optional girls' softball age bracket (e.g. 12u); blank means unset."""
    if value is None:
        return ""
    text = " ".join(str(value).split())
    if not text:
        return ""
    if text not in TEAM_AGE_BRACKETS:
        raise ValueError("Choose an age bracket from the list")
    return text


def parse_team(payload: object) -> dict:
    """Validate team information: name, year, season, age bracket, and years of play."""
    if not isinstance(payload, dict):
        raise ValueError("Send team details in the request body")
    return {
        "name": parse_optional_name(payload.get("name"), "Team name", 80),
        "year": parse_team_year(payload.get("year")),
        "season": parse_optional_season(payload.get("season")),
        "age_bracket": parse_optional_age_bracket(payload.get("age_bracket")),
        "play_year": parse_optional_play_year(payload.get("play_year")),
    }


def parse_optional_link(value: object) -> str:
    """Optional drill link; only http(s) URLs are allowed (blocks javascript:/data:)."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if len(text) > MAX_DRILL_LINK_LEN:
        raise ValueError(f"Link must be {MAX_DRILL_LINK_LEN} characters or fewer")
    parsed = urlparse(text)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        raise ValueError("Link must be a http or https URL")
    return text


def parse_drill(payload: object) -> dict:
    """Validate a skill-development drill: name, practice frequency, and link."""
    if not isinstance(payload, dict):
        raise ValueError("Send drill details in the request body")
    return {
        "name": clean_text(payload.get("name"), "Drill name", MAX_DRILL_NAME_LEN),
        "frequency": parse_optional_name(
            payload.get("frequency"), "Frequency", MAX_DRILL_FREQ_LEN
        ),
        "link": parse_optional_link(payload.get("link")),
    }


def normalize_position(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        return "Utility"
    text = " ".join(value.split())
    for position in POSITIONS:
        if text.casefold() == position.casefold():
            return position
    return POSITION_ALIASES.get(text.casefold(), "Utility")


def normalize_header(value: str) -> str:
    text = value.lstrip("\ufeff").strip().casefold()
    if text == "#":
        return "number"
    return re.sub(r"[^a-z0-9]+", "", text)


def parse_roster_text(text: object) -> tuple[list[dict], list[dict]]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Choose a CSV file or paste a roster")
    if len(text.encode("utf-8")) > MAX_ROSTER_TEXT_BYTES:
        raise ValueError("Roster file must be 200 KB or smaller")

    try:
        rows = list(csv.reader(io.StringIO(text)))
    except csv.Error as exc:
        raise ValueError("Roster is not valid CSV") from exc
    rows = [
        [cell.strip() for cell in row]
        for row in rows
        if any(cell.strip() for cell in row)
    ]
    if not rows:
        raise ValueError("No players found in this roster")

    name_aliases = {"roster", "player", "playername", "name"}
    number_aliases = {"number", "no", "num", "jersey", "jerseynumber"}
    position_aliases = {"position", "pos", "primaryposition"}
    header_index = None
    header = []
    for index, row in enumerate(rows[:15]):
        normalized = [normalize_header(cell) for cell in row]
        if any(cell in name_aliases for cell in normalized):
            header_index = index
            header = normalized
            break

    candidates = []
    skipped = []
    data_rows = rows[header_index + 1 :] if header_index is not None else rows

    def column(aliases: set[str]) -> int | None:
        for index, value in enumerate(header):
            if value in aliases:
                return index
        return None

    name_index = column(name_aliases)
    number_index = column(number_aliases)
    position_index = column(position_aliases)

    first_line = header_index + 2 if header_index is not None else 1
    for offset, row in enumerate(data_rows, start=first_line):
        if len(candidates) >= MAX_ROSTER_PLAYERS:
            skipped.append({"line": offset, "reason": "200-player import limit reached"})
            continue
        if header_index is not None:
            raw_name = row[name_index] if name_index is not None and name_index < len(row) else ""
            raw_number = (
                row[number_index]
                if number_index is not None and number_index < len(row)
                else ""
            )
            raw_position = (
                row[position_index]
                if position_index is not None and position_index < len(row)
                else ""
            )
        elif len(row) == 1:
            raw_name, raw_number, raw_position = row[0], "", ""
        elif row[0].lstrip("#").isdigit():
            raw_number = row[0].lstrip("#")
            raw_name = row[1] if len(row) > 1 else ""
            raw_position = row[2] if len(row) > 2 else ""
        else:
            raw_name = row[0]
            raw_number = row[1].lstrip("#") if len(row) > 1 else ""
            raw_position = row[2] if len(row) > 2 else ""

        if raw_name.casefold() in {"team", "total", "totals", "roster"}:
            continue
        try:
            name = clean_text(raw_name, "Player name", MAX_NAME_LEN)
            number = parse_number(raw_number)
        except ValueError as exc:
            skipped.append({"line": offset, "reason": str(exc)})
            continue
        candidates.append(
            {
                "name": name,
                "number": number,
                "position": normalize_position(raw_position),
            }
        )

    if not candidates:
        raise ValueError("No valid players found. Include a Roster, Player, or Name column.")
    return candidates, skipped


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


PUBLIC_PLAYER_FIELDS = (
    "id",
    "name",
    "position",
    "secondary_position",
    "team_year",
    "grad_year",
    "team_type",
    "number",
    "exit_velo",
    "base_time",
    "pitch_velo",
    "throw_speed",
    "created_at",
    "stats",
)


def public_player(player: dict) -> dict:
    """Copy only non-sensitive player fields (never the access-code hash)."""
    return {key: player.get(key) for key in PUBLIC_PLAYER_FIELDS if key in player}


PUBLIC_STAFF_FIELDS = ("id", "name", "role", "contact", "access_level", "created_at")


def public_staff(member: dict) -> dict:
    """Copy non-sensitive staff fields; never expose the password hash."""
    view = {key: member.get(key) for key in PUBLIC_STAFF_FIELDS if key in member}
    view["has_password"] = bool(member.get("password_hash"))
    return view


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS, salt: bytes | None = None) -> dict:
    if not isinstance(password, str) or not password:
        raise ValueError("Password is required")
    if salt is None:
        salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return {
        "algo": PBKDF2_ALGO,
        "salt": salt.hex(),
        "hash": derived.hex(),
        "iterations": iterations,
    }


def verify_password(password: object, record: object) -> bool:
    if not isinstance(password, str) or not isinstance(record, dict):
        return False
    try:
        salt = bytes.fromhex(record["salt"])
        expected = bytes.fromhex(record["hash"])
        iterations = int(record["iterations"])
    except (KeyError, TypeError, ValueError):
        return False
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(derived, expected)


def hash_access_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


class SessionManager:
    """In-memory server-side session store with idle/absolute expiry."""

    def __init__(self, idle: int = SESSION_IDLE_SECONDS, absolute: int = SESSION_ABSOLUTE_SECONDS):
        self.idle = idle
        self.absolute = absolute
        self.lock = threading.Lock()
        self.sessions: dict[str, dict] = {}

    @staticmethod
    def _fingerprint(user_agent: str) -> str:
        return hashlib.sha256((user_agent or "").encode("utf-8")).hexdigest()

    def create(self, role: str, player_id: str | None, user_agent: str) -> tuple[str, dict]:
        sid = secrets.token_urlsafe(32)
        now = time.time()
        session = {
            "role": role,
            "player_id": player_id or "",
            "created_at": now,
            "last_seen": now,
            "csrf": secrets.token_urlsafe(32),
            "fingerprint": self._fingerprint(user_agent),
        }
        with self.lock:
            self.sessions[sid] = session
        return sid, dict(session)

    def get(self, sid: str | None, user_agent: str) -> dict | None:
        if not sid:
            return None
        now = time.time()
        with self.lock:
            session = self.sessions.get(sid)
            if not session:
                return None
            if (now - session["created_at"] > self.absolute) or (now - session["last_seen"] > self.idle):
                self.sessions.pop(sid, None)
                return None
            if not hmac.compare_digest(session["fingerprint"], self._fingerprint(user_agent)):
                # Session context changed (possible theft); force re-auth.
                self.sessions.pop(sid, None)
                return None
            session["last_seen"] = now
            return dict(session)

    def destroy(self, sid: str | None) -> None:
        if not sid:
            return
        with self.lock:
            self.sessions.pop(sid, None)


class LoginRateLimiter:
    """Per-client throttling to slow credential brute-forcing."""

    def __init__(
        self,
        max_failures: int = LOGIN_MAX_FAILURES,
        window: int = LOGIN_WINDOW_SECONDS,
        block: int = LOGIN_BLOCK_SECONDS,
    ):
        self.max_failures = max_failures
        self.window = window
        self.block = block
        self.lock = threading.Lock()
        self.failures: dict[str, list[float]] = {}
        self.blocked_until: dict[str, float] = {}

    def is_blocked(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            until = self.blocked_until.get(key, 0.0)
            if until > now:
                return True
            if until:
                self.blocked_until.pop(key, None)
            return False

    def record_failure(self, key: str) -> None:
        now = time.time()
        with self.lock:
            hits = [stamp for stamp in self.failures.get(key, []) if now - stamp < self.window]
            hits.append(now)
            self.failures[key] = hits
            if len(hits) >= self.max_failures:
                self.blocked_until[key] = now + self.block
                self.failures[key] = []

    def clear(self, key: str) -> None:
        with self.lock:
            self.failures.pop(key, None)
            self.blocked_until.pop(key, None)


def required_permission(method: str, path: str):
    """Map an HTTP method + path to the access level required to reach it."""
    if method in ("GET", "HEAD"):
        if not path.startswith("/api/"):
            return PERM_PUBLIC  # login page and static assets
        if path in ("/api/health", "/api/session"):
            return PERM_PUBLIC
        if path == "/api/team":
            # Team name/season is shown in the header for any signed-in user.
            return PERM_AUTHED
        match = re.fullmatch(r"/api/players/([a-zA-Z0-9_-]{8,64})", path)
        if match:
            return (PERM_PLAYER_OWN, match.group(1))
        return PERM_COACH
    if method == "POST" and path in ("/api/login", "/api/logout"):
        return PERM_PUBLIC
    if method == "POST":
        act_match = re.fullmatch(
            r"/api/players/([a-zA-Z0-9_-]{8,64})/activity", path
        )
        if act_match:
            # A player may log activity (e.g. opening a drill link) on their own
            # profile; a coach may log it for anyone.
            return (PERM_PLAYER_OWN, act_match.group(1))
    return PERM_COACH


class Store:
    """JSON file store for players, skills, ratings, and notes."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.backup_dir = self.path.parent / "data_backups"
        self.lock = threading.Lock()
        self.data = self._load()

    def _empty(self) -> dict:
        return {
            "skills": [],
            "players": [],
            "ratings": [],
            "notes": [],
            "activity": [],
            "staff": [],
            "team": {},
            "auth": {},
        }

    def _normalize(self, raw: object) -> dict | None:
        """Coerce a parsed JSON document into the store's data shape, or None."""
        if not isinstance(raw, dict):
            return None
        data = self._empty()
        for key in ("skills", "players", "ratings", "notes", "activity", "staff"):
            items = raw.get(key, [])
            if isinstance(items, list):
                data[key] = [item for item in items if isinstance(item, dict)]
        auth = raw.get("auth")
        if isinstance(auth, dict):
            data["auth"] = auth
        team = raw.get("team")
        if isinstance(team, dict):
            data["team"] = team
        return data

    def _read_file(self, path: Path) -> dict | None:
        """Parse a data file into normalized data, or None if unreadable."""
        try:
            raw = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return self._normalize(raw)

    def _backup_files(self) -> list[Path]:
        """Existing snapshots, newest first (timestamped names sort chronologically)."""
        if not self.backup_dir.exists():
            return []
        files = [p for p in self.backup_dir.glob("data-*.json") if p.is_file()]
        files.sort(key=lambda p: p.name, reverse=True)
        return files

    def _load(self) -> dict:
        data = self._read_file(self.path) if self.path.exists() else None
        if data is not None:
            return data
        # The main file is missing or corrupt. Recover from the newest good
        # backup so a deleted or truncated data file never wipes the roster.
        for backup in self._backup_files():
            recovered = self._read_file(backup)
            if recovered is not None:
                self.data = recovered
                try:
                    self._write_main()
                except OSError:
                    pass
                return recovered
        return self._empty()

    def _write_main(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def _write_backup(self) -> None:
        """Write a timestamped snapshot and prune old ones. Best-effort."""
        try:
            self.backup_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%f")
            dest = self.backup_dir / f"data-{stamp}.json"
            tmp = self.backup_dir / f"data-{stamp}.json.tmp"
            tmp.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")
            tmp.replace(dest)
            for old in self._backup_files()[MAX_BACKUPS:]:
                try:
                    old.unlink()
                except OSError:
                    pass
        except OSError:
            # Never fail a save just because a backup could not be written.
            pass

    def _save(self) -> None:
        self._write_main()
        self._write_backup()

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
                "secondary_position": "Second Base",
                "team_year": "2025",
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
                "secondary_position": "First Base",
                "team_year": "2025",
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
            self.data["staff"] = [
                {
                    "id": new_id("staff"),
                    "name": "Casey Morgan",
                    "role": "Head Coach",
                    "contact": "casey.morgan@example.com",
                    "access_level": "Full",
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
            players = [public_player(player) for player in self.data["players"]]
        players.sort(key=lambda player: player.get("name", "").casefold())
        return players

    def _player_unlocked(self, player_id: str) -> dict:
        for player in self.data["players"]:
            if player.get("id") == player_id:
                return player
        raise KeyError("Player not found")

    def get_player(self, player_id: str) -> dict:
        with self.lock:
            record = self._player_unlocked(player_id)
            raw_stats = record.get("stats")
            has_access_code = bool(record.get("access_code_hash"))
            player = public_player(record)
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
            activity = [
                dict(item)
                for item in self.data["activity"]
                if item.get("player_id") == player_id
            ]
            drills = [
                dict(item)
                for item in record.get("drills", [])
                if isinstance(item, dict)
            ]
            # Only surface genuine PRs. A record without a delta is a legacy
            # first-entry baseline (there was nothing to beat), not a real PR.
            records = [
                dict(item)
                for item in record.get("records", [])
                if isinstance(item, dict) and item.get("delta") is not None
            ]
            skills = list(self.data["skills"])
        ratings.sort(key=lambda item: item.get("created_at", ""))
        notes.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        activity.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        player["has_access_code"] = has_access_code
        player["ratings"] = ratings
        player["notes"] = notes
        player["activity"] = activity[:MAX_ACTIVITY]
        player["drills"] = drills
        player["records"] = records[:MAX_RECORDS]
        player["progress"] = build_progress(skills, ratings)
        player["stats"] = build_stats_view(raw_stats)
        return player

    def add_player(self, payload: dict) -> dict:
        player = {
            "id": new_id("player"),
            "name": clean_text(payload.get("name"), "Player name", MAX_NAME_LEN),
            "position": parse_position(payload.get("position")),
            "secondary_position": parse_optional_position(payload.get("secondary_position")),
            "team_year": parse_team_year(payload.get("team_year")),
            "grad_year": parse_grad_year(payload.get("grad_year")),
            "team_type": parse_team_type(payload.get("team_type")),
            "number": parse_number(payload.get("number")),
            "exit_velo": parse_exit_velo(payload.get("exit_velo")),
            "base_time": parse_base_time(payload.get("base_time")),
            "pitch_velo": parse_pitch_velo(payload.get("pitch_velo")),
            "throw_speed": parse_throw_speed(payload.get("throw_speed")),
            "created_at": utc_now(),
            "stats": empty_stat_counts(),
            "drills": [],
        }
        with self.lock:
            self.data["players"].append(player)
            self._save()
            return public_player(player)

    def import_roster(self, payload: dict) -> dict:
        candidates, skipped = parse_roster_text(payload.get("text"))
        preview = payload.get("preview", True)
        if not isinstance(preview, bool):
            raise ValueError("Preview must be true or false")

        with self.lock:
            existing_names = {
                player.get("name", "").casefold()
                for player in self.data["players"]
                if isinstance(player.get("name"), str)
            }
            unique = []
            seen = set(existing_names)
            for player in candidates:
                folded = player["name"].casefold()
                if folded in seen:
                    skipped.append(
                        {"line": None, "reason": f"{player['name']} is already on the roster"}
                    )
                    continue
                seen.add(folded)
                unique.append(player)

            imported = []
            if not preview:
                now = utc_now()
                for candidate in unique:
                    player = {
                        "id": new_id("player"),
                        "name": candidate["name"],
                        "position": candidate["position"],
                        "secondary_position": candidate.get("secondary_position", ""),
                        "team_year": candidate.get("team_year", ""),
                        "number": candidate["number"],
                        "created_at": now,
                        "stats": empty_stat_counts(),
                    }
                    self.data["players"].append(player)
                    imported.append(public_player(player))
                if imported:
                    self._save()

        return {
            "preview": preview,
            "players": unique,
            "imported": imported,
            "skipped": skipped,
        }

    def update_player(self, player_id: str, payload: dict) -> dict:
        with self.lock:
            player = self._player_unlocked(player_id)
            if "name" in payload:
                player["name"] = clean_text(payload.get("name"), "Player name", MAX_NAME_LEN)
            if "position" in payload:
                player["position"] = parse_position(payload.get("position"))
            if "secondary_position" in payload:
                player["secondary_position"] = parse_optional_position(
                    payload.get("secondary_position")
                )
            if "team_year" in payload:
                player["team_year"] = parse_team_year(payload.get("team_year"))
            if "grad_year" in payload:
                player["grad_year"] = parse_grad_year(payload.get("grad_year"))
            if "team_type" in payload:
                player["team_type"] = parse_team_type(payload.get("team_type"))
            if "number" in payload:
                player["number"] = parse_number(payload.get("number"))
            if "exit_velo" in payload:
                player["exit_velo"] = parse_exit_velo(payload.get("exit_velo"))
                self._record_pr(player, "exit_velo", player["exit_velo"])
            if "base_time" in payload:
                player["base_time"] = parse_base_time(payload.get("base_time"))
                self._record_pr(player, "base_time", player["base_time"])
            if "pitch_velo" in payload:
                player["pitch_velo"] = parse_pitch_velo(payload.get("pitch_velo"))
                self._record_pr(player, "pitch_velo", player["pitch_velo"])
            if "throw_speed" in payload:
                player["throw_speed"] = parse_throw_speed(payload.get("throw_speed"))
                self._record_pr(player, "throw_speed", player["throw_speed"])
            self._save()
            return public_player(player)

    def _record_pr(self, player: dict, key: str, value: object) -> None:
        """Log a personal-record note when a metric beats its previous best."""
        if key not in PR_METRICS or not isinstance(value, (int, float)):
            return
        meta = PR_METRICS[key]
        best_map = player.setdefault("metric_best", {})
        previous = best_map.get(key)
        higher = meta["higher_better"]
        # The first value entered is only a baseline, not a personal record —
        # there's nothing to beat yet, so record it silently.
        if not isinstance(previous, (int, float)):
            best_map[key] = value
            return
        is_pr = False
        delta = None
        if higher and value > previous:
            is_pr = True
            # Higher-is-better: positive gain (e.g. +2 MPH).
            delta = round(value - previous, 2)
        elif not higher and value < previous:
            is_pr = True
            # Lower-is-better (time): negative change showing the drop (e.g. -0.20 s).
            delta = round(value - previous, 2)
        if not is_pr:
            return
        best_map[key] = value
        note = {
            "id": new_id("pr"),
            "metric": key,
            "label": meta["label"],
            "unit": meta["unit"],
            "higher_better": higher,
            "value": value,
            "previous": previous if isinstance(previous, (int, float)) else None,
            "delta": delta,
            "created_at": utc_now(),
        }
        records = player.setdefault("records", [])
        records.insert(0, note)
        del records[MAX_RECORDS:]

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
            self.data["activity"] = [
                item for item in self.data["activity"] if item.get("player_id") != player_id
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

    def add_activity(self, player_id: str, payload: dict) -> dict:
        text = clean_text(payload.get("text"), "Activity", MAX_ACTIVITY_LEN)
        with self.lock:
            self._player_unlocked(player_id)
            entry = {
                "id": new_id("act"),
                "player_id": player_id,
                "text": text,
                "created_at": utc_now(),
            }
            self.data["activity"].append(entry)
            # Keep only the most recent entries per player so the log stays bounded.
            own = [a for a in self.data["activity"] if a.get("player_id") == player_id]
            if len(own) > MAX_ACTIVITY:
                stale = {
                    id(a)
                    for a in sorted(own, key=lambda a: a.get("created_at", ""))[
                        : len(own) - MAX_ACTIVITY
                    ]
                }
                self.data["activity"] = [
                    a for a in self.data["activity"] if id(a) not in stale
                ]
            self._save()
            return dict(entry)

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

    def add_drill(self, player_id: str, payload: dict) -> dict:
        fields = parse_drill(payload)
        with self.lock:
            player = self._player_unlocked(player_id)
            drills = player.setdefault("drills", [])
            if len(drills) >= MAX_DRILLS:
                raise ValueError(f"A player can have at most {MAX_DRILLS} drills")
            drill = {"id": new_id("drill"), **fields, "created_at": utc_now()}
            drills.append(drill)
            self._save()
            return dict(drill)

    def delete_drill(self, player_id: str, drill_id: str) -> None:
        with self.lock:
            player = self._player_unlocked(player_id)
            drills = player.get("drills", [])
            remaining = [d for d in drills if d.get("id") != drill_id]
            if len(remaining) == len(drills):
                raise KeyError("Drill not found")
            player["drills"] = remaining
            self._save()

    # -- staff -------------------------------------------------------------
    # -- team information --------------------------------------------------
    def get_team(self) -> dict:
        with self.lock:
            return dict(self.data.get("team", {}))

    def set_team(self, payload: dict) -> dict:
        fields = parse_team(payload)
        with self.lock:
            self.data["team"] = fields
            self._save()
            return dict(fields)

    def _staff_unlocked(self, staff_id: str) -> dict:
        for member in self.data["staff"]:
            if member.get("id") == staff_id:
                return member
        raise KeyError("Staff member not found")

    def list_staff(self) -> list[dict]:
        with self.lock:
            return [public_staff(member) for member in self.data["staff"]]

    def add_staff(self, payload: dict) -> dict:
        fields = parse_staff(payload)
        member = {"id": new_id("staff"), **fields, "created_at": utc_now()}
        with self.lock:
            self.data["staff"].append(member)
            self._save()
            return public_staff(member)

    def set_staff_password(self, staff_id: str, password: object) -> dict:
        """Store only a salted hash of the staff member's access password."""
        secret = parse_staff_password(password)
        record = hash_password(secret)
        with self.lock:
            member = self._staff_unlocked(staff_id)
            member["password_hash"] = record
            self._save()
            return public_staff(member)

    def clear_staff_password(self, staff_id: str) -> dict:
        with self.lock:
            member = self._staff_unlocked(staff_id)
            member.pop("password_hash", None)
            self._save()
            return public_staff(member)

    def delete_staff(self, staff_id: str) -> None:
        with self.lock:
            before = len(self.data["staff"])
            self.data["staff"] = [
                member for member in self.data["staff"] if member.get("id") != staff_id
            ]
            if len(self.data["staff"]) == before:
                raise KeyError("Staff member not found")
            self._save()

    # -- authentication ----------------------------------------------------
    def ensure_admin_password(self, env_password: str | None = None) -> str | None:
        """Ensure a coach password hash exists.

        If ``env_password`` is provided it always governs. Otherwise, if no
        password has ever been set, the default password (``123``) is stored and
        returned once (to print for first-time setup); only its hash is stored.
        The default persists until the coach chooses their own via
        ``IDEV_ADMIN_PASSWORD``. Returns the default plaintext when one was
        created, else None. Never stores or returns an existing plaintext.
        """
        with self.lock:
            auth = self.data.setdefault("auth", {})
            if isinstance(env_password, str) and env_password:
                record = auth.get("admin")
                if not verify_password(env_password, record):
                    auth["admin"] = hash_password(env_password)
                    self._save()
                return None
            if isinstance(auth.get("admin"), dict):
                return None
            auth["admin"] = hash_password(DEFAULT_ADMIN_PASSWORD)
            self._save()
            return DEFAULT_ADMIN_PASSWORD

    def verify_admin_password(self, password: object) -> bool:
        with self.lock:
            record = self.data.get("auth", {}).get("admin")
        return verify_password(password, record)

    def set_player_access_code(self, player_id: str) -> str:
        """Generate a new access code for a player, store only its hash."""
        code = secrets.token_urlsafe(ACCESS_CODE_BYTES)
        digest = hash_access_code(code)
        with self.lock:
            player = self._player_unlocked(player_id)
            player["access_code_hash"] = digest
            self._save()
        return code

    def clear_player_access_code(self, player_id: str) -> None:
        with self.lock:
            player = self._player_unlocked(player_id)
            if "access_code_hash" in player:
                player.pop("access_code_hash", None)
                self._save()

    def find_player_by_access_code(self, code: object) -> str | None:
        if not isinstance(code, str) or not code:
            return None
        digest = hash_access_code(code)
        match = None
        with self.lock:
            for player in self.data["players"]:
                stored = player.get("access_code_hash")
                # Compare every player (no early break) for uniform timing.
                if isinstance(stored, str) and hmac.compare_digest(stored, digest):
                    match = player.get("id")
        return match


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
        if isinstance(current, (int, float)) and isinstance(first, (int, float)):
            delta = round(current - first, 1)
            if float(delta).is_integer():
                delta = int(delta)
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


def send_json(
    handler: BaseHTTPRequestHandler,
    status: int,
    payload: object,
    extra_headers: list[tuple[str, str]] | None = None,
) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    for name, value in extra_headers or []:
        handler.send_header(name, value)
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
    if content_type.startswith("text/html"):
        handler.send_header(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
        )
        handler.send_header("Referrer-Policy", "no-referrer")
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
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


class IdevHandler(BaseHTTPRequestHandler):
    store: Store
    session_manager: SessionManager
    rate_limiter: LoginRateLimiter

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        safe = message.replace("\r", " ").replace("\n", " ")
        print(f"{self.address_string()} {safe}", flush=True)

    # -- session helpers ---------------------------------------------------
    def _drain_body(self) -> None:
        """Discard an unread request body so keep-alive stays in sync.

        Rejecting a request (401/403/429) before json_body() runs would leave
        the POST/PUT body in the socket, corrupting the next keep-alive
        request on the connection.
        """
        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            return
        if length > MAX_BODY_BYTES:
            self.close_connection = True
            return
        remaining = length
        while remaining > 0:
            chunk = self.rfile.read(min(remaining, 65536))
            if not chunk:
                break
            remaining -= len(chunk)

    def _reject(self, status: int, error: str) -> None:
        self._drain_body()
        send_json(self, status, {"error": error})

    def _client_key(self) -> str:
        return self.client_address[0] if self.client_address else "unknown"

    def _cookie_sid(self) -> str | None:
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        try:
            jar = SimpleCookie()
            jar.load(raw)
        except CookieError:
            return None
        morsel = jar.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def _load_session(self) -> dict | None:
        sid = self._cookie_sid()
        if not sid:
            return None
        return self.session_manager.get(sid, self.headers.get("User-Agent", ""))

    def _session_cookie_header(self, sid: str) -> str:
        parts = [f"{SESSION_COOKIE}={sid}", "Path=/", "HttpOnly", "SameSite=Strict"]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def _clear_cookie_header(self) -> str:
        parts = [f"{SESSION_COOKIE}=", "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def _csrf_ok(self, session: dict | None) -> bool:
        expected = session.get("csrf", "") if session else ""
        provided = self.headers.get("X-CSRF-Token", "")
        return bool(expected) and hmac.compare_digest(provided, expected)

    def _session_payload(self, session: dict | None) -> dict:
        if not session:
            return {"authenticated": False}
        payload = {"authenticated": True, "role": session["role"], "csrf": session["csrf"]}
        if session["role"] == "player" and session.get("player_id"):
            try:
                player = self.store.get_player(session["player_id"])
                payload["player"] = {"id": player["id"], "name": player["name"]}
            except KeyError:
                payload["player"] = None
        return payload

    def _guard(self):
        """Enforce deny-by-default access control. Returns (session, perm, ok)."""
        session = self._load_session()
        perm = required_permission(self.command, urlparse(self.path).path)
        if perm == PERM_PUBLIC:
            return session, perm, True
        if session is None:
            self._reject(401, "Please sign in")
            return session, perm, False
        if perm == PERM_AUTHED:
            return session, perm, True
        if perm == PERM_COACH:
            if session.get("role") != "coach":
                self._reject(403, "Not allowed")
                return session, perm, False
            return session, perm, True
        # (PERM_PLAYER_OWN, player_id): coach always; player only for own id.
        player_id = perm[1]
        if session.get("role") == "coach":
            return session, perm, True
        if session.get("role") == "player" and hmac.compare_digest(
            session.get("player_id", ""), player_id
        ):
            return session, perm, True
        self._reject(403, "Not allowed")
        return session, perm, False

    def _require_csrf(self, session: dict | None, perm: object) -> bool:
        if perm == PERM_PUBLIC:
            return True
        if not self._csrf_ok(session):
            self._reject(403, "Missing or invalid security token")
            return False
        return True

    # -- auth actions ------------------------------------------------------
    def _handle_login(self) -> None:
        key = self._client_key()
        if self.rate_limiter.is_blocked(key):
            self._reject(429, "Too many attempts. Wait a few minutes and try again.")
            return
        payload = json_body(self)
        mode = payload.get("mode")
        role = None
        player_id = None
        if mode == "coach" or (mode is None and "password" in payload):
            if self.store.verify_admin_password(payload.get("password")):
                role = "coach"
        elif mode == "player" or (mode is None and "code" in payload):
            found = self.store.find_player_by_access_code(payload.get("code"))
            if found:
                role = "player"
                player_id = found
        if role is None:
            self.rate_limiter.record_failure(key)
            send_json(self, 401, {"error": "Invalid sign-in details"})
            return
        self.rate_limiter.clear(key)
        # Regenerate the session identifier on login; drop any prior session.
        self.session_manager.destroy(self._cookie_sid())
        sid, created = self.session_manager.create(
            role, player_id, self.headers.get("User-Agent", "")
        )
        send_json(
            self,
            200,
            self._session_payload(created),
            extra_headers=[("Set-Cookie", self._session_cookie_header(sid))],
        )

    def _handle_logout(self) -> None:
        self.session_manager.destroy(self._cookie_sid())
        send_json(
            self,
            200,
            {"ok": True},
            extra_headers=[("Set-Cookie", self._clear_cookie_header())],
        )

    def do_GET(self) -> None:
        session, _perm, ok = self._guard()
        if not ok:
            return
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/session":
                send_json(self, 200, self._session_payload(session))
                return
            if path == "/api/health":
                send_json(self, 200, {"ok": True, "app": "idev"})
                return
            if path == "/api/skills":
                send_json(self, 200, {"skills": self.store.list_skills()})
                return
            if path == "/api/players":
                send_json(self, 200, {"players": self.store.list_players()})
                return
            if path == "/api/staff":
                send_json(self, 200, {"staff": self.store.list_staff()})
                return
            if path == "/api/team":
                send_json(self, 200, {"team": self.store.get_team()})
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
        session, perm, ok = self._guard()
        if not ok:
            return
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/login":
                self._handle_login()
                return
            if path == "/api/logout":
                self._handle_logout()
                return
            if not self._require_csrf(session, perm):
                return
            payload = json_body(self)
            access_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/access-code", path
            )
            if access_match:
                send_json(self, 201, {"code": self.store.set_player_access_code(access_match.group(1))})
                return
            if path == "/api/players/import":
                result = self.store.import_roster(payload)
                send_json(self, 200 if result["preview"] else 201, result)
                return
            if path == "/api/players":
                send_json(self, 201, self.store.add_player(payload))
                return
            if path == "/api/staff":
                send_json(self, 201, self.store.add_staff(payload))
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
            activity_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/activity", path
            )
            if activity_match:
                send_json(
                    self, 201, self.store.add_activity(activity_match.group(1), payload)
                )
                return
            drill_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/drills", path
            )
            if drill_match:
                send_json(self, 201, self.store.add_drill(drill_match.group(1), payload))
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})

    def do_PUT(self) -> None:
        session, perm, ok = self._guard()
        if not ok:
            return
        if not self._require_csrf(session, perm):
            return
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
            staff_pw_match = re.fullmatch(
                r"/api/staff/([a-zA-Z0-9_-]{8,64})/password", path
            )
            if staff_pw_match:
                member = self.store.set_staff_password(
                    staff_pw_match.group(1), payload.get("password")
                )
                send_json(self, 200, member)
                return
            if path == "/api/team":
                send_json(self, 200, {"team": self.store.set_team(payload)})
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})

    def do_DELETE(self) -> None:
        session, perm, ok = self._guard()
        if not ok:
            return
        if not self._require_csrf(session, perm):
            return
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            access_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/access-code", path
            )
            if access_match:
                self.store.clear_player_access_code(access_match.group(1))
                send_json(self, 200, {"ok": True})
                return
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
            drill_match = re.fullmatch(
                r"/api/players/([a-zA-Z0-9_-]{8,64})/drills/([a-zA-Z0-9_-]{8,64})",
                path,
            )
            if drill_match:
                self.store.delete_drill(drill_match.group(1), drill_match.group(2))
                send_json(self, 200, {"ok": True})
                return
            staff_pw_match = re.fullmatch(
                r"/api/staff/([a-zA-Z0-9_-]{8,64})/password", path
            )
            if staff_pw_match:
                member = self.store.clear_staff_password(staff_pw_match.group(1))
                send_json(self, 200, member)
                return
            staff_match = re.fullmatch(r"/api/staff/([a-zA-Z0-9_-]{8,64})", path)
            if staff_match:
                self.store.delete_staff(staff_match.group(1))
                send_json(self, 200, {"ok": True})
                return
            send_json(self, 404, {"error": "Not found"})
        except KeyError as exc:
            send_json(self, 404, {"error": str(exc)})
        except ValueError as exc:
            send_json(self, 400, {"error": str(exc)})


def make_server(
    store: Store,
    host: str = HOST,
    port: int = PORT,
    session_manager: SessionManager | None = None,
    rate_limiter: LoginRateLimiter | None = None,
) -> ThreadingHTTPServer:
    IdevHandler.store = store
    IdevHandler.session_manager = session_manager or SessionManager()
    IdevHandler.rate_limiter = rate_limiter or LoginRateLimiter()
    IdevHandler.protocol_version = "HTTP/1.1"
    return ThreadingHTTPServer((host, port), IdevHandler)


def main() -> None:
    store = Store(DATA_PATH)
    store.seed_demo_if_empty()
    generated_password = store.ensure_admin_password(ADMIN_PASSWORD_ENV)
    server = make_server(store, HOST, PORT)
    print(f"idev is running at http://127.0.0.1:{PORT}", flush=True)
    if generated_password:
        print("", flush=True)
        print("First-time setup: the default coach password is:", flush=True)
        print(f"    {generated_password}", flush=True)
        print("Sign in as Coach with it, then set IDEV_ADMIN_PASSWORD to change it.", flush=True)
        print("", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping idev.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
