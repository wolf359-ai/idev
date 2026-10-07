# Security

This app handles **workforce events**. Treat `factory_workforce` as HR-adjacent data even when names are omitted.

## Secrets

Never store in source, lookups, or sample events:

- Splunk HEC tokens
- Passwords, API keys, OAuth client secrets
- Private keys or certificate key files
- Real badge numbers or HR file extracts

HEC tokens are created in Splunk (or ACS) and injected at the collector:

```bash
export SPLUNK_HEC_URL="https://http-inputs.example.splunkcloud.com/services/collector/event"
export SPLUNK_HEC_TOKEN="from-secret-store"
```

`.env` is gitignored. Use `.env.example` for variable *names* only.

Workspace rule **codeguard-1-hardcoded-credentials** applies to every package and script in this repo: no `Authorization: Splunk <token>` literals, no default admin passwords, no connection strings with credentials.

## Transport

- HEC only over TLS 1.3 (Enterprise: disable 1.0/1.1; Cloud: platform default).
- Prefer `https` indexer acknowledgement for MES bursts.
- App packages do not ship certificates. If a lab needs TLS inspection, load CA material from the instance certificate store — not from `default/`.

Workspace rule **codeguard-1-digital-certificates**: do not embed PEM certificates in the app. If a future input ever loads a `.pem` / `.crt`, it must be verified for expiry, RSA ≥ 2048 or P-256+, SHA-2 signatures, and self-signed only in lab.

## Crypto

- Badge or worker correlation hashes: **SHA-256** (or SHA-256 HMAC with a collector-side pepper). Never MD5 or SHA-1.
- No AES-CBC/ECB in custom commands. If the app ever encrypts fields, use AES-256-GCM via a supported library, with keys in KMS/HSM — not in conf files.

Workspace rule **codeguard-1-crypto-algorithms** applies: banned algorithms are not used in TA transforms or scripts.

## PII and access

| Data | Index | Visible to |
| --- | --- | --- |
| `worker_id`, station, role, counts | ops + workforce | operations roles |
| `display_name`, badge hash | `factory_workforce` only | `flo_workforce`, `flo_admin` |
| SSN, DOB, full badge PAN | **do not ingest** | — |

Use Splunk **field filters** (Enterprise 9.x+ / Cloud) so `flo_plant_ops` searching `factory_workforce` still cannot see `display_name`. Dashboard hiding is not sufficient.

Roles ship as documentation in phase 1; `authorize.conf` in the app is easy to get wrong on Cloud. Prefer the customer’s SAML groups mapped to roles created by the admin, with this app documenting the required capabilities (`search`, index access, KV Store).

## KV Store

Roster collections may contain first name + `worker_id`. Restrict write to `flo_admin`. Export = none for roster collections so other apps cannot `inputlookup` names.

## AppInspect and Cloud

Packages must pass `splunk-appinspect inspect --included-tags cloud` and `private_app` with 0 failures, 0 errors, 0 manual checks before Cloud upload. No private Python dependencies, no `local/`, no hidden files in the `.spl`.
