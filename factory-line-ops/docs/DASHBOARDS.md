# Dashboards and alerts

Use **Dashboard Studio** (JSON views) for all operational dashboards. Classic Simple XML is only for `default.xml` navigation. Splunk cannot fully hide nav items by role — pair collections with a **home router** and with index / lookup ACLs.

Tokens on operations dashboards: `tok_site`, `tok_area`, `tok_line`, `tok_shift`. Enterprise sets `tok_site` on tile click. Default `tok_shift` comes from `flo_shift_calendar` (`is_current`) when the user has not picked a historical shift.

Line and plant roles must also be constrained with Splunk `srchFilter` (site / line). Hidden inputs are not access control.

## Navigation

```
Home (router)                         default
Enterprise
  Enterprise operations
Plant
  Plant operations
Line
  Line floor
  Shift report
Workforce                             flo_workforce, flo_admin
  Attendance and exceptions
Search
```

Later (not in the v0.1 JSON seed): factory comparison, shift heatmap, shop-floor TV wall, station detail, handoff checklist, andon board, admin KV health. Same tokens and drill-down contract.

## Token contract

| Token | Line | Plant | Enterprise | Workforce |
| --- | --- | --- | --- | --- |
| `tok_site` | locked by role | locked by role | `*` or one site | `*` or regional |
| `tok_area` | locked | optional | hidden | optional |
| `tok_line` | locked | optional | hidden | optional |
| `tok_shift` | current | current or last | current + last | current or date |
| Refresh | 30s | 60s | 5m (summary) | 1m live / 5m trends |

URL example: `/app/factory_line_ops/flo_line_floor?form.tok_site=PLT-AUS-01&form.tok_line=line-3&form.tok_shift=PLT-AUS-01:2026-10-07:B`

## Drill-down

```
flo_home  →  role landing
flo_enterprise
  click site  →  flo_plant
                  click line  →  flo_line_floor
                                  station / downtime  →  event list (ops indexes)
                                  crew gap with names →  flo_workforce
                                    (only if the user has factory_workforce + flo_worker_display)
```

`flo_business` never lands on workforce views. Alert rows open the lowest dashboard the user can search: line down → line floor; understaffed counts → plant; no-show names → workforce.

## Real-time technique

Do not run true `earliest=rt` jobs on enterprise or plant. Line boards refresh every 30s over `tstats` / snapshot / KV, not a standing realtime search.

| Need | Mechanism |
| --- | --- |
| Crew board | `flo_roster` (planned) + `flo_roster_presence` (clocked), not a 12h raw clock search |
| Plant / line KPIs | `flo_current_shift_snapshot` (1 minute saved search) |
| Enterprise | `index=factory_summary` only |
| Station sparkline | raw `factory_ops` with `earliest=-15m` or `-2h` |
| Phase 4 | accelerated `DM_Factory_Line` + `tstats` |

## Dashboards (v0.1 seed)

### 0. Home — `flo_home`

**Audience:** all app roles  
**Refresh:** 1m  
Reads `| rest /services/authentication/current-context` and points the user at enterprise, plant, line, or workforce. Open-alert counts use the snapshot / alert tracker, never `worker_name`.

### 1. Enterprise operations — `flo_enterprise`

**Audience:** `flo_business`, plant directors, COO  
**Data:** `index=factory_summary`  
**Refresh:** 60s (data is 5-minute summaries)

| Panel | Idea |
| --- | --- |
| KPI row | Factories online, lines down now, average staffing fill %, output vs plan today |
| Factory tiles | One visualization per `site`: fill %, OEE or output vs plan, red if any line down |
| Trend | `timechart span=5m avg(fill_pct) by site` for the current shift window |
| Exceptions | Count of open staffing exceptions by site (counts only) |

Drill-down: click site → Plant operations with `tok_site`.

```spl
`factory_summary_index` earliest=-8h
| stats latest(fill_pct) as fill_pct
        latest(state_value) as state_value
        sum(good_count) as good_count
        by site, line_id
| stats avg(fill_pct) as fill_pct
        sum(eval(state_value="down")) as lines_down
        sum(good_count) as good_count
        by site
```

Staffing fill % on this dashboard is **headcount**, not names.

### 2. Plant operations — `flo_plant`

**Audience:** `flo_plant_ops`  
**Data:** snapshot lookup + `factory_ops` for charts  
**Refresh:** 60s

| Panel | Idea |
| --- | --- |
| Line table | state, fill %, output, downtime minutes, last event age |
| Heatstrip | lines × 15-minute buckets, color by state |
| Staffing | actual vs plan by line for `tok_shift` |
| Top downtime | Pareto of `downtime_reason` this shift |

Drill-down: line → Line floor.

