(() => {
  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const playerLoginForm = document.getElementById("player-login-form");
  const coachLoginForm = document.getElementById("coach-login-form");
  const tabPlayer = document.getElementById("tab-player");
  const tabCoach = document.getElementById("tab-coach");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const sessionLabel = document.getElementById("session-label");

  const playerList = document.getElementById("player-list");
  const main = document.getElementById("main");
  const emptyState = document.getElementById("empty-state");
  const addForm = document.getElementById("add-player-form");
  const showAdd = document.getElementById("show-add-player");
  const cancelAdd = document.getElementById("cancel-add-player");
  const addStaffForm = document.getElementById("add-staff-form");
  const showAddStaff = document.getElementById("show-add-staff");
  const cancelAddStaff = document.getElementById("cancel-add-staff");
  const importForm = document.getElementById("import-roster-form");
  const showImport = document.getElementById("show-import-roster");
  const cancelImport = document.getElementById("cancel-import-roster");
  const rosterFile = document.getElementById("roster-file");
  const rosterText = document.getElementById("roster-text");
  const rosterPreview = document.getElementById("roster-preview");
  const previewRosterButton = document.getElementById("preview-roster");

  const state = {
    players: [],
    selectedId: null,
    detail: null,
    importReady: false,
    role: null,
    player: null,
    csrf: null,
  };

  function isReadOnly() {
    return state.role === "player";
  }

  function showError(message) {
    window.alert(message);
  }

  async function request(url, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers || {}),
    };
    if (state.csrf && method !== "GET" && method !== "HEAD") {
      headers["X-CSRF-Token"] = state.csrf;
    }
    const response = await fetch(url, { credentials: "same-origin", ...opts, headers });
    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
    }
    if (response.status === 401) {
      handleSignedOut();
      throw new Error(payload.error || "Please sign in");
    }
    if (!response.ok) {
      throw new Error(payload.error || "Something went wrong");
    }
    return payload;
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    const safeAttrs = attrs && typeof attrs === "object" ? attrs : {};
    Object.keys(safeAttrs).forEach((key) => {
      const value = safeAttrs[key];
      if (key === "className") {
        node.className = value;
      } else if (key === "dataset") {
        Object.keys(value || {}).forEach((dataKey) => {
          node.dataset[dataKey] = value[dataKey];
        });
      } else if (key.slice(0, 2) === "on" && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value !== undefined && value !== null && value !== false) {
        node.setAttribute(key, String(value));
      }
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    const safeAttrs = attrs && typeof attrs === "object" ? attrs : {};
    Object.keys(safeAttrs).forEach((key) => {
      const value = safeAttrs[key];
      if (value !== undefined && value !== null && value !== false) {
        node.setAttribute(key, String(value));
      }
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function jersey(player) {
    return player.number === null || player.number === undefined ? "" : `#${player.number}`;
  }

  function formatWhen(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Map a 1-5 score to a hue from red (0) to green (120).
  function scoreColor(score) {
    const clamped = Math.max(1, Math.min(5, Number(score) || 0));
    const hue = ((clamped - 1) / 4) * 120;
    return `hsl(${Math.round(hue)}, 70%, 45%)`;
  }

  function resetImportPreview() {
    state.importReady = false;
    rosterPreview.classList.add("hidden");
    rosterPreview.replaceChildren();
    previewRosterButton.textContent = "Preview roster";
  }

  function renderImportPreview(result) {
    const players = result.players || [];
    const skipped = result.skipped || [];
    rosterPreview.replaceChildren(
      el("strong", {}, `${players.length} player${players.length === 1 ? "" : "s"} ready`),
      players.length
        ? el(
            "ul",
            { className: "import-list" },
            players.map((player) =>
              el(
                "li",
                {},
                [player.number === null ? "" : `#${player.number}`, player.name, player.position]
                  .filter(Boolean)
                  .join(" · "),
              ),
            ),
          )
        : el("p", { className: "empty" }, "No new players found."),
      skipped.length
        ? el(
            "p",
            { className: "meta" },
            `${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped: ${skipped
              .slice(0, 3)
              .map((item) => item.reason)
              .join("; ")}${skipped.length > 3 ? "…" : ""}`,
          )
        : null,
    );
    rosterPreview.classList.remove("hidden");
    state.importReady = players.length > 0;
    previewRosterButton.textContent = state.importReady
      ? `Import ${players.length} player${players.length === 1 ? "" : "s"}`
      : "Preview roster";
  }

  function renderRoster() {
    playerList.replaceChildren();
    state.players.forEach((player) => {
      const button = el(
        "button",
        {
          type: "button",
          className: "player-btn" + (player.id === state.selectedId ? " active" : ""),
          onClick: () => selectPlayer(player.id),
        },
        el("strong", {}, player.name),
        el("div", { className: "meta" }, [jersey(player), player.position].filter(Boolean).join(" · ")),
      );
      playerList.append(el("li", {}, button));
    });
  }

  function scoreDots(skillId, current, readOnly) {
    const row = el("div", { className: "dots", role: "group", "aria-label": "Rate 1 to 5" });
    const level = current ? Math.max(1, Math.min(5, Number(current))) : 0;
    for (let score = 1; score <= 5; score += 1) {
      const filled = current && score <= current;
      const attrs = {
        type: "button",
        className: "dot" + (filled ? ` on score-${level}` : ""),
        title: `Rate ${score}`,
        "aria-label": `Rate ${score} out of 5`,
      };
      if (readOnly) {
        attrs.disabled = true;
        attrs.className += " static";
      } else {
        attrs.onClick = () => saveRating(skillId, score);
      }
      row.append(el("button", attrs));
    }
    return row;
  }

  function deltaLabel(delta) {
    if (delta === null || delta === undefined || delta === 0) {
      return el("span", { className: "meta" }, "No change yet");
    }
    const up = delta > 0;
    return el(
      "span",
      { className: "delta " + (up ? "up" : "down") },
      `${up ? "+" : ""}${delta} from first rating`,
    );
  }

  // Radar (spider) chart of all skills vs the player's current ratings.
  function renderRadar(progress) {
    const items = (progress || []).map((item) => ({
      label: item.skill_name || "Skill",
      value: Number(item.current) || 0,
    }));
    if (items.length < 3) {
      return el(
        "p",
        { className: "empty" },
        "Rate at least three skills to see the strengths and weaknesses radar.",
      );
    }
    const size = 320;
    const center = size / 2;
    const radius = center - 54;
    const maxScore = 5;
    const rings = 5;
    const angleFor = (index) => (Math.PI * 2 * index) / items.length - Math.PI / 2;
    const point = (index, ratio) => {
      const angle = angleFor(index);
      return [center + radius * ratio * Math.cos(angle), center + radius * ratio * Math.sin(angle)];
    };

    const gridRings = [];
    for (let ring = 1; ring <= rings; ring += 1) {
      const ratio = ring / rings;
      const pts = items
        .map((_item, index) => point(index, ratio).map((n) => n.toFixed(1)).join(","))
        .join(" ");
      gridRings.push(
        svgEl("polygon", {
          points: pts,
          fill: "none",
          stroke: "#d8cebf",
          "stroke-width": ring === rings ? 1.5 : 1,
        }),
      );
    }

    const spokes = items.map((_item, index) => {
      const [x, y] = point(index, 1);
      return svgEl("line", {
        x1: center,
        y1: center,
        x2: x.toFixed(1),
        y2: y.toFixed(1),
        stroke: "#d8cebf",
        "stroke-width": 1,
      });
    });

    const valuePoints = items
      .map((item, index) => point(index, (item.value || 0) / maxScore).map((n) => n.toFixed(1)).join(","))
      .join(" ");

    const average = items.reduce((sum, item) => sum + item.value, 0) / items.length;
    const shapeColor = scoreColor(average || 1);

    const dots = items.map((item, index) => {
      const [x, y] = point(index, (item.value || 0) / maxScore);
      return svgEl("circle", {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: 3.5,
        fill: item.value ? scoreColor(item.value) : "#b9b1a1",
      });
    });

    const labels = items.map((item, index) => {
      const [x, y] = point(index, 1.16);
      const anchor = Math.abs(x - center) < 8 ? "middle" : x > center ? "start" : "end";
      return svgEl(
        "text",
        {
          x: x.toFixed(1),
          y: y.toFixed(1),
          "text-anchor": anchor,
          "dominant-baseline": "middle",
          "font-size": "11",
          fill: "#1c211e",
        },
        `${item.label} (${item.value || 0})`,
      );
    });

    const svg = svgEl(
      "svg",
      {
        viewBox: `0 0 ${size} ${size}`,
        width: "100%",
        role: "img",
        "aria-label": "Skill strengths and weaknesses radar",
        class: "radar",
      },
      ...gridRings,
      ...spokes,
      svgEl("polygon", {
        points: valuePoints,
        fill: shapeColor,
        "fill-opacity": "0.28",
        stroke: shapeColor,
        "stroke-width": 2,
        "stroke-linejoin": "round",
      }),
      ...dots,
      ...labels,
    );
    return svg;
  }

  function renderDetail() {
    if (!state.detail) {
      main.replaceChildren(emptyState);
      emptyState.classList.remove("hidden");
      return;
    }

    const player = state.detail;
    const readOnly = isReadOnly();
    emptyState.classList.add("hidden");

    const rated = (player.progress || []).filter((item) => item.current);
    const notes = player.notes || [];

    const actions = [];
    if (!readOnly) {
      actions.push(el("button", { type: "button", className: "btn", onClick: editPlayer }, "Edit"));
      actions.push(
        el(
          "button",
          { type: "button", className: "btn", onClick: manageAccessCode },
          player.has_access_code ? "Reset code" : "Access code",
        ),
      );
      if (player.has_access_code) {
        actions.push(
          el(
            "button",
            { type: "button", className: "btn btn-danger", onClick: revokeAccessCode },
            "Remove access",
          ),
        );
      }
      actions.push(
        el("button", { type: "button", className: "btn btn-danger", onClick: removePlayer }, "Delete"),
      );
    }

    const header = el(
      "section",
      { className: "card who" },
      el(
        "div",
        {},
        el("strong", {}, player.name),
        el("div", { className: "meta" }, [jersey(player), player.position].filter(Boolean).join(" · ")),
      ),
      actions.length ? el("div", { className: "row" }, actions) : null,
    );

    const skills = el(
      "section",
      { className: "card" },
      el("h2", {}, "Skills and ratings"),
      el(
        "p",
        { className: "meta" },
        readOnly
          ? "Your latest rating for each skill (1–5)."
          : "Tap a circle to save a new rating (1–5). Older ratings stay in Progress.",
      ),
      el(
        "div",
        { className: "skills" },
        (player.progress || []).map((item) =>
          el(
            "article",
            { className: "skill" },
            el("h3", {}, item.skill_name || "Skill"),
            scoreDots(item.skill_id, item.current, readOnly),
            el("div", { className: "meta" }, item.current ? `${item.current} / 5` : "Not rated yet"),
          ),
        ),
      ),
    );

    const radar = el(
      "section",
      { className: "card" },
      el("h2", {}, "Skill radar"),
      el("p", { className: "meta" }, "Strengths and weaknesses across every skill at a glance."),
      el("div", { className: "radar-wrap" }, renderRadar(player.progress)),
    );

    const stats = player.stats || { offense: [], defense: [] };
    const statsCard = readOnly
      ? el(
          "section",
          { className: "card" },
          el("h2", {}, "GameChanger stats"),
          statsReadOnly("Offense", stats.offense || []),
          statsReadOnly("Defense", stats.defense || []),
        )
      : el(
          "section",
          { className: "card" },
          el("h2", {}, "GameChanger stats"),
          el(
            "p",
            { className: "meta" },
            "Most common offense and defense totals from GameChanger. AVG, OBP, SLG, OPS, and FLD% update when you save.",
          ),
          el(
            "form",
            { className: "form", onSubmit: saveStats },
            statsGroup("Offense", stats.offense || []),
            statsGroup("Defense", stats.defense || []),
            el("button", { type: "submit", className: "btn btn-primary" }, "Save stats"),
          ),
        );

    const progress = el(
      "section",
      { className: "card" },
      el("h2", {}, "Progress"),
      rated.length
        ? rated.map((item) =>
            el(
              "div",
              { className: "stack" },
              el("strong", {}, item.skill_name || "Skill"),
              deltaLabel(item.delta),
              el(
                "div",
                { className: "history" },
                (item.history || [])
                  .map((entry) => `${entry.score} (${formatWhen(entry.created_at)})`)
                  .join(" → ") || "No history",
              ),
            ),
          )
        : el("p", { className: "empty" }, "Rate a skill to start a progress history."),
    );

    const cards = [header, skills, radar, statsCard, progress];

    if (readOnly) {
      const noteList = el(
        "ul",
        { className: "notes" },
        notes.length
          ? notes.map((note) =>
              el(
                "li",
                {},
                el("div", { className: "note-top" }, el("span", { className: "meta" }, formatWhen(note.created_at))),
                el("p", {}, note.text || ""),
              ),
            )
          : el("li", { className: "empty" }, "No notes yet."),
      );
      cards.push(el("section", { className: "card" }, el("h2", {}, "Notes"), noteList));
    } else {
      const noteForm = el(
        "form",
        { className: "form", onSubmit: saveNote },
        el("label", {}, "New note", el("textarea", { name: "text", maxlength: "2000", required: true })),
        el("button", { type: "submit", className: "btn btn-primary" }, "Save note"),
      );
      const noteList = el(
        "ul",
        { className: "notes" },
        notes.length
          ? notes.map((note) =>
              el(
                "li",
                {},
                el(
                  "div",
                  { className: "note-top" },
                  el("span", { className: "meta" }, formatWhen(note.created_at)),
                  el(
                    "button",
                    { type: "button", className: "btn btn-danger", onClick: () => removeNote(note.id) },
                    "Delete",
                  ),
                ),
                el("p", {}, note.text || ""),
              ),
            )
          : el("li", { className: "empty" }, "No notes yet."),
      );
      cards.push(el("section", { className: "card" }, el("h2", {}, "Notes"), noteForm, noteList));
    }

    main.replaceChildren(...cards);
  }

  function statsGroup(title, items) {
    const counts = items.filter((item) => item.kind === "count");
    const computed = items.filter((item) => item.kind === "computed");
    return el(
      "div",
      { className: "stat-group" },
      el("h3", {}, title),
      el("div", { className: "stat-grid" }, counts.map(statInput)),
      el("div", { className: "stat-rates" }, computed.map(statChip)),
    );
  }

  function statsReadOnly(title, items) {
    return el(
      "div",
      { className: "stat-group" },
      el("h3", {}, title),
      el(
        "div",
        { className: "stat-rates" },
        items.map((item) =>
          el(
            "div",
            { className: "stat-chip", title: item.label || item.abbr },
            el("span", { className: "stat-abbr" }, item.abbr || item.key),
            el("strong", {}, item.display !== undefined && item.display !== null ? item.display : String(item.value)),
          ),
        ),
      ),
    );
  }

  function statInput(item) {
    return el(
      "label",
      { className: "stat-field" },
      el("span", { className: "stat-abbr", title: item.label || item.abbr }, item.abbr || item.key),
      el("input", {
        name: item.key,
        type: "number",
        min: "0",
        max: "9999",
        step: item.key === "inn" ? "0.1" : "1",
        value: item.value === undefined || item.value === null ? 0 : item.value,
        "aria-label": item.label || item.abbr || item.key,
      }),
    );
  }

  function statChip(item) {
    return el(
      "div",
      { className: "stat-chip", title: item.label || item.abbr },
      el("span", { className: "stat-abbr" }, item.abbr || item.key),
      el("strong", {}, item.display || "—"),
    );
  }

  async function loadPlayers(preferredId) {
    const data = await request("/api/players");
    state.players = data.players || [];
    const nextId = preferredId || state.selectedId;
    const exists = state.players.some((player) => player.id === nextId);
    state.selectedId = exists ? nextId : (state.players[0] && state.players[0].id) || null;
    renderRoster();
    if (state.selectedId) {
      await loadDetail(state.selectedId);
    } else {
      state.detail = null;
      renderDetail();
    }
  }

  async function loadDetail(playerId) {
    state.detail = await request(`/api/players/${encodeURIComponent(playerId)}`);
    state.selectedId = playerId;
    if (!isReadOnly()) {
      renderRoster();
    }
    renderDetail();
  }

  async function selectPlayer(playerId) {
    try {
      await loadDetail(playerId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function saveRating(skillId, score) {
    if (!state.selectedId) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/ratings`, {
        method: "POST",
        body: JSON.stringify({ skill_id: skillId, score }),
      });
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function saveStats(event) {
    event.preventDefault();
    if (!state.selectedId) {
      return;
    }
    const body = {};
    new FormData(event.currentTarget).forEach((value, key) => {
      body[key] = value;
    });
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/stats`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    if (!state.selectedId) {
      return;
    }
    const form = event.currentTarget;
    const text = new FormData(form).get("text");
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/notes`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      form.reset();
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function removeNote(noteId) {
    try {
      await request(`/api/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function removePlayer() {
    if (!state.selectedId) {
      return;
    }
    const name = state.detail && state.detail.name ? state.detail.name : "this player";
    if (!window.confirm(`Delete ${name} and their ratings and notes?`)) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}`, { method: "DELETE" });
      state.selectedId = null;
      state.detail = null;
      await loadPlayers();
    } catch (error) {
      showError(error.message);
    }
  }

  async function editPlayer() {
    if (!state.detail) {
      return;
    }
    const name = window.prompt("Player name", state.detail.name);
    if (name === null) {
      return;
    }
    const position = window.prompt("Position", state.detail.position);
    if (position === null) {
      return;
    }
    const number = window.prompt("Jersey number (blank to clear)", state.detail.number ?? "");
    if (number === null) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}`, {
        method: "PUT",
        body: JSON.stringify({ name, position, number }),
      });
      await loadPlayers(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function manageAccessCode() {
    if (!state.selectedId || !state.detail) {
      return;
    }
    const has = state.detail.has_access_code;
    const ok = window.confirm(
      has
        ? "Generate a NEW access code? The current code will stop working."
        : "Create an access code so this player can sign in and see their development?",
    );
    if (!ok) {
      return;
    }
    try {
      const result = await request(
        `/api/players/${encodeURIComponent(state.selectedId)}/access-code`,
        { method: "POST" },
      );
      window.prompt(
        "Give this access code to the player. It is shown only once — copy it now:",
        result.code,
      );
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  async function revokeAccessCode() {
    if (!state.selectedId) {
      return;
    }
    if (!window.confirm("Remove this player's access code? They will no longer be able to sign in.")) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/access-code`, {
        method: "DELETE",
      });
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  // -- authentication ----------------------------------------------------
  function selectTab(which) {
    const player = which === "player";
    tabPlayer.classList.toggle("active", player);
    tabCoach.classList.toggle("active", !player);
    playerLoginForm.classList.toggle("hidden", !player);
    coachLoginForm.classList.toggle("hidden", player);
    loginError.textContent = "";
  }

  function showLogin() {
    state.role = null;
    state.csrf = null;
    state.player = null;
    state.players = [];
    state.selectedId = null;
    state.detail = null;
    appView.classList.add("hidden");
    appView.classList.remove("role-player");
    loginView.classList.remove("hidden");
  }

  function handleSignedOut() {
    const wasSignedIn = state.role !== null;
    showLogin();
    if (wasSignedIn) {
      loginError.textContent = "Your session ended. Please sign in again.";
    }
  }

  function applySession(session) {
    state.role = session.role;
    state.csrf = session.csrf || null;
    state.player = session.player || null;
    loginError.textContent = "";
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    if (state.role === "player") {
      appView.classList.add("role-player");
      sessionLabel.textContent = state.player ? `Signed in: ${state.player.name}` : "Signed in";
      state.selectedId = state.player ? state.player.id : null;
      if (state.selectedId) {
        loadDetail(state.selectedId).catch((error) => showError(error.message));
      }
    } else {
      appView.classList.remove("role-player");
      sessionLabel.textContent =
        session.staff && session.staff.name
          ? `Signed in: ${session.staff.name}`
          : "Signed in as Coach";
      loadPlayers().catch((error) => showError(error.message));
    }
  }

  async function doLogin(body) {
    loginError.textContent = "";
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        loginError.textContent = payload.error || "Could not sign in";
        return;
      }
      playerLoginForm.reset();
      coachLoginForm.reset();
      applySession(payload);
    } catch (_error) {
      loginError.textContent = "Could not sign in. Please try again.";
    }
  }

  async function bootstrap() {
    try {
      const session = await request("/api/session");
      if (session && session.authenticated) {
        applySession(session);
      } else {
        showLogin();
      }
    } catch (_error) {
      showLogin();
    }
  }

  tabPlayer.addEventListener("click", () => selectTab("player"));
  tabCoach.addEventListener("click", () => selectTab("coach"));

  playerLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    doLogin({ mode: "player", code: document.getElementById("player-code").value });
  });

  coachLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    doLogin({
      mode: "coach",
      username: document.getElementById("coach-username").value,
      password: document.getElementById("coach-password").value,
    });
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await request("/api/logout", { method: "POST" });
    } catch (_error) {
      /* ignore */
    }
    showLogin();
  });

  showAdd.addEventListener("click", () => {
    importForm.classList.add("hidden");
    addStaffForm.classList.add("hidden");
    addForm.classList.remove("hidden");
    document.getElementById("player-name").focus();
  });

  cancelAdd.addEventListener("click", () => {
    addForm.reset();
    addForm.classList.add("hidden");
  });

  showImport.addEventListener("click", () => {
    addForm.classList.add("hidden");
    addStaffForm.classList.add("hidden");
    importForm.classList.remove("hidden");
    rosterText.focus();
  });

  cancelImport.addEventListener("click", () => {
    importForm.reset();
    importForm.classList.add("hidden");
    resetImportPreview();
  });

  rosterText.addEventListener("input", resetImportPreview);

  showAddStaff.addEventListener("click", () => {
    addForm.classList.add("hidden");
    importForm.classList.add("hidden");
    addStaffForm.classList.remove("hidden");
    document.getElementById("staff-name").focus();
  });

  cancelAddStaff.addEventListener("click", () => {
    addStaffForm.reset();
    addStaffForm.classList.add("hidden");
  });

  addStaffForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(addStaffForm);
    try {
      const created = await request("/api/staff", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      addStaffForm.reset();
      addStaffForm.classList.add("hidden");
      window.alert(`${created.name} can now sign in as ${created.username}.`);
    } catch (error) {
      showError(error.message);
    }
  });

  rosterFile.addEventListener("change", async () => {
    resetImportPreview();
    const file = rosterFile.files && rosterFile.files[0];
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      rosterFile.value = "";
      showError("Choose a .csv file");
      return;
    }
    if (file.size > 200 * 1024) {
      rosterFile.value = "";
      showError("Roster file must be 200 KB or smaller");
      return;
    }
    try {
      rosterText.value = await file.text();
    } catch (_error) {
      rosterFile.value = "";
      showError("Could not read that file");
    }
  });

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = rosterText.value;
    try {
      if (!state.importReady) {
        const result = await request("/api/players/import", {
          method: "POST",
          body: JSON.stringify({ text, preview: true }),
        });
        renderImportPreview(result);
        return;
      }
      const result = await request("/api/players/import", {
        method: "POST",
        body: JSON.stringify({ text, preview: false }),
      });
      const imported = result.imported || [];
      importForm.reset();
      importForm.classList.add("hidden");
      resetImportPreview();
      await loadPlayers(imported.length ? imported[0].id : undefined);
    } catch (error) {
      resetImportPreview();
      showError(error.message);
    }
  });

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(addForm);
    try {
      const created = await request("/api/players", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          position: form.get("position"),
          number: form.get("number"),
        }),
      });
      addForm.reset();
      addForm.classList.add("hidden");
      await loadPlayers(created.id);
    } catch (error) {
      showError(error.message);
    }
  });

  bootstrap();
})();
