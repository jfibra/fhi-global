import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"

/**
 * The event card (2026-11-27): what a person SEES in the Claude chat when an
 * event tool runs — the cover photo, title, date, venue, seats, a Draft or
 * Live badge, what is still missing, and a button to open it in the
 * dashboard. It is an "MCP App": the tools of lib/mcp/events.ts point at
 * this resource (`_meta.ui.resourceUri`), Claude reads it once
 * (`resources/read`) and shows it in a sandboxed frame inside the
 * conversation, then hands it each tool result.
 *
 * One self-contained HTML page, no library and no build step:
 * - It speaks the MCP Apps protocol itself (JSON-RPC over postMessage:
 *   `ui/initialize` → `ui/notifications/initialized`, then
 *   `ui/notifications/tool-result` in, `ui/notifications/size-changed` and
 *   `ui/open-link` out). The official client (@modelcontextprotocol/ext-apps
 *   `App`) is ~500 KB bundled — too heavy to inline — and a script from our
 *   own origin is refused by our Cross-Origin-Resource-Policy header. The
 *   page is tested against the official host class (`AppBridge`), which
 *   validates every message.
 * - It reads the tool's normal JSON text (the same answer Claude gets), so
 *   the card and Claude can never disagree, and a host that shows no cards
 *   loses nothing.
 * - Colours and fonts are Claude's own style variables (with fallbacks), the
 *   page background stays transparent, and FHI's gold is only an accent —
 *   Anthropic's design guidelines for inline cards.
 * - The only outside thing it loads is the cover photo, from the storage
 *   origin declared in `_meta.ui.csp.resourceDomains`. Everything is written
 *   with textContent; links open through the host, which asks first.
 * - No button that writes: a call from the card would skip Claude's approval
 *   prompt, so publishing stays a sentence the person says.
 *
 * Claude may keep a copy of the page: after changing it, bump the version in
 * EVENT_CARD_URI so every chat gets the new one.
 */

export const EVENT_CARD_URI = "ui://fhi-global/event-card-v1"
export const MCP_APP_MIME = "text/html;profile=mcp-app"

/** What a tool's definition carries so the host shows the card (the nested key, plus the flat one older hosts read). */
export const EVENT_CARD_TOOL_META = { ui: { resourceUri: EVENT_CARD_URI }, "ui/resourceUri": EVENT_CARD_URI } as const

/** Where cover photos are served from — the one origin the card may load an image from. */
function photoOrigins(): string[] {
  const out = new Set<string>(["https://filipinohomes123.s3.ap-southeast-1.amazonaws.com"])
  try {
    const configured = process.env.S3_PUBLIC_URL?.trim()
    if (configured) out.add(new URL(configured).origin)
  } catch {
    /* keep the default */
  }
  return [...out]
}

export function registerEventCard(server: McpServer): void {
  server.registerResource(
    "FHI event card",
    EVENT_CARD_URI,
    { title: "FHI event card", description: "The card Claude shows for an FHI event: photo, date, venue, seats, status and what is still missing.", mimeType: MCP_APP_MIME },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: MCP_APP_MIME,
          text: EVENT_CARD_HTML,
          _meta: { ui: { csp: { resourceDomains: photoOrigins() }, prefersBorder: true } },
        },
      ],
    }),
  )
}