```spl
| inputlookup flo_current_shift_snapshot where site="$tok_site$"
| search shift_id="$tok_shift$"
| table line_id, state_value, headcount_actual, headcount_plan, fill_pct, good_count_shift, downtime_minutes_shift, updated
```

### 3. Line floor — `flo_line_floor`

**Audience:** `flo_line_supervisor` (shop-floor display)  
**Data:** snapshot + roster KV + presence KV  
**Refresh:** 30s  
**Theme:** high contrast, large type, **no names**

| Panel | Idea |
| --- | --- |
| Banner | line name, shift_code, run state, minutes in state |
| Staffing strip | plan vs actual; red cells for empty required stations |
| Station board | station_id, role, `worker_id`, clocked / absent |
| Production sparkline | `timechart span=1m sum(good_count)` last 2 hours |
| Open downtime | current reason if down |

```spl
| inputlookup flo_kv_roster where site="$tok_site$" line_id="$tok_line$" shift_id="$tok_shift$"
| lookup flo_kv_roster_presence worker_id, shift_id OUTPUT clock_in, station_id as actual_station
| eval presence=if(isnotnull(clock_in),"clocked","absent")
| table station_id, role, worker_id, presence, clock_in
| sort station_id
```

Do **not** `| lookup flo_worker_display`. That lookup is ACL’d to workforce roles.

### 4. Shift report — `flo_shift_report`

**Audience:** supervisor + plant  
**Refresh:** 1m, or static after shift end

Attendance (clocked vs assigned **counts**), overtime minutes, output vs target, downtime Pareto, handoff still open. Time range locked to the `shift_id` window from the calendar lookup, not to the picker alone.

### 5. Workforce — `flo_workforce`

**Audience:** `flo_workforce` only  
**Index:** `factory_workforce` plus `flo_worker_display`  
**Refresh:** 1m

No-shows, late clock-ins, people still on the clock past planned_end. This is the only dashboard that may show `first_name`.

```spl
| inputlookup flo_kv_roster where site="$tok_site$" shift_id="$tok_shift$"
| lookup flo_kv_roster_presence worker_id, shift_id OUTPUT clock_in
| lookup flo_kv_worker_display worker_id OUTPUT first_name
| table site, line_id, station_id, role, worker_id, first_name, clock_in
```

## Alerts

Implement as `savedsearches.conf` with `alert.track = 1`. Email / Slack / PagerDuty are instance `alert_actions`, not app secrets. Message text for ops alerts must not include names.

Throttle by `site,line_id,shift_id` (and `worker_id` for no-show). `alert.expires` 2–4h.

### Line understaffed

```spl
| inputlookup flo_current_shift_snapshot
| where isnotnull(headcount_plan) AND headcount_plan > 0 AND fill_pct < 90
| table site, line_id, shift_id, headcount_plan, headcount_actual, fill_pct
```

Honor `crew_grace_min` on the shift calendar so the alert does not fire in the first minutes after start.

### No-show

Ops notable: count of assigned `worker_id` with no presence row 15 minutes after start (no names).  
Workforce notable: same search plus `flo_worker_display` for first name. Prefer a separate `factory_workforce` search so plant roles cannot expand names.

### Line down

```spl
| inputlookup flo_current_shift_snapshot
| where state_value="down"
| table site, line_id, shift_id, downtime_minutes_shift, updated
```

Use each line's `down_alert_minutes` from `flo_lines` (default 5).

### Handoff incomplete

In the window `[shift end − 10 min, shift end + 20 min]`, lines missing `handoff_ack` / lineup confirm (phase 3 event family). v0.1 can watch `factory:personnel:exception action=handoff_incomplete`.

### Overtime approaching

Workforce-only. Rolling hours vs site policy; plant/COO see **aggregated hours by site** from the summary index.

## Roles (instance-created; not shipped as authorize.conf)

| Role | Indexes | `srchFilter` (typical) | Names? |
| --- | --- | --- | --- |
| `flo_line_supervisor` | `factory_ops`, `factory_summary` | `site=… line_id=…` | No — `worker_id` only |
| `flo_plant_ops` | same | `site=…` | No |
| `flo_business` | `factory_summary` | none | No |
| `flo_wall` | `factory_ops`, `factory_summary` | one site | No (kiosk TV) |
| `flo_workforce` | `factory_workforce`, `factory_summary` | optional region | Yes — `flo_worker_display` |
| `flo_admin` | all app indexes | none | Break-glass |

SAML maps groups to these roles. Per-user line lock: one role per plant, or a `flo_user_scope` lookup used only as an additional filter — never instead of `srchFilter`.

## Search performance rules

- Enterprise panels never search `factory_workforce` raw.
- Line floor reads KV + snapshot; raw ops searches stay at `earliest=-15m` (or `-2h` for sparklines).
- Prefer `tstats` once a data model is accelerated in phase 4.
- Every production SPL starts with an index macro, never `index=*`.
