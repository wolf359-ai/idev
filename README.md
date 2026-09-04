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

3. In your browser, open [http://127.0.0.1:8765](http://127.0.0.1:8765).

Press `Ctrl+C` in the terminal when you want to stop.

The first launch creates two sample players so you can click around. Your changes are saved in `data.json`.

## What you can do

- **Players** — name, position, and jersey number
- **Skills** — hitting, fielding, throwing, and other softball skills
- **Ratings** — tap 1–5 on a skill; each tap is saved as a new rating
- **Notes** — short coaching notes for a player
- **Progress** — see how a rating changed from the first score to the latest one

## Tests

```bash
python3 -m unittest discover -s tests -v
```
