# idev

A very small local web app for tracking softball player development.

You can add players, rate skills, write notes, and see progress over time. Nothing is sent to the internet. Data stays in a file on your computer.

## Get it onto your computer (no Git needed)

A "repo" is just the project folder stored on GitHub. You do not need to know Git. Downloading a zip is enough.

1. Install Python 3 from [python.org/downloads](https://www.python.org/downloads/).
   - On Windows, check the box **Add python.exe to PATH** before you click Install.
2. Open this page: [github.com/wolf359-ai/idev](https://github.com/wolf359-ai/idev)
3. If GitHub asks you to sign in, sign in.
4. Near the top left, click the branch menu (it may say `main`). Choose `cursor/idev-softball-tracker-2082`.
5. Click the green **Code** button, then **Download ZIP**.
6. Unzip the file. You should get a folder that contains `app.py`.

Direct zip link for the current app branch:

https://github.com/wolf359-ai/idev/archive/refs/heads/cursor/idev-softball-tracker-2082.zip

## Run it

1. Open a terminal in that unzipped folder:
   - **Mac:** open Terminal, type `cd ` (with a space), drag the unzipped folder onto the Terminal window, then press Return.
   - **Windows:** in File Explorer open the unzipped folder, click the address bar, type `cmd`, and press Enter.
2. Start the app:

```bash
python3 app.py
```

If that says the command was not found, try:

```bash
python app.py
```

3. Open a web browser and go to http://127.0.0.1:8765

That address only works on the same computer that is running `app.py`. Leave the terminal window open while you use the app. Press `Ctrl+C` in the terminal when you want to stop.

The first launch creates two sample players so you can click around. Your changes are saved in `data.json` in the same folder.

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
