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

## Signing in

idev now has a sign-in page with two kinds of access:

- **Coach** — full access to the roster, ratings, stats, and notes.
- **Player** — read-only access to just one player's own development, using an
  access code the coach hands out.

### Coach password

The **first** time you run `app.py`, idev sets a default coach password of
`123` and prints it once in the terminal:

```
First-time setup: the default coach password is:
    123
Sign in as Coach with it, then set IDEV_ADMIN_PASSWORD to change it.
```

Sign in on the **Coach** tab with `123`. It is stored only as a salted hash in
`data.json`, never in plain text. The default `123` stays in effect until you
choose your own password by setting an environment variable before starting the
app:

```bash
IDEV_ADMIN_PASSWORD="your-own-password" python3 app.py
```

`123` is a deliberately weak default that is convenient for local use. Change it
with `IDEV_ADMIN_PASSWORD` before running idev anywhere others can reach it.

### Giving a player access

1. Sign in as Coach and open a player.
2. Click **Access code**. idev shows a one-time code — copy it and give it to
   that player (or their family).
3. The player opens idev, chooses the **Player** tab, and enters the code. They
   see only their own skills, ratings, stats, notes, and progress — they cannot
   see or change anyone else.
4. To turn off access, open the player and click **Remove access** (or **Reset
   code** to issue a new one; the old code stops working).

Access codes are stored only as hashes, never in plain text. If you serve idev
over HTTPS behind a proxy, set `IDEV_HTTPS=1` so the session cookie is marked
`Secure`.

## What you can do

- **Players** — name, position, and jersey number
- **Roster import** — preview and import players from a GameChanger Stats CSV or pasted list
- **Skills** — hitting, fielding, throwing, and other softball skills
- **Ratings** — tap 1–5 on a skill; each tap is saved as a new rating
- **GameChanger stats** — common offense and defense totals (AVG, OBP, SLG, OPS, and FLD% are calculated)
- **Skill radar** — a spider chart of every skill's current rating, so strengths and weaknesses stand out at a glance
- **Notes** — short coaching notes for a player
- **Progress** — see how a rating changed from the first score to the latest one
- **Ratings colors** — the 1–5 dots shift from red (needs work) to green (strong) as a skill improves

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
