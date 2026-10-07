# TA ingest contract

Keep **index and sourcetype names** as shipped (`factory_ops`, `factory_workforce`, `factory:shift:clock`, …). Do not rename them to `flo_ot` / `flo:json` — the UI app, macros, and samples already depend on these IDs.

The TA parses, redacts, and maps. It does not collect HEC tokens, hash peppers, or dashboards.

## HEC

Collectors POST JSON to `/services/collector/event` over TLS. Create the token in Splunk Web or ACS. Put it in the collector environment (`SPLUNK_HEC_TOKEN`), never in `default/`.

This TA does **not** ship `inputs.conf`. Splunk Cloud manages HEC on the platform; Enterprise labs create the token in UI.

| Setting | Value |
| --- | --- |
| Envelope `sourcetype` | one of the seven `factory:…` types (set per event, not a single `flo:json`) |
| Envelope `index` | `factory_ops` or `factory_workforce` (token `allowedIndexes` must include both) |
| Envelope `time` | epoch seconds matching the payload event time |
| Envelope `host` | collector host (`flo-collector-<site>`), never a worker name |
| ACK | `useACK=1` on the instance |
| Allowed indexes | `factory_ops`, `factory_workforce`, `factory_summary` (summary is written by saved searches, not HEC) |

See `README/inputs.conf.spec` in the TA for the local-only field names. `samples/hec/README.md` is the lab procedure.

## Routing

| `event_family` | Sourcetype | Index | OT child |
| --- | --- | --- | --- |
| `shift_clock` | `factory:shift:clock` | `factory_workforce` | Security (if `access_point`) |
| `shift_assignment` | `factory:shift:assignment` | `factory_workforce` | Production (`shift`, `operator_id`/`worker_id`, `line_id`) |
| `presence` | `factory:personnel:presence` | `factory_workforce` | Location + Security |
| `exception` | `factory:personnel:exception` | `factory_workforce` | Events |
| `line_state` | `factory:line:state` | `factory_ops` | States (`state_name`, `state_value`) |
| `production` | `factory:line:production` | `factory_ops` | Production (`good_count`) |
| `downtime` | `factory:line:downtime` | `factory_ops` | OEE (`downtime_minutes`) |

`vertical` is always `manufacturing`. If Splunk OT Intelligence is installed, add `factory_ops` and (if policy allows) `factory_workforce` to the `ot_indexes` macro — or use `ot_factory_indexes` as a starting definition.

**Do not** overwrite payload `event_family` with OT `event_type` (`alarm` / `warning`). Keep `event_family` for this app; map OT Events with `ot_event_type` if needed.

Optional later: clone badge grant/deny into a `factory_security` index for SOC. v0.1 does not clone; presence/clock stay in `factory_workforce`.

## Device lookup

`lookups/flo_device_inventory.csv` is keyed on `device_id`. Automatic lookup uses `OUTPUTNEW` so a well-formed event wins. Fill `building`, `floor`, `zone`, `asset_id` when the PLC payload omits them so OT `location` can be derived.

## CIM

There is no CIM Production/OEE model. Do not tag clocks as CIM Authentication in a way that dumps them into Enterprise Security identity investigations. Use the TA eventtypes/tags already shipped (`factory`, `workforce`, `production`, `oee`). OT Intelligence is the primary model.

## PII at ingest

1. **Collector (required):** HMAC-SHA-256 with `FLO_PII_PEPPER` (env/secret store) for employee numbers and badge PANs **before** send. Output an opaque `worker_id` (UUID or 64-hex). Never MD5 or SHA-1.
2. **TA backstop:** index-time `INGEST_EVAL` nulls `first_name`, `last_name`, `display_name`, `email`, `phone`, `ssn`, `badge_id`, `worker_name` on workforce sourcetypes. It does **not** hash `worker_id` (that would break roster KV joins). It does **not** embed a pepper.
3. Names for the Workforce dashboard come from KV `flo_worker_display` on the search head, not from indexed events.

Unpeppered `sha256(employee_number)` in the TA would be rainbow-tableable; do not add it. Hash at the collector with a pepper, or send a UUID from WFM.
