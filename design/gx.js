/*
 * GX UI behaviours: theme, menus, rail, tabs, row selection, modal.
 * No inline handlers, no eval, no innerHTML, so it runs under script-src 'self'.
 */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- theme ---------- */
  function readTheme() {
    try { var t = localStorage.getItem('gx-theme'); if (t === 'light' || t === 'dark') return t; } catch (e) { /* storage blocked */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    document.querySelectorAll('[data-action="theme"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(t === 'dark'));
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
    try { localStorage.setItem('gx-theme', t); } catch (e) { /* ignore */ }
  }
  applyTheme(readTheme());
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action="theme"]');
    if (b) applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- menus ---------- */
  var openMenu = null;
  function items(menu) { return Array.prototype.slice.call(menu.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])')); }
  function closeMenus(refocus) {
    if (!openMenu) return;
    var trig = document.querySelector('[data-menu-for="' + openMenu.id + '"]');
    openMenu.setAttribute('data-open', 'false');
    if (trig) { trig.setAttribute('aria-expanded', 'false'); if (refocus) trig.focus(); }
    openMenu = null;
  }
  function open(trig) {
    var menu = document.getElementById(trig.getAttribute('data-menu-for'));
    if (!menu) return;
    var same = openMenu === menu;
    closeMenus(false);
    if (same) return;
    menu.setAttribute('data-open', 'true');
    trig.setAttribute('aria-expanded', 'true');
    openMenu = menu;
    var first = menu.querySelector('input') || items(menu)[0];
    if (first) first.focus();
  }
  document.addEventListener('click', function (e) {
    var trig = e.target.closest('[data-menu-for]');
    if (trig) { open(trig); return; }
    var item = e.target.closest('[role^="menuitem"]');
    if (item && openMenu && openMenu.contains(item)) {
      if (openMenu.hasAttribute('data-menu-select') && item.getAttribute('role') === 'menuitemradio') {
        items(openMenu).forEach(function (i) { i.setAttribute('aria-checked', String(i === item)); });
        var t = document.querySelector('[data-menu-for="' + openMenu.id + '"] .gx-menu-value');
        if (t) t.textContent = item.getAttribute('data-label') || item.textContent.trim();
      }
      closeMenus(true);
      return;
    }
    if (openMenu && !openMenu.contains(e.target)) closeMenus(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (openMenu) { closeMenus(true); e.preventDefault(); } closeModal(); return; }
    var trig = e.target.closest && e.target.closest('[data-menu-for]');
    if (trig && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !openMenu) { e.preventDefault(); open(trig); return; }
    if (!openMenu || !openMenu.contains(e.target)) return;
    var list = items(openMenu), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
    else if (e.key === 'Tab') closeMenus(false);
  });

  /* ---------- rail ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action="rail"]');
    if (!b) return;
    var app = document.querySelector('.gx-app');
    var c = app.getAttribute('data-rail') === 'collapsed';
    app.setAttribute('data-rail', c ? 'expanded' : 'collapsed');
    b.setAttribute('aria-expanded', String(c));
  });

  /* ---------- views and tabs ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-view-btn]');
    if (!b) return;
    var name = b.getAttribute('data-view-btn');
    document.querySelectorAll('[data-view-btn]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
    document.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.gx-tabbar .gx-tab[role="tab"]');
    if (!t) return;
    t.parentElement.querySelectorAll('.gx-tab[role="tab"]').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
  });

  /* ---------- row selection and bulk bar ---------- */
  function syncBulk(table) {
    var rows = table.querySelectorAll('tbody [data-row-check]');
    var n = 0;
    rows.forEach(function (c) { var tr = c.closest('tr'); tr.setAttribute('aria-selected', String(c.checked)); if (c.checked) n++; });
    var bar = document.querySelector('[data-bulkbar="' + table.id + '"]');
    if (bar) { bar.setAttribute('data-open', String(n > 0)); var cnt = bar.querySelector('[data-bulk-count]'); if (cnt) cnt.textContent = String(n); }
    var all = table.querySelector('[data-all-check]');
    if (all) { all.checked = n > 0 && n === rows.length; all.indeterminate = n > 0 && n < rows.length; }
  }
  document.addEventListener('change', function (e) {
    var c = e.target;
    if (!c.matches || !(c.matches('[data-row-check]') || c.matches('[data-all-check]'))) return;
    var table = c.closest('table');
    if (c.matches('[data-all-check]')) table.querySelectorAll('tbody [data-row-check]').forEach(function (x) { x.checked = c.checked; });
    syncBulk(table);
  });

  /* ---------- modal ---------- */
  var lastFocus = null;
  function closeModal() {
    var m = document.querySelector('.gx-backdrop[data-open="true"]');
    if (!m) return;
    m.setAttribute('data-open', 'false');
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open-modal]');
    if (o) {
      var m = document.getElementById(o.getAttribute('data-open-modal'));
      if (!m) return;
      lastFocus = o; m.setAttribute('data-open', 'true');
      var f = m.querySelector('[data-autofocus]') || m.querySelector('button, input');
      if (f) f.focus();
      return;
    }
    if (e.target.closest('[data-close-modal]') || (e.target.classList && e.target.classList.contains('gx-backdrop'))) closeModal();
  });
})();
