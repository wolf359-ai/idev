# Data model

Every event is JSON. Every event includes the Splunk OT Intelligence required base fields so this app can sit beside OT Intelligence later without a second ingest path.

## Required on all events

| Field | Value / rule |
| --- | --- |
| `time` | Event time (HEC `time` epoch). Do not rely on index time for shift math. |
| `enterprise` | Company key |
| `site` | Factory code |
| `vertical` | Always `manufacturing` |
| `system` | `Production` for line/MES; `Workforce` for clock/roster; `Security` for badge |
| `device_id` | Stable source id (timeclock, PLC, door, kiosk) |
| `device_type` | `timeclock`, `plc`, `mes`, `access_reader`, `kiosk` |
| `event_family` | One of the sourcetypes below without the `factory:` prefix |

## Sourcetypes

| Sourcetype | Index | OT child object | Purpose |
| --- | --- | --- | --- |
| `factory:shift:clock` | `factory_workforce` | Events / Security | Clock in, clock out, break |
| `factory:shift:assignment` | `factory_workforce` | States | Planned assignment of a worker to line/station/shift |
| `factory:personnel:presence` | `factory_workforce` | Security + Location | Badge tap / zone presence |
| `factory:personnel:exception` | `factory_workforce` | Events | No-show, late, overtime, relief |
| `factory:line:state` | `factory_ops` | States | running / down / starved / blocked / changeover |
| `factory:line:production` | `factory_ops` | Production | counts, cycle time, order |
| `factory:line:downtime` | `factory_ops` | OEE | downtime open/close with reason |

## Event schemas

Fictional examples only. See `samples/events/`.

### Clock

```json
{
  "event_family": "shift_clock",
  "action": "clock_in",
  "worker_id": "WKR-7f3a9c2e",
  "shift_id": "PLT-AUS-01:2026-10-07:B",
  "shift_code": "B",
  "site": "PLT-AUS-01",
  "line_id": "line-3",
  "station_id": "st-12",
  "role": "operator",
  "vertical": "manufacturing",
  "system": "Workforce",
  "device_id": "tc-aus-gate-1",
  "device_type": "timeclock"
}
```

`display_name` is optional and **only** on this index. Line boards should prefer first name from KV Store roster, not from every event.

### Assignment (planned)

```json
{
  "event_family": "shift_assignment",
  "action": "assign",
  "worker_id": "WKR-7f3a9c2e",
  "shift_id": "PLT-AUS-01:2026-10-07:B",
  "planned_start": "2026-10-07T14:00:00-05:00",
  "planned_end": "2026-10-07T22:00:00-05:00",
  "site": "PLT-AUS-01",
  "line_id": "line-3",
  "station_id": "st-12",
  "role": "operator",
  "planned": true
}
```

The live roster is the **latest assignment per worker_id+shift_id** in KV Store, refreshed by a scheduled search (`outputlookup` / KV Store). Do not scan raw assignment history on every dashboard refresh.

### Line state

```json
{
  "event_family": "line_state",
  "site": "PLT-AUS-01",
  "line_id": "line-3",
  "shift_id": "PLT-AUS-01:2026-10-07:B",
  "state_name": "run_status",
  "state_value": "running",
  "previous_state": "changeover",
  "state_reason": "automatic",
  "system": "Production",
  "device_id": "plc-line-3",
  "device_type": "plc",
  "vertical": "manufacturing"
}
```

### Production

```json
{
  "event_family": "production",
  "site": "PLT-AUS-01",
  "line_id": "line-3",
  "shift_id": "PLT-AUS-01:2026-10-07:B",
  "good_count": 12,
  "reject_count": 0,
  "total_count": 12,
  "cycle_time": 41.2,
  "ideal_cycle_time": 38,
  "production_order": "PO-10422",
  "product_code": "SKU-7890",
  "operator_id": "WKR-7f3a9c2e",
  "system": "Production",
  "device_id": "mes-line-3",
  "device_type": "mes",
  "vertical": "manufacturing"
}
```

Counts are **deltas in the event** (units since last report), not lifetime totals. Dashboards `sum(good_count)` by shift. If a vendor only sends lifetime totals, the TA uses a stream-time delta in `transforms` or a scheduled search — never mix both conventions on one sourcetype.

### Downtime

```json
{
  "event_family": "downtime",
  "site": "PLT-AUS-01",
  "line_id": "line-3",
  "shift_id": "PLT-AUS-01:2026-10-07:B",
  "action": "open",
  "downtime_category": "unplanned",
  "downtime_reason": "Conveyor jam",
  "downtime_minutes": 0,
  "system": "Production",
  "device_id": "mes-line-3",
  "device_type": "mes",
  "vertical": "manufacturing"
}
```

## Shift identity

`shift_id = site + local calendar date of shift start + shift_code`.

Midnight-crossing shifts keep the **start date**. Example: nights starting 22:00 local on 7 Oct is `PLT-AUS-01:2026-10-07:N` even at 01:00 on 8 Oct.

The `flo_shift_calendar` KV Store holds per-site windows (`start_local`, `end_local`, `tz`). The macro `current_shift(site)` resolves "now" to a `shift_id` using that calendar. Dashboards must not hardcode 06:00–14:00.

## Current-shift snapshot

A 1-minute saved search writes lookup `flo_current_shift_snapshot`:

| Column | Meaning |
| --- | --- |
| `site`, `line_id`, `shift_id` | Keys |
| `state_value` | Latest line state |
| `headcount_actual` | Distinct clocked-in workers still open |
| `headcount_plan` | From roster |
| `fill_pct` | actual / plan |
| `good_count_shift` | Sum of production deltas for this shift_id |
| `downtime_minutes_shift` | Sum |
| `updated` | Search time |

Line and plant dashboards read this lookup first (`inputlookup`) and only fall back to raw searches for drill-down. That is what keeps "real time" from scanning every factory's hot buckets on every panel.

## Summary index (enterprise)

Every 5 minutes, a saved search writes to `factory_summary` with `sitetime=` and span 5m, by `site` and `line_id`: output, fill %, down flag, exception count. The business dashboard searches **only** `index=factory_summary`.
