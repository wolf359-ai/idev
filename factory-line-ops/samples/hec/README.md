# Sending sample events

Create an HTTP Event Collector token **in Splunk**, not in this repo. Use two tokens if you can:

- ops token default index `factory_ops`
- workforce token default index `factory_workforce`

Each event file already includes `index` and `sourcetype`. The token should allow those indexes.

```bash
cp .env.example .env
# edit .env with URL and token from your secret store

set -a && source .env && set +a
./scripts/send_sample_events.sh
```

`SPLUNK_HEC_TOKEN` is never read from a file committed to git.
