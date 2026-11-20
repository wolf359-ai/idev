# idev

A very small local web app for tracking softball player development.

You can add players, rate skills, write notes, and see progress over time. Nothing is sent to the internet. Data stays in a file on your computer.

## Get it onto your computer (no Git needed)

A "repo" is just the project folder stored on GitHub. You do not need to know Git. Downloading a zip is enough.

1. Install Python 3 from [python.org/downloads](https://www.python.org/downloads/).
   - On Windows, check the box **Add python.exe to PATH** before you click Install.
2. Download the zip: https://github.com/wolf359-ai/idev/archive/refs/heads/main.zip
3. Unzip the file. You should get a folder that contains `app.py`.

You only download the zip once. After that, idev updates itself (see below).

## Run it (and get updates automatically)

Double-click the launcher in the idev folder:

- **Mac:** `Start idev.command`
- **Windows:** `Start idev.bat`

Each time you start idev this way, it checks GitHub for a newer version,
downloads it if there is one, and then opens idev in your browser. Your
roster and ratings in `data.json` are never replaced; a copy is saved in
`data_backups/` before every update. If the computer is offline, idev just
starts with the version you already have.

Leave the window that opens running while you use idev. Close it (or press
`Ctrl+C`) to stop. To pick up an update, close idev and start it again.

The first time on a Mac, macOS may say the file "cannot be opened because it
is from an unidentified developer". Right-click (or Control-click)
`Start idev.command`, choose **Open**, then click **Open** again. You only have
to do this once.

**Moving from an older copy:** if you already have an idev folder with your
players in it, copy `data.json` (and the `data_backups` folder) from the old
folder into the new one before you start it. Then you can delete the old
folder.

## Run it from a terminal (optional)

`python3 start.py` does the same as the launcher. To start without checking
for updates:

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

idev has a single sign-in page: everyone enters a **username and password**.
Which account the credentials belong to decides what they can do:

- **Coach** — full access to the roster, ratings, stats, and notes.
- **Staff** — access depends on their level (Full, Manager, or view-only).
- **Player** — read-only access to just their own development.

### Coach login

The **first** time you run `app.py`, idev sets a default coach password of
`123` and prints the login once in the terminal:

```
First-time setup. Sign in with:
    username: coach
    password: 123
Then set IDEV_ADMIN_PASSWORD to change it.
```

Sign in with username `coach` and password `123`. The password is stored only as
a salted hash in `data.json`, never in plain text. The default `123` stays in
effect until you choose your own by setting an environment variable before
starting the app:

```bash
IDEV_ADMIN_PASSWORD="your-own-password" python3 app.py
```

The coach username defaults to `coach`; change it with `IDEV_ADMIN_USERNAME` if
you like. `123` is a deliberately weak default that is convenient for local use.
Change it with `IDEV_ADMIN_PASSWORD` before running idev anywhere others can
reach it.

### Giving a player a login

1. Sign in as Coach, click **Admin**, and open the **Logins** tab. It lists every
   player and whether they have a login.
2. Click **Set login** next to the player, then choose a username and password
   and share it with them (or their family).
3. The player opens idev and signs in with those credentials. They see only
   their own skills, ratings, stats, notes, and progress — they cannot see or
   change anyone else.
4. To turn off access, click **Remove** next to the player on the **Logins** tab
   (or **Reset login** to set new credentials; the old ones stop working).

### The Admin button

Coaches and Full-access staff see an **Admin** button next to **Sign out**. It
opens a window with five tabs:

- **Players** — add a player or import a roster
- **Logins** — set, reset, or remove player logins
- **Stats** — import GameChanger stats
- **Staff** — add staff and manage their access
- **Team** — edit the team name, season, and other team information

### Adding a staff member

In **Admin → Staff**, click **Add staff**. When you add a staff member (coach or team helper), the **Add staff** form has an
optional login section: give them a **username** and **password** and they sign
in with those. Their access level (Full, Manager, Assistant, or Read-only)
controls what they can see and change. Leave the login blank to add someone to
the staff list without sign-in access. Staff added before usernames existed can
still sign in with their name until you set a username for them.

A Full-access user can edit an existing staff member from **Admin → Staff → Manage
access**: change their access level, update their **email/phone** and
**username**, set or clear a password, or remove them — all without deleting and
re-adding the person. Clearing the username reverts them to name-based login.

Passwords are stored only as salted hashes, never in plain text. If you serve
idev over HTTPS behind a proxy, set `IDEV_HTTPS=1` so the session cookie is
marked `Secure`.

## What you can do

- **Players** — name, position, and jersey number
- **Roster import** — preview and import players from a GameChanger Stats CSV or pasted list
- **Skills** — hitting, fielding, throwing, and other softball skills
- **Ratings** — click 1–5 on a skill; click the left half of a circle for a half point (e.g. 3.5). Each click is saved as a new rating
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
3. In idev, click **Admin**, open the **Players** tab, select the CSV under
   **Import roster**, and preview it.
4. Confirm the import.

idev reads GameChanger's `Number`, `First`, and `Last` columns (or `#` and
`Roster`). If position is not included,
the player is added as Utility and can be edited later. You can also paste one
player per line, or use CSV rows such as `7,Alex Rivera,SS`. Existing players
with the same name are skipped.

## Import GameChanger stats

Use the same GameChanger **Export Stats** CSV to fill in each player's season
totals instead of typing them in:

1. In GameChanger, open your team, go to **Stats**, and choose **Export Stats**.
2. In idev, click **Admin**, open the **Stats** tab, select the CSV (or paste it), and
   click **Preview stats**.
3. Check the matched players, then click **Update N players**.

Rows are matched to players already on the roster by name (`First`/`Last`,
`Name`, or `Last, First`) **and** jersey number, since teammates can share a
number. A roster player with no jersey number is matched by name alone. If the
name matches but the number doesn't, the preview lists that row with both
numbers so you can fix the roster (or the file) and import again. Players who
aren't on the roster are listed so you can add them with **Import roster**
first. Batting stats come only from GameChanger's Batting
columns and PO/A/E/DP from its Fielding columns, so pitching totals never
overwrite a hitter's line. Innings played comes from the Fielding group's
`Total` column (GameChanger's `INN` there is innings caught). If GameChanger
lists a player twice (two team profiles), both rows are added together, just as
its Totals row does. Stats the file doesn't include keep their current values.
Each import replaces the imported totals, so import the full-season export
rather than a single game.

## Tests

```bash
python3 -m unittest discover -s tests -v
```
