# Security

This app handles **workforce events**. Treat `factory_workforce` as HR-adjacent data even when names are omitted.

## Secrets

Never store in source, lookups, or sample events:

- Splunk HEC tokens
- Passwords, API keys, OAuth client secrets
- Private keys or certificate key files
- Real badge numbers or HR file extracts

HEC tokens are created in Splunk (or ACS) and injected at the collector. Employee numbers and badge PANs are HMAC-SHA-256’d on the collector with `FLO_PII_PEPPER` before send. Neither value belongs in git.

```bash
export SPLUNK_HEC_URL="https://http-inputs.example.splunkcloud.com/services/collector/event"
export SPLUNK_HEC_TOKEN="from-secret-store"
export FLO_PII_PEPPER="from-secret-store"
```

`.env` is gitignored. Use `.env.example` for variable *names* only.

Workspace rule **codeguard-1-hardcoded-credentials** applies to every package and script in this repo: no `Authorization: Splunk <token>` literals, no default admin passwords, no connection strings with credentials.

## Transport

- HEC only over TLS 1.3 (Enterprise: disable 1.0/1.1; Cloud: platform default).
- Prefer `https` indexer acknowledgement for MES bursts.
- App packages do not ship certificates. If a lab needs TLS inspection, load CA material from the instance certificate store — not from `default/`.

Workspace rule **codeguard-1-digital-certificates**: do not embed PEM certificates in the app. If a future input ever loads a `.pem` / `.crt`, it must be verified for expiry, RSA ≥ 2048 or P-256+, SHA-2 signatures, and self-signed only in lab.

## Crypto

- Badge or worker correlation hashes: **HMAC-SHA-256** with `FLO_PII_PEPPER` on the collector. Never MD5 or SHA-1. The TA does not embed a pepper and does not `sha256()` employee numbers (rainbow tables). It only **nulls** name/badge fields if a source sends them anyway. See [TA_INGEST.md](TA_INGEST.md).
- No AES-CBC/ECB in custom commands. If the app ever encrypts fields, use AES-256-GCM via a supported library, with keys in KMS/HSM — not in conf files.

Workspace rule **codeguard-1-crypto-algorithms** applies: banned algorithms are not used in TA transforms or scripts.

## PII and access

| Data | Where | Visible to |
| --- | --- | --- |
| `worker_id`, station, role, counts | `factory_ops`, snapshot, `flo_roster`, `flo_roster_presence` | operations roles |
| `first_name` | KV `flo_worker_display` only (`replicate = false`) | `flo_workforce`, `flo_admin` |
| `display_name` on events | do not send; use the KV collection | — |
| SSN, DOB, full badge PAN, phone | **do not ingest** | — |

Use Splunk **field filters** (Enterprise 9.x+ / Cloud) so `flo_plant_ops` searching `factory_workforce` still cannot see name fields. Dashboard hiding is not sufficient. Line floor and plant dashboards must not `| lookup flo_worker_display`.

Roles ship as documentation in phase 1; `authorize.conf` in the app is easy to get wrong on Cloud. Prefer the customer’s SAML groups mapped to roles created by the admin (`flo_line_supervisor`, `flo_plant_ops`, `flo_business`, `flo_workforce`, `flo_wall`, `flo_admin`), with `srchFilter` on site/line for supervisors and plant ops.

Ops no-show alerts are **counts by line**. Named no-show lists run only as a workforce search against `factory_workforce` + `flo_worker_display`.

## KV Store

- `flo_roster` — planned assignment; `worker_id` only (no names).
- `flo_roster_presence` — current clock-in; upserted every minute; no names.
- `flo_worker_display` — `worker_id` + first name; read ACL workforce/admin; `export = none`; `replicate = false`.

Write on all collections: `flo_admin` (and a MES/HRIS service account on the instance). Export = none so other apps cannot `inputlookup` names.

## AppInspect and Cloud

Packages must pass `splunk-appinspect inspect --included-tags cloud` and `private_app` with 0 failures, 0 errors, 0 manual checks before Cloud upload. No private Python dependencies, no `local/`, no hidden files in the `.spl`.
