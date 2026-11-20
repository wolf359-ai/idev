(() => {
  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginUsername = document.getElementById("login-username");
  const loginPassword = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const sessionLabel = document.getElementById("session-label");

  const playerList = document.getElementById("player-list");
  const rosterCount = document.getElementById("roster-count");
  const main = document.getElementById("main");
  const emptyState = document.getElementById("empty-state");
  const addForm = document.getElementById("add-player-form");
  const addPlayerModal = document.getElementById("add-player-modal");
  const openAddPlayerBtn = document.getElementById("open-add-player");
  const cancelAdd = document.getElementById("cancel-add-player");
  const importForm = document.getElementById("import-roster-form");
  const adminBtn = document.getElementById("admin-btn");
  const adminModal = document.getElementById("admin-modal");
  const closeAdminBtn = document.getElementById("close-admin");
  const statsModal = document.getElementById("stats-modal");
  const statsModalTitle = document.getElementById("stats-modal-title");
  const statsModalBody = document.getElementById("stats-modal-body");
  const closeStatsBtn = document.getElementById("close-stats");
  const adminTabs = Array.from(document.querySelectorAll(".admin-tab"));
  const playerLoginList = document.getElementById("player-login-list");
  const managePlayerList = document.getElementById("manage-player-list");
  const managePlayerCount = document.getElementById("manage-player-count");
  const cancelImport = document.getElementById("cancel-import-roster");
  const rosterFile = document.getElementById("roster-file");
  const rosterText = document.getElementById("roster-text");
  const rosterPreview = document.getElementById("roster-preview");
  const previewRosterButton = document.getElementById("preview-roster");
  const statsImportForm = document.getElementById("import-stats-form");
  const cancelStatsImport = document.getElementById("cancel-import-stats");
  const statsFile = document.getElementById("stats-file");
  const statsText = document.getElementById("stats-text");
  const statsPreview = document.getElementById("stats-preview");
  const previewStatsButton = document.getElementById("preview-stats");
  const staffForm = document.getElementById("add-staff-form");
  const staffList = document.getElementById("staff-list");
  const staffModal = document.getElementById("staff-modal");
  const openStaffBtn = document.getElementById("open-add-staff");
  const cancelStaff = document.getElementById("cancel-add-staff");
  const staffManageModal = document.getElementById("staff-manage-modal");
  const staffManageList = document.getElementById("staff-manage-list");
  const openManageStaffBtn = document.getElementById("open-manage-staff");
  const closeManageStaffBtn = document.getElementById("close-manage-staff");
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
  const playerLoginModal = document.getElementById("player-login-modal");
  const playerLoginForm = document.getElementById("player-login-form");
  const playerLoginUsername = document.getElementById("player-login-username");
  const playerLoginPassword = document.getElementById("player-login-password");
  const cancelPlayerLogin = document.getElementById("cancel-player-login");
  const noteModal = document.getElementById("note-modal");
  const noteForm = document.getElementById("note-form");
  const noteInput = document.getElementById("note-input");
  const cancelNote = document.getElementById("cancel-note");
  const noteViewModal = document.getElementById("note-view-modal");
  const noteViewWhen = document.getElementById("note-view-when");
  const noteViewText = document.getElementById("note-view-text");
  const closeNoteView = document.getElementById("close-note-view");
  const brandTeam = document.getElementById("brand-team");
  const brandMeta = document.getElementById("brand-meta");
  const alarmBtn = document.getElementById("alarm-btn");
  const alarmBadge = document.getElementById("alarm-badge");
  const alarmModal = document.getElementById("alarm-modal");
  const alarmForm = document.getElementById("alarm-form");
  const alarmTarget = document.getElementById("alarm-target");
  const alarmText = document.getElementById("alarm-text");
  const alarmList = document.getElementById("alarm-list");
  const closeAlarm = document.getElementById("close-alarm");
  const messageBtn = document.getElementById("message-btn");
  const messageBadge = document.getElementById("message-badge");
  const messageModal = document.getElementById("message-modal");
  const messageForm = document.getElementById("message-form");
  const messageAudience = document.getElementById("message-audience");
  const messageRecipientLabel = document.getElementById("message-recipient-label");
  const messageRecipient = document.getElementById("message-recipient");
  const messageBody = document.getElementById("message-body");
  const messageList = document.getElementById("message-list");
  const closeMessage = document.getElementById("close-message");
  let drillTargetId = null;
  let loginTargetId = null;
  let editTargetId = null;
  let noteTargetCategory = "focus";

  const state = {
    players: [],
    staff: [],
    team: {},
    alarms: [],
    messages: [],
    selectedId: null,
    detail: null,
    importReady: false,
    statsImportReady: false,
    role: null,
    player: null,
    csrf: null,
    accessLevel: "",
    can: { admin: false, content: false, view_all: false },
  };

  // Full site access: coach or "Full" staff.
  function canAdmin() {
    return Boolean(state.can && state.can.admin);
  }

  // Ratings, notes, drills, alarms, and messages: admin or "Manager" staff.
  function canContent() {
    return Boolean(state.can && state.can.content);
  }

  // Anyone who cannot edit content (players and view-only staff) is read-only.
  function isReadOnly() {
    return !canContent();
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
      } else if (key === "style") {
        // CSP blocks style attributes; CSSOM assignment is allowed.
        node.style.cssText = value;
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
      if (key === "style") {
        node.style.cssText = value;
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
    rosterPreview.replaceChildren(...[
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
    ].filter(Boolean));
    rosterPreview.classList.remove("hidden");
    state.importReady = players.length > 0;
    previewRosterButton.textContent = state.importReady
      ? `Import ${players.length} player${players.length === 1 ? "" : "s"}`
      : "Preview roster";
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function resetStatsImportPreview() {
    state.statsImportReady = false;
    statsPreview.classList.add("hidden");
    statsPreview.replaceChildren();
    previewStatsButton.textContent = "Preview stats";
  }

  function statsSummary(stats) {
    const parts = [];
    if ("gp" in stats) parts.push(`${stats.gp} GP`);
    if ("ab" in stats && "h" in stats) {
      const avg = stats.ab ? (stats.h / stats.ab).toFixed(3).replace(/^0/, "") : "—";
      parts.push(`${stats.h}-for-${stats.ab} (${avg})`);
    }
    if ("hr" in stats) parts.push(`${stats.hr} HR`);
    if ("rbi" in stats) parts.push(`${stats.rbi} RBI`);
    if ("e" in stats) parts.push(`${stats.e} E`);
    return parts.join(" · ");
  }

  function renderStatsImportPreview(result) {
    const matches = result.matches || [];
    const unmatched = result.unmatched || [];
    const notOnRoster = unmatched.filter((row) => row.reason === "Not on the roster");
    const mismatched = unmatched.filter((row) => row.reason !== "Not on the roster");
    const skipped = result.skipped || [];
    const columns = result.columns || [];
    statsPreview.replaceChildren(...[
      el("strong", {}, `${plural(matches.length, "player")} matched`),
      columns.length ? el("p", { className: "meta" }, `Columns: ${columns.join(", ")}`) : null,
      matches.length
        ? el(
            "ul",
            { className: "import-list" },
            matches.map((match) =>
              el(
                "li",
                {},
                el("span", {}, [jersey(match), match.player_name].filter(Boolean).join(" ")),
                match.rows > 1
                  ? el("span", { className: "meta" }, ` (${match.rows} rows combined)`)
                  : null,
                el("div", { className: "meta" }, statsSummary(match.stats)),
              ),
            ),
          )
        : el("p", { className: "empty" }, "No rows match players on the roster."),
      notOnRoster.length
        ? el(
            "p",
            { className: "meta" },
            `Not on roster (import them with Import roster first): ${notOnRoster
              .slice(0, 5)
              .map((row) => row.name)
              .join(", ")}${notOnRoster.length > 5 ? "…" : ""}`,
          )
        : null,
      mismatched.length
        ? el(
            "div",
            { className: "import-warning" },
            el("strong", {}, `${plural(mismatched.length, "row")} not matched — check the jersey number`),
            el(
              "ul",
              { className: "import-list" },
              mismatched.map((row) =>
                el(
                  "li",
                  {},
                  [jersey(row), row.name].filter(Boolean).join(" "),
                  el("div", { className: "meta" }, row.reason),
                ),
              ),
            ),
          )
        : null,
      skipped.length
        ? el(
            "p",
            { className: "meta" },
            `${plural(skipped.length, "row")} skipped: ${skipped
              .slice(0, 3)
              .map((item) => item.reason)
              .join("; ")}${skipped.length > 3 ? "…" : ""}`,
          )
        : null,
    ].filter(Boolean));
    statsPreview.classList.remove("hidden");
    state.statsImportReady = matches.length > 0;
    previewStatsButton.textContent = state.statsImportReady
      ? `Update ${plural(matches.length, "player")}`
      : "Preview stats";
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

  // Week-over-week change in a player's average rating, as shown in the roster.
  function weekChangeView(change) {
    if (change === null || change === undefined) {
      return { cls: "flat", text: "", label: "No rating from a week ago" };
    }
    const value = Number(change) || 0;
    if (Math.abs(value) < 0.05) {
      return { cls: "flat", text: "", label: "No change since last week" };
    }
    const amount = Math.abs(value).toFixed(1);
    return value > 0
      ? { cls: "up", text: `\u25B2 ${amount}`, label: `Up ${amount} since last week` }
      : { cls: "down", text: `\u25BC ${amount}`, label: `Down ${amount} since last week` };
  }

  function renderRoster() {
    const roster = teamPlayers();
    rosterCount.textContent = roster.length ? ` \u00b7 ${roster.length}` : "";
    playerList.replaceChildren();
    if (!roster.length) {
      return;
    }
    let activeButton = null;
    roster.forEach((player) => {
      const badge = player.number === null || player.number === undefined ? "\u2014" : `#${player.number}`;
      const change = weekChangeView(player.week_change);
      const active = player.id === state.selectedId;
      const button = el(
        "button",
        {
          type: "button",
          className: "player-btn" + (active ? " active" : ""),
          "aria-current": active ? "true" : undefined,
          title: `${player.name}${player.position ? ` \u00b7 ${player.position}` : ""} \u2014 ${change.label}`,
          onClick: () => selectPlayer(player.id),
        },
        el("span", { className: "player-num" }, badge),
        el("span", { className: "player-name" }, player.name),
        el(
          "span",
          { className: `player-delta ${change.cls}` },
          el("span", { "aria-hidden": "true" }, change.text),
          el("span", { className: "sr-only" }, change.label),
        ),
      );
      if (active) {
        activeButton = button;
      }
      playerList.append(el("li", {}, button));
    });
    if (activeButton && playerList.scrollWidth > playerList.clientWidth) {
      activeButton.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  async function loadStaff() {
    // Coaches and staff can browse the roster; players cannot.
    if (state.role === "player" || !state.role) {
      return;
    }
    const data = await request("/api/staff");
    state.staff = data.staff || [];
    renderStaff();
    renderBrandMeta();
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
      // Show how they sign in: their username, or a hint that no login is set.
      const loginBit = member.username
        ? `Login: ${member.username}`
        : member.has_password
          ? "Login: their name"
          : "No login";
      const meta = [details, loginBit, staffTeamsText(member)].filter(Boolean).join(" · ");
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

  async function updateStaffAccess(member, level) {
    if (level === member.access_level) {
      return;
    }
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}`, {
        method: "PUT",
        body: JSON.stringify({ access_level: level }),
      });
      await loadStaff();
      renderManageStaff();
    } catch (error) {
      showError(error.message);
      // Revert the dropdown to the stored value on failure.
      renderManageStaff();
    }
  }

  async function updateStaffIdentity(member, patch, btn) {
    try {
      await request(`/api/staff/${encodeURIComponent(member.id)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      await loadStaff();
      renderManageStaff();
      if (btn) {
        btn.textContent = "Saved";
        setTimeout(() => {
          btn.textContent = "Save";
        }, 1200);
      }
    } catch (error) {
      showError(error.message);
      // Restore the fields to their stored values on failure.
      renderManageStaff();
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
      // Full-access users can change a member's access level in place.
      const accessSelect = el(
        "select",
        {
          className: "staff-access-select",
          "aria-label": `Access level for ${member.name}`,
        },
        ...["Full", "Manager", "Assistant", "Read-only"].map((lvl) =>
          el("option", { value: lvl }, lvl),
        ),
      );
      accessSelect.value = member.access_level || "Full";
      accessSelect.addEventListener("change", () => {
        updateStaffAccess(member, accessSelect.value);
      });
      const info = el(
        "div",
        { className: "staff-info" },
        el(
          "div",
          { className: "staff-top" },
          el("strong", {}, member.name),
          accessSelect,
        ),
        el(
          "div",
          { className: "meta staff-meta" },
          [
            details,
            member.username
              ? `Login: ${member.username}`
              : member.has_password
                ? "Login: their name"
                : "No login",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );

      // Editable email + username for this member (Full-access action).
      const emailInput = el("input", {
        type: "text",
        className: "staff-edit-input",
        value: member.contact || "",
        placeholder: "Email or phone",
        maxLength: 120,
        autocomplete: "off",
        "aria-label": `Email or phone for ${member.name}`,
      });
      const usernameInput = el("input", {
        type: "text",
        className: "staff-edit-input",
        value: member.username || "",
        placeholder: "Username",
        minLength: 3,
        maxLength: 32,
        autocomplete: "off",
        autocapitalize: "none",
        spellcheck: false,
        "aria-label": `Username for ${member.name}`,
      });
      const saveIdentityBtn = el(
        "button",
        { type: "button", className: "btn btn-primary staff-edit-save" },
        "Save",
      );
      saveIdentityBtn.addEventListener("click", () => {
        updateStaffIdentity(
          member,
          {
            contact: emailInput.value.trim(),
            username: usernameInput.value.trim(),
          },
          saveIdentityBtn,
        );
      });
      const identityRow = el(
        "div",
        { className: "staff-manage-edit" },
        el("label", { className: "staff-edit-field" }, "Email", emailInput),
        el("label", { className: "staff-edit-field" }, "Username", usernameInput),
        saveIdentityBtn,
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
        el("li", { className: "staff-manage-item" }, info, identityRow, staffTeamsRow(member), controlRow),
      );
    });
  }

  // ---------- Coach alarms + messages (header bell / envelope) ----------
  function showDialog(modal) {
    if (!modal) return;
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }

  function hideDialog(modal) {
    if (!modal) return;
    if (modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  function unreadCount(items) {
    return (items || []).filter((item) => item && item.read === false).length;
  }

  function setBadge(badge, count) {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // Only players have an unread inbox; coaches are the senders.
  function renderCommBadges() {
    if (state.role === "player") {
      setBadge(alarmBadge, unreadCount(state.alarms));
      setBadge(messageBadge, unreadCount(state.messages));
    } else {
      setBadge(alarmBadge, 0);
      setBadge(messageBadge, 0);
    }
    if (state.role) {
      renderSide();
    }
  }

  function showCommIcons() {
    if (!alarmBtn || !messageBtn) return;
    const show = Boolean(state.role);
    alarmBtn.classList.toggle("hidden", !show);
    messageBtn.classList.toggle("hidden", !show);
  }

  async function loadAlarms() {
    if (!state.role) return;
    try {
      const data = await request("/api/alarms");
      state.alarms = data.alarms || [];
    } catch (_error) {
      state.alarms = [];
    }
    renderCommBadges();
  }

  async function loadMessages() {
    if (!state.role) return;
    try {
      const data = await request("/api/messages");
      state.messages = data.messages || [];
    } catch (_error) {
      state.messages = [];
    }
    renderCommBadges();
  }

  function populateAlarmTargets() {
    if (!alarmTarget) return;
    const current = alarmTarget.value;
    alarmTarget.replaceChildren();
    alarmTarget.append(el("option", { value: "all" }, "All players"));
    state.players.forEach((player) => {
      alarmTarget.append(el("option", { value: player.id }, player.name));
    });
    alarmTarget.value = current || "all";
  }

  function renderAlarmList() {
    if (!alarmList) return;
    alarmList.replaceChildren();
    const items = state.alarms || [];
    if (!items.length) {
      alarmList.append(
        el(
          "li",
          { className: "comm-empty meta" },
          canContent() ? "No alarms yet. Add one above." : "No alarms yet.",
        ),
      );
      return;
    }
    items.forEach((alarm) => {
      const audience =
        alarm.target_name || (alarm.target === "all" ? "All players" : "");
      const meta = [
        formatWhen(alarm.created_at),
        state.role !== "player" && audience ? `To: ${audience}` : null,
      ]
        .filter(Boolean)
        .join(" \u00b7 ");
      const del =
        canContent()
          ? el(
              "button",
              {
                type: "button",
                className: "comm-remove",
                title: "Delete alarm",
                "aria-label": "Delete alarm",
                onClick: () => removeAlarm(alarm.id),
              },
              "\u00d7",
            )
          : null;
      alarmList.append(
        el(
          "li",
          { className: `comm-item${alarm.read === false ? " unread" : ""}` },
          el(
            "div",
            { className: "comm-item-body" },
            el("div", { className: "comm-meta meta" }, meta),
            el("p", { className: "comm-text" }, alarm.text || ""),
          ),
          del,
        ),
      );
    });
  }

  function openAlarmModal() {
    if (!alarmModal) return;
    const canSend = canContent();
    if (alarmForm) alarmForm.classList.toggle("hidden", !canSend);
    if (canSend) populateAlarmTargets();
    renderAlarmList();
    showDialog(alarmModal);
    if (state.role === "player") {
      request("/api/alarms/read", { method: "POST" })
        .then(() => loadAlarms())
        .catch(() => {});
    }
  }

  async function submitAlarm(event) {
    event.preventDefault();
    const text = (alarmText.value || "").trim();
    if (!text) return;
    try {
      await request("/api/alarms", {
        method: "POST",
        body: JSON.stringify({ text, target: alarmTarget.value || "all" }),
      });
      alarmForm.reset();
      if (alarmTarget) alarmTarget.value = "all";
      await loadAlarms();
      renderAlarmList();
    } catch (error) {
      showError(error.message);
    }
  }

  async function removeAlarm(id) {
    if (!window.confirm("Delete this alarm?")) return;
    try {
      await request(`/api/alarms/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadAlarms();
      renderAlarmList();
    } catch (error) {
      showError(error.message);
    }
  }

  function updateMessageRecipient() {
    if (!messageAudience || !messageRecipient || !messageRecipientLabel) return;
    const audience = messageAudience.value;
    const showRecipient = audience === "player" || audience === "staff_member";
    messageRecipientLabel.classList.toggle("hidden", !showRecipient);
    if (!showRecipient) return;
    const source = audience === "player" ? state.players : state.staff;
    messageRecipient.replaceChildren();
    if (!source.length) {
      messageRecipient.append(
        el(
          "option",
          { value: "" },
          audience === "player" ? "No players yet" : "No staff yet",
        ),
      );
      return;
    }
    source.forEach((item) => {
      messageRecipient.append(el("option", { value: item.id }, item.name));
    });
  }

  function messageAudienceLabel(message) {
    switch (message.audience) {
      case "team":
        return "Entire team";
      case "staff":
        return "All staff";
      default:
        return message.recipient_name || "";
    }
  }

  function renderMessageList() {
    if (!messageList) return;
    messageList.replaceChildren();
    const items = state.messages || [];
    if (!items.length) {
      messageList.append(
        el(
          "li",
          { className: "comm-empty meta" },
          canContent()
            ? "No messages yet. Send one above."
            : "No messages yet.",
        ),
      );
      return;
    }
    items.forEach((message) => {
      let tag;
      if (state.role !== "player") {
        const to = messageAudienceLabel(message);
        tag = to ? `To: ${to}` : null;
      } else {
        tag = message.audience === "team" ? "Team message" : "Direct message";
      }
      const meta = [formatWhen(message.created_at), tag].filter(Boolean).join(" \u00b7 ");
      const del =
        canContent()
          ? el(
              "button",
              {
                type: "button",
                className: "comm-remove",
                title: "Delete message",
                "aria-label": "Delete message",
                onClick: () => removeMessage(message.id),
              },
              "\u00d7",
            )
          : null;
      messageList.append(
        el(
          "li",
          { className: `comm-item${message.read === false ? " unread" : ""}` },
          el(
            "div",
            { className: "comm-item-body" },
            el("div", { className: "comm-meta meta" }, meta),
            el("p", { className: "comm-text" }, message.body || ""),
          ),
          del,
        ),
      );
    });
  }

  function openMessageModal() {
    if (!messageModal) return;
    const canSend = canContent();
    if (messageForm) messageForm.classList.toggle("hidden", !canSend);
    if (canSend) updateMessageRecipient();
    renderMessageList();
    showDialog(messageModal);
    if (state.role === "player") {
      request("/api/messages/read", { method: "POST" })
        .then(() => loadMessages())
        .catch(() => {});
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const body = (messageBody.value || "").trim();
    if (!body) return;
    const audience = messageAudience.value;
    const payload = { body, audience };
    if (audience === "player" || audience === "staff_member") {
      payload.recipient_id = messageRecipient.value;
      if (!payload.recipient_id) {
        showError("Choose a recipient");
        return;
      }
    }
    try {
      await request("/api/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      messageForm.reset();
      updateMessageRecipient();
      await loadMessages();
      renderMessageList();
    } catch (error) {
      showError(error.message);
    }
  }

  async function removeMessage(id) {
    if (!window.confirm("Delete this message?")) return;
    try {
      await request(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadMessages();
      renderMessageList();
    } catch (error) {
      showError(error.message);
    }
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
    const picked = shell.teams.filter((t) => shell.teamSel.has(t.id));
    let team = state.team || {};
    if (picked.length === 1) {
      team = picked[0];
    } else if (shell.teams.length > 1) {
      team = { name: picked.length ? `${picked.length} teams` : `All teams (${shell.teams.length})` };
    } else if (shell.teams.length === 1) {
      team = shell.teams[0];
    }
    const when = [team.season, team.year].filter(Boolean).join(" ");
    const label = [team.name, team.sport, when].filter(Boolean).join(" \u00b7 ");
    if (label) {
      brandTeam.textContent = label;
      brandTeam.classList.remove("hidden");
    } else {
      brandTeam.textContent = "";
      brandTeam.classList.add("hidden");
    }
    renderBrandMeta();
  }

  // Head coaches, sorted alphabetically by last name.
  function headCoachNames() {
    const lastName = (name) => {
      const parts = String(name || "").trim().split(/\s+/);
      return (parts[parts.length - 1] || "").toLowerCase();
    };
    return (state.staff || [])
      .filter(
        (m) => typeof m.role === "string" && m.role.trim().toLowerCase() === "head coach",
      )
      .filter((m) => {
        const ids = Array.isArray(m.team_ids) ? m.team_ids : [];
        return !ids.length || !shell.teamSel.size || ids.some((id) => shell.teamSel.has(id));
      })
      .sort((a, b) => {
        const la = lastName(a.name);
        const lb = lastName(b.name);
        if (la !== lb) {
          return la < lb ? -1 : 1;
        }
        return String(a.name).localeCompare(String(b.name));
      })
      .map((m) => m.name);
  }

  // Roster size + head coach(es) below the team/season line (coach view only).
  function renderBrandMeta() {
    if (!brandMeta) {
      return;
    }
    // Players don't load the full roster or staff list; coaches and staff do.
    if (state.role === "player" || !state.role) {
      brandMeta.textContent = "";
      brandMeta.classList.add("hidden");
      return;
    }
    const coaches = headCoachNames();
    const coachText = coaches.length ? coaches.join(", ") : "Not set";
    brandMeta.textContent = `Team Roster: ${teamPlayers().length} \u00b7 Head Coach: ${coachText}`;
    brandMeta.classList.remove("hidden");
  }

  function renderTeamSummary() {
    if (!teamSummary) {
      return;
    }
    if (!shell.teams.length) {
      fill(teamSummary, el("div", { className: "team-empty meta" }, "No teams yet."));
      return;
    }
    fill(
      teamSummary,
      shell.teams.map((team) => {
        const details = [
          [team.season, team.year].filter(Boolean).join(" "),
          team.age_bracket,
          team.play_year ? `Years of play: ${team.play_year}` : "",
          plural(team.player_count || 0, "player"),
        ].filter(Boolean);
        return el(
          "div",
          { className: "team-row" },
          el(
            "div",
            {},
            el("div", {}, el("span", { className: "team-row-name" }, team.name), el("span", { className: "sport-tag" }, team.sport)),
            el("div", { className: "meta" }, details.join(" \u00b7 ")),
          ),
          el(
            "div",
            { className: "team-row-actions" },
            el("button", { type: "button", className: "btn btn-sm", onClick: () => openTeamModal(team) }, "Edit"),
            shell.teams.length > 1
              ? el("button", { type: "button", className: "btn btn-sm btn-danger", onClick: () => removeTeam(team) }, "Delete")
              : null,
          ),
        );
      }),
    );
  }

  function openTeamModal(team) {
    const current = team || {};
    shell.editingTeamId = team ? team.id : null;
    document.getElementById("team-modal-title").textContent = team ? `Edit ${team.name}` : "Add team";
    document.getElementById("team-name").value = current.name || "";
    document.getElementById("team-sport").value = current.sport || "Softball";
    document.getElementById("team-year-input").value = current.year || "";
    document.getElementById("team-season").value = current.season || "";
    document.getElementById("team-age-bracket").value = current.age_bracket || "";
    document.getElementById("team-play-year").value = current.play_year || "";
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
    // Editing metrics and stats is an admin action (coach or "Full" staff).
    // Managers still rate, add notes/drills.
    const canEditProfile = canAdmin();
    emptyState.classList.add("hidden");

    const rated = (player.progress || []).filter((item) => item.current);

    const metrics = computeMetrics(player);
    const hero = renderHero(player, metrics);

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
            { className: "skill", "data-skill-id": item.skill_id },
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
            skillMetric(player, item.skill_name || "", !canEditProfile),
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

    const progress = renderProgressCard(player, rated, readOnly);

    // Coach notes now live in the Focus Area tile (with modal entry), so the
    // standalone Notes card is gone to avoid duplicating the same record.
    const dash = el(
      "div",
      { className: "dash" },
      skills,
      radar,
      progress,
    );

    main.replaceChildren(hero, dash);
  }

  const PROGRESS_STATUS = {
    up: { label: "Improved", rank: 0 },
    down: { label: "Dropped", rank: 1 },
    steady: { label: "Steady", rank: 2 },
    new: { label: "New", rank: 3 },
  };

  const PROGRESS_COLUMNS = [
    { key: "skill", label: "Skill", value: (r) => r.name.toLowerCase() },
    { key: "last", label: "Last rated", value: (r) => r.lastAt },
    { key: "current", label: "Current", numeric: true, value: (r) => r.current },
    { key: "previous", label: "Previous", numeric: true, value: (r) => (r.previous === null ? -1 : r.previous) },
    { key: "change", label: "Change", numeric: true, value: (r) => (r.change === null ? -99 : r.change) },
    { key: "since", label: "Since first", numeric: true, value: (r) => (r.since === null ? -99 : r.since) },
    { key: "count", label: "Ratings", numeric: true, value: (r) => r.count },
    { key: "status", label: "Status", value: (r) => PROGRESS_STATUS[r.status].rank },
  ];

  // Sort, search, filter and expanded rows survive re-renders and player
  // switches so a coach can scan the whole roster the same way.
  const progressView = { key: "status", dir: 1, query: "", filter: null, open: new Set() };

  function roundHalf(value) {
    return Math.round(value * 10) / 10;
  }

  function formatStamp(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      return "—";
    }
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function progressRows(rated) {
    return rated.map((item) => {
      const history = (item.history || []).filter((entry) => typeof entry.score === "number");
      const last = history[history.length - 1];
      const prev = history[history.length - 2];
      const change = prev ? roundHalf(last.score - prev.score) : null;
      const since = history.length > 1 ? roundHalf(last.score - history[0].score) : null;
      let status = "new";
      if (change !== null) {
        status = change > 0 ? "up" : change < 0 ? "down" : "steady";
      }
      return {
        id: item.skill_id,
        name: item.skill_name || "Skill",
        current: Number(item.current) || 0,
        previous: prev ? prev.score : null,
        change,
        since,
        count: history.length,
        lastAt: last ? last.created_at || "" : "",
        status,
        history,
      };
    });
  }

  function changeCell(value) {
    if (value === null) {
      return el("span", { className: "empty-cell" }, "—");
    }
    if (value === 0) {
      return el("span", { className: "chg flat" }, "0");
    }
    return el("span", { className: value > 0 ? "chg up" : "chg down" }, `${value > 0 ? "+" : ""}${value}`);
  }

  function progressPill(status) {
    return el("span", { className: `prog-pill ${status}` }, PROGRESS_STATUS[status].label);
  }

  function renderProgressCard(player, rated, readOnly) {
    const rows = progressRows(rated);
    const tableHost = el("div", { className: "prog-body" });
    const filterHost = el("div", { className: "prog-filter" });
    const search = el("input", {
      type: "search",
      className: "prog-search",
      placeholder: "Search",
      "aria-label": "Search progress",
      value: progressView.query,
      onInput: (event) => {
        progressView.query = event.target.value;
        draw();
      },
    });
    const improved = rows.filter((r) => r.status === "up").length;
    const dropped = rows.filter((r) => r.status === "down").length;

    function rateSkill(row) {
      const target = main.querySelector(`.skill[data-skill-id="${CSS.escape(row.id)}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 1400);
      const dot = target.querySelector("button.dot");
      if (dot) dot.focus({ preventScroll: true });
    }

    function openMenu(row, tr, x, y) {
      const isOpen = progressView.open.has(row.id);
      const groups = [
        {
          label: "Drill down",
          items: [
            {
              label: isOpen ? "Hide rating history" : `Show rating history (${row.count})`,
              icon: "history",
              action: () => {
                if (isOpen) progressView.open.delete(row.id);
                else progressView.open.add(row.id);
                draw();
              },
            },
            {
              label: `Show only “${PROGRESS_STATUS[row.status].label}”`,
              icon: "filter",
              action: () => {
                progressView.filter = row.status;
                draw();
              },
            },
          ],
        },
      ];
      if (progressView.filter || progressView.query) {
        groups[0].items.push({
          label: "Clear filter and search",
          icon: "clear",
          action: () => {
            progressView.filter = null;
            progressView.query = "";
            search.value = "";
            draw();
          },
        });
      }
      if (!readOnly) {
        groups.push({
          label: "Rate",
          items: [{ label: "Rate this skill", icon: "rate", action: () => rateSkill(row) }],
        });
      }
      const sub = [`Current ${row.current} / 5`, row.since !== null ? `${row.since > 0 ? "+" : ""}${row.since} since first` : ""]
        .filter(Boolean)
        .join(" · ");
      showContextMenu({ title: row.name, sub, groups, row: tr, x, y });
    }

    function draw() {
      closePlayerMenu();
      const query = progressView.query.trim().toLowerCase();
      const column = PROGRESS_COLUMNS.find((c) => c.key === progressView.key) || PROGRESS_COLUMNS[0];
      const visible = rows
        .filter((r) => !progressView.filter || r.status === progressView.filter)
        .filter(
          (r) =>
            !query ||
            r.name.toLowerCase().includes(query) ||
            PROGRESS_STATUS[r.status].label.toLowerCase().includes(query),
        )
        .sort((a, b) => {
          const av = column.value(a);
          const bv = column.value(b);
          if (av < bv) return -progressView.dir;
          if (av > bv) return progressView.dir;
          return a.name.localeCompare(b.name);
        });

      filterHost.replaceChildren(
        ...(progressView.filter
          ? [el(
              "button",
              {
                type: "button",
                className: "prog-chip",
                onClick: () => {
                  progressView.filter = null;
                  draw();
                },
              },
              `Showing: ${PROGRESS_STATUS[progressView.filter].label}`,
              el("span", { "aria-hidden": "true" }, " ✕"),
              el("span", { className: "sr-only" }, " (clear)"),
            )]
          : []),
      );

      const head = el(
        "tr",
        {},
        PROGRESS_COLUMNS.map((c) => {
          const active = progressView.key === c.key;
          return el(
            "th",
            {
              scope: "col",
              className: `pc-${c.key}${c.numeric ? " num" : ""}`,
              "aria-sort": active ? (progressView.dir > 0 ? "ascending" : "descending") : "none",
            },
            el(
              "button",
              {
                type: "button",
                className: "th-sort",
                onClick: () => {
                  progressView.dir = active ? -progressView.dir : c.numeric ? -1 : 1;
                  progressView.key = c.key;
                  draw();
                },
              },
              c.label,
              el("span", { className: "sort-mark", "aria-hidden": "true" }, active ? (progressView.dir > 0 ? "▲" : "▼") : ""),
            ),
          );
        }),
        el("th", { scope: "col", className: "pc-menu" }, el("span", { className: "sr-only" }, "Actions")),
      );

      const body = visible.flatMap((r) => {
        const isOpen = progressView.open.has(r.id);
        const tr = el(
          "tr",
          {
            tabindex: "0",
            className: isOpen ? "expanded" : "",
            "aria-haspopup": "menu",
            "aria-expanded": isOpen ? "true" : "false",
            "data-skill-id": r.id,
            onContextmenu: (event) => {
              event.preventDefault();
              openMenu(r, tr, event.clientX, event.clientY);
            },
            // Touch screens have no right-click, so a tap opens the menu.
            onClick: (event) => {
              if (window.matchMedia("(hover: none)").matches) {
                openMenu(r, tr, event.clientX, event.clientY);
              }
            },
            onDblclick: () => {
              if (isOpen) progressView.open.delete(r.id);
              else progressView.open.add(r.id);
              draw();
            },
            onKeydown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const box = tr.getBoundingClientRect();
                openMenu(r, tr, box.left + 24, box.bottom);
              }
            },
          },
          el(
            "td",
            { className: "pc-skill" },
            el("span", { className: "twisty", "aria-hidden": "true" }, isOpen ? "▾" : "▸"),
            el("strong", {}, r.name),
          ),
          el("td", { className: "pc-last mono" }, formatStamp(r.lastAt)),
          el("td", { className: "pc-current num mono" }, el("span", { className: "score-chip", "data-score": String(Math.round(r.current)) }, String(r.current))),
          el("td", { className: "pc-previous num mono" }, r.previous === null ? el("span", { className: "empty-cell" }, "—") : String(r.previous)),
          el("td", { className: "pc-change num mono" }, changeCell(r.change)),
          el("td", { className: "pc-since num mono" }, changeCell(r.since)),
          el("td", { className: "pc-count num mono" }, String(r.count)),
          el("td", { className: "pc-status" }, progressPill(r.status)),
          el(
            "td",
            { className: "pc-menu" },
            el(
              "button",
              {
                type: "button",
                className: "row-menu-btn",
                "aria-label": `Drill down into ${r.name}`,
                "aria-haspopup": "menu",
                tabindex: "-1",
                onClick: (event) => {
                  event.stopPropagation();
                  const box = event.currentTarget.getBoundingClientRect();
                  openMenu(r, tr, box.right, box.bottom);
                },
              },
              "⋯",
            ),
          ),
        );
        if (!isOpen) {
          return [tr];
        }
        const subs = r.history
          .map((entry, index) => {
            const before = index ? r.history[index - 1].score : null;
            return { entry, index, change: before === null ? null : roundHalf(entry.score - before) };
          })
          .reverse()
          .map(({ entry, index, change }) =>
            el(
              "tr",
              { className: "sub-row" },
              el("td", { className: "pc-skill" }, el("span", { className: "sub-label" }, `Rating ${index + 1} of ${r.count}`)),
              el("td", { className: "pc-last mono" }, formatStamp(entry.created_at)),
              el("td", { className: "pc-current num mono" }, String(entry.score)),
              el(
                "td",
                { className: "pc-previous num mono" },
                index ? String(r.history[index - 1].score) : el("span", { className: "empty-cell" }, "—"),
              ),
              el("td", { className: "pc-change num mono" }, changeCell(change)),
              el("td", { className: "pc-since num mono" }, changeCell(index ? roundHalf(entry.score - r.history[0].score) : null)),
              el("td", { className: "pc-count num mono" }, ""),
              el("td", { className: "pc-status" }, ""),
              el("td", { className: "pc-menu" }, ""),
            ),
          );
        return [tr, ...subs];
      });

      const activity = (player.activity || []).filter(
        (entry) => !query || (entry.text || "").toLowerCase().includes(query),
      );

      tableHost.replaceChildren(
        rows.length
          ? el(
              "p",
              { className: "prog-hint" },
              el("span", { className: "hint-mouse" }, "Right-click a skill (or use ⋯) to drill into its rating history."),
              el("span", { className: "hint-touch" }, "Tap a skill to drill into its rating history."),
              " Click a column to sort.",
            )
          : "",
        rows.length
          ? el(
              "div",
              { className: "table-wrap prog-wrap" },
              el(
                "table",
                { className: "data-table prog-table" },
                el("thead", {}, head),
                el(
                  "tbody",
                  {},
                  body.length
                    ? body
                    : el("tr", {}, el("td", { className: "prog-none", colspan: String(PROGRESS_COLUMNS.length + 1) }, "No skills match.")),
                ),
              ),
            )
          : el("p", { className: "empty" }, "Rate a skill to start a progress history."),
        (player.activity || []).length
          ? el(
              "div",
              { className: "activity" },
              el("h3", { className: "activity-title" }, "Drill activity"),
              el(
                "div",
                { className: "table-wrap prog-wrap log-wrap" },
                el(
                  "table",
                  { className: "data-table prog-table log-table" },
                  el(
                    "thead",
                    {},
                    el("tr", {}, el("th", { scope: "col", className: "pc-last" }, "Timestamp"), el("th", { scope: "col" }, "Activity")),
                  ),
                  el(
                    "tbody",
                    {},
                    activity.length
                      ? activity.map((entry) =>
                          el(
                            "tr",
                            {},
                            el("td", { className: "pc-last mono" }, formatStamp(entry.created_at)),
                            el("td", { className: "activity-text" }, entry.text || ""),
                          ),
                        )
                      : el("tr", {}, el("td", { className: "prog-none", colspan: "2" }, "No activity matches.")),
                  ),
                ),
              ),
            )
          : "",
      );
    }

    draw();

    const summary = rows.length
      ? `${rows.length} rated · ${improved} improved · ${dropped} dropped since previous rating`
      : "";
    return el(
      "section",
      { className: "card progress-card" },
      el(
        "div",
        { className: "prog-head" },
        el("div", { className: "prog-titles" }, el("h2", {}, "Progress"), summary ? el("p", { className: "meta" }, summary) : null),
        el("div", { className: "prog-tools" }, filterHost, rows.length ? search : null),
      ),
      tableHost,
    );
  }

  // GameChanger stats live in a modal opened from the player card. Admins get
  // the editable form; everyone else sees the totals read-only.
  function renderStatsModal(statusText) {
    const player = state.detail;
    if (!player || !statsModalBody) {
      return;
    }
    const number = jersey(player);
    statsModalTitle.textContent = `GameChanger stats — ${number ? `${number} ` : ""}${player.name}`;
    const stats = player.stats || { offense: [], defense: [] };
    if (!canAdmin()) {
      statsModalBody.replaceChildren(
        statsReadOnly("Offense", stats.offense || []),
        statsReadOnly("Defense", stats.defense || []),
      );
      return;
    }
    const status = el("span", { className: "stats-saved meta", role: "status" }, statusText || "");
    statsModalBody.replaceChildren(
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
        el(
          "div",
          { className: "stats-actions" },
          el("button", { type: "submit", className: "btn btn-primary" }, "Save stats"),
          status,
        ),
      ),
    );
  }

  function openStatsModal() {
    renderStatsModal();
    showDialog(statsModal);
  }

  function closeStatsModal() {
    hideDialog(statsModal);
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
      const name = item.skill_name || "Skill";
      if (!top || v > top.value) {
        top = { name, value: v };
      }
      // Track every skill tied at the lowest score so the Focus Area card can
      // list them all (e.g. "Power, Pitching" when both are 2.5).
      if (!low || v < low.value) {
        low = { name, value: v, names: [name] };
      } else if (v === low.value) {
        low.names.push(name);
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
    const avgTrend = computeAvgTrend(weeklyAvgSeries(player), player);
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

  // Direction + percent for the Avg Rating tile. Uses the server's 7-day
  // comparison (the same number as the roster) when available, else the two
  // most recent weekly averages.
  function computeAvgTrend(series, player) {
    if (!series || series.length < 2) {
      return { series: series || [], direction: "flat", pct: 0 };
    }
    if (player && player.week_change !== null && player.week_change !== undefined) {
      const change = Number(player.week_change) || 0;
      const prior = Number(player.week_prior_avg) || 0;
      const direction = change >= 0.05 ? "up" : change <= -0.05 ? "down" : "flat";
      const pct = direction === "flat" || prior <= 0 ? 0 : Math.round((change / prior) * 100);
      return { series, direction, pct };
    }
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const delta = last - prev;
    const eps = 0.049; // ratings move in 0.5 steps; ignore floating-point noise
    const direction = delta > eps ? "up" : delta < -eps ? "down" : "flat";
    const pct = prev > 0 ? Math.round((delta / prev) * 100) : last > 0 ? 100 : 0;
    return { series, direction, pct };
  }

  // A warning triangle with an exclamation point. The stroke/mark inherit the
  // tile's accent color (via currentColor), so it matches the metric number.
  function warningIcon() {
    return svgEl(
      "svg",
      {
        class: "tile-alarm",
        viewBox: "0 0 24 24",
        width: "22",
        height: "22",
        role: "img",
        "aria-label": "Needs attention",
      },
      svgEl("title", {}, "Needs attention"),
      // Rounded triangle outline.
      svgEl("path", {
        d: "M12 3.2 L21.4 19.4 A1.4 1.4 0 0 1 20.2 21.4 H3.8 A1.4 1.4 0 0 1 2.6 19.4 Z",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linejoin": "round",
      }),
      // Exclamation stem.
      svgEl("line", {
        x1: "12",
        y1: "9.5",
        x2: "12",
        y2: "14.5",
        stroke: "currentColor",
        "stroke-width": "1.9",
        "stroke-linecap": "round",
      }),
      // Exclamation dot.
      svgEl("circle", { cx: "12", cy: "17.4", r: "1.15", fill: "currentColor" }),
    );
  }

  // A gold trophy, pinned to the upper-right corner (used on the Top Skill tile).
  function trophyIcon() {
    return svgEl(
      "svg",
      {
        class: "tile-trophy",
        viewBox: "0 0 24 24",
        width: "22",
        height: "22",
        role: "img",
        "aria-label": "Top skill",
      },
      svgEl("title", {}, "Top skill"),
      // Cup bowl.
      svgEl("path", {
        d: "M6 4 H18 V6 C18 9.3 15.3 12 12 12 C8.7 12 6 9.3 6 6 Z",
        fill: "currentColor",
      }),
      // Left and right handles.
      svgEl("path", {
        d: "M6 5.2 C3.4 5.2 3.4 9 6.3 9.3",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.4",
        "stroke-linecap": "round",
      }),
      svgEl("path", {
        d: "M18 5.2 C20.6 5.2 20.6 9 17.7 9.3",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.4",
        "stroke-linecap": "round",
      }),
      // Stem, base trapezoid, and foot bar.
      svgEl("line", {
        x1: "12",
        y1: "12",
        x2: "12",
        y2: "16",
        stroke: "currentColor",
        "stroke-width": "2",
      }),
      svgEl("path", { d: "M10 16 H14 L15 19 H9 Z", fill: "currentColor" }),
      svgEl("rect", { x: "8", y: "19", width: "8", height: "2", rx: "0.6", fill: "currentColor" }),
    );
  }

  // A three-bar chart, pinned to the upper-right corner (Overall tile). The
  // bars share a vertical gradient built from currentColor, so the fill stays
  // coordinated with the tile accent — the same cyan as the Overall % value.
  function barsIcon() {
    const gradId = "tile-bars-grad";
    return svgEl(
      "svg",
      {
        class: "tile-bars",
        viewBox: "0 0 24 24",
        width: "22",
        height: "22",
        role: "img",
        "aria-label": "Overall progress",
      },
      svgEl("title", {}, "Overall progress"),
      svgEl(
        "defs",
        {},
        svgEl(
          "linearGradient",
          { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" },
          // Lighter at the top, fuller at the base (matching a bar-chart glyph).
          svgEl("stop", { offset: "0", "stop-color": "currentColor", "stop-opacity": "0.5" }),
          svgEl("stop", { offset: "1", "stop-color": "currentColor", "stop-opacity": "1" }),
        ),
      ),
      // Three rising bars: short, medium, tall.
      svgEl("rect", { x: "3", y: "14", width: "4.6", height: "8", rx: "1.3", fill: `url(#${gradId})` }),
      svgEl("rect", { x: "9.7", y: "9", width: "4.6", height: "13", rx: "1.3", fill: `url(#${gradId})` }),
      svgEl("rect", { x: "16.4", y: "4", width: "4.6", height: "18", rx: "1.3", fill: `url(#${gradId})` }),
    );
  }

  // An up/down trend arrow pinned to the upper-right corner: green when the
  // metric increased week over week, red when it decreased. Returns null for a
  // flat/absent trend so no icon is drawn.
  function trendIcon(trend) {
    const dir = trend && trend.direction;
    if (dir !== "up" && dir !== "down") return null;
    const up = dir === "up";
    return svgEl(
      "svg",
      {
        class: `tile-trend ${dir}`,
        viewBox: "0 0 24 24",
        width: "22",
        height: "22",
        role: "img",
        "aria-label": up ? "Trending up" : "Trending down",
      },
      svgEl("title", {}, up ? "Trending up" : "Trending down"),
      svgEl("path", {
        d: up ? "M12 19 V7 M6.5 12.5 L12 7 L17.5 12.5" : "M12 5 V17 M6.5 11.5 L12 17 L17.5 11.5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2.2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    );
  }

  function metricTile(opts) {
    const children = [
      el("span", { className: "ribbon" }),
      opts.alarm ? warningIcon() : null,
      opts.trophy ? trophyIcon() : null,
      opts.bars ? barsIcon() : null,
      opts.trend ? trendIcon(opts.trend) : null,
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
    // When a tile shows notes, keep the skill-name foot above the notes block
    // so the bottom-aligned "Add note" button lands at the card's bottom edge
    // (matching the "Add drill" tile).
    if (opts.foot) {
      const footClass = opts.notes ? "tile-foot tile-foot-inline" : "tile-foot";
      children.push(el("div", { className: footClass }, opts.foot));
    }
    if (opts.notes) {
      children.push(notesBlock(opts.notes));
    }
    return el("div", { className: `tile ${opts.accent || "cyan"}` }, ...children);
  }

  // Notes for a given card. Legacy notes without a category belong to "focus".
  function notesForCategory(player, category) {
    const all = Array.isArray(player.notes) ? player.notes : [];
    return all.filter((note) => (note.category || "focus") === category);
  }

  // A running record of coach notes shown inside a tile: history + an
  // "Add note" button (coaches only) that opens the note modal. Notes are
  // grouped by category so each tile keeps its own record.
  function notesBlock(cfg) {
    const items = Array.isArray(cfg.items) ? cfg.items : [];
    const category = cfg.category || "focus";
    const children = [
      el("div", { className: "note-block-head" }, "Coach notes"),
    ];
    if (!items.length) {
      children.push(el("div", { className: "note-empty meta" }, "No notes yet."));
    } else {
      const list = el("ul", { className: "note-list" });
      items.forEach((note) => {
        const del = cfg.canEdit
          ? el(
              "button",
              {
                type: "button",
                className: "note-remove",
                title: "Delete note",
                "aria-label": "Delete note",
                onClick: () => removeNote(note.id),
              },
              "\u00d7",
            )
          : null;
        // Each note shows its date and up to two lines of text; hovering shows
        // the whole note and clicking opens it in a read-only modal.
        const preview = (note.text || "").replace(/\s+/g, " ").trim() || "Untitled note";
        const openBtn = el(
          "button",
          {
            type: "button",
            className: "note-open",
            title: preview,
            onClick: () => openNoteView(note),
          },
          el("span", { className: "note-when meta" }, formatWhen(note.created_at)),
          el("span", { className: "note-preview" }, preview),
        );
        list.append(
          el("li", { className: "note-item" }, openBtn, del),
        );
      });
      children.push(list);
    }
    if (cfg.canEdit) {
      children.push(
        el(
          "div",
          { className: "note-actions" },
          el(
            "button",
            { type: "button", className: "btn note-add", onClick: () => openNoteModal(category) },
            "Add note",
          ),
        ),
      );
    }
    return el("div", { className: "note-block" }, ...children);
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
    // A vertical gradient fades the fill from the tile accent (top) to
    // transparent (bottom). currentColor resolves to each tile's accent.
    const gradId = `trend-grad-${Math.random().toString(36).slice(2, 9)}`;
    const gradient = svgEl(
      "linearGradient",
      { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" },
      svgEl("stop", { offset: "0", "stop-color": "currentColor", "stop-opacity": "0.5" }),
      svgEl("stop", { offset: "1", "stop-color": "currentColor", "stop-opacity": "0" }),
    );
    const defs = svgEl("defs", {}, gradient);
    const area = svgEl("path", {
      d: areaD,
      class: "trend-area",
      style: `fill: url(#${gradId}); opacity: 1;`,
    });
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
      defs,
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

  function renderHero(player, m) {
    const tags = [el("span", { className: "tag on" }, `Overall ${m.overall}%`)];
    if (player.team_year) {
      tags.push(el("span", { className: "tag" }, `${player.team_year} team year`));
    }
    if (player.grad_year) {
      tags.push(el("span", { className: "tag" }, `Class of ${player.grad_year}`));
    }
    if (player.has_login) {
      tags.push(el("span", { className: "tag on" }, "Login set"));
    } else {
      tags.push(el("span", { className: "tag" }, "No login"));
    }
    const idPanel = el(
      "section",
      { className: "card hero-id" },
      el("div", { className: "hero-num" }, jersey(player) || "—"),
      el("div", { className: "hero-name" }, player.name),
      el("div", { className: "hero-sub" }, positionLabel(player) || "Athlete"),
      el("div", { className: "tags" }, tags),
      statsLauncher(player, m),
    );

    const tiles = el(
      "div",
      { className: "tiles" },
      metricTile({
        label: "Overall",
        value: m.overall,
        unit: "%",
        accent: "cyan",
        // A 3-bar chart glyph, gradient-tinted to match the cyan Overall %.
        bars: true,
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
        // A gold trophy marks the player's strongest skill.
        trophy: Boolean(m.top),
        foot: m.top ? m.top.name : "Rate a skill",
        notes: { items: notesForCategory(player, "top"), canEdit: !isReadOnly(), category: "top" },
      }),
      metricTile({
        label: "Focus Area",
        value: m.low ? m.low.value : "—",
        unit: m.low ? "/5" : "",
        accent: m.low ? accentForScore(m.low.value) : "orange",
        // A focus score of 2.5 or lower flags the card as needing attention.
        alarm: m.low && Number(m.low.value) <= 2.5,
        // List every skill tied at the lowest score, not just one.
        foot: m.low ? (m.low.names || [m.low.name]).join(", ") : "Rate a skill",
        notes: { items: notesForCategory(player, "focus"), canEdit: !isReadOnly(), category: "focus" },
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

  // "GameChanger stats" button on the player card, with a one-line AVG / OPS
  // summary once any game totals have been entered.
  function statsLauncher(player, m) {
    const stats = player.stats || {};
    const hasStats = [...(stats.offense || []), ...(stats.defense || [])].some(
      (item) => item.kind === "count" && Number(item.value) > 0,
    );
    const summary = hasStats
      ? ["AVG", "OPS"]
          .map((abbr) => {
            const value = m.findStat(abbr);
            return value === null ? null : `${abbr} ${value}`;
          })
          .filter(Boolean)
          .join(" · ")
      : "";
    return el(
      "div",
      { className: "stats-launch" },
      el(
        "button",
        { type: "button", className: "btn stats-open", "aria-haspopup": "dialog", onClick: openStatsModal },
        "GameChanger stats",
      ),
      el("span", { className: "stats-summary" }, summary || (hasStats ? "" : "No game stats yet")),
    );
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
    const pool = teamPlayers().length ? teamPlayers() : state.players;
    const exists = state.players.some((player) => player.id === nextId);
    state.selectedId = exists ? nextId : (pool[0] && pool[0].id) || null;
    renderRoster();
    renderBrandMeta();
    renderPlayerLogins();
    renderManagePlayers();
    renderShell();
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
    const listed = state.players.find((player) => player.id === playerId);
    if (listed) {
      listed.week_change = state.detail.week_change;
    }
    // Players have no roster list; coaches and staff keep the active row in sync.
    if (state.role !== "player") {
      renderRoster();
    }
    renderDetail();
    if (shell.view === "home") {
      renderShell();
    }
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
    Power: {
      key: "distance",
      heading: "Distance",
      unit: "Feet",
      min: 0,
      max: 1000,
      step: 0.01,
      aria: "Hitting distance in feet",
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
      heading: "IF Velo",
      unit: "MPH",
      min: 0,
      max: 200,
      step: 0.01,
      aria: "Infield throwing velocity in MPH",
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
    const form = event.currentTarget;
    const body = {};
    new FormData(form).forEach((value, key) => {
      body[key] = value;
    });
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Saving…";
    }
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/stats`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await loadDetail(state.selectedId);
      renderStatsModal(`Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } catch (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Save stats";
      }
      showError(error.message);
    }
  }

  function openNoteModal(category) {
    if (!state.selectedId || !noteModal) {
      return;
    }
    noteTargetCategory = category === "top" ? "top" : "focus";
    const title = document.getElementById("note-title");
    if (title) {
      title.textContent =
        noteTargetCategory === "top" ? "Add top skill note" : "Add focus area note";
    }
    noteForm.reset();
    if (typeof noteModal.showModal === "function") {
      noteModal.showModal();
    } else {
      noteModal.setAttribute("open", "");
    }
    if (noteInput) {
      noteInput.focus();
    }
  }

  function closeNoteModal() {
    if (noteModal.open) {
      noteModal.close();
    } else {
      noteModal.removeAttribute("open");
    }
  }

  // Show a single note's full text in a read-only modal.
  function openNoteView(note) {
    if (!noteViewModal) {
      return;
    }
    if (noteViewWhen) {
      noteViewWhen.textContent = formatWhen(note.created_at);
    }
    if (noteViewText) {
      noteViewText.textContent = note.text || "";
    }
    if (typeof noteViewModal.showModal === "function") {
      noteViewModal.showModal();
    } else {
      noteViewModal.setAttribute("open", "");
    }
  }

  function closeNoteViewModal() {
    if (!noteViewModal) {
      return;
    }
    if (noteViewModal.open) {
      noteViewModal.close();
    } else {
      noteViewModal.removeAttribute("open");
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    if (!state.selectedId) {
      return;
    }
    const text = new FormData(noteForm).get("text");
    try {
      await request(`/api/players/${encodeURIComponent(state.selectedId)}/notes`, {
        method: "POST",
        body: JSON.stringify({ text, category: noteTargetCategory }),
      });
      closeNoteModal();
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

  async function removePlayer(player) {
    if (!player) {
      return;
    }
    const name = player.name || "this player";
    if (!window.confirm(`Delete ${name} and their ratings and notes?`)) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(player.id)}`, { method: "DELETE" });
      if (state.selectedId === player.id) {
        state.selectedId = null;
        state.detail = null;
      }
      await loadPlayers();
    } catch (error) {
      showError(error.message);
    }
  }

  function editPlayer(player) {
    if (!player || !editPlayerModal) {
      return;
    }
    const p = player;
    editTargetId = player.id;
    const title = document.getElementById("edit-player-title");
    if (title) {
      title.textContent = `Edit ${player.name || "player"}`;
    }
    editPlayerForm.reset();
    editPlayerForm.elements.name.value = p.name || "";
    editPlayerForm.elements.position.value = p.position || "";
    editPlayerForm.elements.secondary_position.value = p.secondary_position || "";
    editPlayerForm.elements.number.value =
      p.number === null || p.number === undefined ? "" : p.number;
    editPlayerForm.elements.grad_year.value = p.grad_year || "";
    editPlayerForm.elements.team_id.value = p.team_id || (shell.teams[0] && shell.teams[0].id) || "";
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
    editTargetId = null;
  }

  const MANAGE_COLUMNS = [
    { key: "number", label: "#", value: (p) => (p.number === null || p.number === undefined ? -1 : Number(p.number)) },
    { key: "name", label: "Name", value: (p) => (p.name || "").toLowerCase() },
    { key: "position", label: "Position", value: (p) => (p.position || "").toLowerCase() },
    { key: "secondary_position", label: "2nd position", value: (p) => (p.secondary_position || "").toLowerCase() },
    { key: "grad_year", label: "Class", value: (p) => String(p.grad_year || "") },
    { key: "login", label: "Login", value: (p) => (p.has_login ? 0 : 1) },
  ];
  const manageSort = { key: "name", dir: 1 };

  const POSITION_ABBR = {
    Pitcher: "P",
    Catcher: "C",
    "First Base": "1B",
    "Second Base": "2B",
    "Third Base": "3B",
    Shortstop: "SS",
    "Left Field": "LF",
    "Center Field": "CF",
    "Right Field": "RF",
    Utility: "UT",
    "DP/Flex": "DP",
  };

  // Lucide icon outlines (24x24, stroked); static markup only.
  const MENU_ICONS = {
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    view: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    resetLogin: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    clear: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    rate: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    delete: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  };

  function menuIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "menu-icon");
    svg.innerHTML = MENU_ICONS[name];
    return svg;
  }

  function numberBadge(player) {
    const hasNumber = player.number !== null && player.number !== undefined && player.number !== "";
    return hasNumber
      ? el("span", { className: "num-badge" }, String(player.number))
      : el("span", { className: "empty-cell" }, "—");
  }

  function positionChip(position) {
    if (!position) {
      return el("span", { className: "empty-cell" }, "—");
    }
    const abbr = POSITION_ABBR[position];
    return el(
      "span",
      { className: "pos-chip" },
      abbr ? el("span", { className: "pos-abbr" }, abbr) : null,
      el("span", { className: "pos-name" }, position),
    );
  }

  function loginPill(player) {
    return el(
      "span",
      { className: player.has_login ? "status-pill on" : "status-pill" },
      el("span", { className: "status-dot", "aria-hidden": "true" }),
      player.has_login ? "Login set" : "No login",
    );
  }

  function sortedManagePlayers() {
    const column = MANAGE_COLUMNS.find((c) => c.key === manageSort.key) || MANAGE_COLUMNS[1];
    return [...state.players].sort((a, b) => {
      const av = column.value(a);
      const bv = column.value(b);
      if (av < bv) return -manageSort.dir;
      if (av > bv) return manageSort.dir;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  function renderManagePlayers() {
    if (!managePlayerList) {
      return;
    }
    closePlayerMenu();
    if (managePlayerCount) {
      const count = state.players.length;
      managePlayerCount.textContent = `${count} ${count === 1 ? "player" : "players"}`;
      managePlayerCount.closest(".manage-toolbar").hidden = !count;
    }
    if (!state.players.length) {
      managePlayerList.replaceChildren(el("p", { className: "meta manage-empty" }, "No players yet."));
      return;
    }
    const head = el(
      "tr",
      {},
      MANAGE_COLUMNS.map((column) => {
        const active = manageSort.key === column.key;
        return el(
          "th",
          {
            scope: "col",
            className: `col-${column.key}`,
            "aria-sort": active ? (manageSort.dir > 0 ? "ascending" : "descending") : "none",
          },
          el(
            "button",
            {
              type: "button",
              className: "th-sort",
              onClick: () => {
                manageSort.dir = active ? -manageSort.dir : 1;
                manageSort.key = column.key;
                renderManagePlayers();
              },
            },
            column.label,
            el("span", { className: "sort-mark", "aria-hidden": "true" }, active ? (manageSort.dir > 0 ? "▲" : "▼") : ""),
          ),
        );
      }),
      el("th", { scope: "col", className: "col-menu" }, el("span", { className: "sr-only" }, "Actions")),
    );
    const rows = sortedManagePlayers().map((player) => {
      const row = el(
        "tr",
        {
          tabindex: "0",
          "aria-haspopup": "menu",
          onContextmenu: (event) => {
            event.preventDefault();
            openPlayerMenu(player, row, event.clientX, event.clientY);
          },
          onDblclick: () => editPlayer(player),
          onKeydown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const box = row.getBoundingClientRect();
              openPlayerMenu(player, row, box.left + 24, box.bottom);
            }
          },
        },
        el("td", { className: "col-number" }, numberBadge(player)),
        el("td", { className: "col-name" }, el("strong", {}, player.name)),
        el("td", { className: "col-position" }, positionChip(player.position)),
        el("td", { className: "col-secondary_position" }, positionChip(player.secondary_position)),
        el(
          "td",
          { className: "col-grad_year" },
          player.grad_year || el("span", { className: "empty-cell" }, "—"),
        ),
        el("td", { className: "col-login" }, loginPill(player)),
        el(
          "td",
          { className: "col-menu" },
          el(
            "button",
            {
              type: "button",
              className: "row-menu-btn",
              "aria-label": `Manage ${player.name}`,
              "aria-haspopup": "menu",
              tabindex: "-1",
              onClick: (event) => {
                event.stopPropagation();
                const box = event.currentTarget.getBoundingClientRect();
                openPlayerMenu(player, row, box.right, box.bottom);
              },
            },
            "⋯",
          ),
        ),
      );
      return row;
    });
    managePlayerList.replaceChildren(
      el("table", { className: "data-table manage-table" }, el("thead", {}, head), el("tbody", {}, rows)),
    );
  }

  let playerMenu = null;

  function closePlayerMenu() {
    if (!playerMenu) {
      return;
    }
    const { node, row } = playerMenu;
    playerMenu = null;
    node.remove();
    if (row && row.isConnected) {
      row.classList.remove("menu-open");
    }
  }

  function openPlayerMenu(player, row, x, y) {
    const loginItems = player.has_login
      ? [
          { label: "Reset login", icon: "resetLogin", action: () => managePlayerLogin(player) },
          { label: "Remove login", icon: "key", action: () => clearPlayerLogin(player) },
        ]
      : [{ label: "Set login", icon: "key", action: () => managePlayerLogin(player) }];
    const groups = [
      {
        label: "Profile",
        items: [
          { label: "Edit player", icon: "edit", action: () => editPlayer(player) },
          {
            label: "View on main page",
            icon: "view",
            action: () => {
              closeAdminModal();
              selectPlayer(player.id);
            },
          },
        ],
      },
      { label: "Login", items: loginItems },
      {
        label: "Danger",
        items: [{ label: "Delete player", icon: "delete", danger: true, action: () => removePlayer(player) }],
      },
    ];
    const details = [player.position, player.grad_year ? `Class of ${player.grad_year}` : ""]
      .filter(Boolean)
      .join(" · ");
    showContextMenu({
      title: player.name,
      sub: details,
      badge:
        player.number !== null && player.number !== undefined && player.number !== ""
          ? el("span", { className: "num-badge small" }, String(player.number))
          : null,
      groups,
      row,
      x,
      y,
      // Inside the dialog so it renders in the same top layer as the Admin window.
      host: adminModal,
    });
  }

  function showContextMenu({ title, sub, badge, groups, row, x, y, host }) {
    closePlayerMenu();
    const run = (action) => () => {
      closePlayerMenu();
      action();
    };
    const node = el(
      "div",
      { className: "context-menu", role: "menu", "aria-label": title },
      el(
        "div",
        { className: "context-menu-head" },
        badge || null,
        el(
          "div",
          { className: "context-menu-who" },
          el("div", { className: "context-menu-name" }, title),
          sub ? el("div", { className: "context-menu-sub" }, sub) : null,
        ),
      ),
      groups.flatMap((group, index) => [
        index ? el("div", { className: "menu-sep", role: "separator" }) : null,
        el("div", { className: "menu-group-label", "aria-hidden": "true" }, group.label),
        ...group.items.map((item) =>
          el(
            "button",
            {
              type: "button",
              role: "menuitem",
              className: item.danger ? "menu-item danger" : "menu-item",
              onClick: run(item.action),
            },
            menuIcon(item.icon),
            item.label,
          ),
        ),
      ]),
    );
    (host || document.body).append(node);
    const box = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
    row.classList.add("menu-open");
    playerMenu = { node, row };
    node.querySelector(".menu-item").focus();
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (playerMenu && !playerMenu.node.contains(event.target)) {
        closePlayerMenu();
      }
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!playerMenu) {
        return;
      }
      if (event.key === "Escape") {
        // Close only the menu, not the Admin window behind it.
        event.preventDefault();
        event.stopPropagation();
        const { row } = playerMenu;
        closePlayerMenu();
        if (row && row.isConnected) row.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = [...playerMenu.node.querySelectorAll(".menu-item")];
        const index = buttons.indexOf(document.activeElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        buttons[(index + step + buttons.length) % buttons.length].focus();
      } else if (event.key === "Tab") {
        closePlayerMenu();
      }
    },
    true,
  );
  window.addEventListener("resize", closePlayerMenu);
  // Not "scroll": opening the menu on a half-visible row scrolls it into view,
  // and that scroll event would shut the menu straight away.
  ["wheel", "touchmove"].forEach((type) =>
    document.addEventListener(
      type,
      (event) => {
        if (playerMenu && !playerMenu.node.contains(event.target)) {
          closePlayerMenu();
        }
      },
      { capture: true, passive: true },
    ),
  );

  function renderPlayerLogins() {
    if (!playerLoginList) {
      return;
    }
    if (!state.players.length) {
      playerLoginList.replaceChildren(el("li", { className: "meta" }, "Add players to give them a login."));
      return;
    }
    playerLoginList.replaceChildren(
      ...state.players.map((player) => {
        const buttons = [
          el(
            "button",
            { type: "button", className: "btn", onClick: () => managePlayerLogin(player) },
            player.has_login ? "Reset login" : "Set login",
          ),
        ];
        if (player.has_login) {
          buttons.push(
            el(
              "button",
              { type: "button", className: "btn btn-danger", onClick: () => clearPlayerLogin(player) },
              "Remove",
            ),
          );
        }
        return el(
          "li",
          { className: "login-item" },
          el(
            "div",
            { className: "login-info" },
            el("strong", {}, [jersey(player), player.name].filter(Boolean).join(" ")),
            player.has_login
              ? el("span", { className: "meta" }, `Username: ${player.username || "—"}`)
              : null,
          ),
          el("span", { className: player.has_login ? "tag on" : "tag" }, player.has_login ? "Login set" : "No login"),
          el("div", { className: "login-actions" }, buttons),
        );
      }),
    );
  }

  function managePlayerLogin(player) {
    if (!player || !playerLoginModal) {
      return;
    }
    loginTargetId = player.id;
    const has = player.has_login;
    const title = document.getElementById("player-login-title");
    const help = document.getElementById("player-login-help");
    if (title) {
      title.textContent = `${has ? "Reset" : "Set"} login for ${player.name}`;
    }
    if (help) {
      help.textContent = has
        ? "Enter a new username and password for this player. The current login will stop working."
        : "Give this player a username and password so they can sign in and view their own development.";
    }
    playerLoginForm.reset();
    if (playerLoginUsername) {
      playerLoginUsername.value = player.username || "";
    }
    if (typeof playerLoginModal.showModal === "function") {
      playerLoginModal.showModal();
    } else {
      playerLoginModal.setAttribute("open", "");
    }
    if (playerLoginUsername) {
      playerLoginUsername.focus();
    }
  }

  function closePlayerLoginModal() {
    if (playerLoginModal.open) {
      playerLoginModal.close();
    } else {
      playerLoginModal.removeAttribute("open");
    }
  }

  async function clearPlayerLogin(player) {
    if (!player) {
      return;
    }
    if (!window.confirm(`Remove ${player.name}'s login? They will no longer be able to sign in.`)) {
      return;
    }
    try {
      await request(`/api/players/${encodeURIComponent(player.id)}/login`, {
        method: "DELETE",
      });
      await loadPlayers();
    } catch (error) {
      showError(error.message);
    }
  }

  // -- authentication ----------------------------------------------------
  function showLogin() {
    state.role = null;
    state.csrf = null;
    state.player = null;
    state.accessLevel = "";
    state.can = { admin: false, content: false, view_all: false };
    state.players = [];
    state.staff = [];
    state.selectedId = null;
    state.detail = null;
    state.team = {};
    state.alarms = [];
    state.messages = [];
    state.staffName = "";
    stopShell();
    renderBrandTeam();
    showCommIcons();
    renderCommBadges();
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
    appView.classList.add("hidden");
    appView.classList.remove("role-player", "no-admin", "collapsed", "menu-open");
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
    state.accessLevel = session.access_level || "";
    state.can = session.can || { admin: false, content: false, view_all: false };
    state.staffName = session.staff_name || "";
    loginError.textContent = "";
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    // Only "Full" staff and coaches see the roster admin tools.
    appView.classList.toggle("no-admin", !canAdmin());
    if (state.role === "player") {
      appView.classList.add("role-player");
      sessionLabel.textContent = state.player ? `Signed in: ${state.player.name}` : "Signed in";
      state.selectedId = state.player ? state.player.id : null;
      if (state.selectedId) {
        loadDetail(state.selectedId).catch((error) => showError(error.message));
      }
    } else {
      appView.classList.remove("role-player");
      if (state.role === "staff") {
        const lvl = state.accessLevel ? ` (${state.accessLevel})` : "";
        sessionLabel.textContent = `${session.staff_name || "Staff"}${lvl}`;
      } else {
        sessionLabel.textContent = "Signed in as Coach";
      }
      loadPlayers().catch((error) => showError(error.message));
      loadStaff().catch((error) => showError(error.message));
    }
    // Team + season appears in the header for both roles.
    loadTeam().catch((error) => showError(error.message));
    // Alarms + messages are available to both roles (compose vs inbox).
    showCommIcons();
    loadAlarms().catch(() => {});
    loadMessages().catch(() => {});
    startShell();
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
      if (loginForm) loginForm.reset();
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

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      doLogin({
        username: loginUsername ? loginUsername.value : "",
        password: loginPassword ? loginPassword.value : "",
      });
    });
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      await request("/api/logout", { method: "POST" });
    } catch (_error) {
      /* ignore */
    }
    showLogin();
  });

  // Admin modal: one tab per area (players, stats, staff, team).
  function selectAdminTab(name) {
    adminTabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).classList.toggle("hidden", !selected);
    });
  }

  function openAdminModal(tabName) {
    if (tabName) selectAdminTab(tabName);
    if (typeof adminModal.showModal === "function") {
      if (!adminModal.open) adminModal.showModal();
    } else {
      adminModal.setAttribute("open", "");
    }
  }

  function closeAdminModal() {
    if (adminModal.open && typeof adminModal.close === "function") {
      adminModal.close();
    } else {
      adminModal.removeAttribute("open");
    }
  }

  closeStatsBtn.addEventListener("click", closeStatsModal);
  statsModal.addEventListener("click", (event) => {
    if (event.target === statsModal) {
      closeStatsModal();
    }
  });

  // The old Game stats toggle remembered its state here; it no longer exists.
  try {
    window.localStorage.removeItem("idev.gameStatsOpen");
  } catch (error) {
    // Storage can be blocked in private browsing; nothing to clean up then.
  }

  adminBtn.addEventListener("click", () => openAdminModal());
  closeAdminBtn.addEventListener("click", closeAdminModal);

  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) {
      closeAdminModal();
    }
  });

  adminTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectAdminTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = adminTabs[(index + step + adminTabs.length) % adminTabs.length];
      selectAdminTab(next.dataset.tab);
      next.focus();
    });
  });

  // Add-player modal open/close.
  function openAddPlayerModal() {
    addForm.reset();
    const picked = shell.teams.filter((t) => shell.teamSel.has(t.id));
    if (picked.length === 1) addForm.elements.team_id.value = picked[0].id;
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
    renderStaffTeamChecks(staffTeamsBox, []);
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
    openTeamBtn.addEventListener("click", () => openTeamModal(null));
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
      const body = {
        name: form.get("name"),
        sport: form.get("sport"),
        year: form.get("year"),
        season: form.get("season"),
        age_bracket: form.get("age_bracket"),
        play_year: form.get("play_year"),
      };
      try {
        if (shell.editingTeamId) {
          await request(`/api/teams/${encodeURIComponent(shell.editingTeamId)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        } else {
          await request("/api/teams", { method: "POST", body: JSON.stringify(body) });
        }
        closeTeamModal();
        await loadTeams();
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
      if (!editTargetId) {
        return;
      }
      const form = new FormData(editPlayerForm);
      try {
        await request(`/api/players/${encodeURIComponent(editTargetId)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.get("name"),
            position: form.get("position"),
            secondary_position: form.get("secondary_position"),
            grad_year: form.get("grad_year"),
            number: form.get("number"),
            team_id: form.get("team_id") || undefined,
          }),
        });
        closeEditPlayer();
        loadTeams().catch(() => {});
        await loadPlayers();
      } catch (error) {
        showError(error.message);
      }
    });
  }

  if (cancelPlayerLogin) {
    cancelPlayerLogin.addEventListener("click", closePlayerLoginModal);
  }
  if (playerLoginModal) {
    playerLoginModal.addEventListener("click", (event) => {
      if (event.target === playerLoginModal) {
        closePlayerLoginModal();
      }
    });
  }
  if (playerLoginForm) {
    playerLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!loginTargetId) {
        return;
      }
      const username = playerLoginUsername.value.trim();
      const password = playerLoginPassword.value;
      try {
        await request(`/api/players/${encodeURIComponent(loginTargetId)}/login`, {
          method: "PUT",
          body: JSON.stringify({ username, password }),
        });
        closePlayerLoginModal();
        await loadPlayers();
      } catch (error) {
        showError(error.message);
      }
    });
  }

  if (cancelNote) {
    cancelNote.addEventListener("click", closeNoteModal);
  }
  if (noteModal) {
    noteModal.addEventListener("click", (event) => {
      if (event.target === noteModal) {
        closeNoteModal();
      }
    });
  }
  if (noteForm) {
    noteForm.addEventListener("submit", saveNote);
  }
  if (closeNoteView) {
    closeNoteView.addEventListener("click", closeNoteViewModal);
  }
  if (noteViewModal) {
    noteViewModal.addEventListener("click", (event) => {
      if (event.target === noteViewModal) {
        closeNoteViewModal();
      }
    });
  }

  if (alarmBtn) {
    alarmBtn.addEventListener("click", openAlarmModal);
  }
  if (closeAlarm) {
    closeAlarm.addEventListener("click", () => hideDialog(alarmModal));
  }
  if (alarmForm) {
    alarmForm.addEventListener("submit", submitAlarm);
  }
  if (alarmModal) {
    alarmModal.addEventListener("click", (event) => {
      if (event.target === alarmModal) {
        hideDialog(alarmModal);
      }
    });
  }
  if (messageBtn) {
    messageBtn.addEventListener("click", openMessageModal);
  }
  if (closeMessage) {
    closeMessage.addEventListener("click", () => hideDialog(messageModal));
  }
  if (messageForm) {
    messageForm.addEventListener("submit", submitMessage);
  }
  if (messageAudience) {
    messageAudience.addEventListener("change", updateMessageRecipient);
  }
  if (messageModal) {
    messageModal.addEventListener("click", (event) => {
      if (event.target === messageModal) {
        hideDialog(messageModal);
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
    const body = {
      name: form.get("name"),
      role: form.get("role"),
      contact: form.get("contact"),
      access_level: form.get("access_level"),
      team_ids: form.getAll("team_ids"),
    };
    const username = (form.get("username") || "").trim();
    const password = (form.get("password") || "").trim();
    if (username || password) {
      body.username = username;
      body.password = password;
    }
    try {
      await request("/api/staff", {
        method: "POST",
        body: JSON.stringify(body),
      });
      closeStaffModal();
      await loadStaff();
    } catch (error) {
      showError(error.message);
    }
  });

  cancelImport.addEventListener("click", () => {
    importForm.reset();
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
          body: JSON.stringify({ text, preview: true, team_id: importForm.elements.team_id.value || undefined }),
        });
        renderImportPreview(result);
        return;
      }
      const result = await request("/api/players/import", {
        method: "POST",
        body: JSON.stringify({ text, preview: false, team_id: importForm.elements.team_id.value || undefined }),
      });
      const imported = result.imported || [];
      importForm.reset();
      resetImportPreview();
      closeAdminModal();
      await loadPlayers(imported.length ? imported[0].id : undefined);
      loadTeams().catch(() => {});
    } catch (error) {
      resetImportPreview();
      showError(error.message);
    }
  });

  cancelStatsImport.addEventListener("click", () => {
    statsImportForm.reset();
    resetStatsImportPreview();
  });

  statsText.addEventListener("input", resetStatsImportPreview);

  statsFile.addEventListener("change", async () => {
    resetStatsImportPreview();
    const file = statsFile.files && statsFile.files[0];
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      statsFile.value = "";
      showError("Choose a .csv file");
      return;
    }
    if (file.size > 200 * 1024) {
      statsFile.value = "";
      showError("Stats file must be 200 KB or smaller");
      return;
    }
    try {
      statsText.value = await file.text();
    } catch (_error) {
      statsFile.value = "";
      showError("Could not read that file");
    }
  });

  statsImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = statsText.value;
    try {
      if (!state.statsImportReady) {
        const result = await request("/api/stats/import", {
          method: "POST",
          body: JSON.stringify({ text, preview: true }),
        });
        renderStatsImportPreview(result);
        return;
      }
      const result = await request("/api/stats/import", {
        method: "POST",
        body: JSON.stringify({ text, preview: false }),
      });
      const updated = result.updated || [];
      statsImportForm.reset();
      resetStatsImportPreview();
      closeAdminModal();
      await loadPlayers(updated.includes(state.selectedId) ? state.selectedId : updated[0]);
    } catch (error) {
      resetStatsImportPreview();
      showError(error.message);
    }
  });

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(addForm);
    const body = {
      name: form.get("name"),
      position: form.get("position"),
      secondary_position: form.get("secondary_position"),
      team_year: form.get("team_year"),
      grad_year: form.get("grad_year"),
      team_type: form.get("team_type"),
      number: form.get("number"),
      team_id: form.get("team_id") || undefined,
    };
    const username = (form.get("username") || "").trim();
    const password = (form.get("password") || "").trim();
    if (username || password) {
      body.username = username;
      body.password = password;
    }
    try {
      const created = await request("/api/players", {
        method: "POST",
        body: JSON.stringify(body),
      });
      addForm.reset();
      closeAddPlayerModal();
      closeAdminModal();
      await loadPlayers(created.id);
      loadTeams().catch(() => {});
    } catch (error) {
      showError(error.message);
    }
  });

  // ---------- Team shell: sidebar, Home, Schedule ----------
  const sideNav = document.getElementById("side-nav");
  const teamSwitchBtn = document.getElementById("team-switch");
  const teamSwitchName = document.getElementById("team-switch-name");
  const teamSwitchSub = document.getElementById("team-switch-sub");
  const collapseBtn = document.getElementById("collapse-btn");
  const nextCard = document.getElementById("next-card");
  const meBox = document.getElementById("me");
  const meAvatar = document.getElementById("me-avatar");
  const meName = document.getElementById("me-name");
  const sideScrim = document.getElementById("side-scrim");
  const hamburgerBtn = document.getElementById("hamburger");
  const pageHeading = document.getElementById("page-heading");
  const homeView = document.getElementById("home-view");
  const scheduleView = document.getElementById("schedule-view");
  const pageView = document.getElementById("page-view");
  const devView = document.getElementById("dev-view");
  const eventPop = document.getElementById("event-pop");
  const eventModal = document.getElementById("event-modal");
  const eventForm = document.getElementById("event-form");
  const eventTeamSelect = document.getElementById("event-team");
  const eventAllDay = document.getElementById("event-all-day");
  const eventTimes = document.getElementById("event-times");
  const deleteEventBtn = document.getElementById("delete-event");
  const staffTeamsBox = document.getElementById("staff-teams");

  const EVENT_TYPES = [
    { id: "practice", label: "Practice" },
    { id: "game", label: "Game" },
    { id: "tournament", label: "Tournament" },
    { id: "training", label: "Training" },
    { id: "scrimmage", label: "Scrimmage" },
  ];

  const SHELL_ICONS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
  };

  function shellIcon(name, cls) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", cls || "ico");
    svg.innerHTML = SHELL_ICONS[name];
    return svg;
  }

  // replaceChildren would print null/false as text, so drop them first.
  function fill(node, ...kids) {
    node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  }

  function readStored(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Private browsing can block storage; the setting still applies for this visit.
    }
  }

  const VIEWS = ["home", "schedule", "dev", "reports", "drills", "help"];

  const shell = {
    view: "home",
    teams: [],
    // Selected team ids; empty means every team the viewer can see.
    teamSel: new Set(),
    events: [],
    types: new Set(EVENT_TYPES.map((t) => t.id)),
    month: null,
    calMode: readStored("idev.calMode", "month") === "list" ? "list" : "month",
    collapsed: readStored("idev.sideCollapsed", "0") === "1",
    editingEventId: null,
    editingTeamId: null,
    eventsLoaded: false,
  };

  // ----- dates (events use local YYYY-MM-DD strings) -----
  function ymd(date) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
  }

  function parseYmd(text) {
    const [y, m, d] = String(text).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function addDays(date, n) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + n);
    return next;
  }

  function todayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function fmtDay(date) {
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function fmtTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function fmtTimeShort(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const hour = h % 12 || 12;
    return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "p" : "a"}`;
  }

  function eventTimeLabel(ev) {
    if (ev.all_day) return "All day";
    return ev.end_time ? `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}` : fmtTime(ev.start_time);
  }

  function eventSpanDays(ev) {
    return Math.round((parseYmd(ev.end_date || ev.date) - parseYmd(ev.date)) / 86400000) + 1;
  }

  function isPlayerView() {
    return state.role === "player";
  }

  function teamById(id) {
    return shell.teams.find((t) => t.id === id) || null;
  }

  function teamShort(id) {
    const team = teamById(id);
    return team ? team.name : "Team";
  }

  function typeLabel(id) {
    const type = EVENT_TYPES.find((t) => t.id === id);
    return type ? type.label : id;
  }

  function teamSelected(teamId) {
    return !shell.teamSel.size || shell.teamSel.has(teamId);
  }

  // Roster rail, Home numbers and the calendar all follow the team switcher.
  function teamPlayers() {
    if (shell.teams.length < 2 || !shell.teamSel.size) return state.players;
    return state.players.filter((p) => shell.teamSel.has(p.team_id));
  }

  function saveTeamSel() {
    writeStored("idev.teams", JSON.stringify([...shell.teamSel]));
  }

  function setTeamSel(ids) {
    shell.teamSel = new Set(ids);
    saveTeamSel();
    teamSelectionChanged();
  }

  function teamSelectionChanged() {
    renderTeamSwitch();
    renderBrandTeam();
    renderRoster();
    renderBrandMeta();
    const pool = teamPlayers();
    if (!isPlayerView() && pool.length && !pool.some((p) => p.id === state.selectedId)) {
      selectPlayer(pool[0].id);
    }
    renderShell();
  }

  // ----- loading -----
  async function loadTeams() {
    if (!state.role) return;
    const data = await request("/api/teams");
    shell.teams = data.teams || [];
    let stored = [];
    try {
      stored = JSON.parse(readStored("idev.teams", "[]"));
    } catch (_error) {
      stored = [];
    }
    const valid = (Array.isArray(stored) ? stored : []).filter((id) => teamById(id));
    shell.teamSel = new Set(isPlayerView() ? [] : valid);
    fillTeamSelects();
    renderTeamSummary();
    renderTeamSwitch();
    renderBrandTeam();
    renderRoster();
    renderBrandMeta();
    renderManagePlayers();
    renderShell();
  }

  function eventsWindow() {
    const today = todayDate();
    const month = shell.month || new Date(today.getFullYear(), today.getMonth(), 1);
    const gridStart = addDays(month, -month.getDay());
    const gridEnd = addDays(gridStart, 41);
    const from = gridStart < today ? gridStart : addDays(today, -1);
    const horizon = addDays(today, 45);
    const to = gridEnd > horizon ? gridEnd : horizon;
    return { from: ymd(from), to: ymd(to) };
  }

  async function loadEvents() {
    if (!state.role) return;
    const range = eventsWindow();
    const data = await request(`/api/events?from=${range.from}&to=${range.to}`);
    shell.events = data.events || [];
    shell.eventsLoaded = true;
    renderShell();
  }

  function visibleEvents() {
    return shell.events.filter((ev) => teamSelected(ev.team_id) && shell.types.has(ev.type));
  }

  function eventsOn(day) {
    const key = ymd(day);
    return visibleEvents().filter((ev) => ev.date <= key && key <= (ev.end_date || ev.date));
  }

  function upcoming(days) {
    const out = [];
    const today = todayDate();
    for (let i = 0; i < days; i += 1) {
      const day = addDays(today, i);
      const list = eventsOn(day);
      if (list.length) out.push({ day, list });
    }
    return out;
  }

  function nextEvent() {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = todayDate();
    for (let i = 0; i < 45; i += 1) {
      const day = addDays(today, i);
      const list = eventsOn(day).filter(
        (ev) => i > 0 || ev.all_day || (ev.end_time || ev.start_time) >= nowTime,
      );
      if (list.length) return { day, ev: list[0] };
    }
    return null;
  }

  // ----- sidebar -----
  function navGroups() {
    const messagesBadge = isPlayerView() ? unreadCount(state.messages) : 0;
    const alarmsBadge = isPlayerView() ? unreadCount(state.alarms) : 0;
    if (isPlayerView()) {
      return [
        [
          { id: "home", label: "Home", icon: "home" },
          { id: "schedule", label: "Schedule", icon: "calendar" },
          { id: "dev", label: "My Development", icon: "trend" },
        ],
        [
          { id: "messages", label: "Messages", icon: "mail", badge: messagesBadge, action: openMessageModal },
          { id: "alarms", label: "Reminders", icon: "bell", badge: alarmsBadge, action: openAlarmModal },
          { id: "help", label: "Help", icon: "help" },
        ],
      ];
    }
    const manage = [];
    if (canAdmin()) {
      manage.push(
        { id: "roster", label: "Roster & Logins", icon: "users", action: () => openAdminModal("players") },
        { id: "teams", label: "Team & Staff", icon: "shield", action: () => openAdminModal("team") },
      );
    }
    manage.push(
      { id: "messages", label: "Messages", icon: "mail", action: openMessageModal },
      { id: "alarms", label: "Alarms", icon: "bell", action: openAlarmModal },
      { id: "help", label: "Help", icon: "help" },
    );
    return [
      [
        { id: "home", label: "Home", icon: "home" },
        { id: "schedule", label: "Schedule", icon: "calendar" },
        { id: "dev", label: "Player Development", icon: "trend" },
        { id: "reports", label: "Reports", icon: "chart" },
        { id: "drills", label: "Drills & Plans", icon: "clipboard" },
      ],
      manage,
    ];
  }

  function renderSide() {
    if (!sideNav) return;
    appView.classList.toggle("collapsed", shell.collapsed);
    fill(collapseBtn, shellIcon("chevL"));
    const label = shell.collapsed ? "Expand menu" : "Minimize menu";
    collapseBtn.setAttribute("aria-label", label);
    collapseBtn.title = label;
    collapseBtn.setAttribute("aria-expanded", String(!shell.collapsed));

    fill(
      sideNav,
      navGroups().map((items, i) => [
        i ? el("div", { className: "nav-sep", role: "separator" }) : null,
        el(
          "ul",
          { className: "nav-list" },
          items.map((item) => {
            const active = !item.action && shell.view === item.id;
            return el(
              "li",
              {},
              el(
                "button",
                {
                  type: "button",
                  className: "nav-item" + (active ? " active" : ""),
                  "aria-current": active ? "page" : undefined,
                  "aria-label": item.label,
                  "data-tip": item.badge ? `${item.label} (${item.badge})` : item.label,
                  dataset: { nav: item.id },
                  onClick: () => {
                    closeDrawer();
                    if (item.action) item.action();
                    else go(item.id);
                  },
                },
                shellIcon(item.icon),
                el("span", { className: "nav-label" }, item.label),
                item.badge ? el("span", { className: "nav-badge" }, item.badge > 99 ? "99+" : String(item.badge)) : null,
              ),
            );
          }),
        ),
      ]),
    );

    const who = whoAmI();
    meAvatar.textContent = initialsOf(who);
    meName.textContent = who;
    meBox.setAttribute("data-tip", who);
    renderNextCard();
  }

  function whoAmI() {
    if (isPlayerView()) return (state.player && state.player.name) || "Player";
    if (state.role === "staff") return state.staffName || "Staff";
    return "Coach";
  }

  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function renderTeamSwitch() {
    if (!teamSwitchBtn) return;
    const sports = new Set(shell.teams.map((t) => t.sport));
    if (isPlayerView() || shell.teams.length < 2) {
      const team = shell.teams[0];
      teamSwitchName.textContent = team ? team.name : "My team";
      teamSwitchSub.textContent = team ? [team.sport, team.season, team.year].filter(Boolean).join(" · ") : "";
      teamSwitchBtn.disabled = true;
      return;
    }
    teamSwitchBtn.disabled = false;
    if (!shell.teamSel.size) {
      teamSwitchName.textContent = "All teams";
      teamSwitchSub.textContent = `${plural(shell.teams.length, "team")} · ${plural(sports.size, "sport")}`;
    } else {
      const picked = shell.teams.filter((t) => shell.teamSel.has(t.id));
      teamSwitchName.textContent = picked.length === 1 ? picked[0].name : `${picked.length} teams`;
      teamSwitchSub.textContent =
        picked.length === 1 ? picked[0].sport : picked.map((t) => t.name).join(" · ");
    }
  }

  let teamMenu = null;

  function closeTeamMenu() {
    if (teamMenu) {
      teamMenu.remove();
      teamMenu = null;
    }
  }

  function openTeamMenu() {
    if (teamMenu) {
      closeTeamMenu();
      return;
    }
    const option = (label, sub, checked, pick) =>
      el(
        "button",
        {
          type: "button",
          role: "menuitemradio",
          "aria-checked": String(checked),
          onClick: () => {
            closeTeamMenu();
            pick();
          },
        },
        label,
        sub ? el("span", { className: "team-menu-sub" }, sub) : null,
      );
    teamMenu = el(
      "div",
      { className: "team-menu", role: "menu", "aria-label": "Choose team" },
      option("All teams", plural(shell.teams.length, "team"), !shell.teamSel.size, () => setTeamSel([])),
      shell.teams.map((team) =>
        option(
          team.name,
          [team.sport, plural(team.player_count || 0, "player")].join(" · "),
          shell.teamSel.size === 1 && shell.teamSel.has(team.id),
          () => setTeamSel([team.id]),
        ),
      ),
    );
    document.body.append(teamMenu);
    const box = teamSwitchBtn.getBoundingClientRect();
    teamMenu.style.left = `${Math.max(8, box.left)}px`;
    teamMenu.style.top = `${box.bottom + 6}px`;
    const first = teamMenu.querySelector("button");
    if (first) first.focus();
  }

  function renderNextCard() {
    const next = shell.eventsLoaded ? nextEvent() : null;
    if (!next) {
      nextCard.classList.add("hidden");
      nextCard.replaceChildren();
      return;
    }
    const today = todayDate();
    const when = next.day.getTime() === today.getTime() ? "Today" : fmtDay(next.day);
    const time = next.ev.all_day ? "All day" : fmtTime(next.ev.start_time);
    fill(
      nextCard,
      el("p", { className: "next-eyebrow" }, "Next up"),
      el("span", { className: `type-dot t-${next.ev.type}` }),
      el("p", { className: "next-title" }, next.ev.title),
      el("p", { className: "next-meta" }, `${when} · ${time}`),
      el(
        "p",
        { className: "next-meta" },
        [shell.teams.length > 1 ? teamShort(next.ev.team_id) : "", next.ev.location].filter(Boolean).join(" · "),
      ),
      el(
        "button",
        {
          type: "button",
          className: "btn btn-primary btn-block btn-sm",
          onClick: (e) => openEventPop(next.ev, e.currentTarget),
        },
        "View details",
      ),
    );
    nextCard.classList.remove("hidden");
  }

  function closeDrawer() {
    appView.classList.remove("menu-open");
  }

  // ----- routing -----
  function viewFromHash() {
    const name = (window.location.hash || "").replace(/^#/, "");
    return VIEWS.includes(name) ? name : "home";
  }

  function go(view) {
    const target = VIEWS.includes(view) ? view : "home";
    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
      return;
    }
    showView(target);
  }

  function showView(view) {
    shell.view = view;
    closeEventPop();
    closeDrawer();
    homeView.classList.toggle("hidden", view !== "home");
    scheduleView.classList.toggle("hidden", view !== "schedule");
    devView.classList.toggle("hidden", view !== "dev");
    pageView.classList.toggle("hidden", !["reports", "drills", "help"].includes(view));
    const headings = {
      home: "Home",
      schedule: "Schedule",
      dev: isPlayerView() ? "My development" : "Player development",
      reports: "Reports",
      drills: "Drills & plans",
      help: "Help",
    };
    pageHeading.textContent = headings[view];
    // Home, Schedule and the info pages carry their own large title.
    pageHeading.classList.toggle("hidden", view !== "dev");
    renderShell();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", () => {
    if (state.role) showView(viewFromHash());
  });

  function renderShell() {
    if (!state.role) return;
    renderSide();
    if (shell.view === "home") renderHome();
    else if (shell.view === "schedule") renderSchedule();
    else if (["reports", "drills", "help"].includes(shell.view)) renderPage(shell.view);
  }

  // ----- shared pieces -----
  function typeChips(onChange, range) {
    const allTypes = shell.types.size === EVENT_TYPES.length;
    const counts = {};
    shell.events.forEach((ev) => {
      if (!teamSelected(ev.team_id)) return;
      if (range && ((ev.end_date || ev.date) < range.from || ev.date > range.to)) return;
      counts[ev.type] = (counts[ev.type] || 0) + 1;
    });
    return el(
      "div",
      { className: "chips", role: "group", "aria-label": "Event types" },
      el(
        "button",
        {
          type: "button",
          className: "chip chip-all" + (allTypes ? " on" : ""),
          "aria-pressed": String(allTypes),
          onClick: () => {
            shell.types = new Set(EVENT_TYPES.map((t) => t.id));
            onChange();
          },
        },
        "All events",
      ),
      EVENT_TYPES.map((t) =>
        el(
          "button",
          {
            type: "button",
            className: `chip t-${t.id}` + (shell.types.has(t.id) && !allTypes ? " on" : ""),
            "aria-pressed": String(shell.types.has(t.id) && !allTypes),
            onClick: () => {
              // First click from "All" narrows to that type; later clicks add or remove.
              if (allTypes) shell.types = new Set([t.id]);
              else if (shell.types.has(t.id)) shell.types.delete(t.id);
              else shell.types.add(t.id);
              if (!shell.types.size) shell.types = new Set(EVENT_TYPES.map((x) => x.id));
              onChange();
            },
          },
          el("span", { className: `type-dot t-${t.id}` }),
          t.label,
          el("span", { className: "chip-count" }, String(counts[t.id] || 0)),
        ),
      ),
    );
  }

  function teamChips(onChange) {
    if (isPlayerView() || shell.teams.length < 2) return null;
    return el(
      "div",
      { className: "chips", role: "group", "aria-label": "Teams" },
      shell.teams.map((team) => {
        const on = teamSelected(team.id);
        return el(
          "button",
          {
            type: "button",
            className: "chip chip-team" + (on ? " on" : ""),
            "aria-pressed": String(on),
            onClick: () => {
              const ids = shell.teamSel.size ? new Set(shell.teamSel) : new Set(shell.teams.map((t) => t.id));
              if (ids.has(team.id)) {
                if (ids.size === 1) return;
                ids.delete(team.id);
              } else {
                ids.add(team.id);
              }
              shell.teamSel = ids.size === shell.teams.length ? new Set() : ids;
              saveTeamSel();
              teamSelectionChanged();
              onChange();
            },
          },
          el("span", { className: "chip-check" }, on ? shellIcon("check") : null),
          team.name,
          el("span", { className: "chip-sport" }, team.sport),
        );
      }),
    );
  }

  function eventRow(ev, day) {
    const span = eventSpanDays(ev);
    const dayIndex = Math.round((day - parseYmd(ev.date)) / 86400000) + 1;
    return el(
      "button",
      { type: "button", className: `ev-row t-${ev.type}`, onClick: (e) => openEventPop(ev, e.currentTarget) },
      el("span", { className: "ev-time mono" }, ev.all_day ? "All day" : fmtTime(ev.start_time)),
      el(
        "span",
        { className: "ev-main" },
        el(
          "span",
          { className: "ev-title" },
          ev.title,
          span > 1 ? el("span", { className: "ev-days" }, ` · day ${dayIndex} of ${span}`) : null,
        ),
        ev.location ? el("span", { className: "ev-sub" }, shellIcon("pin", "ico ico-sm"), ev.location) : null,
      ),
      !isPlayerView() && shell.teams.length > 1 ? el("span", { className: "ev-team" }, teamShort(ev.team_id)) : el("span", {}),
      el("span", { className: `type-pill t-${ev.type}` }, typeLabel(ev.type)),
    );
  }

  function agendaList(days, full) {
    const today = todayDate();
    return el(
      "div",
      { className: "agenda" + (full ? " agenda-full" : "") },
      days.map(({ day, list }) => {
        const isToday = day.getTime() === today.getTime();
        return el(
          "div",
          { className: "agenda-day" },
          el("p", { className: "agenda-date" + (isToday ? " today" : "") }, isToday ? (full ? `Today · ${fmtDay(day)}` : "Today") : fmtDay(day)),
          list.map((ev) => eventRow(ev, day)),
        );
      }),
    );
  }

  function kpiCard(k) {
    return el(
      "article",
      { className: `kpi a-${k.accent}` },
      el("p", { className: "kpi-label" }, k.label),
      el("p", { className: "kpi-value" }, k.value, k.unit ? el("span", { className: "kpi-unit" }, ` ${k.unit}`) : null),
      k.foot ? el("p", { className: "kpi-foot" + (k.footCls ? ` ${k.footCls}` : "") }, k.foot) : null,
    );
  }

  function greeting() {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    if (isPlayerView()) {
      const first = ((state.player && state.player.name) || "").split(/\s+/)[0];
      return first ? `Hi ${first}` : "Hi there";
    }
    return state.role === "staff" && state.staffName ? `${part}, ${state.staffName}` : `${part}, Coach`;
  }

  function pageTop(title, actions) {
    return el(
      "div",
      { className: "page-top" },
      el(
        "div",
        { className: "page-titles" },
        el(
          "p",
          { className: "eyebrow" },
          new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        ),
        el("h1", {}, title),
      ),
      actions && actions.length ? el("div", { className: "page-actions" }, actions) : null,
    );
  }

  // ----- Home -----
  function renderHome() {
    const week = upcoming(7);
    const weekCount = week.reduce((sum, d) => sum + d.list.length, 0);
    const next = shell.eventsLoaded ? nextEvent() : null;
    const player = isPlayerView();
    const players = teamPlayers();

    const actions = [];
    if (!player) {
      actions.push(
        el("button", { type: "button", className: "btn", onClick: () => go("dev") }, shellIcon("star"), "Rate a player"),
      );
      if (canContent()) {
        actions.push(
          el("button", { type: "button", className: "btn btn-primary", onClick: () => openEventModal(null) }, shellIcon("plus"), "Add event"),
        );
      }
    }

    let kpis;
    if (player) {
      const metrics = state.detail ? computeMetrics(state.detail) : null;
      const change = state.detail ? Number(state.detail.week_change) : NaN;
      const changeView = Number.isFinite(change) ? weekChangeView(change) : null;
      kpis = [
        {
          label: "My overall",
          value: metrics && metrics.rated ? String(metrics.overall) : "—",
          unit: metrics && metrics.rated ? "%" : "",
          accent: "cyan",
          foot: changeView && changeView.text ? `${changeView.text} since last week` : "No change since last week",
          footCls: changeView ? changeView.cls : "",
        },
        {
          label: "My top skill",
          value: metrics && metrics.top ? metrics.top.name : "—",
          accent: "green",
          foot: metrics && metrics.top ? `${roundHalf(metrics.top.value)} / 5` : "Not rated yet",
        },
        { label: "This week", value: String(weekCount), unit: weekCount === 1 ? "event" : "events", accent: "orange", foot: next ? `Next: ${next.ev.title}` : "Nothing scheduled" },
        { label: "Messages", value: String(unreadCount(state.messages)), unit: "unread", accent: "purple", foot: `${plural(unreadCount(state.alarms), "reminder")} unread` },
      ];
    } else {
      const changes = players.map((p) => Number(p.week_change)).filter((v) => Number.isFinite(v));
      const ups = changes.filter((v) => v >= 0.05);
      const downs = changes.filter((v) => v <= -0.05);
      const avg = (list) => (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1);
      const sports = new Set(shell.teams.filter((t) => teamSelected(t.id)).map((t) => t.sport));
      const teamCount = shell.teams.filter((t) => teamSelected(t.id)).length;
      const noLogin = players.filter((p) => !p.has_login).length;
      kpis = [
        { label: "Players", value: String(players.length), accent: "cyan", foot: `${plural(teamCount, "team")} · ${plural(sports.size, "sport")}` },
        { label: "Improved this week", value: String(ups.length), accent: "green", foot: ups.length ? `\u25B2 avg +${avg(ups)}` : "No rating gains yet", footCls: ups.length ? "up" : "" },
        { label: "Dropped this week", value: String(downs.length), accent: "red", foot: downs.length ? `\u25BC avg ${avg(downs)}` : "No drops", footCls: downs.length ? "down" : "" },
        { label: "This week", value: String(weekCount), unit: weekCount === 1 ? "event" : "events", accent: "orange", foot: next ? `Next: ${next.ev.title}` : "Nothing scheduled" },
        canAdmin()
          ? { label: "No login yet", value: String(noLogin), unit: noLogin === 1 ? "player" : "players", accent: "purple", foot: noLogin ? "Set up in Roster & Logins" : "Everyone can sign in" }
          : { label: "Staff", value: String((state.staff || []).length), accent: "purple", foot: "Coaches and helpers" },
      ];
    }

    const agenda = el(
      "section",
      { className: "card agenda-card" },
      el(
        "div",
        { className: "card-head" },
        el(
          "div",
          {},
          el("h2", {}, "Coming up"),
          el("p", { className: "meta" }, player ? "Your team's next 7 days" : shell.teamSel.size ? "Selected teams · next 7 days" : "All teams · next 7 days"),
        ),
        el("button", { type: "button", className: "link-btn", onClick: () => go("schedule") }, "Open calendar", shellIcon("chevR", "ico ico-sm")),
      ),
      el("div", { className: "filters" }, typeChips(renderHome, { from: ymd(todayDate()), to: ymd(addDays(todayDate(), 6)) })),
      !shell.eventsLoaded
        ? el("p", { className: "empty" }, "Loading schedule…")
        : week.length
          ? agendaList(week, false)
          : el(
              "p",
              { className: "empty" },
              shell.events.length ? "No events match these filters this week." : canContent() ? "Nothing on the schedule yet. Use Add event to create practices, games and more." : "Nothing on the schedule yet.",
            ),
    );

    const movers = player ? myProgressCard() : topMoversCard(players);

    const modules = player ? playerModules(weekCount) : coachModules(weekCount, players);
    const grid = el(
      "section",
      { className: "modules-wrap" },
      el("h2", { className: "section-title" }, player ? "My tools" : "Manage"),
      el(
        "div",
        { className: "modules" },
        modules.map((m) =>
          el(
            "button",
            { type: "button", className: "module", onClick: m.action },
            el("span", { className: "module-ico" }, shellIcon(m.icon)),
            el(
              "span",
              { className: "module-text" },
              el("span", { className: "module-title" }, m.title),
              el("span", { className: "module-desc" }, m.desc),
              m.live ? el("span", { className: "module-live" }, m.live) : null,
            ),
          ),
        ),
      ),
    );

    fill(homeView, pageTop(greeting(), actions), el("div", { className: "kpis" }, kpis.map(kpiCard)), el("div", { className: "home-row" }, agenda, movers), grid);
  }

  function topMoversCard(players) {
    const moved = players
      .filter((p) => Number.isFinite(Number(p.week_change)) && Math.abs(Number(p.week_change)) >= 0.05)
      .sort((a, b) => Math.abs(Number(b.week_change)) - Math.abs(Number(a.week_change)))
      .slice(0, 6);
    return el(
      "section",
      { className: "card movers-card" },
      el("div", { className: "card-head" }, el("div", {}, el("h2", {}, "Top movers"), el("p", { className: "meta" }, "Average rating change since last week"))),
      moved.length
        ? el(
            "ul",
            { className: "movers" },
            moved.map((p) => {
              const change = Number(p.week_change);
              return el(
                "li",
                {},
                el(
                  "button",
                  {
                    type: "button",
                    className: "mover mover-btn",
                    onClick: () => {
                      go("dev");
                      selectPlayer(p.id);
                    },
                  },
                  el("span", { className: "mover-num" }, p.number === null || p.number === undefined ? "—" : `#${p.number}`),
                  el("span", { className: "mover-name" }, p.name, el("span", { className: "mover-skill" }, positionLabel(p) || " ")),
                  el("span", { className: "mover-chg " + (change > 0 ? "up" : "down") }, `${change > 0 ? "\u25B2" : "\u25BC"} ${Math.abs(change).toFixed(1)}`),
                ),
              );
            }),
          )
        : el("p", { className: "empty" }, "No rating changes this week yet."),
    );
  }

  function myProgressCard() {
    const rated = state.detail ? (state.detail.progress || []).filter((item) => item.current) : [];
    const items = progressRows(rated)
      .filter((row) => row && row.change !== null && row.change !== undefined && Math.abs(row.change) >= 0.05)
      .slice(0, 6);
    return el(
      "section",
      { className: "card movers-card" },
      el("div", { className: "card-head" }, el("div", {}, el("h2", {}, "My progress"), el("p", { className: "meta" }, "Change since the previous rating"))),
      items.length
        ? el(
            "ul",
            { className: "movers" },
            items.map((row) =>
              el(
                "li",
                { className: "mover" },
                el("span", { className: "mover-name" }, row.name, el("span", { className: "mover-skill" }, `Now ${row.current} / 5`)),
                el("span", { className: "mover-chg " + (row.change > 0 ? "up" : "down") }, `${row.change > 0 ? "\u25B2" : "\u25BC"} ${Math.abs(row.change)}`),
              ),
            ),
          )
        : el("p", { className: "empty" }, "No rating changes yet."),
      el("button", { type: "button", className: "link-btn", onClick: () => go("dev") }, "Open My Development", shellIcon("chevR", "ico ico-sm")),
    );
  }

  function coachModules(weekCount, players) {
    const improved = players.filter((p) => Number(p.week_change) >= 0.05).length;
    const noLogin = players.filter((p) => !p.has_login).length;
    const list = [
      { icon: "calendar", title: "Schedule", desc: "Practices, games, tournaments, training and scrimmages across every team.", live: `${plural(weekCount, "event")} this week`, action: () => go("schedule") },
      { icon: "trend", title: "Player Development", desc: "Skill ratings, performance profiles, progress tables and GameChanger stats.", live: improved ? `${improved} improved this week` : "", action: () => go("dev") },
      { icon: "chart", title: "Reports", desc: "Team skill averages over time, most improved and not rated recently.", live: "Coming next", action: () => go("reports") },
      { icon: "clipboard", title: "Drills & Practice Plans", desc: "A team drill library and practice plans for schedule events.", live: "Coming next", action: () => go("drills") },
    ];
    if (canAdmin()) {
      list.push(
        { icon: "users", title: "Roster & Logins", desc: "Add, import and edit players; manage player logins.", live: noLogin ? `${plural(noLogin, "player")} without a login` : "", action: () => openAdminModal("players") },
        { icon: "shield", title: "Team & Staff", desc: "Teams and sports, seasons, coaches and staff access levels.", live: `${plural(shell.teams.length, "team")} · ${plural((state.staff || []).length, "staff member")}`, action: () => openAdminModal("team") },
      );
    }
    list.push(
      { icon: "mail", title: "Messages & Alarms", desc: "Message the team, staff or one player; send reminders.", live: "", action: openMessageModal },
      { icon: "help", title: "Help", desc: "How the pages fit together, and where your data is saved.", live: "", action: () => go("help") },
    );
    return list;
  }

  function playerModules(weekCount) {
    const metrics = state.detail ? computeMetrics(state.detail) : null;
    return [
      { icon: "calendar", title: "Schedule", desc: "Practices, games, tournaments, training and scrimmages for your team.", live: `${plural(weekCount, "event")} this week`, action: () => go("schedule") },
      { icon: "trend", title: "My Development", desc: "Skill ratings, performance profile, progress history and coach notes.", live: metrics && metrics.rated ? `Overall ${metrics.overall}%` : "", action: () => go("dev") },
      { icon: "mail", title: "Messages", desc: "Messages from your coaches.", live: unreadCount(state.messages) ? `${unreadCount(state.messages)} unread` : "", action: openMessageModal },
      { icon: "help", title: "Help", desc: "How to read your ratings and use the app.", live: "", action: () => go("help") },
    ];
  }

  // ----- Schedule -----
  function renderSchedule() {
    const today = todayDate();
    if (!shell.month) shell.month = new Date(today.getFullYear(), today.getMonth(), 1);
    const first = shell.month;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const shift = (n) => {
      shell.month = new Date(first.getFullYear(), first.getMonth() + n, 1);
      renderSchedule();
      loadEvents().catch((error) => showError(error.message));
    };
    const actions = canContent()
      ? [el("button", { type: "button", className: "btn btn-primary", onClick: () => openEventModal(null) }, shellIcon("plus"), "Add event")]
      : [];

    const toolbar = el(
      "div",
      { className: "cal-toolbar" },
      el(
        "div",
        { className: "cal-nav" },
        el("button", { type: "button", className: "icon-btn", "aria-label": "Previous month", onClick: () => shift(-1) }, shellIcon("chevL")),
        el("h2", { className: "cal-month" }, first.toLocaleDateString(undefined, { month: "long", year: "numeric" })),
        el("button", { type: "button", className: "icon-btn", "aria-label": "Next month", onClick: () => shift(1) }, shellIcon("chevR")),
        el(
          "button",
          {
            type: "button",
            className: "btn btn-sm",
            onClick: () => {
              const now = todayDate();
              shift((now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth());
            },
          },
          "Today",
        ),
      ),
      el(
        "div",
        { className: "seg", role: "group", "aria-label": "Calendar view" },
        ["month", "list"].map((mode) =>
          el(
            "button",
            {
              type: "button",
              className: "seg-btn" + (shell.calMode === mode ? " on" : ""),
              "aria-pressed": String(shell.calMode === mode),
              onClick: () => {
                shell.calMode = mode;
                writeStored("idev.calMode", mode);
                renderSchedule();
              },
            },
            shellIcon(mode === "month" ? "grid" : "list", "ico ico-sm"),
            mode === "month" ? "Month" : "List",
          ),
        ),
      ),
    );

    const range = { from: ymd(first), to: ymd(last) };
    const monthEvents = visibleEvents().filter((ev) => (ev.end_date || ev.date) >= range.from && ev.date <= range.to);
    const shownTeams = shell.teams.filter((t) => teamSelected(t.id));
    const summary = el(
      "p",
      { className: "meta cal-summary" },
      `Showing ${plural(monthEvents.length, "event")}` +
        (isPlayerView() || shell.teams.length < 2
          ? shell.teams[0] ? ` for ${shell.teams[0].name}` : ""
          : ` across ${shownTeams.length} of ${plural(shell.teams.length, "team")}`),
    );

    let body;
    if (shell.calMode === "month") {
      const startGrid = addDays(first, -first.getDay());
      const cells = [];
      for (let i = 0; i < 42; i += 1) {
        const day = addDays(startGrid, i);
        if (i >= 35 && day.getMonth() !== first.getMonth()) break;
        const list = eventsOn(day);
        const shown = list.slice(0, 3);
        const canAdd = canContent();
        cells.push(
          el(
            "div",
            {
              className:
                "cal-cell" +
                (day.getMonth() !== first.getMonth() ? " out" : "") +
                (day.getTime() === today.getTime() ? " today" : "") +
                (canAdd ? " can-add" : ""),
              title: canAdd ? `Add an event on ${fmtDay(day)}` : undefined,
              onClick: canAdd
                ? (e) => {
                    if (e.target.closest(".cal-ev")) return;
                    openEventModal(null, ymd(day));
                  }
                : undefined,
            },
            el("span", { className: "cal-date" }, String(day.getDate())),
            shown.map((ev) =>
              el(
                "button",
                {
                  type: "button",
                  className: `cal-ev t-${ev.type}`,
                  title: `${ev.title} · ${teamShort(ev.team_id)}`,
                  onClick: (e) => openEventPop(ev, e.currentTarget),
                },
                el("span", { className: "cal-ev-time" }, ev.all_day ? "All day" : fmtTimeShort(ev.start_time)),
                el("span", { className: "cal-ev-title" }, ev.title),
              ),
            ),
            list.length > shown.length
              ? el(
                  "button",
                  {
                    type: "button",
                    className: "cal-more link-btn",
                    onClick: () => {
                      shell.calMode = "list";
                      renderSchedule();
                    },
                  },
                  `+${list.length - shown.length} more`,
                )
              : null,
          ),
        );
      }
      body = el(
        "div",
        { className: "cal" },
        el("div", { className: "cal-head" }, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => el("span", {}, d))),
        el("div", { className: "cal-grid" }, cells),
      );
    } else {
      const days = [];
      for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
        const list = eventsOn(d);
        if (list.length) days.push({ day: d, list });
      }
      body = days.length ? agendaList(days, true) : el("p", { className: "empty" }, "No events match these filters this month.");
    }

    fill(
      scheduleView,
      pageTop("Schedule", actions),
      el(
        "section",
        { className: "card cal-card" },
        toolbar,
        el("div", { className: "filters" }, typeChips(renderSchedule, range), teamChips(renderSchedule)),
        summary,
        body,
        isPlayerView() ? el("p", { className: "privacy-note" }, "You only see events for your own team.") : null,
      ),
    );
  }

  // ----- Event popover -----
  let popEvent = null;

  function closeEventPop() {
    popEvent = null;
    if (eventPop) eventPop.classList.add("hidden");
  }

  function openEventPop(ev, anchor) {
    popEvent = ev;
    const team = teamById(ev.team_id);
    const span = eventSpanDays(ev);
    const start = parseYmd(ev.date);
    const dateLine = span > 1 ? `${fmtDay(start)} – ${fmtDay(parseYmd(ev.end_date))}` : fmtDay(start);
    const actions = [];
    if (isPlayerView()) {
      const answer = (status) =>
        el(
          "button",
          {
            type: "button",
            className: "btn rsvp-btn" + (status === "yes" ? " btn-primary" : " no") + (ev.my_rsvp === status ? " on" : ""),
            "aria-pressed": String(ev.my_rsvp === status),
            onClick: () => sendRsvp(ev, ev.my_rsvp === status ? "" : status, anchor),
          },
          status === "yes" ? "I'll be there" : "Can't make it",
        );
      actions.push(answer("yes"), answer("no"));
    } else if (canContent()) {
      actions.push(
        el("button", { type: "button", className: "btn btn-primary", onClick: () => openEventModal(ev) }, "Edit"),
        el("button", { type: "button", className: "btn btn-danger", onClick: () => removeEvent(ev) }, "Delete"),
      );
    }
    fill(
      eventPop,
      el(
        "div",
        { className: "pop-head" },
        el("span", { className: `type-pill t-${ev.type}` }, typeLabel(ev.type)),
        el("button", { type: "button", className: "icon-btn", "aria-label": "Close", onClick: closeEventPop }, shellIcon("x")),
      ),
      el("h3", { id: "event-pop-title", className: "pop-title" }, ev.title),
      el("p", { className: "pop-line" }, shellIcon("calendar", "ico ico-sm"), dateLine),
      el("p", { className: "pop-line" }, shellIcon("clock", "ico ico-sm"), eventTimeLabel(ev)),
      ev.location ? el("p", { className: "pop-line" }, shellIcon("pin", "ico ico-sm"), ev.location) : null,
      team ? el("p", { className: "pop-line" }, shellIcon("users", "ico ico-sm"), `${team.name} · ${team.sport}`) : null,
      ev.notes ? el("p", { className: "pop-note" }, ev.notes) : null,
      ev.rsvp
        ? el(
            "p",
            { className: "pop-att" },
            `${ev.rsvp.yes} going · ${ev.rsvp.no} can't make it · ${ev.rsvp.roster - ev.rsvp.yes - ev.rsvp.no} no answer`,
          )
        : null,
      isPlayerView() && ev.my_rsvp ? el("p", { className: "meta" }, ev.my_rsvp === "yes" ? "You said you'll be there." : "You said you can't make it.") : null,
      actions.length ? el("div", { className: "pop-actions" }, actions) : null,
    );
    eventPop.classList.remove("hidden");
    const box = anchor.getBoundingClientRect();
    const pw = eventPop.offsetWidth;
    const ph = eventPop.offsetHeight;
    let left = box.left;
    let top = box.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, box.top - ph - 6);
    eventPop.style.left = `${Math.max(8, left)}px`;
    eventPop.style.top = `${top}px`;
    const focusTarget = eventPop.querySelector(".pop-actions .btn") || eventPop.querySelector(".icon-btn");
    if (focusTarget) focusTarget.focus();
  }

  async function sendRsvp(ev, status, anchor) {
    try {
      await request(`/api/events/${encodeURIComponent(ev.id)}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadEvents();
      const fresh = shell.events.find((item) => item.id === ev.id);
      if (fresh && anchor && anchor.isConnected) openEventPop(fresh, anchor);
      else closeEventPop();
    } catch (error) {
      showError(error.message);
    }
  }

  async function removeEvent(ev) {
    if (!window.confirm(`Delete "${ev.title}" from the schedule?`)) return;
    try {
      await request(`/api/events/${encodeURIComponent(ev.id)}`, { method: "DELETE" });
      closeEventPop();
      hideDialog(eventModal);
      await loadEvents();
    } catch (error) {
      showError(error.message);
    }
  }

  document.addEventListener("pointerdown", (e) => {
    if (eventPop && !eventPop.classList.contains("hidden") && !eventPop.contains(e.target) && !e.target.closest(".cal-ev, .ev-row, .next-card .btn")) {
      closeEventPop();
    }
    if (teamMenu && !teamMenu.contains(e.target) && !teamSwitchBtn.contains(e.target)) {
      closeTeamMenu();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeEventPop();
      closeTeamMenu();
      closeDrawer();
    }
  });
  window.addEventListener("resize", closeEventPop);

  // ----- Event dialog -----
  function syncAllDay() {
    eventTimes.classList.toggle("hidden", eventAllDay.checked);
    eventForm.elements.start_time.required = !eventAllDay.checked;
  }

  function editableTeams() {
    return shell.teams;
  }

  function openEventModal(ev, date) {
    closeEventPop();
    eventForm.reset();
    shell.editingEventId = ev ? ev.id : null;
    document.getElementById("event-modal-title").textContent = ev ? "Edit event" : "Add event";
    fill(eventTeamSelect, editableTeams().map((t) => el("option", { value: t.id }, `${t.name} (${t.sport})`)));
    eventTeamSelect.closest("label").classList.toggle("hidden", editableTeams().length < 2);
    const f = eventForm.elements;
    if (ev) {
      f.team_id.value = ev.team_id;
      f.type.value = ev.type;
      f.title.value = ev.title;
      f.date.value = ev.date;
      f.end_date.value = ev.end_date && ev.end_date !== ev.date ? ev.end_date : "";
      f.all_day.checked = Boolean(ev.all_day);
      f.start_time.value = ev.start_time || "";
      f.end_time.value = ev.end_time || "";
      f.location.value = ev.location || "";
      f.notes.value = ev.notes || "";
    } else {
      const picked = shell.teams.filter((t) => shell.teamSel.has(t.id));
      if (picked.length === 1) f.team_id.value = picked[0].id;
      const onlyType = shell.types.size === 1 ? [...shell.types][0] : "practice";
      f.type.value = onlyType;
      f.date.value = date || ymd(todayDate());
      f.start_time.value = "18:00";
      f.end_time.value = "20:00";
    }
    deleteEventBtn.classList.toggle("hidden", !ev);
    syncAllDay();
    showDialog(eventModal);
    f.title.focus();
  }

  if (eventAllDay) eventAllDay.addEventListener("change", syncAllDay);
  document.getElementById("cancel-event").addEventListener("click", () => hideDialog(eventModal));
  eventModal.addEventListener("click", (event) => {
    if (event.target === eventModal) hideDialog(eventModal);
  });
  deleteEventBtn.addEventListener("click", () => {
    const ev = shell.events.find((item) => item.id === shell.editingEventId);
    if (ev) removeEvent(ev);
  });
  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const f = eventForm.elements;
    const body = {
      team_id: f.team_id.value,
      type: f.type.value,
      title: f.title.value,
      date: f.date.value,
      end_date: f.end_date.value || f.date.value,
      all_day: f.all_day.checked,
      start_time: f.all_day.checked ? "" : f.start_time.value,
      end_time: f.all_day.checked ? "" : f.end_time.value,
      location: f.location.value,
      notes: f.notes.value,
    };
    try {
      if (shell.editingEventId) {
        await request(`/api/events/${encodeURIComponent(shell.editingEventId)}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await request("/api/events", { method: "POST", body: JSON.stringify(body) });
      }
      hideDialog(eventModal);
      const day = parseYmd(body.date);
      if (shell.view === "schedule") shell.month = new Date(day.getFullYear(), day.getMonth(), 1);
      await loadEvents();
    } catch (error) {
      showError(error.message);
    }
  });

  // ----- Reports / Drills / Help -----
  function renderPage(view) {
    if (view === "help") {
      const player = isPlayerView();
      const topics = player
        ? [
            ["Home", "Your next events, your overall rating, and what changed since your coach last rated you."],
            ["Schedule", "Every practice, game, tournament, training session and scrimmage for your team. Tap an event to say whether you'll be there."],
            ["My Development", "Your skill ratings, performance profile, progress table, GameChanger stats and notes from your coaches."],
            ["Messages and reminders", "Messages and reminders from your coaches show a number in the menu until you open them."],
          ]
        : [
            ["Home", "Your starting page: this week's numbers, what's coming up, who moved the most, and shortcuts to everything else."],
            ["Team switcher", "The box under the logo picks which team you're looking at. The roster, Home numbers and schedule follow it. Choose All teams to see everything."],
            ["Schedule", "Add practices, games, tournaments, training and scrimmages for a team. Click a day to add an event there. Players only see their own team's events and can answer whether they'll be there."],
            ["Player Development", "The roster and player pages you already know: ratings, performance profile, progress table, GameChanger stats, notes and drills."],
            ["Teams and staff", "Admin → Team holds your teams (softball or baseball). Each player belongs to one team. Staff can be limited to certain teams, or left with access to all of them."],
            ["Minimize the menu", "Use the small arrow on the menu's edge to shrink it to icons. Your choice is remembered on this computer."],
            ["Your data", "Everything is saved in the idev data folder in your Documents, with automatic backups."],
          ];
      fill(
        pageView,
        pageTop("Help", []),
        el(
          "section",
          { className: "card help-list" },
          topics.map(([title, text]) => el("div", {}, el("h3", {}, title), el("p", {}, text))),
        ),
      );
      return;
    }
    const info =
      view === "reports"
        ? ["Reports", "Team skill averages over time, most improved, players not rated recently, and exports. This page is next on the list."]
        : ["Drills & practice plans", "One drill library for the whole team and practice plans you can attach to schedule events. This page is next on the list. Drills assigned to a single player are still on their Player Development page."];
    fill(
      pageView,
      pageTop(info[0], []),
      el(
        "section",
        { className: "card placeholder" },
        el("h2", {}, "Coming next"),
        el("p", { className: "meta" }, info[1]),
        el("button", { type: "button", className: "btn", onClick: () => go("home") }, "Back to Home"),
      ),
    );
  }

  // ----- team pickers in the admin forms -----
  function fillTeamSelects() {
    document.querySelectorAll(".team-select").forEach((select) => {
      const current = select.value;
      fill(select, shell.teams.map((t) => el("option", { value: t.id }, `${t.name} (${t.sport})`)));
      if (current && teamById(current)) select.value = current;
      const label = select.closest("label");
      if (label) label.classList.toggle("hidden", shell.teams.length < 2);
    });
    renderStaffTeamChecks(staffTeamsBox, []);
  }

  function renderStaffTeamChecks(container, selected) {
    if (!container) return;
    const fieldset = container.closest("fieldset");
    if (fieldset) fieldset.classList.toggle("hidden", shell.teams.length < 2);
    fill(
      container,
      shell.teams.map((t) =>
        el(
          "label",
          {},
          el("input", { type: "checkbox", name: "team_ids", value: t.id, checked: selected.includes(t.id) }),
          t.name,
        ),
      ),
    );
  }

  function staffTeamsRow(member) {
    if (shell.teams.length < 2) return null;
    const selected = Array.isArray(member.team_ids) ? member.team_ids : [];
    const boxes = shell.teams.map((t) => {
      const input = el("input", { type: "checkbox", value: t.id, checked: selected.includes(t.id) });
      input.addEventListener("change", () => {
        const ids = Array.from(row.querySelectorAll("input:checked")).map((box) => box.value);
        updateStaffIdentity(member, { team_ids: ids });
      });
      return el("label", { className: "check-row" }, input, t.name);
    });
    const row = el(
      "div",
      { className: "staff-manage-teams" },
      el("span", { className: "meta" }, selected.length ? "Teams:" : "Teams (none checked = all):"),
      boxes,
    );
    return row;
  }

  function staffTeamsText(member) {
    if (shell.teams.length < 2) return "";
    const ids = Array.isArray(member.team_ids) ? member.team_ids : [];
    if (!ids.length) return "All teams";
    return ids.map((id) => (teamById(id) || {}).name).filter(Boolean).join(", ");
  }

  async function removeTeam(team) {
    if (!window.confirm(`Delete ${team.name}? Its schedule events are deleted too.`)) return;
    try {
      await request(`/api/teams/${encodeURIComponent(team.id)}`, { method: "DELETE" });
      await loadTeams();
      await loadTeam();
      await loadEvents();
    } catch (error) {
      showError(error.message);
    }
  }

  // ----- shell controls -----
  collapseBtn.addEventListener("click", () => {
    shell.collapsed = !shell.collapsed;
    writeStored("idev.sideCollapsed", shell.collapsed ? "1" : "0");
    renderSide();
  });
  hamburgerBtn.addEventListener("click", () => appView.classList.add("menu-open"));
  sideScrim.addEventListener("click", closeDrawer);
  teamSwitchBtn.addEventListener("click", () => {
    if (!isPlayerView() && shell.teams.length > 1) openTeamMenu();
  });

  function startShell() {
    shell.view = viewFromHash();
    shell.month = null;
    shell.events = [];
    shell.eventsLoaded = false;
    showView(shell.view);
    loadTeams().catch((error) => showError(error.message));
    loadEvents().catch((error) => showError(error.message));
  }

  function stopShell() {
    closeEventPop();
    closeTeamMenu();
    closeDrawer();
    shell.teams = [];
    shell.events = [];
    shell.eventsLoaded = false;
  }

  bootstrap();
})();
