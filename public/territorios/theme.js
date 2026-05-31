(function () {
  "use strict";

  var STORAGE_KEY = "mi-theme";
  var listeners = [];

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark") return v;
    } catch (e) {}
    return null;
  }

  function get() {
    return getStored() || systemTheme();
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    listeners.forEach(function (fn) {
      fn(theme);
    });
  }

  function set(theme, persist) {
    if (theme !== "light" && theme !== "dark") theme = "dark";
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
    apply(theme);
    return theme;
  }

  function toggle() {
    return set(get() === "dark" ? "light" : "dark");
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  function bindToggle(btn) {
    if (!btn) return;
    function syncLabel() {
      var dark = get() === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.title = dark ? "Modo claro" : "Modo escuro";
      btn.textContent = dark ? "☀" : "☾";
    }
    syncLabel();
    btn.addEventListener("click", function () {
      toggle();
      syncLabel();
    });
    onChange(syncLabel);
  }

  apply(get());

  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
    if (!getStored()) apply(systemTheme());
  });

  window.MITheme = {
    get: get,
    set: set,
    toggle: toggle,
    onChange: onChange,
    bindToggle: bindToggle,
    mapTileUrl: function () {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--map-tiles")
        .trim()
        .replace(/^["']|["']$/g, "");
    },
  };
})();
