# Factory Line Operations — project plan

## 1. Problem

Production leadership cannot see, in one place, **who is on which line for the current shift**, whether that line is staffed to plan, and how that shift is performing — especially when more than one factory is running.

Today those answers are split across timeclocks, MES/SCADA, and spreadsheets. By the time they roll up, the shift is over. This Splunk application makes shift and personnel state a first-class, real-time event stream and rolls it up from station → line → factory → enterprise.

## 2. Outcome

A Splunk app a supervisor can leave on a shop-floor screen, a plant manager can use for the shift huddle, and a business user can open for a multi-factory morning view.

| Layer | Question it answers | Typical refresh |
| --- | --- | --- |
| Line floor | Who is here, is the line staffed, is it running? | 30 seconds |
| Shift | How is this crew doing versus plan for this shift? | 1 minute |
| Plant | Which lines are at risk across this factory? | 1 minute |
| Business | How are all factories trending this shift / today / this week? | 5 minutes (summary) |

## 3. Non-goals (v1)

- Replacing MES, WFM, or the timeclock as the system of record
- Controlling PLCs or writing back to HRIS
- Full CMMS / predictive maintenance (map into Splunk OT Intelligence later)
- Public Splunkbase listing (private app first)

## 4. Product split

Two Splunk packages in one git repo, installed independently so indexers and search heads get only what they need.

```
factory-line-ops/                  # GitHub repo root
├── packages/
│   ├── TA-factory_line/           # ingest + knowledge (UF / HF / indexer / SH)
│   └── factory_line_ops/          # UI, alerts, KV Store (search heads only)
├── samples/                       # fictional events for demos
└── docs/
```

| Package | Install on | Contains |
| --- | --- | --- |
| `TA-factory_line` | Indexers, heavy forwarders, search heads. Universal forwarders only if a scripted input is used. | `indexes.conf` (Enterprise; Cloud admins create indexes), sourcetypes, props/transforms, event types, CIM/OT tags |
| `factory_line_ops` | Search heads (or SHC via deployer) | Dashboards, nav, macros, saved searches/alerts, KV Store collections, lookups |

Never enable HEC or file inputs inside the UI app. Inputs belong on the collector that actually receives plant data.

## 5. Site hierarchy

ISA-95 / Unified Namespace style, used as Splunk fields on every event:

| Field | Meaning | Example |
| --- | --- | --- |
| `enterprise` | Company | `acme` |
| `site` | Factory code (OT Intelligence required field) | `PLT-AUS-01` |
| `site_name` | Display name | `Austin Assembly` |
| `area` | Hall / department | `body_shop` |
| `line_id` | Production line | `line-3` |
| `station_id` | Work station / cell | `st-12` |
| `shift_id` | Canonical shift for that site/day | `PLT-AUS-01:2026-10-07:B` |
| `shift_code` | Human shift name | `B` / `nights` |
| `crew_id` | Named crew if used | `crew-blue` |
| `role` | Station role | `operator`, `relief`, `team_lead` |
| `worker_id` | Opaque personnel key | `WKR-7f3a…` (UUID, not badge number) |

Business dashboards group by `enterprise` → `site`. Plant dashboards filter one `site`. Line dashboards filter `site` + `line_id`.

## 6. Data sources (ingest)

All live events enter Splunk through **HTTP Event Collector** as JSON (`sourcetype` set per event type). Do not put the HEC token in git, in `inputs.conf`, or in sample files. The collector token lives in Splunk and in the factory's secret store.

| Source | Typical system | Event families |
| --- | --- | --- |
| Timeclock / WFM | Kronos, UKG, SAP SF | `factory:shift:clock`, `factory:shift:assignment` |
| Badge / access | Lenel, HID, Genetec | `factory:personnel:presence` (OT Security object) |
| MES / line PLC | Ignition, Wonderware, OPC-UA gateway | `factory:line:state`, `factory:line:production`, `factory:line:downtime` |
| Manual / tablet | Line-side kiosk | staffing exceptions, relief coverage |
| Roster master | HRIS export or KV Store admin UI | planned headcount per line/shift (lookup, not high-volume events) |

