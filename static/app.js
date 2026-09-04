(() => {
  const playerList = document.getElementById("player-list");
  const main = document.getElementById("main");
  const emptyState = document.getElementById("empty-state");
  const addForm = document.getElementById("add-player-form");
  const showAdd = document.getElementById("show-add-player");
  const cancelAdd = document.getElementById("cancel-add-player");
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
  };

  function showError(message) {
    window.alert(message);
  }

  async function request(url, options) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      ...options,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
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
      } else if (value !== undefined && value !== null) {
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

  function scoreDots(skillId, current) {
    const row = el("div", { className: "dots", role: "group", "aria-label": "Rate 1 to 5" });
    for (let score = 1; score <= 5; score += 1) {
      row.append(
        el("button", {
          type: "button",
          className: "dot" + (current && score <= current ? " on" : ""),
          title: `Rate ${score}`,
          "aria-label": `Rate ${score} out of 5`,
          onClick: () => saveRating(skillId, score),
        }),
      );
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

  function renderDetail() {
    if (!state.detail) {
      main.replaceChildren(emptyState);
      emptyState.classList.remove("hidden");
      return;
    }

    const player = state.detail;
    emptyState.classList.add("hidden");

    const rated = (player.progress || []).filter((item) => item.current);
    const notes = player.notes || [];

    const header = el(
      "section",
      { className: "card who" },
      el(
        "div",
        {},
        el("strong", {}, player.name),
        el("div", { className: "meta" }, [jersey(player), player.position].filter(Boolean).join(" · ")),
      ),
      el(
        "div",
        { className: "row" },
        el("button", { type: "button", className: "btn", onClick: editPlayer }, "Edit"),
        el("button", { type: "button", className: "btn btn-danger", onClick: removePlayer }, "Delete"),
      ),
    );

    const skills = el(
      "section",
      { className: "card" },
      el("h2", {}, "Skills and ratings"),
      el("p", { className: "meta" }, "Tap a circle to save a new rating (1–5). Older ratings stay in Progress."),
      el(
        "div",
        { className: "skills" },
        (player.progress || []).map((item) =>
          el(
            "article",
            { className: "skill" },
            el("h3", {}, item.skill_name || "Skill"),
            scoreDots(item.skill_id, item.current),
            el("div", { className: "meta" }, item.current ? `${item.current} / 5` : "Not rated yet"),
          ),
        ),
      ),
    );

    const stats = player.stats || { offense: [], defense: [] };
    const statsCard = el(
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
                  {
                    type: "button",
                    className: "btn btn-danger",
                    onClick: () => removeNote(note.id),
                  },
                  "Delete",
                ),
              ),
              el("p", {}, note.text || ""),
            ),
          )
        : el("li", { className: "empty" }, "No notes yet."),
    );

    const notesCard = el("section", { className: "card" }, el("h2", {}, "Notes"), noteForm, noteList);
    main.replaceChildren(header, skills, statsCard, progress, notesCard);
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
    renderRoster();
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

  showAdd.addEventListener("click", () => {
    importForm.classList.add("hidden");
    addForm.classList.remove("hidden");
    document.getElementById("player-name").focus();
  });

  cancelAdd.addEventListener("click", () => {
    addForm.reset();
    addForm.classList.add("hidden");
  });

  showImport.addEventListener("click", () => {
    addForm.classList.add("hidden");
    importForm.classList.remove("hidden");
    rosterText.focus();
  });

  cancelImport.addEventListener("click", () => {
    importForm.reset();
    importForm.classList.add("hidden");
    resetImportPreview();
  });

  rosterText.addEventListener("input", resetImportPreview);

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

  loadPlayers().catch((error) => {
    showError(error.message);
  });
})();