// String.raw: the script below is sent exactly as written (no escapes are processed here).
export const EVENT_CARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>FHI event</title>
<style>
  /* Fallbacks for a host that sends no style variables; Claude's own win when present. */
  :root {
    color-scheme: light dark;
    --f-t1: #1a1a18; --f-t2: #5e5d59; --f-t3: #7c7b75;
    --f-bg2: #f3f2ed; --f-bd: rgba(20, 20, 19, 0.14);
    --f-ok: #17663f; --f-okbg: #e3f3ea; --f-warn: #7d5200; --f-warnbg: #fbf0d9; --f-bad: #a32a22; --f-badbg: #fdecea;
    --f-inv: #1a1a18; --f-invt: #faf9f5;
    --gold: #a47c2c;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --f-t1: #f3f2ee; --f-t2: #bdbcb5; --f-t3: #96958e;
      --f-bg2: #2c2b28; --f-bd: rgba(250, 249, 245, 0.16);
      --f-ok: #74d3a0; --f-okbg: #1c3527; --f-warn: #e8b959; --f-warnbg: #3a2f16; --f-bad: #f0938b; --f-badbg: #3b1f1c;
      --f-inv: #f3f2ee; --f-invt: #1a1a18;
      --gold: #d6b357;
    }
  }
  :root[data-theme="dark"] {
    --f-t1: #f3f2ee; --f-t2: #bdbcb5; --f-t3: #96958e;
    --f-bg2: #2c2b28; --f-bd: rgba(250, 249, 245, 0.16);
    --f-ok: #74d3a0; --f-okbg: #1c3527; --f-warn: #e8b959; --f-warnbg: #3a2f16; --f-bad: #f0938b; --f-badbg: #3b1f1c;
    --f-inv: #f3f2ee; --f-invt: #1a1a18;
    --gold: #d6b357;
  }
  :root {
    --t1: var(--color-text-primary, var(--f-t1));
    --t2: var(--color-text-secondary, var(--f-t2));
    --t3: var(--color-text-tertiary, var(--f-t3));
    --bg2: var(--color-background-secondary, var(--f-bg2));
    --bd: var(--color-border-secondary, var(--f-bd));
    --ok: var(--color-text-success, var(--f-ok));
    --okbg: var(--color-background-success, var(--f-okbg));
    --warn: var(--color-text-warning, var(--f-warn));
    --warnbg: var(--color-background-warning, var(--f-warnbg));
    --bad: var(--color-text-danger, var(--f-bad));
    --badbg: var(--color-background-danger, var(--f-badbg));
    --inv: var(--color-background-inverse, var(--f-inv));
    --invt: var(--color-text-inverse, var(--f-invt));
    --r: var(--border-radius-lg, 10px);
    --rs: var(--border-radius-md, 8px);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
    font-size: var(--font-text-sm-size, 14px);
    line-height: var(--font-text-sm-line-height, 1.45);
    color: var(--t1);
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
  }
  .card { padding: 14px 16px 16px; min-height: 44px; }
  .head { display: flex; gap: 14px; align-items: flex-start; }
  .head .info { flex: 1 1 auto; min-width: 0; }
  .photo { flex: 0 0 176px; border-radius: var(--rs); overflow: hidden; background: var(--bg2); aspect-ratio: 16 / 10; }
  .photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
  @media (max-width: 480px) { .head { flex-direction: column; gap: 12px; } .photo { flex: none; width: 100%; aspect-ratio: 16 / 9; } }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: var(--font-weight-semibold, 600); line-height: 20px; white-space: nowrap; }
  .pill i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
  .pill.draft { color: var(--warn); background: var(--warnbg); }
  .pill.live { color: var(--ok); background: var(--okbg); }
  .pill.off { color: var(--t2); background: var(--bg2); }
  .by { font-size: 12px; color: var(--gold); font-weight: var(--font-weight-medium, 500); }
  h1 { margin: 8px 0 0; font-size: var(--font-heading-sm-size, 18px); line-height: var(--font-heading-sm-line-height, 1.3); font-weight: var(--font-weight-semibold, 600); overflow-wrap: anywhere; }
  .note { margin: 6px 0 0; color: var(--t2); overflow-wrap: anywhere; }
  .note.bad { color: var(--bad); }
  dl { margin: 12px 0 0; padding: 0; border-top: var(--border-width-regular, 1px) solid var(--bd); }
  dl > div { display: flex; gap: 12px; padding: 8px 0; border-bottom: var(--border-width-regular, 1px) solid var(--bd); }
  dt { flex: 0 0 64px; color: var(--t3); }
  dd { margin: 0; flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  dd small { display: block; color: var(--t3); font-size: 12px; }
  dd small.ok { color: var(--ok); }
  .sec { margin: 12px 0 0; font-size: 12px; font-weight: var(--font-weight-semibold, 600); color: var(--t2); text-transform: uppercase; letter-spacing: 0.04em; }
  ul { list-style: none; margin: 6px 0 0; padding: 0; }
  li { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; overflow-wrap: anywhere; }
  li .dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--t3); transform: translateY(-1px); }
  li.need .dot { background: var(--warn); }
  li .tag { flex: 0 0 auto; margin-left: auto; font-size: 12px; color: var(--t3); white-space: nowrap; }
  li.need .tag { color: var(--warn); }
  li.row { display: block; padding: 7px 0; border-bottom: var(--border-width-regular, 1px) solid var(--bd); }
  li.row:last-child { border-bottom: 0; padding-bottom: 0; }
  li.row b { font-weight: var(--font-weight-medium, 500); }
  li.row span { display: block; font-size: 12px; color: var(--t3); }
  li.row span.ok { color: var(--ok); }
  .ready { margin: 12px 0 0; padding: 8px 10px; border-radius: var(--rs); color: var(--ok); background: var(--okbg); font-weight: var(--font-weight-medium, 500); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  button { appearance: none; font: inherit; font-weight: var(--font-weight-medium, 500); min-height: 44px; padding: 0 16px; border-radius: var(--rs); border: var(--border-width-regular, 1px) solid var(--bd); background: transparent; color: var(--t1); cursor: pointer; }
  button.primary { background: var(--inv); color: var(--invt); border-color: transparent; }
  button:focus-visible { outline: 2px solid var(--color-ring-primary, var(--gold)); outline-offset: 2px; }
  @media (max-width: 380px) { .actions button { flex: 1 1 100%; } dt { flex-basis: 56px; } }
  /* When the host gives a height limit and the card is taller: a small photo first, then none. */
  .card.compact .head { flex-direction: row; gap: 12px; }
  .card.compact .photo { flex: 0 0 96px; width: 96px; aspect-ratio: 16 / 10; }
  .card.compact dl { margin-top: 10px; }
  .card.compact dl > div { padding: 6px 0; }
  .card.compact .actions { margin-top: 10px; }
  .card.minimal .photo { display: none; }
  .card.minimal dd small, .card.minimal .tag { display: none; }
</style>
</head>
<body>
<div class="card" id="card" aria-live="polite"><p class="note">Loading the event…</p></div>
<script>
(function () {
  "use strict";
  var PROTOCOL = "2026-01-26";
  var host = window.parent;
  var card = document.getElementById("card");
  var nextId = 1;
  var waiting = {};

  /* ── the protocol: JSON-RPC over postMessage ── */
  function post(message) { message.jsonrpc = "2.0"; host.postMessage(message, "*"); }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      waiting[id] = { resolve: resolve, reject: reject };
      post({ id: id, method: method, params: params });
    });
  }
  function notify(method, params) { post(params === undefined ? { method: method } : { method: method, params: params }); }

  window.addEventListener("message", function (ev) {
    if (ev.source !== host) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (typeof m.method === "string") {
      if (m.id !== undefined && m.id !== null) {
        /* a request from the host: answer the two we know, refuse the rest */
        if (m.method === "ping" || m.method === "ui/resource-teardown") post({ id: m.id, result: {} });
        else post({ id: m.id, error: { code: -32601, message: "Method not found" } });
        return;
      }
      var p = m.params || {};
      if (m.method === "ui/notifications/tool-result") showResult(p);
      else if (m.method === "ui/notifications/tool-input") showWorking(p.arguments || {});
      else if (m.method === "ui/notifications/tool-cancelled") showNote("Cancelled. Nothing was changed.", false);
      else if (m.method === "ui/notifications/host-context-changed") applyContext(p);
      return;
    }
    var w = waiting[m.id];
    if (!w) return;
    delete waiting[m.id];
    if (m.error) w.reject(new Error(m.error.message || "The host refused")); else w.resolve(m.result);
  });

  /* ── the host's look: theme, style variables, fonts, safe areas ── */
  function applyContext(ctx) {
    if (!ctx) return;
    var root = document.documentElement;
    if (ctx.theme === "light" || ctx.theme === "dark") { root.setAttribute("data-theme", ctx.theme); root.style.colorScheme = ctx.theme; }
    var styles = ctx.styles || {};
    var vars = styles.variables || {};
    for (var name in vars) { if (Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== undefined && vars[name] !== null) root.style.setProperty(name, String(vars[name])); }
    if (styles.css && styles.css.fonts && !document.getElementById("__mcp-host-fonts")) {
      var st = document.createElement("style"); st.id = "__mcp-host-fonts"; st.textContent = styles.css.fonts; document.head.appendChild(st);
    }
    var s = ctx.safeAreaInsets;
    if (s) document.body.style.padding = [s.top, s.right, s.bottom, s.left].map(function (n) { return (Number(n) || 0) + "px"; }).join(" ");
    var box = ctx.containerDimensions;
    if (box && typeof box.maxHeight === "number" && box.maxHeight > 0) limit = box.maxHeight;
    else if (box && typeof box.height === "number" && box.height > 0) limit = box.height;
    fit();
  }

  /* ── stay inside the host's height limit: the host clips what is taller ── */
  var limit = 0;
  function fit() {
    card.classList.remove("compact", "minimal");
    if (limit) {
      var pad = document.body.getBoundingClientRect().height - card.getBoundingClientRect().height;
      if (card.getBoundingClientRect().height + pad > limit) card.classList.add("compact");
      if (card.getBoundingClientRect().height + pad > limit) card.classList.add("minimal");
    }
    measure();
  }

  /* ── tell the host how tall the card is (never 0) ── */
  var sizeQueued = false, lastW = 0, lastH = 0, connected = false;
  function measure() {
    if (!connected || sizeQueued) return;
    sizeQueued = true;
    requestAnimationFrame(function () {
      sizeQueued = false;
      var root = document.documentElement, before = root.style.height;
      root.style.height = "max-content";
      var h = Math.ceil(root.getBoundingClientRect().height);
      root.style.height = before;
      var w = Math.ceil(window.innerWidth);
      if (h < 1) return;
      if (w !== lastW || h !== lastH) { lastW = w; lastH = h; notify("ui/notifications/size-changed", { width: w, height: h }); }
    });
  }

  /* ── small DOM helpers: text only, never markup ── */
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; }
  function clear() { while (card.firstChild) card.removeChild(card.firstChild); }
  function isHttps(u) { return typeof u === "string" && /^https:\/\//i.test(u); }
  function isWeb(u) { return typeof u === "string" && /^https?:\/\//i.test(u); }
  function openLink(url) {
    request("ui/open-link", { url: url }).catch(function () { try { window.open(url, "_blank", "noopener"); } catch (e) { /* the host decides */ } });
  }
  function button(label, url, primary) {
    var b = el("button", primary ? "primary" : "", label);
    b.type = "button";
    b.addEventListener("click", function () { openLink(url); });
    return b;
  }

  function showNote(text, bad) { clear(); card.appendChild(el("p", bad ? "note bad" : "note", text)); measure(); }
  function showWorking(args) { if (card.getAttribute("data-done")) return; showNote(args && args.title ? "Working on “" + args.title + "”…" : "Working on it…", false); }

  /* what happened, in a few words, from the tool's own answer */
  function headline(p) {
    if (p.already_existed) return "Already there — no second event was made.";
    if (p.saved === true && p.published === true) return "Published. It is live on the website.";
    if (p.saved === true && p.published === false) return "Back to draft. The page is hidden.";
    if (p.saved === true && p.changed) return Array.isArray(p.changed) && p.changed.length ? "Updated: " + p.changed.join(", ") + "." : "No change: it already had these values.";
    if (p.saved === true) return p.copied_from && p.copied_from.title ? "Saved as a draft, copied from “" + p.copied_from.title + "”." : "Saved as a draft.";
    if (p.saved === false && p.problem) return p.problem;
    return "";
  }

  function missingList(items, title, plain) {
    var frag = document.createDocumentFragment();
    frag.appendChild(el("p", "sec", title));
    var ul = el("ul");
    items.forEach(function (m) {
      var li = el("li", m.needed_to_publish ? "need" : "");
      li.appendChild(el("span", "dot"));
      li.appendChild(el("span", "", m.what));
      if (!plain) li.appendChild(el("span", "tag", m.needed_to_publish ? "needed to publish" : "nice to have"));
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    return frag;
  }

  function showEvent(p, e) {
    clear();
    var head = el("div", "head"), info = el("div", "info");
    if (isHttps(e.cover_photo)) {
      var box = el("div", "photo"), img = document.createElement("img");
      img.alt = ""; img.decoding = "async";
      img.addEventListener("load", fit);
      img.addEventListener("error", function () { if (box.parentNode) box.parentNode.removeChild(box); fit(); });
      img.src = e.cover_photo;
      box.appendChild(img); head.appendChild(box);
    }
    head.appendChild(info);
    card.appendChild(head);
    var top = el("div", "top");
    var live = e.status === "published";
    var pill = el("span", "pill " + (live ? "live" : e.status === "draft" ? "draft" : "off"));
    pill.appendChild(el("i")); pill.appendChild(document.createTextNode(live ? "Live" : e.status === "draft" ? "Draft" : String(e.status || "")));
    top.appendChild(pill);
    top.appendChild(el("span", "by", e.brand || "FHI Global"));
    info.appendChild(top);
    info.appendChild(el("h1", "", e.title));
    var line = headline(p);
    if (line) info.appendChild(el("p", p.saved === false && p.problem ? "note bad" : "note", line));

    var dl = el("dl");
    function row(label, value, small, smallOk) {
      var d = el("div"); d.appendChild(el("dt", "", label));
      var dd = el("dd", "", value);
      if (small) dd.appendChild(el("small", smallOk ? "ok" : "", small));
      d.appendChild(dd); dl.appendChild(d);
    }
    /* the day-by-day line only when the days start at different times */
    var sched = "";
    if (Array.isArray(e.schedule) && e.schedule.length > 1) {
      var times = e.schedule.map(function (d) { return String(d).slice(String(d).lastIndexOf(", ") + 2); });
      if (times.some(function (t) { return t !== times[0]; })) sched = e.schedule.join("  ·  ");
    }
    row("When", e.when || "No date yet", sched || (e.time_zone && e.when && e.when !== "no date yet" ? e.time_zone : ""));
    row("Venue", e.venue || "Not set yet", e.venue ? (e.has_map_pin ? "Map pin set" : "No map pin yet") : "", !!e.has_map_pin);
    if (e.appears_on) row("Shows on", e.appears_on);
    var seats = Array.isArray(e.seats_per_day)
      ? (e.seats_per_day.length === 1 ? String(e.seats_per_day[0]) + " seats" : e.seats_per_day.map(function (v, i) { return "Day " + (i + 1) + ": " + v; }).join("  ·  "))
      : "No limit";
    row("Seats", seats, e.registration_open === false ? "Sign-up is closed" : "Sign-up is open", e.registration_open !== false);
    card.appendChild(dl);

    var missing = Array.isArray(e.missing) ? e.missing : [];
    if (live) {
      if (e.is_past) card.appendChild(el("p", "note", "This event has ended. Its page stays on the website."));
      else if (missing.length) card.appendChild(missingList(missing, "Would make the page better", true));
    } else if (missing.length) {
      card.appendChild(missingList(missing, "Still missing"));
    } else if (e.ready_to_publish) {
      card.appendChild(el("p", "ready", "Nothing is missing. Say “publish it” when you are ready."));
    }

    var actions = el("div", "actions");
    if (isWeb(e.open_in_dashboard)) actions.appendChild(button("Open in dashboard", e.open_in_dashboard, true));
    if (live && isWeb(e.public_page)) actions.appendChild(button("View page", e.public_page, false));
    if (actions.firstChild) card.appendChild(actions);
    fit();
  }

  function rows(title, list) {
    var frag = document.createDocumentFragment();
    frag.appendChild(el("p", "sec", title + " (" + list.length + ")"));
    var ul = el("ul");
    list.slice(0, 6).forEach(function (r) {
      var li = el("li", "row");
      li.appendChild(el("b", "", r.title));
      li.appendChild(el("span", "", r.when || ""));
      if (r.status === "draft") {
        var miss = Array.isArray(r.missing) ? r.missing : [];
        li.appendChild(el("span", r.ready_to_publish ? "ok" : "", r.ready_to_publish ? "Ready to publish" : miss.length ? "Missing: " + miss.join(", ") : ""));
      }
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    if (list.length > 6) frag.appendChild(el("p", "note", "+ " + (list.length - 6) + " more"));
    return frag;
  }

  function showResult(result) {
    card.setAttribute("data-done", "1");
    var p = null;
    if (result && result.structuredContent && typeof result.structuredContent === "object") p = result.structuredContent;
    else {
      var blocks = (result && result.content) || [];
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i] && blocks[i].type === "text") { try { p = JSON.parse(blocks[i].text); } catch (e) { p = null; } break; }
      }
    }
    if (!p || typeof p !== "object") { showNote("Done. See Claude’s answer below.", false); return; }
    if (p.event && typeof p.event === "object") { showEvent(p, p.event); return; }
    clear();
    if (Array.isArray(p.drafts) || Array.isArray(p.upcoming_live)) {
      card.appendChild(el("h1", "", "FHI events"));
      var d = p.drafts || [], l = p.upcoming_live || [];
      if (!d.length && !l.length) card.appendChild(el("p", "note", "No drafts and no upcoming live events."));
      if (d.length) card.appendChild(rows("Drafts", d));
      if (l.length) card.appendChild(rows("Live, upcoming", l));
    } else if (Array.isArray(p.which)) {
      card.appendChild(el("h1", "", "Which event?"));
      if (p.problem) card.appendChild(el("p", "note", p.problem));
      card.appendChild(rows("Matches", p.which));
    } else {
      /* a refusal: nothing was saved, and Claude is about to ask for what is listed */
      var asks = Array.isArray(p.missing) && p.missing.length > 0;
      card.appendChild(el("h1", "", p.published === false && p.saved === false ? "Not published yet" : p.saved === false ? "Not saved yet" : "FHI events"));
      card.appendChild(el("p", p.saved === false && !asks ? "note bad" : "note", p.problem || p.say || "Done."));
      if (asks) card.appendChild(missingList(p.missing, p.published === false ? "Missing" : "Needed first", p.published !== false));
    }
    fit();
  }

  /* ── start: listeners are set above, so nothing the host sends is lost ── */
  if (!host || host === window) { showNote("This card is shown inside Claude.", false); return; }
  request("ui/initialize", { appInfo: { name: "FHI event card", version: "1.0.0" }, appCapabilities: {}, protocolVersion: PROTOCOL })
    .then(function (res) {
      applyContext(res && res.hostContext);
      notify("ui/notifications/initialized");
      connected = true;
      measure();
      if (typeof ResizeObserver === "function") { var ro = new ResizeObserver(measure); ro.observe(document.documentElement); ro.observe(document.body); }
      window.addEventListener("resize", measure);
    })
    .catch(function () { /* no host answered: the tool's text answer is still in the chat */ });
})();
</script>
</body>
</html>
`