Optional later: Splunk OT Intelligence (Edge Hub / MQTT / OPC-UA) for machine telemetry, mapped into the Operational Telemetry data model (`vertical=manufacturing`). This app does not require OT Intelligence in phase 1, but **every event already carries the five OT required fields** (`device_id`, `device_type`, `vertical`, `site`, `system`) so adoption is additive.

### Real-time path

```
Timeclock / MES / Access
        │  HTTPS JSON
        ▼
   Splunk HEC  ──►  indexers  ──►  TA search-time knowledge
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
             KV Store roster    summary index      dashboards
             (current shift)    (enterprise)       + alerts
```

Line boards read **KV roster + presence** (and a 1-minute snapshot lookup), not a 12-hour raw clock search. Sparklines may use `factory_ops` with `earliest=-15m`. Enterprise dashboards read a **summary index** populated every 5 minutes so multi-factory searches stay cheap.

## 7. Indexes

| Index | Contents | Retention (start) | Who may search |
| --- | --- | --- | --- |
| `factory_ops` | Line state, production, downtime, OEE | 13 months | ops roles (`flo_business` uses summary only) |
| `factory_workforce` | Clock, assignment, presence, exceptions | 13 months | `flo_workforce`, `flo_admin` (optional field-filtered plant) |
| `factory_summary` | 5-minute rollups by site/line/shift | 25 months | all FLO roles |

Cloud: create these indexes in Splunk Web / Admin Config Service. The TA ships `indexes.conf` for single-instance Enterprise labs only; do not assume it is applied in Cloud.

## 8. Knowledge objects

Shipped in the TA (exported `system` so the UI app can use them):

- Sourcetypes listed in [DATA_MODEL.md](DATA_MODEL.md)
- Event types: `factory_shift_clock`, `factory_line_down`, …
- Tags for CIM where they fit (`Authentication` is **not** a good fit for badge-at-turnstile; use OT Security fields instead)
- Macros: `factory_ops_indexes`, `factory_workforce_indexes`, `current_shift(site)`
- Automatic lookups: `site` / `line_id` → display names, planned headcount, shift calendar

Shipped in the UI app:

- KV Store: `flo_sites`, `flo_lines`, `flo_stations`, `flo_shift_calendar`, `flo_roster` (ids only), `flo_roster_presence`, `flo_worker_display` (names, restricted)
- Dashboard Studio views, including a role home router
- Scheduled searches: current-shift snapshot, presence upsert, summary index
- Alerts (see [DASHBOARDS.md](DASHBOARDS.md))

## 9. Personas and authorization

| Role | Splunk role | Sees |
| --- | --- | --- |
| Line supervisor | `flo_line_supervisor` | One site + assigned lines; `worker_id` only (`srchFilter`) |
| Plant operations | `flo_plant_ops` | One or more sites; staffing counts; no names |
| Business / COO | `flo_business` | All sites via `factory_summary`; KPIs and counts; no names |
| Shop-floor TV | `flo_wall` | One site; line cards; no search bar; no names |
| Workforce / HR | `flo_workforce` | First names via `flo_worker_display`; attendance; overtime |
| Admin | `flo_admin` | All indexes, KV Store writes, HEC config |

Deny by default. Index permissions are the hard boundary; dashboard tokens are not.

Personnel identifiers:

- Index `worker_id` (UUID). Never index SSN, full badge PAN, or password.
- If a badge value must be stored, ingest **SHA-256** of `badge_id + site pepper`. The pepper lives in the collector secret store, not in the app.
- First names live only in KV `flo_worker_display`, not on line/plant dashboards and not on ops alert payloads.

## 10. Dashboard map (v1)

Drill-down is always **enterprise → site → line → worker/event**.

