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
  const addPlayerModal = document.getElementById("add-player-modal");
  const openAddPlayerBtn = document.getElementById("open-add-player");
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
  const staffModal = document.getElementById("staff-modal");
  const openStaffBtn = document.getElementById("open-add-staff");
  const cancelStaff = document.getElementById("cancel-add-staff");
  const staffManageModal = document.getElementById("staff-manage-modal");
  const staffManageList = document.getElementById("staff-manage-list");
  const openManageStaffBtn = document.getElementById("open-manage-staff");
  const closeManageStaffBtn = document.getElementById("close-manage-staff");
  const teamPanel = document.getElementById("team-tools");
  const teamSummary = document.getElementById("team-summary");
  const teamModal = document.getElementById("team-modal");
  const teamForm = document.getElementById("team-form");
  const openTeamBtn = document.getElementById("open-team-info");
  const cancelTeam = document.getElementById("cancel-team-info");
  const drillModal = document.getElementById("drill-modal");
  const drillForm = document.getElementById("drill-form");
  const cancelDrill = document.getElementById("cancel-drill");
  const editPlayerModal = document.getElementById("edit-player-modal");
  const editPlayerForm = document.getElementById("edit-player-form");
  const cancelEditPlayer = document.getElementById("cancel-edit-player");
  const brandTeam = document.getElementById("brand-team");
  let drillTargetId = null;

  const state = {
    players: [],
    staff: [],
    team: {},
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
      const details = [member.role, member.contact].filter(Boolean).join(" · ");
      const meta = [details, member.has_password ? "Password set" : "No password"]
        .filter(Boolean)
        .join(" · ");
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
      staffList.append(el("li", { className: "staff-item" }, info));
    });
  }

  async function removeStaff(member) {
    if (!window.confirm(`Remove ${member.name} from staff?`)) {
      return;
    }
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      await loadStaff();
      renderManageStaff();
    } catch (error) {
      showError(error.message);
    }
  }

  async function setStaffPassword(member, password) {
    const value = (password || "").trim();
    if (value.length < 4) {
      showError("Password must be at least 4 characters");
      return;
    }
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: value }),
      });
      await loadStaff();
      renderManageStaff();
    } catch (error) {
      showError(error.message);
    }
  }

  async function clearStaffPassword(member) {
    if (!window.confirm(`Clear ${member.name}'s access password?`)) {
      return;
    }
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}/password`, {
        method: "DELETE",
      });
      await loadStaff();
      renderManageStaff();
    } catch (error) {
      showError(error.message);
    }
  }

  function renderManageStaff() {
    if (!staffManageList) {
      return;
    }
    staffManageList.replaceChildren();
    if (!state.staff.length) {
      staffManageList.append(
        el("li", { className: "staff-empty meta" }, "No staff added yet."),
      );
      return;
    }
    state.staff.forEach((member) => {
      const details = [member.role, member.contact].filter(Boolean).join(" · ");
      const info = el(
        "div",
        { className: "staff-info" },
        el(
          "div",
          { className: "staff-top" },
          el("strong", {}, member.name),
          el("span", { className: "staff-access" }, member.access_level || ""),
        ),
        el(
          "div",
          { className: "meta staff-meta" },
          [details, member.has_password ? "Password set" : "No password"]
            .filter(Boolean)
            .join(" · "),
        ),
      );

      const pwInput = el("input", {
        type: "password",
        className: "staff-pw-input",
        placeholder: member.has_password ? "New password" : "Set password",
        maxLength: 128,
        autocomplete: "new-password",
      });
      const setBtn = el(
        "button",
        {
          type: "button",
          className: "btn btn-primary staff-pw-set",
          onClick: () => {
            setStaffPassword(member, pwInput.value).then(() => {
              pwInput.value = "";
            });
          },
        },
        member.has_password ? "Update" : "Set",
      );
      const controls = [pwInput, setBtn];
      if (member.has_password) {
        controls.push(
          el(
            "button",
            {
              type: "button",
              className: "btn staff-pw-clear",
              onClick: () => clearStaffPassword(member),
            },
            "Clear",
          ),
        );
      }
      controls.push(
        el(
          "button",
          {
            type: "button",
            className: "btn btn-danger staff-remove",
            onClick: () => removeStaff(member),
          },
          "Remove",
        ),
      );

      const controlRow = el("div", { className: "staff-manage-controls" }, ...controls);
      staffManageList.append(
        el("li", { className: "staff-manage-item" }, info, controlRow),
      );
    });
  }

  async function loadTeam() {
    if (!state.role) {
      return;
    }
    const data = await request("/api/team");
    state.team = data.team || {};
    renderTeamSummary();
    renderBrandTeam();
  }

  // Show the current team + season under the header title (all signed-in users).
  function renderBrandTeam() {
    if (!brandTeam) {
      return;
    }
    const team = state.team || {};
    const when = [team.season, team.year].filter(Boolean).join(" ");
    const label = [team.name, when].filter(Boolean).join(" \u00b7 ");
    if (label) {
      brandTeam.textContent = label;
      brandTeam.classList.remove("hidden");
    } else {
      brandTeam.textContent = "";
      brandTeam.classList.add("hidden");
    }
  }

  function renderTeamSummary() {
    if (!teamSummary) {
      return;
    }
    teamSummary.replaceChildren();
    const team = state.team || {};
    const rows = [
      ["Team", team.name],
      ["Year", team.year],
      ["Season", team.season],
      ["Years of play", team.play_year],
    ];
    const hasAny = rows.some(([, value]) => value);
    if (!hasAny) {
      teamSummary.append(
        el("div", { className: "team-empty meta" }, "No team information yet."),
      );
      return;
    }
    rows.forEach(([label, value]) => {
      teamSummary.append(el("dt", {}, label));
      teamSummary.append(el("dd", { className: value ? "" : "meta" }, value || "Not set"));
    });
  }

  function openTeamModal() {
    const team = state.team || {};
    document.getElementById("team-name").value = team.name || "";
    document.getElementById("team-year-input").value = team.year || "";
    document.getElementById("team-season").value = team.season || "";
    document.getElementById("team-play-year").value = team.play_year || "";
    if (typeof teamModal.showModal === "function") {
      teamModal.showModal();
    } else {
      teamModal.setAttribute("open", "");
    }
    document.getElementById("team-name").focus();
  }

  function closeTeamModal() {
    if (teamModal.open) {
      teamModal.close();
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
    // Square drawing area for the rings, with extra horizontal padding baked
    // into the viewBox so the long side labels always fit inside the SVG (and
    // never spill past the card / viewport when the chart is enlarged).
    const size = 320;
    const padX = 70;
    const viewW = size + padX * 2;
    const cx = viewW / 2;
    const cy = size / 2;
    const radius = cy - 34;
    const maxScore = 5;
    const rings = 5;
    const angleFor = (index) => (Math.PI * 2 * index) / items.length - Math.PI / 2;
    const point = (index, ratio) => {
      const angle = angleFor(index);
      return [cx + radius * ratio * Math.cos(angle), cy + radius * ratio * Math.sin(angle)];
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
        x1: cx,
        y1: cy,
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
          points: `${cx},${cy} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
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
      const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
      return svgEl(
        "text",
        {
          x: x.toFixed(1),
          y: y.toFixed(1),
          "text-anchor": anchor,
          "dominant-baseline": "middle",
          "font-size": "10",
          fill: "#9fb0c0",
        },
        `${item.label} (${item.value || 0})`,
      );
    });

    const svg = svgEl(
      "svg",
      {
        viewBox: `0 0 ${viewW} ${size}`,
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
            el(
              "div",
              { className: "skill-main" },
              el("h3", {}, item.skill_name || "Skill"),
              scoreDots(item.skill_id, item.current, readOnly),
              el(
                "div",
                { className: "meta" },
                item.current ? `${item.current} / 5` : "Not rated yet",
              ),
            ),
            skillMetric(player, item.skill_name || "", readOnly),
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

    const activity = player.activity || [];
    const activityBlock = activity.length
      ? el(
          "div",
          { className: "activity" },
          el("h3", { className: "activity-title" }, "Drill activity"),
          el(
            "ul",
            { className: "activity-list" },
            activity.map((entry) =>
              el(
                "li",
                { className: "activity-item" },
                el("span", { className: "activity-text" }, entry.text || ""),
                el("span", { className: "activity-when meta" }, formatWhen(entry.created_at)),
              ),
            ),
          ),
        )
      : null;

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
      activityBlock,
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
    const avgTrend = computeAvgTrend(weeklyAvgSeries(player));
    return { rated: rated.length, total: items.length, avg, overall, top, low, spark, avgTrend, findStat };
  }

  // Reconstruct the player's average rating at the end of each week from the raw
  // rating history (latest score per skill as of that moment, averaged).
  function weeklyAvgSeries(player) {
    const ratings = (player.ratings || [])
      .map((r) => ({ skill: r.skill_id, score: Number(r.score) || 0, t: Date.parse(r.created_at) }))
      .filter((r) => r.skill && !Number.isNaN(r.t))
      .sort((a, b) => a.t - b.t);
    if (ratings.length < 2) {
      return [];
    }
    const WEEK = 7 * 24 * 3600 * 1000;
    const tMin = ratings[0].t;
    const tMax = Math.max(ratings[ratings.length - 1].t, Date.now());
    const bounds = [tMin];
    for (let t = tMin + WEEK; t < tMax; t += WEEK) {
      bounds.push(t);
    }
    bounds.push(tMax);
    const avgAsOf = (t) => {
      const latest = new Map();
      for (const r of ratings) {
        if (r.t <= t) {
          latest.set(r.skill, r.score);
        } else {
          break;
        }
      }
      const vals = [...latest.values()];
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const series = bounds.map(avgAsOf).filter((v) => v !== null);
    // Keep at most the last 10 weekly points for a compact sparkline.
    return series.slice(-10);
  }

  // Compare the two most recent weekly averages to derive a direction + percent.
  function computeAvgTrend(series) {
    if (!series || series.length < 2) {
      return { series: series || [], direction: "flat", pct: 0 };
    }
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const delta = last - prev;
    const eps = 0.049; // ratings move in 0.5 steps; ignore floating-point noise
    const direction = delta > eps ? "up" : delta < -eps ? "down" : "flat";
    const pct = prev > 0 ? Math.round((delta / prev) * 100) : last > 0 ? 100 : 0;
    return { series, direction, pct };
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
    if (opts.trend && opts.trend.series && opts.trend.series.length >= 2) {
      children.push(trendTag(opts.trend), trendSpark(opts.trend));
    }
    if (opts.records && opts.records.length) {
      const prs = prList(opts.records);
      if (prs) {
        children.push(prs);
      }
    }
    if (opts.foot) {
      children.push(el("div", { className: "tile-foot" }, opts.foot));
    }
    return el("div", { className: `tile ${opts.accent || "cyan"}` }, ...children);
  }

  // Render personal-record (PR) notes inside a metric tile, newest first.
  function prList(records) {
    const fmt = (n) => {
      const num = Number(n);
      return Number.isInteger(num) ? String(num) : num.toFixed(2);
    };
    const items = records
      // A record without a delta is a legacy first-entry baseline, not a real PR.
      .filter((rec) => rec.delta !== null && rec.delta !== undefined)
      .slice(0, 6)
      .map((rec) => {
      const unit = rec.unit ? ` ${rec.unit}` : "";
      const num = Number(rec.delta);
      const sign = num > 0 ? "+" : num < 0 ? "\u2212" : "";
      // The achieved value (e.g. "48 MPH") plus the change (e.g. "(+2)").
      const value = `${fmt(rec.value)}${unit}`;
      const change = `(${sign}${fmt(Math.abs(num))})`;
      return el(
        "li",
        { className: "pr-item" },
        el("span", { className: "pr-arrow" }, "\u25B2"),
        el(
          "span",
          { className: "pr-text" },
          el("span", { className: "pr-title" }, "New PR"),
          " \u2014 ",
          el("span", { className: "pr-name" }, rec.label),
          " ",
          el("span", { className: "pr-value" }, value),
          " ",
          el("span", { className: "pr-delta" }, change),
        ),
      );
    });
    if (!items.length) {
      return null;
    }
    return el(
      "ul",
      { className: "pr-list" },
      ...items,
    );
  }

  // A small "week over week" indicator: arrow + percent change.
  function trendTag(trend) {
    const glyph = trend.direction === "up" ? "\u25B2" : trend.direction === "down" ? "\u25BC" : "\u2014";
    const pct = `${trend.pct > 0 ? "+" : ""}${trend.pct}%`;
    return el(
      "div",
      { className: `trend-tag ${trend.direction}` },
      el("span", { className: "trend-arrow" }, glyph),
      el("span", { className: "trend-pct" }, pct),
      el("span", { className: "trend-note" }, "week over week"),
    );
  }

  // A line sparkline of the weekly average rating that fills the tile body.
  function trendSpark(trend) {
    const s = trend.series;
    const n = s.length;
    let lo = Math.min(...s);
    let hi = Math.max(...s);
    if (hi - lo < 1) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
    const W = 100;
    const H = 100;
    const pad = 8;
    const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const yAt = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
    const pts = s.map((v, i) => [xAt(i), yAt(v)]);
    const lineD = smoothPathD(pts);
    const areaD = `${lineD} L ${W},${H} L 0,${H} Z`;
    const area = svgEl("path", { d: areaD, class: "trend-area" });
    const line = svgEl("path", {
      d: lineD,
      class: "trend-line",
      fill: "none",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke",
    });
    return svgEl(
      "svg",
      {
        viewBox: `0 0 ${W} ${H}`,
        class: "trend-spark",
        preserveAspectRatio: "none",
        "aria-hidden": "true",
      },
      area,
      line,
    );
  }

  // Build a smoothed (Catmull-Rom -> cubic Bezier) SVG path through the points
  // so the trendline curves gently instead of forming sharp peaks and valleys.
  function smoothPathD(pts) {
    if (!pts.length) {
      return "";
    }
    if (pts.length < 3) {
      return "M " + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");
    }
    const t = 1 / 6; // tension; lower = tighter to the points
    const d = [`M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t;
      const c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t;
      const c2y = p2[1] - (p3[1] - p1[1]) * t;
      d.push(
        `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ` +
          `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`,
      );
    }
    return d.join(" ");
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
        records: Array.isArray(player.records) ? player.records : null,
        foot: `${m.rated}/${m.total} skills rated`,
      }),
      metricTile({
        label: "Avg Rating",
        value: m.avg ? m.avg.toFixed(1) : "0.0",
        unit: "/5",
        accent: accentForScore(m.avg),
        trend: m.avgTrend,
        foot: "Across rated skills",
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
      drillsTile(player),
    );

    return el("div", { className: "hero" }, idPanel, tiles);
  }

  // Only http(s) links may become clickable anchors (blocks javascript:/data:).
  function safeLink(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url.trim());
  }

  // "Skills Assigned" tile: a bulleted list of up to 10 development drills.
  // Compact the free-text drill cadence for display, e.g.
  // "3x per week" -> "3x-pw", "Daily warmup" -> "Daily", "Weekly" -> "pw".
  function abbreviateFreq(text) {
    if (!text) {
      return "";
    }
    let s = String(text).trim();
    if (/\bdaily\b/i.test(s)) {
      return "Daily";
    }
    s = s
      .replace(/\btimes\b/gi, "x")
      .replace(/\bper\s*week\b/gi, "pw")
      .replace(/\bper\s*day\b/gi, "pd")
      .replace(/\bper\s*month\b/gi, "pm")
      .replace(/\bweekly\b/gi, "pw")
      .replace(/\bmonthly\b/gi, "pm")
      .replace(/\/\s*week\b/gi, "-pw")
      .replace(/\/\s*day\b/gi, "-pd")
      .replace(/\/\s*month\b/gi, "-pm");
    // Join a count like "3x pw" into "3x-pw".
    s = s.replace(/(\d+)\s*x\s*[-\s]*\s*(pw|pd|pm)\b/gi, "$1x-$2");
    return s.replace(/\s+/g, " ").trim();
  }

  function drillsTile(player) {
    const readOnly = isReadOnly();
    const drills = Array.isArray(player.drills) ? player.drills : [];
    const children = [
      el("span", { className: "ribbon" }),
      el("div", { className: "tile-label" }, "Skills Assigned"),
    ];
    if (!drills.length) {
      children.push(el("div", { className: "drill-empty meta" }, "No drills assigned yet."));
    } else {
      children.push(
        el(
          "div",
          { className: "drill-head" },
          el("span", { className: "drill-head-name" }, "Skill Name"),
          el("span", { className: "drill-head-dur" }, "Duration"),
        ),
      );
      const list = el("ul", { className: "drill-list" });
      drills.slice(0, 10).forEach((drill) => {
        const label = safeLink(drill.link)
          ? el(
              "a",
              {
                className: "drill-link",
                href: drill.link,
                target: "_blank",
                rel: "noopener noreferrer",
                onClick: () => logDrillOpen(player.id, drill.name),
              },
              drill.name,
            )
          : el("span", { className: "drill-name" }, drill.name);
        const freq = el(
          "span",
          { className: "drill-freq meta", title: drill.frequency || "" },
          abbreviateFreq(drill.frequency) || "\u2014",
        );
        const remove = readOnly
          ? null
          : el(
              "button",
              {
                type: "button",
                className: "drill-remove",
                title: `Remove ${drill.name}`,
                "aria-label": `Remove ${drill.name}`,
                onClick: () => removeDrill(player.id, drill),
              },
              "\u00d7",
            );
        list.append(
          el(
            "li",
            { className: "drill-item" },
            el("span", { className: "drill-name-cell" }, label),
            el("span", { className: "drill-dur-cell" }, freq, remove),
          ),
        );
      });
      children.push(list);
    }
    if (!readOnly) {
      const full = drills.length >= 10;
      children.push(
        el(
          "div",
          { className: "drill-actions" },
          el(
            "button",
            {
              type: "button",
              className: "btn drill-add",
              disabled: full || undefined,
              onClick: () => openDrillModal(player.id),
            },
            full ? "Max 10 drills" : "Add drill",
          ),
        ),
      );
    }
    return el("div", { className: "tile blue drill-tile" }, ...children);
  }

  async function removeDrill(playerId, drill) {
    if (!window.confirm(`Remove drill "${drill.name}"?`)) {
      return;
    }
    try {
      await request(
        `/api/players/${encodeURIComponent(playerId)}/drills/${encodeURIComponent(drill.id)}`,
        { method: "DELETE" },
      );
      await loadDetail(state.selectedId);
    } catch (error) {
      showError(error.message);
    }
  }

  function openDrillModal(playerId) {
    drillTargetId = playerId;
    drillForm.reset();
    if (typeof drillModal.showModal === "function") {
      drillModal.showModal();
    } else {
      drillModal.setAttribute("open", "");
    }
    document.getElementById("drill-name").focus();
  }

  function closeDrillModal() {
    if (drillModal.open) {
      drillModal.close();
    }
    drillForm.reset();
    drillTargetId = null;
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

  // Per-skill editable metric shown on the far right of a skill box.
  const SKILL_METRICS = {
    Hitting: {
      key: "exit_velo",
      heading: "Exit Velo",
      unit: "MPH",
      min: 0,
      max: 200,
      step: 0.01,
      aria: "Exit velocity in MPH",
    },
    "Base running": {
      key: "base_time",
      heading: "Time",
      unit: "(s)",
      min: 0,
      max: 60,
      step: 0.01,
      aria: "Base-running time in seconds",
    },
    Pitching: {
      key: "pitch_velo",
      heading: "Velocity",
      unit: "MPH",
      min: 0,
      max: 200,
      step: 0.01,
      aria: "Pitching velocity in MPH",
    },
    Throwing: {
      key: "throw_speed",
      heading: "Throw Speed",
      unit: "MPH",
      min: 0,
      max: 200,
      step: 0.01,
      aria: "Throwing speed in MPH",
    },
  };

  function metricDisplay(value) {
    return value === "" || value === null || value === undefined ? "—" : String(value);
  }

  function skillMetric(player, skillName, readOnly) {
    const spec = SKILL_METRICS[skillName];
    if (!spec) {
      return null;
    }
    return el(
      "div",
      { className: "skill-metric" },
      el("h3", {}, spec.heading),
      metricField(player, readOnly, spec),
      el("div", { className: "skill-metric-unit" }, spec.unit),
    );
  }

  function metricField(player, readOnly, spec) {
    const value = player[spec.key];
    if (readOnly) {
      return el("div", { className: "skill-metric-value" }, metricDisplay(value));
    }
    const input = el("input", {
      type: "number",
      className: "skill-metric-input",
      min: String(spec.min),
      max: String(spec.max),
      step: String(spec.step),
      placeholder: "—",
      "aria-label": spec.aria,
      value: value === "" || value === null || value === undefined ? "" : String(value),
    });
    input.addEventListener("change", () => saveMetric(spec.key, input));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
    return input;
  }

  // Save a single metric without re-rendering the whole detail, so the value the
  // coach entered stays put (and is replaced by the server's normalized value).
  async function saveMetric(key, input) {
    if (!state.selectedId) {
      return;
    }
    try {
      const updated = await request(
        `/api/players/${encodeURIComponent(state.selectedId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ [key]: input.value.trim() }),
        },
      );
      const saved = updated && key in updated ? updated[key] : input.value.trim();
      if (state.detail) {
        state.detail[key] = saved;
      }
      input.value = saved === "" || saved === null || saved === undefined ? "" : String(saved);
      // Refresh so any new personal-record note shows in the Overall tile.
      await loadDetail(state.selectedId);
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

  // Log an entry in the Progress section whenever a drill link is opened. The
  // link still opens in a new tab; logging is best-effort and never blocks it.
  async function logDrillOpen(playerId, name) {
    try {
      await request(`/api/players/${encodeURIComponent(playerId)}/activity`, {
        method: "POST",
        body: JSON.stringify({ text: `Reviewed drill: ${name}` }),
      });
      if (state.selectedId === playerId) {
        await loadDetail(playerId);
      }
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

  function editPlayer() {
    if (!state.detail || !editPlayerModal) {
      return;
    }
    const p = state.detail;
    editPlayerForm.reset();
    editPlayerForm.elements.name.value = p.name || "";
    editPlayerForm.elements.position.value = p.position || "";
    editPlayerForm.elements.secondary_position.value = p.secondary_position || "";
    editPlayerForm.elements.number.value =
      p.number === null || p.number === undefined ? "" : p.number;
    editPlayerForm.elements.team_year.value = p.team_year || "";
    if (typeof editPlayerModal.showModal === "function") {
      editPlayerModal.showModal();
    } else {
      editPlayerModal.setAttribute("open", "");
    }
    editPlayerForm.elements.name.focus();
  }

  function closeEditPlayer() {
    if (editPlayerModal && editPlayerModal.open) {
      editPlayerModal.close();
    }
    editPlayerForm.reset();
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
    state.team = {};
    renderBrandTeam();
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
    // Team + season appears in the header for both roles.
    loadTeam().catch((error) => showError(error.message));
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
  importPanel.addEventListener("toggle", () => {
    if (importPanel.open) {
      staffPanel.open = false;
      if (teamPanel) teamPanel.open = false;
      rosterText.focus();
    }
  });

  staffPanel.addEventListener("toggle", () => {
    if (staffPanel.open) {
      importPanel.open = false;
      if (teamPanel) teamPanel.open = false;
    }
  });

  if (teamPanel) {
    teamPanel.addEventListener("toggle", () => {
      if (teamPanel.open) {
        importPanel.open = false;
        staffPanel.open = false;
      }
    });
  }

  // Add-player modal open/close.
  function openAddPlayerModal() {
    addForm.reset();
    if (typeof addPlayerModal.showModal === "function") {
      addPlayerModal.showModal();
    } else {
      addPlayerModal.setAttribute("open", "");
    }
    const nameField = document.getElementById("player-name");
    if (nameField) {
      nameField.focus();
    }
  }

  function closeAddPlayerModal() {
    if (addPlayerModal.open) {
      addPlayerModal.close();
    } else {
      addPlayerModal.removeAttribute("open");
    }
  }

  if (openAddPlayerBtn) {
    openAddPlayerBtn.addEventListener("click", openAddPlayerModal);
  }

  addPlayerModal.addEventListener("click", (event) => {
    if (event.target === addPlayerModal) {
      closeAddPlayerModal();
    }
  });

  function openStaffModal() {
    staffForm.reset();
    if (typeof staffModal.showModal === "function") {
      staffModal.showModal();
    } else {
      staffModal.setAttribute("open", "");
    }
    document.getElementById("staff-name").focus();
  }

  function closeStaffModal() {
    if (staffModal.open) {
      staffModal.close();
    }
    staffForm.reset();
  }

  openStaffBtn.addEventListener("click", openStaffModal);

  // Click on the backdrop (outside the form) closes the modal.
  staffModal.addEventListener("click", (event) => {
    if (event.target === staffModal) {
      closeStaffModal();
    }
  });

  function openManageStaffModal() {
    renderManageStaff();
    if (typeof staffManageModal.showModal === "function") {
      staffManageModal.showModal();
    } else {
      staffManageModal.setAttribute("open", "");
    }
  }

  function closeManageStaffModal() {
    if (staffManageModal.open) {
      staffManageModal.close();
    }
  }

  if (openManageStaffBtn) {
    openManageStaffBtn.addEventListener("click", openManageStaffModal);
  }
  if (closeManageStaffBtn) {
    closeManageStaffBtn.addEventListener("click", closeManageStaffModal);
  }
  if (staffManageModal) {
    staffManageModal.addEventListener("click", (event) => {
      if (event.target === staffManageModal) {
        closeManageStaffModal();
      }
    });
  }

  if (openTeamBtn) {
    openTeamBtn.addEventListener("click", openTeamModal);
  }
  if (cancelTeam) {
    cancelTeam.addEventListener("click", closeTeamModal);
  }
  if (teamModal) {
    teamModal.addEventListener("click", (event) => {
      if (event.target === teamModal) {
        closeTeamModal();
      }
    });
  }
  if (teamForm) {
    teamForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(teamForm);
      try {
        await request("/api/team", {
          method: "PUT",
          body: JSON.stringify({
            name: form.get("name"),
            year: form.get("year"),
            season: form.get("season"),
            play_year: form.get("play_year"),
          }),
        });
        closeTeamModal();
        await loadTeam();
      } catch (error) {
        showError(error.message);
      }
    });
  }

  if (cancelDrill) {
    cancelDrill.addEventListener("click", closeDrillModal);
  }
  if (drillModal) {
    drillModal.addEventListener("click", (event) => {
      if (event.target === drillModal) {
        closeDrillModal();
      }
    });
  }
  if (drillForm) {
    drillForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!drillTargetId) {
        return;
      }
      const form = new FormData(drillForm);
      try {
        await request(`/api/players/${encodeURIComponent(drillTargetId)}/drills`, {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            frequency: form.get("frequency"),
            link: form.get("link"),
          }),
        });
        closeDrillModal();
        await loadDetail(state.selectedId);
      } catch (error) {
        showError(error.message);
      }
    });
  }

  if (cancelEditPlayer) {
    cancelEditPlayer.addEventListener("click", closeEditPlayer);
  }
  if (editPlayerModal) {
    editPlayerModal.addEventListener("click", (event) => {
      if (event.target === editPlayerModal) {
        closeEditPlayer();
      }
    });
  }
  if (editPlayerForm) {
    editPlayerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.selectedId) {
        return;
      }
      const form = new FormData(editPlayerForm);
      try {
        await request(`/api/players/${encodeURIComponent(state.selectedId)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.get("name"),
            position: form.get("position"),
            secondary_position: form.get("secondary_position"),
            team_year: form.get("team_year"),
            number: form.get("number"),
          }),
        });
        closeEditPlayer();
        await loadPlayers(state.selectedId);
      } catch (error) {
        showError(error.message);
      }
    });
  }

  cancelAdd.addEventListener("click", () => {
    addForm.reset();
    closeAddPlayerModal();
  });

  cancelStaff.addEventListener("click", closeStaffModal);

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
      closeStaffModal();
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
          grad_year: form.get("grad_year"),
          team_type: form.get("team_type"),
          number: form.get("number"),
        }),
      });
      addForm.reset();
      closeAddPlayerModal();
      await loadPlayers(created.id);
    } catch (error) {
      showError(error.message);
    }
  });

  bootstrap();
})();
