/**
 * NAV-1 — Navegação unificada (NAV-SPEC.md, Política B)
 * Único sítio que aplica sheet mobile / sidebar desktop.
 */
(function () {
  "use strict";

  var currentNav = defaultNav();
  var deps = null;

  function defaultFiltros() {
    return {
      tags: [],
      camadas: [],
      mes: null,
      ano: null,
      festividade: null,
      projetoId: null,
    };
  }

  function defaultNav() {
    return {
      view: "bahia",
      tiSlug: null,
      redeSlug: null,
      territorioSlug: null,
      panel: "lista",
      sheet: "fechada",
      lastListView: "bahia",
      filtros: defaultFiltros(),
    };
  }

  function mergeNav(base, patch) {
    var next = {
      view: patch.view !== undefined ? patch.view : base.view,
      tiSlug: patch.hasOwnProperty("tiSlug") ? patch.tiSlug : base.tiSlug,
      redeSlug: patch.hasOwnProperty("redeSlug") ? patch.redeSlug : base.redeSlug,
      territorioSlug: patch.hasOwnProperty("territorioSlug")
        ? patch.territorioSlug
        : base.territorioSlug,
      panel: patch.panel !== undefined ? patch.panel : base.panel,
      sheet: base.sheet,
      lastListView: patch.lastListView !== undefined ? patch.lastListView : base.lastListView,
      filtros: base.filtros,
    };

    if (patch.redeSlug !== undefined && patch.redeSlug !== null) {
      next.territorioSlug = patch.redeSlug;
    }

    if (patch.sheet === "toggle") {
      next.sheet = base.sheet === "aberta" ? "fechada" : "aberta";
    } else if (patch.sheet !== undefined) {
      next.sheet = patch.sheet;
    }

    if (patch.filtros) {
      next.filtros = Object.assign({}, base.filtros, patch.filtros);
    }

    return next;
  }

  /** Política B — mapa primeiro no mobile */
  function applyPolicyB(nav, patch, isMobile) {
    var explicitSheet =
      patch.sheet !== undefined && patch.sheet !== "toggle";

    if (explicitSheet) return nav;

    if (isMobile) {
      if (patch.view === "territorio") {
        nav.sheet = "fechada";
      } else if (patch.view === "rede" || patch.view === "bahia") {
        nav.sheet = "fechada";
      }
    } else {
      if (patch.view === "territorio") {
        nav.sheet = "aberta";
      } else if (patch.view === "rede" || patch.view === "bahia") {
        nav.sheet = "aberta";
      } else if (patch.panel === "lista" && patch.sheet === undefined) {
        nav.sheet = "aberta";
      }
    }

    return nav;
  }

  function applySheet(nav) {
    if (!deps) return;
    var isMobile = deps.isMobileLayout();

    if (isMobile) {
      if (nav.sheet === "aberta") {
        deps.openMobileSheet();
      } else {
        deps.closeMobileSheet();
      }
      return;
    }

    var main = document.querySelector(".main");
    if (!main) return;
    var btnMenu = deps.$("btn-menu");
    if (nav.sheet === "aberta") {
      main.classList.remove("sidebar-closed");
      if (btnMenu) btnMenu.classList.remove("collapsed");
    } else {
      main.classList.add("sidebar-closed");
      if (btnMenu) btnMenu.classList.add("collapsed");
    }
    deps.updateSidebarToggleState();
    setTimeout(function () {
      if (deps.map && deps.map()) deps.map().invalidateSize();
    }, 250);
  }

  function navigate(patch, opts) {
    opts = opts || {};
    var prev = currentNav;
    var isMobile = deps ? deps.isMobileLayout() : false;
    var next = mergeNav(currentNav, patch);
    next = applyPolicyB(next, patch, isMobile);
    currentNav = next;

    if (patch.view === "rede") next.lastListView = "rede";
    if (patch.view === "bahia") next.lastListView = "bahia";
    currentNav = next;

    if (opts.sheetOnly) {
      applySheet(next);
      if (deps && deps.onSheetOnly) deps.onSheetOnly(next);
      return next;
    }

    if (deps && deps.onNavigate) {
      deps.onNavigate(next, prev, patch);
    }

    applySheet(next);

    if (deps && deps.updateUrlFromNav) {
      deps.updateUrlFromNav(next);
    }

    return next;
  }

  function registerHandlers(handlers) {
    deps = handlers;
  }

  function getNav() {
    return currentNav;
  }

  function setNav(nav) {
    currentNav = nav;
  }

  window.MI_NAV = {
    defaultNav: defaultNav,
    registerHandlers: registerHandlers,
    navigate: navigate,
    getNav: getNav,
    setNav: setNav,
    applySheet: applySheet,
    applyPolicyB: applyPolicyB,
  };
})();