0. **Home** — role router to the right board.
1. **Enterprise operations** — factories as tiles: current-shift OEE (or output vs plan), staffing fill %, lines down, open exceptions. Click a factory.
2. **Plant operations** — all lines in that site: run state, headcount vs plan, current shift output, downtime minutes.
3. **Line floor (real time)** — station board with `worker_id`, open gaps, last production count, time in current state.
4. **Shift report** — one shift_id: attendance counts, overtime minutes, output, downtime Pareto, handoff.
5. **Workforce** (restricted) — named no-shows, late clock-in, overtime approaching policy.

Details and SPL sketches: [DASHBOARDS.md](DASHBOARDS.md).

## 11. Alerts (v1)

| Alert | Trigger (sketch) | Notify |
| --- | --- | --- |
| Line understaffed | Current unique `worker_id` on line &lt; planned headcount for 10 minutes after shift start | Supervisor + plant |
| No-show | Assigned `worker_id` with no presence 15 minutes after start (ops: counts; workforce: names) | Supervisor (counts) + workforce |
| Line down | `state_value=down` longer than threshold for that line | Supervisor + plant |
| Overtime approaching | Clocked duration approaching site policy | Workforce |
| Handoff incomplete | Previous shift still has open downtime with no reason code | Supervisor |

Alerts fire from saved searches in the UI app. Recipients come from KV Store (`flo_sites.notify`) or Splunk notable / email **configured on the instance**, never hardcoded addresses in `default/`.

## 12. Delivery phases

Work is scoped by technical surface, not calendar.

### Phase 0 — Repository and seed (this PR)

- New git repo layout, plan, sample events, empty-but-valid Splunk packages
- Makefile that builds `.spl` files
- Document HEC-from-env only

### Phase 1 — Ingest

- Create indexes (Cloud ACS or Enterprise `indexes.conf`)
- HEC tokens per source (ops vs workforce) with sourcetype allow-lists
- TA props/transforms + OT required fields
- Replay `samples/events` into a lab

### Phase 2 — Current shift

- KV Store sites/lines/calendar/roster + presence upsert
- Current-shift snapshot lookup
- Home router, line floor (`worker_id` only), shift report
- Understaffed and line-down alerts

### Phase 3 — Plant and business

- Plant operations dashboard
- Summary index + enterprise dashboard
- Multi-site tokens and RBAC

### Phase 4 — Workforce and hardening

- Workforce dashboard, named no-show / overtime, `flo_worker_display` ACL
- Field filters so ops roles cannot see name fields on `factory_workforce`
- AppInspect (`cloud` + `private_app`) in CI
- Optional OT Intelligence mapping for production/OEE/location

## 13. Lab vs production topology

**Lab (single instance):** install both packages, create HEC token in UI, send samples with `SPLUNK_HEC_TOKEN`.

**Production Enterprise:** TA on indexers + search heads; UI app on search heads / SHC deployer; HEC on heavy forwarders or indexers behind TLS 1.3; optional multisite cluster with one search head (or affinity) per factory region.

**Production Cloud:** indexes via ACS; private app upload after AppInspect; HEC on the Cloud inputs endpoint; no `indexes.conf` from the TA applied automatically.

## 14. Open decisions

The build can start without these, but each one changes ingest or RBAC:

1. **Splunk Cloud or Enterprise** (or both)? Packages are written to pass AppInspect either way.
2. **Which timeclock / MES / access vendors** for the first factory?
3. **How many factories** at go-live, and is `site` already a stable code in other systems?
4. **Is Splunk OT Intelligence licensed?** If yes, phase 4 maps into its data model instead of only the app-local model.
5. **Shift rules:** rotating crews, midnight-crossing shifts, DST at each site.
6. **Name policy (default):** line/plant boards show `worker_id` only. First names are workforce-only unless HR later signs off on a shop-floor first-name exception.

## 15. Success checks

- A line dashboard shows clock-ins within 30 seconds of HEC receipt
- Plant view matches the sum of its lines for the same `shift_id`
- Enterprise view matches the sum of its sites from the summary index
- A `flo_business` user cannot search `flo_worker_display` or name fields
- `make package && splunk-appinspect inspect dist/*.spl --included-tags cloud` reports 0 failures / 0 errors
- No secret, token, or real employee record exists in git
