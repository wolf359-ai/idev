(() => {
  "use strict";

  // ---------- Sample data (mockup only) ----------
  const TODAY = new Date(2026, 10, 20);

  const TEAMS = [
    { id: "a12", name: "Alpha 12U-2033", short: "12U", sport: "Softball" },
    { id: "a14", name: "Alpha 14U-2031", short: "14U", sport: "Softball" },
    { id: "b10", name: "Alpha Baseball 10U", short: "BB 10U", sport: "Baseball" },
  ];

  const TYPES = [
    { id: "practice", label: "Practice" },
    { id: "game", label: "Game" },
    { id: "tournament", label: "Tournament" },
    { id: "training", label: "Training" },
    { id: "scrimmage", label: "Scrimmage" },
  ];

  const ICONS = {
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

  function buildEvents() {
    const events = [];
    let n = 0;
    const add = (team, type, title, date, start, end, location, extra) => {
      events.push({ id: `e${++n}`, team, type, title, date, start, end, location, days: 1, ...extra });
    };
    const start = new Date(2026, 10, 1);
    const stop = new Date(2026, 11, 31);
    for (let d = new Date(start); d <= stop; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const date = new Date(d);
      const thanksgiving = date.getMonth() === 10 && date.getDate() >= 25 && date.getDate() <= 29;
      const holiday = date.getMonth() === 11 && date.getDate() >= 23;
      if (thanksgiving || holiday) continue;
      const week = Math.floor((date.getDate() - 1) / 7);

      // 12U softball
      if (day === 2 || day === 4) add("a12", "practice", "Team practice", date, "6:00 PM", "8:00 PM", "Alpha Field 2");
      if (day === 1) add("a12", "training", "Hitting lab", date, "5:30 PM", "6:30 PM", "Alpha Training Center");
      if (day === 3 && week % 2 === 1) add("a12", "scrimmage", "Scrimmage vs. Lady Hawks", date, "6:30 PM", "8:30 PM", "Riverside Park");
      if (day === 6 && week % 2 === 0) add("a12", "game", "vs. Firecrackers 12U", date, "10:00 AM", "11:45 AM", "Central Complex F3");

      // 14U softball
      if (day === 1 || day === 3) add("a14", "practice", "Team practice", date, "7:00 PM", "9:00 PM", "Alpha Field 1");
      if (day === 0 && week % 2 === 1) add("a14", "game", "vs. Lightning 14U", date, "1:00 PM", "2:45 PM", "Westfield HS");
      if (day === 5 && week % 2 === 0) add("a14", "training", "Pitching & catching", date, "6:00 PM", "7:30 PM", "Alpha Training Center");

      // Baseball 10U
      if (day === 2 || day === 4) add("b10", "practice", "Team practice", date, "5:00 PM", "6:30 PM", "Alpha Diamond B");
      if (day === 6 && week % 2 === 1) add("b10", "scrimmage", "Scrimmage vs. Sluggers", date, "9:00 AM", "11:00 AM", "Alpha Diamond B");
      if (day === 5 && week % 2 === 1) add("b10", "training", "Speed & agility", date, "5:00 PM", "6:00 PM", "Alpha Training Center");
    }
    add("a12", "tournament", "Turkey Bash Classic", new Date(2026, 10, 21), "8:00 AM", "6:00 PM", "Valley Sports Park", { days: 2, note: "Pool play Sat, bracket Sun. Arrive 60 min early." });
    add("a12", "tournament", "Winter Warm-Up", new Date(2026, 11, 12), "8:00 AM", "5:00 PM", "Central Complex", { days: 2, note: "Hotel block at Hampton Inn (code ALPHA12)." });
    add("a14", "tournament", "December Showcase", new Date(2026, 11, 5), "7:30 AM", "6:00 PM", "Valley Sports Park", { days: 2 });
    add("b10", "tournament", "Fall Classic", new Date(2026, 10, 14), "8:00 AM", "4:00 PM", "Legion Fields", { days: 1 });
    // Today
    add("a12", "training", "Bullpen session (pitchers)", new Date(TODAY), "4:30 PM", "5:30 PM", "Alpha Training Center");
    events.forEach((ev) => {
      ev.attendance = ev.type === "tournament" ? null : { yes: 9 + (ev.id.length % 3), total: 12 };
    });
    return events;
  }

  const EVENTS = buildEvents();

  const MOVERS = [
    { num: 7, name: "Allison Harrop", change: 0.4, skill: "Hitting +1" },
    { num: 12, name: "Brooke Lane", change: 0.3, skill: "Fielding +0.5" },
    { num: 21, name: "Jordan Blake", change: 0.2, skill: "Bunting +1" },
    { num: 3, name: "Alex Rivera", change: -0.2, skill: "Throwing −0.5" },
  ];

  // ---------- State ----------
  const state = {
    role: "coach",
    view: "home",
    collapsed: false,
    month: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
    calMode: "month",
    types: new Set(TYPES.map((t) => t.id)),
    teams: new Set(TEAMS.map((t) => t.id)),
  };
  const PLAYER_TEAM = "a12";

  // ---------- Helpers ----------
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === "className") node.className = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  // replaceChildren would print null/false as text, so drop them first.
  function fill(node, ...kids) {
    node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  }

  function icon(name, cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", cls || "ico");
    svg.innerHTML = ICONS[name];
    return svg;
  }

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const team = (id) => TEAMS.find((t) => t.id === id);
  const typeLabel = (id) => TYPES.find((t) => t.id === id).label;
  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const isPlayer = () => state.role === "player";

  function eventCovers(ev, day) {
    const startDay = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate());
    const diff = Math.round((day - startDay) / 86400000);
    return diff >= 0 && diff < ev.days;
  }

  // Players only ever see their own team's events; coaches see the superset
  // narrowed by the team and type filters.
  function visibleEvents() {
    return EVENTS.filter((ev) => {
      if (isPlayer() && ev.team !== PLAYER_TEAM) return false;
      if (!isPlayer() && !state.teams.has(ev.team)) return false;
      return state.types.has(ev.type);
    });
  }

  function eventsOn(day) {
    return visibleEvents()
      .filter((ev) => eventCovers(ev, day))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }

  function toMinutes(label) {
    const [time, mer] = label.split(" ");
    let [hh, mm] = time.split(":").map(Number);
    if (mer === "PM" && hh !== 12) hh += 12;
    if (mer === "AM" && hh === 12) hh = 0;
    return hh * 60 + mm;
  }

  function upcoming(days) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(TODAY);
      day.setDate(TODAY.getDate() + i);
      const list = eventsOn(day);
      if (list.length) out.push({ day, list });
    }
    return out;
  }

  function nextEvent() {
    for (let i = 0; i < 30; i++) {
      const day = new Date(TODAY);
      day.setDate(TODAY.getDate() + i);
      const list = eventsOn(day);
      if (list.length) return { day, ev: list[0] };
    }
    return null;
  }

  // ---------- Sidebar ----------
  function navItems() {
    if (isPlayer()) {
      return [
        { group: null, items: [
          { id: "home", label: "Home", icon: "home" },
          { id: "schedule", label: "Schedule", icon: "calendar" },
          { id: "dev", label: "My Development", icon: "trend" },
          { id: "drills", label: "My Drills", icon: "clipboard" },
        ] },
        { group: null, items: [
          { id: "messages", label: "Messages", icon: "mail", badge: 1 },
          { id: "help", label: "Help", icon: "help" },
        ] },
      ];
    }
    return [
      { group: null, items: [
        { id: "home", label: "Home", icon: "home" },
        { id: "schedule", label: "Schedule", icon: "calendar" },
        { id: "dev", label: "Player Development", icon: "trend" },
        { id: "reports", label: "Reports", icon: "chart" },
        { id: "drills", label: "Drills & Plans", icon: "clipboard" },
      ] },
      { group: null, items: [
        { id: "roster", label: "Roster & Logins", icon: "users" },
        { id: "staff", label: "Team & Staff", icon: "shield" },
        { id: "messages", label: "Messages", icon: "mail", badge: 2 },
        { id: "alarms", label: "Alarms", icon: "bell", badge: 1 },
        { id: "help", label: "Help", icon: "help" },
      ] },
    ];
  }

  function renderSide() {
    const shell = document.getElementById("shell");
    shell.classList.toggle("collapsed", state.collapsed);
    const collapse = document.getElementById("collapse-btn");
    fill(collapse, icon(state.collapsed ? "chevR" : "chevL"));
    collapse.setAttribute("aria-label", state.collapsed ? "Expand menu" : "Collapse menu");
    collapse.title = collapse.getAttribute("aria-label");

    const nav = document.getElementById("side-nav");
    fill(nav, 
      ...navItems().flatMap((group, i) => [
        i ? h("div", { className: "nav-sep", role: "separator" }) : null,
        h(
          "ul",
          { className: "nav-list" },
          group.items.map((item) =>
            h(
              "li",
              {},
              h(
                "button",
                {
                  type: "button",
                  className: "nav-item" + (state.view === item.id ? " active" : ""),
                  "aria-current": state.view === item.id ? "page" : null,
                  title: item.label,
                  onClick: () => go(item.id, item.label),
                },
                icon(item.icon),
                h("span", { className: "nav-label" }, item.label),
                item.badge ? h("span", { className: "nav-badge" }, String(item.badge)) : null,
              ),
            ),
          ),
        ),
      ]).filter(Boolean),
    );

    const name = document.getElementById("team-switch-name");
    const sub = document.getElementById("team-switch-sub");
    if (isPlayer()) {
      name.textContent = team(PLAYER_TEAM).name;
      sub.textContent = team(PLAYER_TEAM).sport;
    } else if (state.teams.size === TEAMS.length) {
      name.textContent = "All teams";
      sub.textContent = `${TEAMS.length} teams · 2 sports`;
    } else {
      const picked = TEAMS.filter((t) => state.teams.has(t.id));
      name.textContent = picked.length === 1 ? picked[0].name : `${picked.length} teams`;
      sub.textContent = picked.map((t) => t.short).join(" · ") || "None selected";
    }

    const next = nextEvent();
    const card = document.getElementById("next-card");
    fill(card, 
      h("p", { className: "next-eyebrow" }, "Next up"),
      ...(next
        ? [
            h("span", { className: `type-dot t-${next.ev.type}` }),
            h("p", { className: "next-title" }, next.ev.title),
            h("p", { className: "next-meta" }, `${sameDay(next.day, TODAY) ? "Today" : fmtDay(next.day)} · ${next.ev.start}`),
            h("p", { className: "next-meta" }, `${team(next.ev.team).short} · ${next.ev.location}`),
            h(
              "button",
              { type: "button", className: "btn btn-primary btn-block", onClick: (e) => openPop(next.ev, e.currentTarget) },
              isPlayer() || next.ev.type === "tournament" ? "View details" : "Take attendance",
            ),
          ]
        : [h("p", { className: "next-meta" }, "Nothing scheduled")]),
    );

    document.getElementById("me-avatar").textContent = isPlayer() ? "AH" : "CM";
    document.getElementById("me-name").textContent = isPlayer() ? "Allison Harrop" : "Casey Morgan";
  }

  // ---------- Page header ----------
  function renderTop() {
    document.getElementById("today-label").textContent = TODAY.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const title = document.getElementById("page-title");
    const actions = document.getElementById("page-actions");
    if (state.view === "home") {
      title.textContent = isPlayer() ? "Hi Allison" : "Good afternoon, Coach Morgan";
    } else if (state.view === "schedule") {
      title.textContent = "Schedule";
    }
    fill(actions, 
      ...(isPlayer()
        ? []
        : [
            h("button", { type: "button", className: "btn" }, icon("star"), "Rate a player"),
            h("button", { type: "button", className: "btn btn-primary" }, icon("plus"), "Add event"),
          ]),
    );
  }

  // ---------- Filters (shared by Home and Schedule) ----------
  function filterBar(onChange, opts = {}) {
    const allTypes = state.types.size === TYPES.length;
    const typeChips = h(
      "div",
      { className: "chips", role: "group", "aria-label": "Event types" },
      h(
        "button",
        {
          type: "button",
          className: "chip chip-all" + (allTypes ? " on" : ""),
          "aria-pressed": String(allTypes),
          onClick: () => {
            state.types = new Set(TYPES.map((t) => t.id));
            onChange();
          },
        },
        "All events",
      ),
      TYPES.map((t) =>
        h(
          "button",
          {
            type: "button",
            className: `chip t-${t.id}` + (state.types.has(t.id) && !allTypes ? " on" : ""),
            "aria-pressed": String(state.types.has(t.id)),
            onClick: () => {
              // First click from "All" narrows to just that type; later clicks add or remove.
              if (allTypes) state.types = new Set([t.id]);
              else if (state.types.has(t.id)) state.types.delete(t.id);
              else state.types.add(t.id);
              if (!state.types.size) state.types = new Set(TYPES.map((x) => x.id));
              onChange();
            },
          },
          h("span", { className: `type-dot t-${t.id}` }),
          t.label,
          h("span", { className: "chip-count" }, String(countType(t.id))),
        ),
      ),
    );
    if (isPlayer() || opts.typesOnly) {
      return h("div", { className: "filters" }, typeChips);
    }
    const teamChips = h(
      "div",
      { className: "chips", role: "group", "aria-label": "Teams" },
      TEAMS.map((t) =>
        h(
          "button",
          {
            type: "button",
            className: "chip chip-team" + (state.teams.has(t.id) ? " on" : ""),
            "aria-pressed": String(state.teams.has(t.id)),
            onClick: () => {
              if (state.teams.has(t.id) && state.teams.size > 1) state.teams.delete(t.id);
              else state.teams.add(t.id);
              onChange();
            },
          },
          h("span", { className: "chip-check" }, state.teams.has(t.id) ? icon("check") : null),
          t.name,
          h("span", { className: "chip-sport" }, t.sport),
        ),
      ),
    );
    return h("div", { className: "filters" }, typeChips, teamChips);
  }

  function countType(type) {
    const from = state.view === "schedule" ? state.month : TODAY;
    const to = state.view === "schedule"
      ? new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0)
      : new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 13);
    return EVENTS.filter((ev) => {
      if (ev.type !== type) return false;
      if (isPlayer() ? ev.team !== PLAYER_TEAM : !state.teams.has(ev.team)) return false;
      return ev.date >= from && ev.date <= to;
    }).length;
  }

  function eventRow(ev, day) {
    return h(
      "button",
      { type: "button", className: `ev-row t-${ev.type}`, onClick: (e) => openPop(ev, e.currentTarget) },
      h("span", { className: "ev-time mono" }, ev.type === "tournament" ? "All day" : ev.start),
      h(
        "span",
        { className: "ev-main" },
        h("span", { className: "ev-title" }, ev.title, ev.days > 1 ? h("span", { className: "ev-days" }, ` · day ${dayIndex(ev, day)} of ${ev.days}`) : null),
        h("span", { className: "ev-sub" }, icon("pin", "ico ico-sm"), ev.location),
      ),
      isPlayer() ? null : h("span", { className: "ev-team" }, team(ev.team).short),
      h("span", { className: `type-pill t-${ev.type}` }, typeLabel(ev.type)),
    );
  }

  function dayIndex(ev, day) {
    const startDay = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate());
    return Math.round((day - startDay) / 86400000) + 1;
  }

  // ---------- Home ----------
  function renderHome() {
    const root = document.getElementById("view-home");
    const week = upcoming(7);
    const thisWeekCount = week.reduce((sum, d) => sum + d.list.length, 0);
    const next = nextEvent();

    const kpis = isPlayer()
      ? [
          { label: "My overall", value: "64", unit: "%", accent: "cyan", foot: "▲ 4% vs last week", footCls: "up" },
          { label: "My top skill", value: "Hitting", accent: "green", foot: "4 / 5" },
          { label: "This week", value: String(thisWeekCount), unit: "events", accent: "orange", foot: "12U schedule" },
          { label: "Messages", value: "1", unit: "unread", accent: "purple", foot: "From Coach Morgan" },
        ]
      : [
          { label: "Players", value: "36", accent: "cyan", foot: "3 teams · 2 sports" },
          { label: "Improved this week", value: "11", accent: "green", foot: "▲ avg +0.3", footCls: "up" },
          { label: "Dropped this week", value: "3", accent: "red", foot: "▼ avg −0.2", footCls: "down" },
          { label: "This week", value: String(thisWeekCount), unit: "events", accent: "orange", foot: next ? `Next: ${next.ev.title}` : "" },
          { label: "Unread", value: "2", unit: "messages", accent: "purple", foot: "1 active alarm" },
        ];

    const kpiStrip = h(
      "div",
      { className: "kpis" },
      kpis.map((k) =>
        h(
          "article",
          { className: `kpi a-${k.accent}` },
          h("p", { className: "kpi-label" }, k.label),
          h("p", { className: "kpi-value" }, k.value, k.unit ? h("span", { className: "kpi-unit" }, ` ${k.unit}`) : null),
          k.foot ? h("p", { className: "kpi-foot" + (k.footCls ? ` ${k.footCls}` : "") }, k.foot) : null,
        ),
      ),
    );

    const agenda = h(
      "section",
      { className: "card agenda-card" },
      h(
        "div",
        { className: "card-head" },
        h("div", {}, h("h2", {}, "Coming up"), h("p", { className: "meta" }, isPlayer() ? "Your team's next 7 days" : "All selected teams · next 7 days")),
        h("button", { type: "button", className: "link-btn", onClick: () => go("schedule", "Schedule") }, "Open calendar", icon("chevR", "ico ico-sm")),
      ),
      filterBar(renderAll, { typesOnly: true }),
      week.length
        ? h(
            "div",
            { className: "agenda" },
            week.map(({ day, list }) =>
              h(
                "div",
                { className: "agenda-day" },
                h(
                  "p",
                  { className: "agenda-date" + (sameDay(day, TODAY) ? " today" : "") },
                  sameDay(day, TODAY) ? "Today" : fmtDay(day),
                ),
                list.map((ev) => eventRow(ev, day)),
              ),
            ),
          )
        : h("p", { className: "empty" }, "No events match these filters."),
    );

    const movers = h(
      "section",
      { className: "card movers-card" },
      h(
        "div",
        { className: "card-head" },
        h("div", {}, h("h2", {}, isPlayer() ? "My progress" : "Top movers"), h("p", { className: "meta" }, isPlayer() ? "Change since last week" : "12U · change since last week")),
      ),
      isPlayer()
        ? h(
            "ul",
            { className: "movers" },
            [
              ["Hitting", 1],
              ["Fielding", 0.5],
              ["Throwing", 0],
              ["Base running", -0.5],
            ].map(([skill, chg]) =>
              h(
                "li",
                { className: "mover" },
                h("span", { className: "mover-name" }, skill),
                h("span", { className: "mover-chg " + (chg > 0 ? "up" : chg < 0 ? "down" : "flat") }, chg > 0 ? `▲ ${chg}` : chg < 0 ? `▼ ${Math.abs(chg)}` : ""),
              ),
            ),
          )
        : h(
            "ul",
            { className: "movers" },
            MOVERS.map((m) =>
              h(
                "li",
                { className: "mover" },
                h("span", { className: "mover-num" }, `#${m.num}`),
                h("span", { className: "mover-name" }, m.name, h("span", { className: "mover-skill" }, m.skill)),
                h("span", { className: "mover-chg " + (m.change > 0 ? "up" : "down") }, `${m.change > 0 ? "▲" : "▼"} ${Math.abs(m.change).toFixed(1)}`),
              ),
            ),
          ),
    );

    const modules = isPlayer()
      ? [
          { id: "schedule", icon: "calendar", title: "Schedule", desc: "Practices, games, tournaments, training and scrimmages for your team.", live: `${thisWeekCount} this week` },
          { id: "dev", icon: "trend", title: "My Development", desc: "Skill ratings, performance profile, progress history and coach notes.", live: "Overall 64%" },
          { id: "drills", icon: "clipboard", title: "My Drills", desc: "Drills your coach assigned, with video links.", live: "3 assigned" },
          { id: "help", icon: "help", title: "Help", desc: "How to read your ratings and use the app.", live: "" },
        ]
      : [
          { id: "schedule", icon: "calendar", title: "Schedule & Attendance", desc: "Practices, games, tournaments, training and scrimmages across every team, with check-in.", live: `${thisWeekCount} events this week` },
          { id: "dev", icon: "trend", title: "Player Development", desc: "Skill ratings, performance profiles, progress tables and GameChanger stats.", live: "11 improved this week" },
          { id: "reports", icon: "chart", title: "Reports", desc: "Team skill averages over time, most improved, not rated recently, exports.", live: "4 not rated in 14 days" },
          { id: "drills", icon: "clipboard", title: "Drills & Practice Plans", desc: "One team drill library and practice plans attached to schedule events.", live: "Plan needed for Tue practice" },
          { id: "roster", icon: "users", title: "Roster & Logins", desc: "Add, import and edit players; manage player and family logins.", live: "2 players without a login" },
          { id: "staff", icon: "shield", title: "Team & Staff", desc: "Teams, seasons, coaches and staff access levels.", live: "3 teams · 6 staff" },
          { id: "messages", icon: "mail", title: "Messages & Alarms", desc: "Message the team, staff or one player; send reminders.", live: "2 unread · 1 alarm" },
          { id: "help", icon: "help", title: "Help", desc: "Guides, backup and restore, app version and updates.", live: "Up to date" },
        ];

    const grid = h(
      "section",
      { className: "modules-wrap" },
      h("h2", { className: "section-title" }, isPlayer() ? "My tools" : "Manage"),
      h(
        "div",
        { className: "modules" },
        modules.map((m) =>
          h(
            "button",
            { type: "button", className: "module", onClick: () => go(m.id, m.title) },
            h("span", { className: "module-ico" }, icon(m.icon)),
            h(
              "span",
              { className: "module-text" },
              h("span", { className: "module-title" }, m.title),
              h("span", { className: "module-desc" }, m.desc),
              m.live ? h("span", { className: "module-live" }, m.live) : null,
            ),
          ),
        ),
      ),
    );

    fill(root, kpiStrip, h("div", { className: "home-row" }, agenda, movers), grid);
  }

  // ---------- Schedule ----------
  function renderSchedule() {
    const root = document.getElementById("view-schedule");
    const monthLabel = state.month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const shift = (n) => {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1);
      renderAll();
    };
    const toolbar = h(
      "div",
      { className: "cal-toolbar" },
      h(
        "div",
        { className: "cal-nav" },
        h("button", { type: "button", className: "icon-btn", "aria-label": "Previous month", onClick: () => shift(-1) }, icon("chevL")),
        h("h2", { className: "cal-month" }, monthLabel),
        h("button", { type: "button", className: "icon-btn", "aria-label": "Next month", onClick: () => shift(1) }, icon("chevR")),
        h(
          "button",
          {
            type: "button",
            className: "btn btn-sm",
            onClick: () => {
              state.month = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
              renderAll();
            },
          },
          "Today",
        ),
      ),
      h(
        "div",
        { className: "seg", role: "group", "aria-label": "Calendar view" },
        ["month", "list"].map((mode) =>
          h(
            "button",
            {
              type: "button",
              className: "seg-btn" + (state.calMode === mode ? " on" : ""),
              "aria-pressed": String(state.calMode === mode),
              onClick: () => {
                state.calMode = mode;
                renderAll();
              },
            },
            icon(mode === "month" ? "grid" : "list", "ico ico-sm"),
            mode === "month" ? "Month" : "List",
          ),
        ),
      ),
    );

    const first = state.month;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const monthEvents = visibleEvents().filter((ev) => ev.date >= first && ev.date <= last);
    const summary = h(
      "p",
      { className: "meta cal-summary" },
      `Showing ${monthEvents.length} events` + (isPlayer() ? ` for ${team(PLAYER_TEAM).name}` : ` across ${state.teams.size} of ${TEAMS.length} teams`),
    );

    let body;
    if (state.calMode === "month") {
      const startGrid = new Date(first);
      startGrid.setDate(1 - first.getDay());
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const day = new Date(startGrid);
        day.setDate(startGrid.getDate() + i);
        if (i >= 35 && day.getMonth() !== first.getMonth()) break;
        const list = eventsOn(day);
        const shown = list.slice(0, 3);
        cells.push(
          h(
            "div",
            {
              className:
                "cal-cell" +
                (day.getMonth() !== first.getMonth() ? " out" : "") +
                (sameDay(day, TODAY) ? " today" : ""),
            },
            h("span", { className: "cal-date" }, String(day.getDate())),
            shown.map((ev) =>
              h(
                "button",
                { type: "button", className: `cal-ev t-${ev.type}`, title: `${ev.title} · ${team(ev.team).name}`, onClick: (e) => openPop(ev, e.currentTarget) },
                h("span", { className: "cal-ev-time" }, ev.type === "tournament" ? "All day" : ev.start.replace(":00", "").replace(" ", "").toLowerCase()),
                h("span", { className: "cal-ev-title" }, isPlayer() ? ev.title : `${team(ev.team).short} · ${ev.title}`),
              ),
            ),
            list.length > shown.length ? h("span", { className: "cal-more" }, `+${list.length - shown.length} more`) : null,
          ),
        );
      }
      body = h(
        "div",
        { className: "cal" },
        h("div", { className: "cal-head" }, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => h("span", {}, d))),
        h("div", { className: "cal-grid" }, cells),
      );
    } else {
      const days = [];
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
        const day = new Date(d);
        const list = eventsOn(day);
        if (list.length) days.push({ day, list });
      }
      body = days.length
        ? h(
            "div",
            { className: "agenda agenda-full" },
            days.map(({ day, list }) =>
              h(
                "div",
                { className: "agenda-day" },
                h("p", { className: "agenda-date" + (sameDay(day, TODAY) ? " today" : "") }, sameDay(day, TODAY) ? `Today · ${fmtDay(day)}` : fmtDay(day)),
                list.map((ev) => eventRow(ev, day)),
              ),
            ),
          )
        : h("p", { className: "empty" }, "No events match these filters.");
    }

    fill(root, 
      h(
        "section",
        { className: "card cal-card" },
        toolbar,
        filterBar(renderAll),
        summary,
        body,
        isPlayer()
          ? h("p", { className: "privacy-note" }, "You only see events for teams you are on.")
          : null,
      ),
    );
  }

  function renderPlaceholder(label) {
    const root = document.getElementById("view-placeholder");
    fill(root, 
      h(
        "section",
        { className: "card placeholder" },
        h("h2", {}, label),
        h("p", { className: "meta" }, "In the real app this opens the existing page or Admin section. The mockup only covers Home and Schedule."),
        h("button", { type: "button", className: "btn", onClick: () => go("home", "Home") }, "Back to Home"),
      ),
    );
    document.getElementById("page-title").textContent = label;
  }

  // ---------- Event popover ----------
  const pop = document.getElementById("event-pop");

  function openPop(ev, anchor) {
    const t = team(ev.team);
    const endDate = new Date(ev.date);
    endDate.setDate(ev.date.getDate() + ev.days - 1);
    fill(pop, 
      h(
        "div",
        { className: "pop-head" },
        h("span", { className: `type-pill t-${ev.type}` }, typeLabel(ev.type)),
        h("button", { type: "button", className: "icon-btn", "aria-label": "Close", onClick: closePop }, icon("x")),
      ),
      h("h3", { id: "pop-title", className: "pop-title" }, ev.title),
      h("p", { className: "pop-line" }, icon("calendar", "ico ico-sm"), ev.days > 1 ? `${fmtDay(ev.date)} – ${fmtDay(endDate)}` : fmtDay(ev.date)),
      h("p", { className: "pop-line" }, icon("clock", "ico ico-sm"), `${ev.start} – ${ev.end}`),
      h("p", { className: "pop-line" }, icon("pin", "ico ico-sm"), ev.location),
      h("p", { className: "pop-line" }, icon("users", "ico ico-sm"), `${t.name} · ${t.sport}`),
      ev.note ? h("p", { className: "pop-note" }, ev.note) : null,
      ev.attendance && !isPlayer()
        ? h("p", { className: "pop-att" }, `${ev.attendance.yes} of ${ev.attendance.total} players confirmed`)
        : null,
      h(
        "div",
        { className: "pop-actions" },
        isPlayer()
          ? [h("button", { type: "button", className: "btn btn-primary" }, "I'll be there"), h("button", { type: "button", className: "btn" }, "Can't make it")]
          : [h("button", { type: "button", className: "btn btn-primary" }, "Take attendance"), h("button", { type: "button", className: "btn" }, "Practice plan"), h("button", { type: "button", className: "btn" }, "Edit")],
      ),
    );
    pop.classList.remove("hidden");
    const box = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = box.left;
    let top = box.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, box.top - ph - 6);
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${top}px`;
    pop.querySelector(".pop-actions .btn").focus();
  }

  function closePop() {
    pop.classList.add("hidden");
  }

  document.addEventListener("pointerdown", (e) => {
    if (!pop.classList.contains("hidden") && !pop.contains(e.target) && !e.target.closest(".cal-ev, .ev-row, .next-card .btn")) closePop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePop();
      document.getElementById("shell").classList.remove("menu-open");
    }
  });
  window.addEventListener("resize", closePop);

  // ---------- Routing ----------
  function go(view, label) {
    state.view = ["home", "schedule"].includes(view) ? view : view;
    state.placeholderLabel = label;
    document.getElementById("shell").classList.remove("menu-open");
    closePop();
    renderAll();
    document.getElementById("page").scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function renderAll() {
    renderSide();
    renderTop();
    const views = { home: "view-home", schedule: "view-schedule" };
    ["view-home", "view-schedule", "view-placeholder"].forEach((id) => document.getElementById(id).classList.add("hidden"));
    if (state.view === "home") {
      renderHome();
    } else if (state.view === "schedule") {
      renderSchedule();
    } else {
      renderPlaceholder(state.placeholderLabel || "Coming soon");
    }
    document.getElementById(views[state.view] || "view-placeholder").classList.remove("hidden");
  }

  document.getElementById("collapse-btn").addEventListener("click", () => {
    state.collapsed = !state.collapsed;
    renderSide();
  });
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("shell").classList.add("menu-open");
  });
  document.getElementById("side-scrim").addEventListener("click", () => {
    document.getElementById("shell").classList.remove("menu-open");
  });
  document.getElementById("team-switch").addEventListener("click", () => {
    if (isPlayer()) return;
    // Mockup shortcut: cycle All teams → each team, which drives the team filter.
    const order = [null, ...TEAMS.map((t) => t.id)];
    const current = state.teams.size === TEAMS.length ? null : state.teams.size === 1 ? [...state.teams][0] : null;
    const next = order[(order.indexOf(current) + 1) % order.length];
    state.teams = next ? new Set([next]) : new Set(TEAMS.map((t) => t.id));
    renderAll();
  });
  document.getElementById("view-as").addEventListener("change", (e) => {
    state.role = e.target.value;
    state.view = "home";
    renderAll();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("role") === "player") {
    state.role = "player";
    document.getElementById("view-as").value = "player";
  }
  if (params.get("view") === "schedule") state.view = "schedule";
  if (params.get("cal") === "list") state.calMode = "list";
  if (params.get("collapsed") === "1") state.collapsed = true;
  renderAll();
})();
