# Dashboards and alerts

Use **Dashboard Studio** (JSON views), not Classic Simple XML, for all new dashboards. Navigation stays in `default/data/ui/nav/default.xml`.

Tokens on every operations dashboard: `tok_site`, `tok_area`, `tok_line`, `tok_shift`. Enterprise sets `tok_site` on tile click. Default `tok_shift` comes from the `current_shift(site)` macro when the user has not picked a historical shift.

## Navigation

```
Home (Enterprise operations)
Plant operations
Line floor
Shift report
Workforce          (flo_workforce, flo_admin)
Lookups / admin    (flo_admin)
Search             (opens Splunk search in-app)
```

## Dashboards

### 1. Enterprise operations — `flo_enterprise`

**Audience:** `flo_business`, plant directors, COO  
**Data:** `index=factory_summary`  
**Refresh:** 60s (data is 5-minute summaries)

| Panel | Idea |
| --- | --- |
| KPI row | Factories online, lines down now, average staffing fill %, output vs plan today |
| Factory tiles | One visualization per `site`: fill %, OEE or output vs plan, red if any line down |
| Trend | `timechart span=5m avg(fill_pct) by site` for the current shift window |
| Exceptions | Count of open staffing exceptions by site |

Drill-down: click site → Plant operations with `tok_site`.

SPL sketch:

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

### 2. Plant operations — `flo_plant`

**Audience:** `flo_plant_ops`  
**Data:** snapshot lookup + `factory_ops` for charts  
**Refresh:** 30s

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
**Data:** snapshot + last 15 minutes of clock/state/production  
**Refresh:** 30s  
**Theme:** high contrast, large type, no dense tables of PII

| Panel | Idea |
| --- | --- |
| Banner | line name, shift_code, run state, minutes in state |
| Staffing strip | plan vs actual; red cells for empty required stations |
| Station board | station_id, role, first name (or worker_id), clocked duration |
| Production sparkline | `timechart span=1m sum(good_count)` last 2 hours |
| Open downtime | current reason if down |

```spl
index=factory_workforce sourcetype=factory:shift:clock site="$tok_site$" line_id="$tok_line$" shift_id="$tok_shift$"
| stats latest(action) as action, latest(_time) as last_clock by worker_id, station_id, role
| where action="clock_in"
| lookup flo_roster worker_id OUTPUT first_name
| table station_id, role, first_name, worker_id, last_clock
```

### 4. Shift report — `flo_shift_report`

**Audience:** supervisor + plant  
**Refresh:** 1m, or static after shift end

Attendance (clocked vs assigned), overtime minutes, output vs target, downtime Pareto, handoff notes (exceptions still open). Time range locked to the `shift_id` window from the calendar lookup, not to the picker alone.

### 5. Workforce — `flo_workforce`

**Audience:** `flo_workforce` only  
**Index:** `factory_workforce`  
**Refresh:** 1m

No-shows, late clock-ins, people still on the clock past planned_end, consecutive-day fatigue proxy. This is the only dashboard that may show `display_name`.

## Alerts

Implement as `savedsearches.conf` with `alert.track = 1`. Email / Slack / PagerDuty are instance `alert_actions`, not app secrets.

### Line understaffed

```spl
| inputlookup flo_current_shift_snapshot
| where isnotnull(headcount_plan) AND headcount_plan > 0
| eval gap = headcount_plan - headcount_actual
| where gap > 0 AND fill_pct < 90
| table site, line_id, shift_id, headcount_plan, headcount_actual, fill_pct
```

Throttle per `site,line_id,shift_id` so a line does not page every 60 seconds.

### No-show

```spl
`factory_workforce_indexes` sourcetype=factory:shift:assignment action=assign
| eval late_after = planned_start + 15*60
| where now() > late_after
| lookup flo_clocked_now worker_id, shift_id OUTPUT clocked
| where isnull(clocked)
| table site, line_id, shift_id, worker_id, station_id, planned_start
```

### Line down

```spl
| inputlookup flo_current_shift_snapshot
| where state_value="down"
| table site, line_id, shift_id, downtime_minutes_shift, updated
```

Use each line's `down_alert_minutes` from `flo_lines` KV Store (default 5).

## Search performance rules

- Enterprise panels never search `factory_workforce` raw.
- Line floor may search raw with `earliest=-15m` plus the snapshot lookup.
- Prefer `tstats` once a data model is accelerated in phase 4.
- Every production SPL starts with an index macro, never `index=*`.
