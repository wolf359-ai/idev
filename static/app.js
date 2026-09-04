(() => {
  const playerList = document.getElementById("player-list");
  const main = document.getElementById("main");
  const emptyState = document.getElementById("empty-state");
  const addForm = document.getElementById("add-player-form");
  const showAdd = document.getElementById("show-add-player");
  const cancelAdd = document.getElementById("cancel-add-player");

  const state = {
    players: [],
    selectedId: null,
    detail: null,
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
    main.replaceChildren(header, skills, progress, notesCard);
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
    addForm.classList.remove("hidden");
    document.getElementById("player-name").focus();
  });

  cancelAdd.addEventListener("click", () => {
    addForm.reset();
    addForm.classList.add("hidden");
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
