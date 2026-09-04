# idev

A very small local web app for tracking softball player development.

You can add players, rate skills, write notes, and see progress over time. Nothing is sent to the internet. Data stays in a file on your computer.

## Run it

You only need Python 3. No extra packages.

1. Open a terminal in this folder.
2. Start the app:

```bash
python3 app.py
```

3. In your browser, open http://127.0.0.1:8765

If you are using a Cursor Cloud Agent, that address is the agent machine, not your laptop. Open the Ports / plug control in Cursor and open port 8765, or clone this repo and run `python3 app.py` on your computer.

Press `Ctrl+C` in the terminal when you want to stop.

The first launch creates two sample players so you can click around. Your changes are saved in `data.json`.

## What you can do

- **Players** — name, position, and jersey number
- **Roster import** — preview and import players from a GameChanger Stats CSV or pasted list
- **Skills** — hitting, fielding, throwing, and other softball skills
- **Ratings** — tap 1–5 on a skill; each tap is saved as a new rating
- **GameChanger stats** — common offense and defense totals (AVG, OBP, SLG, OPS, and FLD% are calculated)
- **Notes** — short coaching notes for a player
- **Progress** — see how a rating changed from the first score to the latest one

## Import a GameChanger roster

GameChanger does not provide a separate roster CSV, but staff can export a Stats
CSV that contains the same player list:

1. In GameChanger, open your team and go to **Stats**.
2. Choose **Export Stats** and save the CSV.
3. In idev, choose **Import roster**, select the CSV, and preview it.
4. Confirm the import.

idev reads GameChanger's `#` and `Roster` columns. If position is not included,
the player is added as Utility and can be edited later. You can also paste one
player per line, or use CSV rows such as `7,Alex Rivera,SS`. Existing players
with the same name are skipped.

## Tests

```bash
python3 -m unittest discover -s tests -v
```
