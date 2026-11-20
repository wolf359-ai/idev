# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Coaches and team staff (primary).** The head coach and assistant coaches of a 12U fastpitch softball team (Alpha 12U-2033). They use idev mostly on a laptop, after practice, to record how each player is developing; occasionally on a phone.
- **Players and their families (secondary).** Each player can be given a login that shows only their own development, read-only.

## Product Purpose

A clear development-progress tracker for each player across a season: skill ratings, progress over time, performance metrics and personal records, GameChanger stats, coach notes, and assigned drills in one place, private to the team. Success is a coach seeing at a glance where each player stands and where she is improving, and a player seeing her own growth.

## Positioning

More than a spreadsheet and not a GameChanger replacement: GameChanger records game stats; idev tracks development over time (coach-rated skills, progress history, focus areas, drills, PRs), and uses imported GameChanger stats as supporting evidence.

## Operating Context

- Coaches rate skills (1–5, half points allowed), add notes grouped as focus areas or top skills, assign drills, and log metrics such as exit velocity, pitch velocity, throw speed, distance, and base-running time.
- After games, a coach exports season stats from GameChanger as CSV and imports them; players are matched by name and jersey number.
- Admin work (players, player logins, stats import, staff access, team info) lives in an Admin window next to Sign out.
- Runs locally on the coach's computer (`python3 app.py` or the Start idev launcher); data is a JSON file in `Documents/idev data`.

## Capabilities and Constraints

- Roles: Coach (full), Staff at Full / Manager / Assistant / Read-only levels, and Player (own data only, read-only).
- Coach-to-player alerts and messages.
- Stack: Python standard-library server (`app.py`) serving vanilla HTML/CSS/JS from `static/`; no framework, no build step, no external network dependencies at runtime.
- Must keep working on laptop and phone widths. The laptop layout leads; the phone may get its own purpose-built layout (confirmed by the coach) rather than a squeezed laptop page.

## Brand Commitments

- Keep the existing color palette (dark ground with orange, cyan, green, lime, yellow accents defined in `static/style.css`).
- Keep the **ALPHA** lightning logo and the team name "Alpha 12U-2033".
- Keep the existing content: features, labels, and data shown.

## Evidence on Hand

- Real roster and stats live only on the coach's machine; sample/demo players are seeded on first run. No testimonials, customers, or metrics exist and none should be invented.
- GameChanger season stats CSV export format is supported.

## Product Principles

1. Development over time is the story; a single number is never the whole picture.
2. Coaches should reach any player and any action in a click or two after a long practice.
3. Players see only their own data; privacy is non-negotiable.
4. Game stats support the development picture; they don't replace coach judgment.
