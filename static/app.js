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
  const addPanel = document.getElementById("add-player");
  const cancelAdd = document.getElementById("cancel-add-player");
  const importForm = document.getElementById("import-roster-form");
  const importPanel = document.getElementById("import-roster");
  const cancelImport = document.getElementById("cancel-import-roster");
  const rosterFile = document.getElementById("roster-file");
  const rosterText = document.getElementById("roster-text");
  const rosterPreview = document.getElementById("roster-preview");
  const previewRosterButton = document.getElementById("preview-roster");
  const staffForm = document.getElementById("add-staff-form");
  const staffPanel = document.getElementById("staff-tools");
  const staffList = document.getElementById("staff-list");
  const cancelStaff = document.getElementById("cancel-add-staff");

  const state = {
    players: [],
    staff: [],
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

  // Rating colors shared with the skill dots: red (weak) to green (strong).
  const SCORE_COLORS = {
    1: "hsl(352, 85%, 60%)",
    2: "hsl(28, 90%, 58%)",
    3: "hsl(50, 92%, 56%)",
    4: "hsl(96, 62%, 52%)",
    5: "hsl(150, 72%, 50%)",
  };

  function scoreColor(value) {
    if (!value) return "#3a4757";
    const level = Math.max(1, Math.min(5, Math.round(value)));
    return SCORE_COLORS[level];
  }

  // "Shortstop · Second Base" when a secondary position is set, else just primary.
  function positionLabel(player) {
    const primary = player.position || "";
    const secondary = player.secondary_position || "";
    if (primary && secondary) return `${primary} · ${secondary}`;
    return primary || secondary;
  }

  function renderRoster() {
    playerList.replaceChildren();
    if (!state.players.length) {
      return;
    }
    playerList.append(el("li", { className: "player-list-title" }, "Athletes"));
    state.players.forEach((player) => {
      const badge = player.number === null || player.number === undefined ? "—" : `#${player.number}`;
      const button = el(
        "button",
        {
          type: "button",
          className: "player-btn" + (player.id === state.selectedId ? " active" : ""),
          onClick: () => selectPlayer(player.id),
        },
        el("span", { className: "player-dot" }),
        el(
          "span",
          { className: "player-id" },
          el("strong", {}, player.name),
          el("span", { className: "meta" }, player.position || "—"),
        ),
        el("span", { className: "player-score" }, badge),
      );
      playerList.append(el("li", {}, button));
    });
  }

  async function loadStaff() {
    if (state.role !== "coach") {
      return;
    }
    const data = await request("/api/staff");
    state.staff = data.staff || [];
    renderStaff();
  }

  function renderStaff() {
    if (!staffList) {
      return;
    }
    staffList.replaceChildren();
    if (!state.staff.length) {
      staffList.append(el("li", { className: "staff-empty meta" }, "No staff added yet."));
      return;
    }
    state.staff.forEach((member) => {
      const meta = [member.role, member.contact].filter(Boolean).join(" · ");
      const remove = el(
        "button",
        {
          type: "button",
          className: "btn btn-danger staff-remove",
          title: `Remove ${member.name}`,
          "aria-label": `Remove ${member.name}`,
          onClick: () => removeStaff(member),
        },
        "Remove",
      );
      const info = el(
        "div",
        { className: "staff-info" },
        el(
          "div",
          { className: "staff-top" },
          el("strong", {}, member.name),
          el("span", { className: "staff-access" }, member.access_level || ""),
        ),
        meta ? el("div", { className: "meta staff-meta" }, meta) : null,
      );
      staffList.append(el("li", { className: "staff-item" }, info, remove));
    });
  }

  async function removeStaff(member) {
    if (!window.confirm(`Remove ${member.name} from staff?`)) {
      return;
    }
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      await loadStaff();
    } catch (error) {
      showError(error.message);
    }
  }

  function scoreDots(skillId, current, readOnly) {
    const row = el("div", { className: "dots", role: "group", "aria-label": "Rate 1 to 5" });
    const value = current ? Math.max(0, Math.min(5, Number(current))) : 0;
    const level = value ? Math.max(1, Math.min(5, Math.round(value))) : 0;
    for (let dot = 1; dot <= 5; dot += 1) {
      let cls = "dot";
      if (value >= dot) {
        cls += ` on full score-${level}`;
      } else if (value >= dot - 0.5) {
        cls += ` on half score-${level}`;
      }
      const attrs = {
        type: "button",
        className: cls,
        title: `Rate ${dot} (click left half for ${dot - 0.5})`,
        "aria-label": `Rate up to ${dot} out of 5`,
      };
      if (readOnly) {
        attrs.disabled = true;
        attrs.className += " static";
      } else {
        attrs.onClick = (event) => {
          const target = event.currentTarget;
          const rect = target.getBoundingClientRect();
          const leftHalf = event.clientX - rect.left < rect.width / 2;
          saveRating(skillId, leftHalf ? dot - 0.5 : dot);
        };
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
          fill: ring === rings ? "rgba(34,211,238,0.03)" : "none",
          stroke: ring === rings ? "#274152" : "#1c2735",
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
        stroke: "#1c2735",
        "stroke-width": 1,
      });
    });

    // Value vertices, each carrying its own score color.
    const verts = items.map((item, index) => {
      const [x, y] = point(index, (item.value || 0) / maxScore);
      return { x, y, color: scoreColor(item.value) };
    });

    // Unique id prefix so multiple gradients never collide.
    const uid = "rg" + Math.random().toString(36).slice(2, 8);

    // Per-edge linear gradients that blend each vertex color into the next,
    // making the shape multi-colored to match the skill ratings.
    const gradientDefs = [];
    const fillSectors = [];
    const edges = [];
    for (let i = 0; i < verts.length; i += 1) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const gid = `${uid}-${i}`;
      gradientDefs.push(
        svgEl(
          "linearGradient",
          {
            id: gid,
            gradientUnits: "userSpaceOnUse",
            x1: a.x.toFixed(1),
            y1: a.y.toFixed(1),
            x2: b.x.toFixed(1),
            y2: b.y.toFixed(1),
          },
          svgEl("stop", { offset: "0", "stop-color": a.color }),
          svgEl("stop", { offset: "1", "stop-color": b.color }),
        ),
      );
      // Triangle from center to this edge tiles the (star-shaped) value area.
      fillSectors.push(
        svgEl("polygon", {
          points: `${center},${center} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
          fill: `url(#${gid})`,
          "fill-opacity": "0.26",
          stroke: "none",
        }),
      );
      edges.push(
        svgEl("line", {
          x1: a.x.toFixed(1),
          y1: a.y.toFixed(1),
          x2: b.x.toFixed(1),
          y2: b.y.toFixed(1),
          stroke: `url(#${gid})`,
          "stroke-width": 2.5,
          "stroke-linecap": "round",
        }),
      );
    }

    const dots = verts.map((v) =>
      svgEl("circle", {
        cx: v.x.toFixed(1),
        cy: v.y.toFixed(1),
        r: 3.8,
        fill: v.color,
        stroke: "#0b1019",
        "stroke-width": 1,
      }),
    );

    const labels = items.map((item, index) => {
      const [x, y] = point(index, 1.14);
      const anchor = Math.abs(x - center) < 8 ? "middle" : x > center ? "start" : "end";
      return svgEl(
        "text",
        {
          x: x.toFixed(1),
          y: y.toFixed(1),
          "text-anchor": anchor,
          "dominant-baseline": "middle",
          "font-size": "12",
          fill: "#9fb0c0",
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
      svgEl("defs", {}, ...gradientDefs),
      ...gridRings,
      ...spokes,
      ...fillSectors,
      ...edges,
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

    const metrics = computeMetrics(player);
    const hero = renderHero(player, actions, metrics);
    const statTiles = renderStatTiles(metrics);

    const skills = el(
      "section",
      { className: "card skills-card" },
      el("h2", {}, "Skills and ratings"),
      el(
        "p",
        { className: "meta" },
        readOnly
          ? "Your latest rating for each skill (1–5)."
          : "Click a circle to rate (1–5); click its left half for a half point (e.g. 3.5). Older ratings stay in Progress.",
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
      { className: "card radar-card" },
      el("h2", {}, "Performance Profile"),
      el("p", { className: "meta" }, "Strengths and weaknesses across every skill at a glance."),
      el("div", { className: "radar-wrap" }, renderRadar(player.progress)),
    );

    const stats = player.stats || { offense: [], defense: [] };
    const statsCard = readOnly
      ? el(
          "section",
          { className: "card stats-card" },
          el("h2", {}, "GameChanger stats"),
          statsReadOnly("Offense", stats.offense || []),
          statsReadOnly("Defense", stats.defense || []),
        )
      : el(
          "section",
          { className: "card stats-card" },
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
      { className: "card progress-card" },
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

    let notesCard;
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
      notesCard = el("section", { className: "card notes-card" }, el("h2", {}, "Notes"), noteList);
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
      notesCard = el("section", { className: "card notes-card" }, el("h2", {}, "Notes"), noteForm, noteList);
    }

    const dash = el(
      "div",
      { className: "dash" },
      skills,
      radar,
      statsCard,
      progress,
      notesCard,
    );

    const nodes = [hero];
    if (statTiles) {
      nodes.push(statTiles);
    }
    nodes.push(dash);
    main.replaceChildren(...nodes);
  }

  // Map a 1-5 value to a tile accent color name.
  function accentForScore(value) {
    const v = Math.round(Number(value) || 0);
    return { 1: "red", 2: "orange", 3: "yellow", 4: "lime", 5: "green" }[v] || "cyan";
  }

  function computeMetrics(player) {
    const items = player.progress || [];
    const rated = items.filter((item) => item.current);
    const values = rated.map((item) => Number(item.current) || 0);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const overall = Math.round((avg / 5) * 100);
    let top = null;
    let low = null;
    rated.forEach((item) => {
      const v = Number(item.current) || 0;
      if (!top || v > top.value) {
        top = { name: item.skill_name || "Skill", value: v };
      }
      if (!low || v < low.value) {
        low = { name: item.skill_name || "Skill", value: v };
      }
    });
    const spark = items.map((item) => Number(item.current) || 0);
    const stats = player.stats || {};
    const findStat = (abbr) => {
      const groups = [stats.offense || [], stats.defense || []];
      for (const group of groups) {
        const found = group.find((s) => (s.abbr || "").toUpperCase() === abbr);
        if (found && found.display !== undefined && found.display !== null && found.display !== "") {
          return found.display;
        }
      }
      return null;
    };
    return { rated: rated.length, total: items.length, avg, overall, top, low, spark, findStat };
  }

  function metricTile(opts) {
    const children = [
      el("span", { className: "ribbon" }),
      el("div", { className: "tile-label" }, opts.label),
      el(
        "div",
        {},
        el("span", { className: "tile-value" }, opts.value),
        opts.unit ? el("span", { className: "tile-unit" }, opts.unit) : null,
      ),
    ];
    if (opts.spark && opts.spark.length) {
      children.push(
        el(
          "div",
          { className: "spark" },
          opts.spark.map((v) =>
            el("i", { style: `height:${Math.max(10, Math.round(((Number(v) || 0) / 5) * 100))}%` }),
          ),
        ),
      );
    }
    if (opts.foot) {
      children.push(el("div", { className: "tile-foot" }, opts.foot));
    }
    return el("div", { className: `tile ${opts.accent || "cyan"}` }, ...children);
  }

  function renderHero(player, actions, m) {
    const tags = [el("span", { className: "tag on" }, `Overall ${m.overall}%`)];
    if (player.team_year) {
      tags.push(el("span", { className: "tag" }, `${player.team_year} season`));
    }
    if (player.has_access_code) {
      tags.push(el("span", { className: "tag on" }, "Access on"));
    } else {
      tags.push(el("span", { className: "tag" }, "No access code"));
    }
    const idPanel = el(
      "section",
      { className: "card hero-id" },
      el("div", { className: "hero-num" }, jersey(player) || "—"),
      el("div", { className: "hero-name" }, player.name),
      el("div", { className: "hero-sub" }, positionLabel(player) || "Athlete"),
      el("div", { className: "tags" }, tags),
      actions.length ? el("div", { className: "row", style: "margin-top:0.7rem" }, actions) : null,
    );

    const tiles = el(
      "div",
      { className: "tiles" },
      metricTile({
        label: "Overall",
        value: m.overall,
        unit: "%",
        accent: "cyan",
        spark: m.spark.length ? m.spark : null,
        foot: `${m.rated}/${m.total} skills rated`,
      }),
      metricTile({
        label: "Avg Rating",
        value: m.avg ? m.avg.toFixed(1) : "0.0",
        unit: "/5",
        accent: accentForScore(m.avg),
        foot: "Across rated skills",
      }),
      metricTile({
        label: "Skills Rated",
        value: m.rated,
        unit: `/ ${m.total}`,
        accent: "blue",
        foot: m.total ? `${Math.round((m.rated / m.total) * 100)}% coverage` : "No skills yet",
      }),
      metricTile({
        label: "Top Skill",
        value: m.top ? m.top.value : "—",
        unit: m.top ? "/5" : "",
        accent: "green",
        foot: m.top ? m.top.name : "Rate a skill",
      }),
      metricTile({
        label: "Focus Area",
        value: m.low ? m.low.value : "—",
        unit: m.low ? "/5" : "",
        accent: m.low ? accentForScore(m.low.value) : "orange",
        foot: m.low ? m.low.name : "Rate a skill",
      }),
    );

    return el("div", { className: "hero" }, idPanel, tiles);
  }

  // Secondary tile row from GameChanger computed stats, when present.
  function renderStatTiles(m) {
    const specs = [
      { abbr: "AVG", label: "Batting Avg", accent: "yellow" },
      { abbr: "OBP", label: "On-Base %", accent: "cyan" },
      { abbr: "SLG", label: "Slugging", accent: "orange" },
      { abbr: "OPS", label: "OPS", accent: "lime" },
      { abbr: "FLD%", label: "Fielding %", accent: "green" },
    ];
    const tiles = specs
      .map((spec) => {
        const display = m.findStat(spec.abbr);
        if (display === null) {
          return null;
        }
        return metricTile({ label: spec.label, value: display, accent: spec.accent, foot: "GameChanger" });
      })
      .filter(Boolean);
    if (!tiles.length) {
      return null;
    }
    return el("div", { className: "tiles" }, tiles);
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
    const position = window.prompt("Primary position", state.detail.position);
    if (position === null) {
      return;
    }
    const secondaryPosition = window.prompt(
      "Secondary position (blank for none)",
      state.detail.secondary_position || "",
    );
    if (secondaryPosition === null) {
      return;
    }
    const number = window.prompt("Jersey number (blank to clear)", state.detail.number ?? "");
    if (number === null) {
      return;
    }
    const teamYear = window.prompt(
      "Team year (blank to clear)",
      state.detail.team_year || "",
    );
    if (teamYear === null) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          position,
          secondary_position: secondaryPosition,
          team_year: teamYear,
          number,
        }),
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
      sessionLabel.textContent = "Signed in as Coach";
      loadPlayers().catch((error) => showError(error.message));
      loadStaff().catch((error) => showError(error.message));
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
    doLogin({ mode: "coach", password: document.getElementById("coach-password").value });
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await request("/api/logout", { method: "POST" });
    } catch (_error) {
      /* ignore */
    }
    showLogin();
  });

  // Open one admin panel at a time and focus its first field.
  addPanel.addEventListener("toggle", () => {
    if (addPanel.open) {
      importPanel.open = false;
      staffPanel.open = false;
      document.getElementById("player-name").focus();
    }
  });

  importPanel.addEventListener("toggle", () => {
    if (importPanel.open) {
      addPanel.open = false;
      staffPanel.open = false;
      rosterText.focus();
    }
  });

  staffPanel.addEventListener("toggle", () => {
    if (staffPanel.open) {
      addPanel.open = false;
      importPanel.open = false;
      document.getElementById("staff-name").focus();
    }
  });

  cancelAdd.addEventListener("click", () => {
    addForm.reset();
    addPanel.open = false;
  });

  cancelStaff.addEventListener("click", () => {
    staffForm.reset();
    staffPanel.open = false;
  });

  staffForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(staffForm);
    try {
      await request("/api/staff", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          role: form.get("role"),
          contact: form.get("contact"),
          access_level: form.get("access_level"),
        }),
      });
      staffForm.reset();
      staffPanel.open = false;
      await loadStaff();
    } catch (error) {
      showError(error.message);
    }
  });

  cancelImport.addEventListener("click", () => {
    importForm.reset();
    importPanel.open = false;
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
      importPanel.open = false;
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
          secondary_position: form.get("secondary_position"),
          team_year: form.get("team_year"),
          number: form.get("number"),
        }),
      });
      addForm.reset();
      addPanel.open = false;
      await loadPlayers(created.id);
    } catch (error) {
      showError(error.message);
    }
  });

  bootstrap();
})();
