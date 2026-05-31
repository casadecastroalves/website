(function () {
  "use strict";

  var D = window.MI_DADOS;
  if (!D) return;

  var map, markersLayer, polygonsLayer, linesLayer, labelsLayer, baseTileLayer;
  var mode = "ti";
  var lastMainMode = "ti";
  var activeSlug = null;
  var activeTiSlug = null;
  var activeRoteiroId = null;
  var activeCamadas = {};
  var tiToRede = {};
  var galeriaMidia = null;
  var roteiroMarkers = [];
  var roteiroPanelData = null;
  var roteiroSidebarMidia = null;
  var lagoaPolyLayers = [];
  var tiNavPolyLayers = [];
  var activeLagoaRegId = null;
  var loadingFromShare = false;

  Object.keys(D.redeTiMap || {}).forEach(function (rede) {
    tiToRede[D.redeTiMap[rede]] = rede;
  });

  D.camadas.forEach(function (c) {
    activeCamadas[c.id] = true;
  });

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : s;
    return d.innerHTML;
  }

  function renderPopupFotos(fotos) {
    if (!fotos || !fotos.length) return "";
    return (
      '<div class="popup-fotos">' +
      fotos
        .map(function (f) {
          var url = typeof f === "string" ? f : f && f.src;
          if (!url) return "";
          return (
            '<button type="button" class="popup-photo-btn" aria-label="Ampliar foto">' +
            '<img src="' +
            esc(url) +
            '" alt="" loading="lazy">' +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function getTerritorio(slug) {
    return D.territorios.find(function (t) {
      return t.slug === slug;
    });
  }

  function camadaCor(id) {
    var c = D.camadas.find(function (x) {
      return x.id === id;
    });
    return c ? c.cor : "#6aad2a";
  }

  function showToast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function buildShareUrl() {
    var u = new URL(location.origin + location.pathname);
    if (mode === "territorio" && activeSlug) {
      u.searchParams.set("territorio", activeSlug);
      if (activeSlug === "lagoa-grande" && activeLagoaRegId) {
        u.searchParams.set("regiao", activeLagoaRegId);
      }
    } else if (mode === "rede") {
      u.searchParams.set("vista", "rede");
    } else if (mode === "ti" && activeTiSlug) {
      var redeSlug = tiToRede[activeTiSlug];
      if (redeSlug) {
        u.searchParams.set("territorio", redeSlug);
        if (redeSlug === "lagoa-grande" && activeLagoaRegId) {
          u.searchParams.set("regiao", activeLagoaRegId);
        }
      } else {
        u.searchParams.set("vista", "ti");
        u.searchParams.set("ti", activeTiSlug);
      }
    } else if (mode === "ti") {
      u.searchParams.set("vista", "ti");
    }
    return u.toString();
  }

  function updateUrl() {
    var u = new URL(location.href);
    u.searchParams.delete("territorio");
    u.searchParams.delete("vista");
    u.searchParams.delete("ti");
    u.searchParams.delete("regiao");
    if (mode === "ti") {
      u.searchParams.set("vista", "ti");
      if (activeTiSlug) u.searchParams.set("ti", activeTiSlug);
    } else if (mode === "rede") u.searchParams.set("vista", "rede");
    else if (mode === "territorio" && activeSlug) {
      u.searchParams.set("territorio", activeSlug);
      if (activeSlug === "lagoa-grande" && activeLagoaRegId) {
        u.searchParams.set("regiao", activeLagoaRegId);
      }
    }
    history.replaceState(null, "", u);
  }

  function updateShareMeta(title, subtitle) {
    if (!title) return;
    var desc = subtitle || "Mapa interativo — Movimento Irun";
    document.title = title + " — Identidade e Memória";
    var setMeta = function (sel, val) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute("content", val);
    };
    setMeta('meta[property="og:title"]', title + " — Identidade e Memória");
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:url"]', location.href.split("#")[0]);
  }

  var mapFrameKey = "";
  var mapFrameRetryTimer = null;
  var mapResizeTimer = null;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function mapIsSized() {
    var el = $("map");
    return !!(map && el && el.offsetWidth >= 80 && el.offsetHeight >= 80);
  }

  function clearMapFrameLock() {
    mapFrameKey = "";
  }

  function boundsFromInput(input) {
    if (!input) return null;
    if (input.getNorthEast && input.isValid) return input;
    if (!input.length) return null;
    if (input.length === 2 && typeof input[0] === "number") return L.latLngBounds([input, input]);
    try {
      return L.latLngBounds(input);
    } catch (e) {
      return null;
    }
  }

  function centerOfPoints(points) {
    var lat = 0;
    var lng = 0;
    var n = 0;
    (points || []).forEach(function (p) {
      if (p && p.length === 2) {
        lat += p[0];
        lng += p[1];
        n += 1;
      }
    });
    if (!n) return null;
    return [lat / n, lng / n];
  }

  function applyMapFrame(input, opts) {
    opts = opts || {};
    if (!map) return;
    var padding = opts.padding || [48, 48];
    var maxZoom = opts.maxZoom != null ? opts.maxZoom : 14;
    var minZoom = opts.minZoom != null ? opts.minZoom : 11;
    map.invalidateSize({ animate: false });
    var b = boundsFromInput(input);
    if (b && b.isValid()) {
      map.fitBounds(b, { padding: padding, maxZoom: maxZoom, animate: false });
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
      return;
    }
    var pts = input;
    if (pts && pts.getNorthEast) return;
    if (pts && pts.length === 2 && typeof pts[0] === "number") pts = [pts];
    var c = centerOfPoints(pts);
    if (c) map.setView(c, minZoom, { animate: false });
  }

  function scheduleMapFrame(key, fn, retryOnce) {
    if (!map) return;
    if (mapFrameKey === key) return;
    if (mapFrameRetryTimer) {
      clearTimeout(mapFrameRetryTimer);
      mapFrameRetryTimer = null;
    }

    function runFrame() {
      if (!mapIsSized()) return false;
      fn();
      mapFrameKey = key;
      return true;
    }

    function attempt(useRetry) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (runFrame()) return;
          if (useRetry && retryOnce) {
            mapFrameRetryTimer = setTimeout(function () {
              mapFrameRetryTimer = null;
              if (mapFrameKey === key) return;
              runFrame();
            }, 350);
          }
        });
      });
    }

    if (map._loaded) attempt(retryOnce);
    else map.whenReady(function () {
      attempt(retryOnce);
    });
  }

  function debouncedMapResize() {
    if (mapResizeTimer) clearTimeout(mapResizeTimer);
    mapResizeTimer = setTimeout(function () {
      mapResizeTimer = null;
      if (!map) return;
      clearMapFrameLock();
      refitCurrentView();
    }, 300);
  }

  function getTerritorioBoundsPoints(territorio, regiaoId) {
    if (!territorio) return [];
    if (regiaoId && territorio.slug === "lagoa-grande") {
      var reg = (window.MI_LAGOAS_GEO || []).find(function (r) {
        return r.id === regiaoId;
      });
      if (reg && reg.coords && reg.coords.length) return reg.coords.slice();
    }
    if (territorio.slug === "lagoa-grande" && window.MI_LAGOAS_GEO && window.MI_LAGOAS_GEO.length) {
      var all = [];
      window.MI_LAGOAS_GEO.forEach(function (r) {
        (r.coords || []).forEach(function (c) {
          all.push(c);
        });
      });
      if (all.length) return all;
    }
    var pts = [];
    if (territorio.pin && territorio.pin.length === 2) pts.push(territorio.pin);
    (territorio.pontos || []).forEach(function (p) {
      if (p.coords && p.coords.length === 2) pts.push(p.coords);
    });
    (territorio.municipios || []).forEach(function (m) {
      if (m.coords && m.coords.length === 2) pts.push(m.coords);
    });
    if (pts.length) return pts;
    var tiSlug = D.redeTiMap[territorio.slug];
    var ti = tiSlug
      ? (window.MI_TI_BAHIA || []).find(function (x) {
          return x.slug === tiSlug;
        })
      : null;
    if (ti && ti.coords) return ti.coords.slice();
    return [];
  }

  function frameTerritorioView(territorio, regiaoId, retryOnce) {
    if (!territorio || !map) return;
    var rid = regiaoId != null ? regiaoId : activeLagoaRegId || "";
    var points = getTerritorioBoundsPoints(territorio, rid || null);
    if (!points.length) return;
    var minZoom = territorio.slug === "lagoa-grande" ? 12 : territorio.zoom || 11;
    var key = "territorio:" + territorio.slug + ":" + rid;
    scheduleMapFrame(
      key,
      function () {
        applyMapFrame(points, { padding: [48, 48], maxZoom: 15, minZoom: minZoom });
      },
      retryOnce !== false
    );
  }

  function frameTiView(focused, allBounds) {
    if (!map) return;
    if (focused) {
      scheduleMapFrame(
        "ti:" + focused.slug,
        function () {
          applyMapFrame(focused.coords, { padding: [32, 32], maxZoom: 11, minZoom: 8 });
        },
        true
      );
    } else if (allBounds && allBounds.length) {
      scheduleMapFrame(
        "ti:all",
        function () {
          applyMapFrame(allBounds, { padding: [24, 24], maxZoom: 8, minZoom: 7 });
        },
        true
      );
    }
  }

  function frameRedeView() {
    scheduleMapFrame(
      "rede",
      function () {
        applyMapFrame(
          D.territorios.map(function (t) {
            return t.pin;
          }),
          { padding: [48, 48], maxZoom: 10, minZoom: 7 }
        );
      },
      true
    );
  }

  function refitCurrentView() {
    if (!map) return;
    if (mode === "territorio" && activeSlug) {
      var t = getTerritorio(activeSlug);
      if (t) frameTerritorioView(t, activeLagoaRegId, false);
    } else if (mode === "ti") {
      var geo = window.MI_TI_BAHIA || [];
      if (activeTiSlug) {
        var focused = geo.find(function (x) {
          return x.slug === activeTiSlug;
        });
        if (focused) frameTiView(focused);
      } else {
        var bounds = [];
        geo.forEach(function (ti) {
          ti.coords.forEach(function (c) {
            bounds.push(c);
          });
        });
        frameTiView(null, bounds);
      }
    } else if (mode === "rede") {
      frameRedeView();
    }
  }

  function setSidebarClosed(closed) {
    var main = document.querySelector(".main");
    if (!main) return;
    if (isMobile()) {
      main.classList.remove("sidebar-closed");
      if (closed) closeSidebarMobile();
      return;
    }
    main.classList.toggle("sidebar-closed", !!closed);
  }

  function setHeaderContext(titulo, subtitulo) {
    var el = $("header-location");
    var div = $("brand-divider");
    var brand = $("header-brand");
    if (!el) return;
    if (!titulo) {
      el.hidden = true;
      el.innerHTML = "";
      if (div) div.hidden = true;
      if (brand) brand.classList.remove("has-location");
      return;
    }
    el.hidden = false;
    if (div) div.hidden = false;
    if (brand) brand.classList.add("has-location");
    el.innerHTML =
      '<strong class="header-strip-region">' +
      esc(titulo) +
      "</strong>" +
      (subtitulo ? '<span class="header-strip-place">' + esc(subtitulo) + "</span>" : "");
    updateShareMeta(titulo, subtitulo);
  }

  function initMap() {
    map = L.map("map", { zoomControl: false }).setView([-12.5, -41.5], 7);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    applyMapTheme();
    if (window.MITheme) {
      window.MITheme.onChange(function () {
        applyMapTheme();
        // Re-render map elements to update theme colors
        if (mode === "territorio" && activeSlug) {
          renderTerritorioMap(getTerritorio(activeSlug), { fit: false });
        } else if (mode === "ti") {
          renderTiMap(activeTiSlug, activeTiSlug ? true : false);
        } else if (mode === "rede") {
          renderRedeMap();
        }
      });
    }
    polygonsLayer = L.layerGroup().addTo(map);
    linesLayer = L.layerGroup().addTo(map);
    labelsLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    setTimeout(function () {
      map.invalidateSize();
    }, 250);
    map.on("click", onMapBackgroundClick);
  }

  function applyMapTheme() {
    var url =
      window.MITheme && window.MITheme.mapTileUrl
        ? window.MITheme.mapTileUrl()
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    if (baseTileLayer) map.removeLayer(baseTileLayer);
    baseTileLayer = L.tileLayer(url, {
      attribution: "&copy; OSM &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    });
    baseTileLayer.addTo(map);
    baseTileLayer.bringToBack();
  }

  function onMapBackgroundClick(e) {
    if (mapClickShouldIgnore(e)) return;
    navigateFromMapClick(e.latlng);
  }

  function mapClickShouldIgnore(e) {
    var t = e.originalEvent && e.originalEvent.target;
    if (!t || !t.closest) return false;
    if (t.closest(".leaflet-popup, .leaflet-control, .chip, .map-toggle-sidebar, .btn-menu")) {
      return true;
    }
    if (t.closest(".leaflet-marker-icon, .leaflet-marker-pane img")) return true;
    var path = t.closest(".leaflet-overlay-pane path.leaflet-interactive");
    if (
      path &&
      !path.classList.contains("ti-nav-poly") &&
      !path.classList.contains("lagoa-nav-poly")
    ) {
      return true;
    }
    return false;
  }

  function pointInRing(lat, lng, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var yi = ring[i][0];
      var xi = ring[i][1];
      var yj = ring[j][0];
      var xj = ring[j][1];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function findTiAtLatLng(latlng) {
    var geo = window.MI_TI_BAHIA || [];
    var i;
    for (i = geo.length - 1; i >= 0; i--) {
      if (pointInRing(latlng.lat, latlng.lng, geo[i].coords)) return geo[i];
    }
    return null;
  }

  function findLagoaRegAtLatLng(latlng) {
    var regs = window.MI_LAGOAS_GEO || [];
    var i;
    for (i = regs.length - 1; i >= 0; i--) {
      if (pointInRing(latlng.lat, latlng.lng, regs[i].coords)) return regs[i];
    }
    return null;
  }

  function focusLagoaReg(reg, fit) {
    if (!reg) return;
    activeLagoaRegId = reg.id;
    var t = getTerritorio("lagoa-grande");
    if (t) setHeaderContext(t.ti || t.nome, reg.nome);
    lagoaPolyLayers.forEach(function (poly) {
      var isActive = poly.regId === reg.id;
      poly.setStyle({
        weight: isActive ? 1.1 : 0.55,
        opacity: isActive ? 0.9 : 0.38,
        fillOpacity: 0,
      });
    });
    if (fit !== false && reg.coords && reg.coords.length) {
      var tFrame = getTerritorio("lagoa-grande");
      if (tFrame) {
        clearMapFrameLock();
        frameTerritorioView(tFrame, reg.id, false);
      }
    }
    updateUrl();
    showToast(reg.nome);
  }

  function navigateToTi(ti) {
    if (!ti) return;
    var rede = tiToRede[ti.slug];
    if (rede) {
      if (mode === "territorio" && activeSlug === rede) return;
      selectTerritorio(rede);
      showToast(ti.nome);
      return;
    }
    if (mode === "ti" && activeTiSlug === ti.slug && !activeSlug) return;
    renderTiMap(ti.slug, true);
    showToast(ti.nome);
  }

  function navigateFromMapClick(latlng) {
    var lagoaReg = findLagoaRegAtLatLng(latlng);
    var lagoaTiSlug = D.redeTiMap["lagoa-grande"];
    var ti = findTiAtLatLng(latlng);
    if (!ti) ti = hitTestTiAtLatLng(latlng);

    if (lagoaReg && ti && ti.slug === lagoaTiSlug) {
      if (mode !== "territorio" || activeSlug !== "lagoa-grande") {
        selectTerritorio("lagoa-grande");
      }
      focusLagoaReg(lagoaReg);
      return;
    }

    if (!ti) return;
    navigateToTi(ti);
  }

  function hitTestTiAtLatLng(latlng) {
    var ti = findTiAtLatLng(latlng);
    if (ti) return ti;
    var geo = window.MI_TI_BAHIA || [];
    if (!geo.length) return null;
    var zoom = map ? map.getZoom() : 7;
    var limit = zoom >= 11 ? 0.55 : zoom >= 9 ? 1.0 : zoom >= 7 ? 2.0 : 3.5;
    var limitSq = limit * limit;
    var best = null;
    var bestDist = Infinity;
    geo.forEach(function (t) {
      var c = t.coords;
      if (!c || !c.length) return;
      var latSum = 0;
      var lngSum = 0;
      c.forEach(function (p) {
        latSum += p[0];
        lngSum += p[1];
      });
      var clat = latSum / c.length;
      var clng = lngSum / c.length;
      var d = Math.pow(latlng.lat - clat, 2) + Math.pow(latlng.lng - clng, 2);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    });
    return bestDist < limitSq ? best : null;
  }

  function clearLayers() {
    markersLayer.clearLayers();
    polygonsLayer.clearLayers();
    linesLayer.clearLayers();
    labelsLayer.clearLayers();
    roteiroMarkers = [];
    lagoaPolyLayers = [];
    tiNavPolyLayers = [];
  }

  function renderMunicipioLabels(territorio) {
    if (mode === "territorio") return;
    (territorio.municipios || []).forEach(function (m) {
      var icon = L.divIcon({
        className: "municipio-label-wrap",
        html: '<span class="municipio-label">' + esc(m.nome) + "</span>",
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      });
      L.marker(m.coords, {
        icon: icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 400,
      }).addTo(labelsLayer);
    });
  }

  function updateHeaderNavActive() {
    var btnTi = $("btn-ti");
    var btnRede = $("btn-rede");
    if (btnTi) btnTi.classList.toggle("header-nav-active", mode === "ti");
    if (btnRede) btnRede.classList.toggle("header-nav-active", mode === "rede");
  }

  function toggleUiForMode() {
    var tabs = $("tabs-territorio");
    if (tabs) tabs.hidden = mode !== "territorio";

    var chips = $("layer-chips");
    if (chips) chips.hidden = mode !== "territorio";

    updateHeaderNavActive();
  }

  function renderDivisaoTiNav(highlightSlug) {
    return (
      "<h3>Divisão territorial</h3><p>" +
      esc(D.conceitos.divisao) +
      "</p>" +
      renderTiListHtml(highlightSlug)
    );
  }

  function renderTiListHtml(highlightSlug) {
    var geo = window.MI_TI_BAHIA || [];
    return (
      '<div class="ti-nav-block">' +
      "<h3>27 Territórios de Identidade Cultural</h3>" +
      '<ul class="ti-list-plain">' +
      geo
        .map(function (ti) {
          var cls = highlightSlug === ti.slug ? " active" : "";
          var rede = tiToRede[ti.slug];
          var tag = rede ? '<span class="tag-rede ti-tag">Rede</span> ' : "";
          return (
            "<li><button type='button' class='ti-link" +
            cls +
            "' data-ti='" +
            esc(ti.slug) +
            "'>" +
            tag +
            esc(ti.nome) +
            "</button></li>"
          );
        })
        .join("") +
      "</ul></div>"
    );
  }

  function bindTiLinks() {
    var geo = window.MI_TI_BAHIA || [];
    document.querySelectorAll(".ti-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ti = geo.find(function (x) {
          return x.slug === btn.dataset.ti;
        });
        if (ti) onTiClick(ti);
      });
    });
  }

  function getCombinedGaleria(t) {
    var fotos = [];
    var videos = [];
    if (t.galeria) {
      if (t.galeria.fotos) {
        t.galeria.fotos.forEach(function (f) {
          fotos.push(f);
        });
      }
      if (t.galeria.videos) {
        t.galeria.videos.forEach(function (v) {
          videos.push(v);
        });
      }
    }
    (t.pontos || []).forEach(function (p) {
      if (p.fotos) {
        p.fotos.forEach(function (f) {
          var src = typeof f === "string" ? f : f && f.src;
          var tTitle = (typeof f === "object" && f.titulo) || p.titulo || "";
          if (src) {
            if (!fotos.some(function (x) { return (typeof x === "string" ? x : x.src) === src; })) {
              fotos.push({ src: src, titulo: tTitle });
            }
          }
        });
      }
      if (p.videos) {
        p.videos.forEach(function (v) {
          if (!videos.some(function (x) { return x.url === v.url; })) {
            videos.push(v);
          }
        });
      }
    });
    return { fotos: fotos, videos: videos };
  }

  function tabHasContent(t, name) {
    if (name === "territorio") return true;
    if (name === "cultura") return (t.cultura || []).length > 0;
    if (name === "memoria") return (t.memoria || []).length > 0;
    if (name === "roteiros") return (t.roteiros || []).length > 0;
    if (name === "galeria") {
      var g = getCombinedGaleria(t);
      return g.fotos.length > 0 || g.videos.length > 0;
    }
    return false;
  }

  function updateTabsVisibility(t) {
    var activeTab = document.querySelector("#tabs-territorio .tab.active");
    var activeName = activeTab ? activeTab.dataset.tab : "territorio";
    var visibleCount = 0;
    ["territorio", "cultura", "galeria", "memoria", "roteiros"].forEach(function (name) {
      var tab = document.querySelector('#tabs-territorio .tab[data-tab="' + name + '"]');
      if (tab) {
        var hasContent = tabHasContent(t, name);
        tab.hidden = !hasContent;
        if (hasContent) visibleCount++;
      }
    });
    var tabsEl = $("tabs-territorio");
    if (tabsEl) {
      tabsEl.hidden = (visibleCount <= 1);
    }
    if (!tabHasContent(t, activeName)) setActiveTab("territorio");
    else setActiveTab(activeName);
  }

  function camadasComPontos(territorio) {
    var set = {};
    if (!territorio) return set;
    (territorio.pontos || []).forEach(function (p) {
      if (p.camada) set[p.camada] = true;
    });
    return set;
  }

  function renderChips(territorio) {
    var wrap = $("layer-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (mode !== "territorio") {
      wrap.hidden = true;
      return;
    }
    var comPontos = camadasComPontos(territorio);
    D.camadas.forEach(function (c) {
      if (!comPontos[c.id]) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (activeCamadas[c.id] ? " active" : "");
      btn.textContent = c.rotulo;
      btn.style.color = c.cor;
      btn.dataset.camada = c.id;
      btn.addEventListener("click", function () {
        activeCamadas[c.id] = !activeCamadas[c.id];
        renderChips(getTerritorio(activeSlug));
        if (activeSlug) renderTerritorioMap(getTerritorio(activeSlug), { fit: false });
      });
      wrap.appendChild(btn);
    });
    wrap.hidden = wrap.childElementCount === 0;
  }

  function setActiveTab(name) {
    document.querySelectorAll("#tabs-territorio .tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    ["territorio", "cultura", "galeria", "memoria", "roteiros"].forEach(function (k) {
      var p = $("panel-" + k);
      if (p) p.classList.toggle("active", k === name);
    });
  }

  function bindTabs() {
    document.querySelectorAll("#tabs-territorio .tab").forEach(function (tab) {
      tab.onclick = function () {
        setActiveTab(tab.dataset.tab);
      };
    });
  }

  function territorioLabel(t) {
    return t.nome + (t.subtitulo ? " · " + t.subtitulo : "");
  }

  function getTiResumo(slug) {
    if (D.tiResumos && D.tiResumos[slug]) return D.tiResumos[slug];
    return "Território de Identidade Cultural da Bahia — divisão oficial por critérios ambientais, econômicos e culturais.";
  }

  function fitTerritorioView(territorio) {
    frameTerritorioView(territorio);
  }

  function renderTiSidebar(highlightSlug, focusOnly) {
    var geo = window.MI_TI_BAHIA || [];
    var focused = highlightSlug
      ? geo.find(function (x) {
          return x.slug === highlightSlug;
        })
      : null;
    var hasRede = highlightSlug && tiToRede[highlightSlug];
    var focusBlock = focused
      ? '<div class="ti-focus">' +
        '<h2 class="territorio-heading">' +
        esc(focused.nome) +
        "</h2>" +
        '<p class="ti-focus-text">' +
        esc(getTiResumo(focused.slug)) +
        "</p>" +
        "</div>"
      : "";

    var navBlock =
      focusOnly && focused && !hasRede ? "" : renderDivisaoTiNav(highlightSlug);

    $("panel-territorio").innerHTML =
      '<div class="conceitos">' +
      focusBlock +
      (focusOnly && focused && !hasRede
        ? ""
        : "<p class='brand-block'><strong>" +
          esc(D.subtitulo) +
          "</strong><br>" +
          esc(D.titulo) +
          "<br><em>" +
          esc(D.autoria) +
          "</em></p>") +
      navBlock +
      "<p class='hint'>" +
      esc(D.conceitos.notaOffline) +
      "</p></div>";

    bindTiLinks();

    ["cultura", "galeria", "memoria", "roteiros"].forEach(function (k) {
      $("panel-" + k).innerHTML = "";
    });
    setActiveTab("territorio");
  }

  function renderTiMap(highlightSlug, focusOne) {
    clearLayers();
    clearMapFrameLock();
    mode = "ti";
    lastMainMode = "ti";
    activeSlug = null;
    activeRoteiroId = null;
    if (highlightSlug) activeTiSlug = highlightSlug;
    else if (!focusOne) activeTiSlug = null;

    toggleUiForMode();
    renderChips(null);

    var hl = activeTiSlug;
    var geo = window.MI_TI_BAHIA || [];
    var focused = hl
       ? geo.find(function (x) {
          return x.slug === hl;
        })
       : null;

    if (focusOne && focused) setHeaderContext(focused.nome);
    else setHeaderContext("27 Territórios de Identidade da Bahia");

    renderTiSidebar(hl, focusOne);
    renderTiNavPolygons(hl, { bahiaView: true });

    if (focusOne && focused) {
      frameTiView(focused);
    } else {
      var bounds = [];
      geo.forEach(function (ti) {
        ti.coords.forEach(function (c) {
          bounds.push(c);
        });
      });
      frameTiView(null, bounds);
    }
    updateUrl();
    updateFormNavLink();

    if (highlightSlug && focusOne && !loadingFromShare) {
      if (window.innerWidth <= 768) {
        openSidebarMobile();
      } else {
        var main = document.querySelector(".main");
        if (main) {
          main.classList.remove("sidebar-closed");
          var btnMenu = $("btn-menu");
          if (btnMenu) btnMenu.classList.remove("collapsed");
        }
      }
    } else if (loadingFromShare) {
      setSidebarClosed(true);
    }
    updateSidebarToggleState();
  }

  function onTiClick(ti) {
    navigateToTi(ti);
  }

  function renderTiNavPolygons(highlightTiSlug, opts) {
    opts = opts || {};
    var bahiaView = !!opts.bahiaView;
    var isActive;
    tiNavPolyLayers = [];
    var theme = window.MITheme ? window.MITheme.get() : "dark";
    var borderNormal = theme === "dark" ? "rgba(255, 255, 255, 0.45)" : "rgba(10, 10, 10, 0.35)";
    var borderActive = theme === "dark" ? "#39ff14" : "#22c55e"; // neon green active outline

    (window.MI_TI_BAHIA || []).forEach(function (ti) {
      if (opts.skipSlug && ti.slug === opts.skipSlug) return;
      isActive = highlightTiSlug === ti.slug;
      var poly = L.polygon(ti.coords, {
        color: isActive ? borderActive : borderNormal,
        weight: isActive ? 3.0 : 1.2,
        opacity: isActive ? 0.95 : 0.55,
        fillColor: isActive ? borderActive : "transparent",
        fillOpacity: isActive ? 0.05 : 0,
        className: "ti-nav-poly" + (isActive ? " active" : ""),
      });
      poly.tiSlug = ti.slug;
      poly._tiBase = { 
        color: isActive ? borderActive : borderNormal,
        weight: isActive ? 3.0 : 1.2,
        opacity: isActive ? 0.95 : 0.55 
      };
      if (!opts.hideTooltips) {
        poly.bindTooltip(ti.nome, {
          sticky: false,
          className: "regiao-tooltip",
          direction: "top",
          opacity: 1,
        });
      }
      poly.on("mouseover", function () {
        if (!isActive) poly.setStyle({ weight: 0.85, opacity: 0.65 });
      });
      poly.on("mouseout", function () {
        poly.setStyle(poly._tiBase);
      });
      tiNavPolyLayers.push(poly);
      polygonsLayer.addLayer(poly);
    });
  }

  function renderRedeMap() {
    clearLayers();
    clearMapFrameLock();
    mode = "rede";
    lastMainMode = "rede";
    activeSlug = null;
    activeRoteiroId = null;
    toggleUiForMode();
    renderChips(null);
    setHeaderContext("Rede Movimento Irun", "6 territórios");

    $("panel-territorio").innerHTML =
      '<div class="conceitos">' +
      renderDivisaoTiNav(null) +
      "<p class='hint'>" +
      esc(D.conceitos.notaOffline) +
      "</p></div>";
    bindTiLinks();
    ["cultura", "galeria", "memoria", "roteiros"].forEach(function (k) {
      $("panel-" + k).innerHTML = "";
    });
    setActiveTab("territorio");

    renderTiNavPolygons(null);

    D.territorios.forEach(function (t) {
      var m = L.circleMarker(t.pin, {
        radius: 11,
        fillColor: "#6aad2a",
        color: "#fff",
        weight: 2,
        fillOpacity: 0.95,
      });
      m.bindPopup(
        "<h4>" +
          esc(t.nome) +
          "</h4><p>" +
          esc(t.subtitulo || "") +
          '</p><button type="button" class="btn btn-primary popup-go">Abrir</button>'
      );
      m.on("popupopen", function (ev) {
        var el = ev.popup.getElement();
        if (el) {
          var cw = el.querySelector(".leaflet-popup-content-wrapper");
          if (cw) L.DomEvent.disableClickPropagation(cw);
        }
        var b = el && el.querySelector(".popup-go");
        if (b) {
          b.onclick = function () {
            selectTerritorio(t.slug);
            map.closePopup();
          };
        }
      });
      m.on("click", function (e) {
        L.DomEvent.stopPropagation(e);
        selectTerritorio(t.slug);
      });
      markersLayer.addLayer(m);
    });

    frameRedeView();
    bringMarkersToFront();
    updateUrl();
    updateFormNavLink();
    updateSidebarToggleState();
  }

  function renderLagoaPolys() {
    lagoaPolyLayers = [];
    (window.MI_LAGOAS_GEO || []).forEach(function (reg) {
      var isActive = activeLagoaRegId === reg.id;
      var poly = L.polygon(reg.coords, {
        color: reg.cor || "#6aad2a",
        weight: isActive ? 3.5 : 2.0,
        opacity: isActive ? 0.95 : 0.75,
        fillColor: reg.cor || "#6aad2a",
        fillOpacity: isActive ? 0.35 : 0.15,
        className: "lagoa-nav-poly" + (isActive ? " active" : ""),
      });
      poly.regId = reg.id;
      poly.bindTooltip(reg.nome, {
        sticky: false,
        direction: "top",
        className: "regiao-tooltip",
      });
      poly.bindPopup("<h4>" + esc(reg.nome) + "</h4><p>" + esc(reg.desc || "") + "</p>");
      lagoaPolyLayers.push(poly);
      polygonsLayer.addLayer(poly);
    });
  }

  function midiaItems(source) {
    if (!source) return [];
    var items = [];
    (source.fotos || []).forEach(function (f) {
      var src = typeof f === "string" ? f : f && f.src;
      if (!src) return;
      items.push({
        tipo: "foto",
        titulo: (typeof f === "object" && f.titulo) || "",
        src: src,
      });
    });
    (source.videos || []).forEach(function (v) {
      items.push({
        tipo: "video",
        titulo: v.titulo || "",
        url: v.url,
        id: ytId(v.url),
      });
    });
    return items;
  }

  function renderPopupMidia(items) {
    if (!items.length) return "";
    if (items.length === 1) {
      return (
        '<div class="popup-midia popup-midia--single">' +
        renderMidiaStageHtml(items[0], "popup") +
        "</div>"
      );
    }
    return (
      '<div class="popup-midia" data-count="' +
      items.length +
      '">' +
      '<div class="popup-midia-stage">' +
      renderMidiaStageHtml(items[0], "popup") +
      "</div>" +
      '<div class="popup-midia-nav">' +
      '<button type="button" class="popup-midia-btn popup-midia-prev" aria-label="Anterior">&lsaquo;</button>' +
      '<span class="popup-midia-index">1 de ' +
      items.length +
      "</span>" +
      '<button type="button" class="popup-midia-btn popup-midia-next" aria-label="Próximo">&rsaquo;</button>' +
      "</div></div>"
    );
  }

  function renderMidiaStageHtml(item, mode) {
    if (!item) return "";
    if (item.tipo === "foto") {
      if (mode === "popup") {
        return (
          '<figure class="popup-midia-figure">' +
          '<button type="button" class="popup-photo-btn" aria-label="Ampliar foto">' +
          '<img src="' +
          esc(item.src) +
          '" alt="' +
          esc(item.titulo) +
          '" loading="lazy">' +
          "</button>" +
          (item.titulo ? '<figcaption>' + esc(item.titulo) + "</figcaption>" : "") +
          "</figure>"
        );
      }
      return (
        '<figure class="slideshow-figure">' +
        '<button type="button" class="slideshow-img-btn" aria-label="Ampliar foto">' +
        '<img class="slideshow-img" src="' +
        esc(item.src) +
        '" alt="' +
        esc(item.titulo) +
        '" loading="lazy">' +
        "</button>" +
        '<figcaption class="slideshow-caption">' +
        esc(item.titulo) +
        "</figcaption></figure>"
      );
    }
    if (item.tipo === "video" && item.id) {
      var wrapCls = mode === "popup" ? "video-embed-wrap popup-video-wrap" : "video-embed-wrap galeria-slide-video";
      return (
        '<figure class="slideshow-figure slideshow-figure--video">' +
        '<div class="' +
        wrapCls +
        '" aria-label="' +
        esc(item.titulo) +
        '">' +
        '<div class="video-embed-poster" data-yt-id="' +
        esc(item.id) +
        '">' +
        '<img src="https://img.youtube.com/vi/' +
        esc(item.id) +
        '/hqdefault.jpg" alt="" loading="lazy">' +
        '<button type="button" class="video-play-btn" aria-label="Reproduzir">' +
        '<span class="video-play-icon" aria-hidden="true">&#9654;</span>' +
        "<span>Reproduzir</span></button></div></div>" +
        '<figcaption class="slideshow-caption">' +
        esc(item.titulo) +
        "</figcaption></figure>"
      );
    }
    return "";
  }

  function renderMidiaActionsHtml(item) {
    if (!item) return "";
    if (item.tipo === "foto") {
      return '<button type="button" class="btn btn-slideshow-fs">Tela cheia</button>';
    }
    if (item.tipo === "video" && item.id) {
      return (
        '<button type="button" class="btn btn-video-fs" data-yt-id="' +
        esc(item.id) +
        '">Tela cheia</button>' +
        '<a class="btn" href="' +
        esc(item.url) +
        '" target="_blank" rel="noopener noreferrer">YouTube</a>'
      );
    }
    return "";
  }

  function bindMidiaVideoControls(root, autoplay) {
    if (!root) return;
    root.querySelectorAll(".video-embed-poster").forEach(function (poster) {
      var wrap = poster.closest(".video-embed-wrap");
      var id = poster.dataset.ytId;
      
      poster.addEventListener("click", function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        playGalleryVideo(wrap, null, id);
      });
      
      if (autoplay && id && canInlineYoutube()) {
        mountYoutubePlayer(wrap, id, true);
      }
    });
    root.querySelectorAll(".btn-video-fs").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.ytId;
        var iframeWrap = btn.closest(".video-embed-block, .galeria-slideshow, .popup-midia");
        iframeWrap = iframeWrap ? iframeWrap.querySelector(".video-embed-wrap, .galeria-slide-video") : null;
        fullscreenVideoWrap(iframeWrap, id);
      });
    });
  }

  function openPopupPhotoLightbox(src, titulo, fotoItems) {
    fotoItems =
      fotoItems && fotoItems.length
        ? fotoItems.filter(function (x) {
            return x.tipo === "foto";
          })
        : [{ tipo: "foto", src: src, titulo: titulo || "" }];
    if (!fotoItems.length) return;
    var idx = 0;
    fotoItems.forEach(function (f, i) {
      if (f.src === src) idx = i;
    });
    galeriaMidia = {
      items: fotoItems,
      idx: idx,
      show: function (n) {
        galeriaMidia.idx = (n + fotoItems.length) % fotoItems.length;
        refreshGaleriaLightbox();
      },
      prev: fotoItems.length > 1,
      next: fotoItems.length > 1,
    };
    openGaleriaLightbox();
  }

  function bindPopupPhotoZoom(root, items) {
    if (!root) return;
    var fotos = (items || []).filter(function (x) {
      return x.tipo === "foto";
    });
    root.querySelectorAll(".popup-photo-btn").forEach(function (btn) {
      var img = btn.querySelector("img");
      if (!img) return;
      btn.onclick = function () {
        openPopupPhotoLightbox(img.getAttribute("src"), img.alt, fotos);
      };
    });
  }

  function bindPopupMidia(root, items) {
    if (root) {
      var cw = root.querySelector(".leaflet-popup-content-wrapper");
      if (cw) L.DomEvent.disableClickPropagation(cw);
      else L.DomEvent.disableClickPropagation(root);
    }
    var block = root.querySelector(".popup-midia");
    items = items || [];
    if (!block) {
      bindPopupPhotoZoom(root, items);
      return;
    }
    if (block.classList.contains("popup-midia--single") || items.length <= 1) {
      bindMidiaVideoControls(block, items[0] && items[0].tipo === "video" && canInlineYoutube());
      bindPopupPhotoZoom(root, items);
      return;
    }

    var stage = block.querySelector(".popup-midia-stage");
    var indexEl = block.querySelector(".popup-midia-index");
    var prev = block.querySelector(".popup-midia-prev");
    var next = block.querySelector(".popup-midia-next");
    if (!stage) return;

    var idx = 0;

    function showPopupItem(n) {
      idx = (n + items.length) % items.length;
      stage.innerHTML = renderMidiaStageHtml(items[idx], "popup");
      if (indexEl) indexEl.textContent = idx + 1 + " de " + items.length;
      bindMidiaVideoControls(stage, items[idx].tipo === "video" && canInlineYoutube());
      bindPopupPhotoZoom(root, items);
    }

    if (prev) prev.onclick = function () { showPopupItem(idx - 1); };
    if (next) next.onclick = function () { showPopupItem(idx + 1); };
    bindMidiaVideoControls(stage, items[0].tipo === "video" && canInlineYoutube());
    bindPopupPhotoZoom(root, items);
  }

  function renderSidebarMidiaCarousel(items, extraClass) {
    if (!items.length) return "";
    extraClass = extraClass || "";
    var single = items.length === 1;
    return (
      '<div class="galeria-slideshow ' +
      extraClass +
      (single ? " galeria-slideshow--single" : "") +
      '" data-count="' +
      items.length +
      '">' +
      '<div class="slideshow-stage">' +
      (single
        ? ""
        : '<button type="button" class="slideshow-btn slideshow-prev" aria-label="Anterior">&lsaquo;</button>') +
      '<div class="galeria-midia-stage">' +
      renderMidiaStageHtml(items[0], "sidebar") +
      "</div>" +
      (single
        ? ""
        : '<button type="button" class="slideshow-btn slideshow-next" aria-label="Próximo">&rsaquo;</button>') +
      "</div>" +
      '<div class="slideshow-toolbar">' +
      '<p class="slideshow-meta"><span class="slideshow-index">1</span> / ' +
      items.length +
      "</p>" +
      '<div class="slideshow-actions">' +
      renderMidiaActionsHtml(items[0]) +
      "</div></div></div>"
    );
  }

  function bindSidebarMidiaActions(slideshow, items, idx, showItem) {
    if (!slideshow) return;
    slideshow.querySelectorAll(".btn-slideshow-fs").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fotoItems = items.filter(function (x) {
          return x.tipo === "foto";
        });
        var fotoIdx = items.slice(0, idx + 1).filter(function (x) {
          return x.tipo === "foto";
        }).length - 1;
        galeriaMidia = {
          items: fotoItems,
          idx: Math.max(0, fotoIdx),
          show: function (n) {
            var target = fotoItems[(n + fotoItems.length) % fotoItems.length];
            var fullIdx = items.indexOf(target);
            if (fullIdx >= 0) showItem(fullIdx);
            galeriaMidia.idx = fotoItems.indexOf(target);
            refreshGaleriaLightbox();
          },
          prev: fotoItems.length > 1,
          next: fotoItems.length > 1,
        };
        openGaleriaLightbox();
      });
    });
    slideshow.querySelectorAll(".btn-video-fs").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.ytId;
        var wrap = btn.closest(".galeria-slideshow");
        var iframeWrap = wrap ? wrap.querySelector(".video-embed-wrap iframe") : null;
        if (iframeWrap && iframeWrap.parentElement && canInlineYoutube()) {
          requestFullscreen(iframeWrap.parentElement);
          return;
        }
        if (id) openYoutubeLarge(id);
      });
    });
  }

  function bindSidebarMidiaCarousel(container, items) {
    if (!container || !items.length) return null;
    var slideshow = container.querySelector(".galeria-slideshow");
    if (!slideshow) return null;

    var idx = 0;
    var stage = slideshow.querySelector(".galeria-midia-stage");
    var indexEl = slideshow.querySelector(".slideshow-index");
    var actionsEl = slideshow.querySelector(".slideshow-actions");
    var prev = slideshow.querySelector(".slideshow-prev");
    var next = slideshow.querySelector(".slideshow-next");

    function showItem(n) {
      idx = (n + items.length) % items.length;
      if (stage) stage.innerHTML = renderMidiaStageHtml(items[idx], "sidebar");
      if (indexEl) indexEl.textContent = String(idx + 1);
      if (actionsEl) actionsEl.innerHTML = renderMidiaActionsHtml(items[idx]);
      bindMidiaVideoControls(stage, items[idx].tipo === "video" && canInlineYoutube());
      bindSidebarMidiaActions(slideshow, items, idx, showItem);
      var imgBtn = stage && stage.querySelector(".slideshow-img-btn");
      if (imgBtn) {
        imgBtn.addEventListener("click", function () {
          galeriaMidia = {
            items: items.filter(function (x) {
              return x.tipo === "foto";
            }),
            idx: items.slice(0, idx + 1).filter(function (x) {
              return x.tipo === "foto";
            }).length - 1,
            show: showItem,
            prev: !!prev,
            next: !!next,
          };
          if (galeriaMidia.idx < 0) galeriaMidia.idx = 0;
          openGaleriaLightbox();
        });
      }
    }

    if (prev) prev.addEventListener("click", function () { showItem(idx - 1); });
    if (next) next.addEventListener("click", function () { showItem(idx + 1); });
    bindMidiaVideoControls(stage, items[0].tipo === "video" && canInlineYoutube());
    bindSidebarMidiaActions(slideshow, items, 0, showItem);

    return { items: items, idx: 0, show: showItem, prev: !!prev, next: !!next };
  }

  function roteiroStopPopupHtml(s, paradaNum) {
    var items = midiaItems({ fotos: s.fotos, videos: s.videos });
    var html =
      "<h4>" +
      esc(s.name) +
      "</h4><p>Parada " +
      paradaNum +
      " · Contra Costa</p>";
    if (items.length) html += renderPopupMidia(items);
    return html;
  }

  function focusRoteiroStop(stopIdx) {
    var m = roteiroMarkers[stopIdx];
    if (!m) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 13), { animate: true });
    m.openPopup();
  }

  function bringMarkersToFront() {
    if (markersLayer) markersLayer.bringToFront();
    if (labelsLayer) labelsLayer.bringToFront();
  }

  function isMediaUrl(url) {
    return /hostedimage|googleusercontent|\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url || "");
  }

  function displayLinks(links) {
    return (links || []).filter(function (u) {
      return u && !isMediaUrl(u);
    });
  }

  function linkLabel(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, "");
      var p = new URL(url).pathname;
      if (p && p !== "/") return h + p.replace(/\/$/, "");
      return h;
    } catch (e) {
      return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
  }
  function popupHtml(p) {
    var html = "<h4>" + esc(p.titulo) + "</h4>";
    var r = (p.resumo || "").trim();
    if (r) html += "<p>" + esc(r) + "</p>";
    var webLinks = displayLinks(p.links);
    if (webLinks.length) {
      html +=
        '<p class="popup-links">' +
        webLinks
          .map(function (u) {
            return (
              '<a href="' +
              esc(u) +
              '" target="_blank" rel="noopener noreferrer">' +
              esc(linkLabel(u)) +
              "</a>"
            );
          })
          .join("<br>") +
        "</p>";
    }
    var items = midiaItems(p);
    if (items.length) {
      html += renderPopupMidia(items);
    } else if (p.fotos && p.fotos.length) {
      html += renderPopupFotos(p.fotos);
    }
    return html;
  }

  function renderPontos(territorio) {
    (territorio.pontos || []).forEach(function (p) {
      if (!activeCamadas[p.camada]) return;
      var m = L.circleMarker(p.coords, {
        radius: 10,
        fillColor: camadaCor(p.camada),
        color: "#fff",
        weight: 2,
        fillOpacity: 0.92,
      });
      var pontoMidia = midiaItems(p);
      m.bindPopup(popupHtml(p), { maxWidth: 300 });
      m.on("click", function (e) {
        L.DomEvent.stopPropagation(e);
      });
      m.on("popupopen", function () {
        var el = m.getPopup().getElement();
        if (el) {
          var cw = el.querySelector(".leaflet-popup-content-wrapper");
          if (cw) L.DomEvent.disableClickPropagation(cw);
          if (pontoMidia.length) {
            bindPopupMidia(el, pontoMidia);
          }
        }
      });
      m.pontoId = p.id;
      markersLayer.addLayer(m);
    });
  }

  function renderRoteiroOnMap(territorio, roteiroId) {
    var roteiro = (territorio.roteiros || []).find(function (r) {
      return r.id === roteiroId;
    });
    if (!roteiro) return;

    if (roteiro.ref === "MI_ROTEIRO_CONTRA_COSTA" && window.MI_ROTEIRO_CONTRA_COSTA) {
      var data = window.MI_ROTEIRO_CONTRA_COSTA;
      var path = data.path || [];
      var points = data.points || data.stops || [];

      if (path.length > 1) {
        L.polyline(path, {
          color: "#6ee7b7",
          weight: 3,
          opacity: 0.9,
          lineJoin: "round",
        }).addTo(linesLayer);
      }

      points.forEach(function (s, i) {
        if (/^line\s*\d*$/i.test(String(s.name || "").trim())) return;
        var stopIdx = roteiroMarkers.length;
        var items = midiaItems({ fotos: s.fotos, videos: s.videos });
        var m = L.circleMarker([s.lat, s.lng], {
          radius: 10,
          fillColor: "#6aad2a",
          color: "#fff",
          weight: 2,
          fillOpacity: 0.95,
        });
        m.bindPopup(roteiroStopPopupHtml(s, stopIdx + 1), { maxWidth: 300 });
        m.on("click", function (e) {
          L.DomEvent.stopPropagation(e);
        });
        if (items.length) {
          m.on("popupopen", function () {
            var el = m.getPopup().getElement();
            if (el) {
              var cw = el.querySelector(".leaflet-popup-content-wrapper");
              if (cw) L.DomEvent.disableClickPropagation(cw);
              bindPopupMidia(el, items);
            }
          });
        }
        roteiroMarkers[stopIdx] = m;
        markersLayer.addLayer(m);
      });

      var bounds = [];
      path.forEach(function (c) {
        bounds.push(c);
      });
      points.forEach(function (s) {
        if (!/^line\s*\d*$/i.test(String(s.name || "").trim())) {
          bounds.push([s.lat, s.lng]);
        }
      });
      if (bounds.length) applyMapFrame(bounds, { padding: [48, 48], maxZoom: 14, minZoom: 11 });
      return;
    }

    if (roteiroId === "subregioes") {
      renderLagoaPolys();
      var all = [];
      (window.MI_LAGOAS_GEO || []).forEach(function (r) {
        r.coords.forEach(function (c) {
          all.push(c);
        });
      });
      if (all.length) applyMapFrame(all, { padding: [32, 32], maxZoom: 13, minZoom: 12 });
    }
  }

  function renderTerritorioMap(territorio, options) {
    options = options || {};
    clearLayers();

    // Render boundary of the parent TI region
    var tiSlug = D.redeTiMap[territorio.slug];
    var ti = tiSlug
      ? (window.MI_TI_BAHIA || []).find(function (x) {
          return x.slug === tiSlug;
        })
      : null;
    if (ti) {
      var theme = window.MITheme ? window.MITheme.get() : "dark";
      var tiBoundaryColor = theme === "dark" ? "#39ff14" : "#22c55e";
      var tiBoundaryFill = theme === "dark" ? "rgba(57, 255, 20, 0.03)" : "rgba(22, 163, 74, 0.02)";

      var tiPoly = L.polygon(ti.coords, {
        color: tiBoundaryColor,
        weight: 3.5,
        opacity: 0.95,
        fillColor: tiBoundaryFill,
        fillOpacity: 0.03,
        className: "ti-boundary-poly",
        interactive: false,
      });
      polygonsLayer.addLayer(tiPoly);
    }

    if (territorio.slug === "lagoa-grande") renderLagoaPolys();

    renderMunicipioLabels(territorio);

    if (activeRoteiroId) renderRoteiroOnMap(territorio, activeRoteiroId);
    renderPontos(territorio);
    bringMarkersToFront();
  }

  function ytId(url) {
    var m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function ytEmbedSrc(id, autoplay) {
    var params = ["rel=0", "modestbranding=1", "playsinline=1"];
    if (autoplay) params.push("autoplay=1");
    if (location.protocol !== "file:" && location.origin) {
      params.push("origin=" + encodeURIComponent(location.origin));
    }
    return "https://www.youtube.com/embed/" + id + "?" + params.join("&");
  }

  function canInlineYoutube() {
    return true;
  }

  function playGalleryVideo(wrap, block, id) {
    if (!id || !wrap) return;
    if (mountYoutubePlayer(wrap, id, true)) return;
    openYoutubeWatch(id);
    showToast("A abrir no YouTube…");
  }

  function openYoutubeWatch(id) {
    window.open("https://www.youtube.com/watch?v=" + id, "_blank", "noopener,noreferrer");
  }

  function openYoutubeLarge(id) {
    window.open(
      "https://www.youtube.com/watch?v=" + id,
      "_blank",
      "noopener,noreferrer,width=" + Math.min(screen.width, 1280) + ",height=" + Math.min(screen.height, 800)
    );
  }

  function mountYoutubePlayer(wrap, id, autoplay) {
    if (!wrap || wrap.querySelector("iframe")) return false;
    var iframe = document.createElement("iframe");
    iframe.src = ytEmbedSrc(id, autoplay);
    iframe.title = wrap.getAttribute("aria-label") || "Vídeo YouTube";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    wrap.innerHTML = "";
    wrap.appendChild(iframe);
    return true;
  }

  function fullscreenVideoWrap(wrap, id) {
    if (!wrap) return;
    if (id && !wrap.querySelector("iframe")) mountYoutubePlayer(wrap, id, true);
    if (wrap.querySelector("iframe")) {
      requestFullscreen(wrap);
      return;
    }
    if (id) openYoutubeLarge(id);
  }

  function renderTerritorioPanel(t) {
    return (
      '<div class="territorio-conteudo">' +
      '<h2 class="territorio-heading">' +
      esc(t.nome) +
      "</h2>" +
      (t.subtitulo ? '<p class="territorio-municipios">' + esc(t.subtitulo) + "</p>" : "") +
      (t.instagram
        ? '<p><a class="link-ig" href="' +
          esc(t.instagram) +
          '" target="_blank" rel="noopener">Instagram</a></p>'
        : "") +
      '<div class="texto-territorio">' +
      paragrafosHtml(t.territorioParagrafos || [t.resumo]) +
      "</div></div>"
    );
  }

  function paragrafosHtml(arr) {
    if (!arr || !arr.length) return "";
    return arr.map(function (p) {
      return "<p>" + esc(p) + "</p>";
    }).join("");
  }

  function renderCultura(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (it) {
        var btn = it.mapaPontoId
          ? '<button type="button" class="btn-link-mapa" data-ponto="' +
            esc(it.mapaPontoId) +
            '">Ver no mapa</button>'
          : "";
        return (
          '<div class="card"><h3>' +
          esc(it.titulo) +
          "</h3><p>" +
          esc(it.texto) +
          "</p>" +
          btn +
          "</div>"
        );
      })
      .join("");
  }

  function renderGaleria(g) {
    if (!g) return "";
    var fotos = g.fotos || [];
    var videos = g.videos || [];
    var html = "";

    if (fotos.length) {
      var first = fotos[0];
      var single = fotos.length === 1;
      html +=
        '<div class="galeria-slideshow' +
        (single ? " galeria-slideshow--single" : "") +
        '" data-count="' +
        fotos.length +
        '">';
      html += '<div class="slideshow-stage">';
      if (!single) {
        html +=
          '<button type="button" class="slideshow-btn slideshow-prev" aria-label="Foto anterior">&lsaquo;</button>';
      }
      html += '<div class="galeria-midia-stage">';
      html += renderMidiaStageHtml(
        { tipo: "foto", titulo: first.titulo, src: first.src },
        "sidebar"
      );
      html += "</div>";
      if (!single) {
        html +=
          '<button type="button" class="slideshow-btn slideshow-next" aria-label="Próxima foto">&rsaquo;</button>';
      }
      html += "</div>";
      html +=
        '<div class="slideshow-toolbar">' +
        '<p class="slideshow-meta"><span class="slideshow-index">1</span> / ' +
        fotos.length +
        "</p>" +
        '<div class="slideshow-actions">' +
        '<button type="button" class="btn btn-slideshow-fs">Tela cheia</button>' +
        "</div></div></div>";
    }

    if (videos.length) {
      html += '<div class="galeria-videos">';
      videos.forEach(function (v, i) {
        var id = ytId(v.url);
        html += '<article class="video-embed-block">';
        html += "<h3>" + esc(v.titulo) + "</h3>";
        if (id) {
          html +=
            '<div class="video-embed-wrap galeria-slide-video" id="video-wrap-' +
            i +
            '" aria-label="' +
            esc(v.titulo) +
            '">' +
            '<div class="video-embed-poster" data-yt-id="' +
            esc(id) +
            '">' +
            '<img src="https://img.youtube.com/vi/' +
            esc(id) +
            '/hqdefault.jpg" alt="" loading="lazy">' +
            '<button type="button" class="video-play-btn" aria-label="Reproduzir">' +
            '<span class="video-play-icon" aria-hidden="true">&#9654;</span>' +
            "<span>Reproduzir</span></button></div></div>" +
            '<div class="video-embed-actions">' +
            '<button type="button" class="btn btn-video-fs" data-yt-id="' +
            esc(id) +
            '">Ecrã inteiro</button>' +
            '<button type="button" class="btn btn-video-yt" data-yt-id="' +
            esc(id) +
            '">Ver no YouTube</button>' +
            "</div>";
        } else {
          html +=
            '<p><a class="btn" href="' +
            esc(v.url) +
            '" target="_blank" rel="noopener">Abrir vídeo</a></p>';
        }
        html += "</article>";
      });
      html += "</div>";
    }

    return html || "";
  }

  function requestFullscreen(el) {
    if (!el) return;
    var fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (fn) fn.call(el);
  }

  function closeGaleriaLightbox() {
    var lightbox = $("galeria-lightbox");
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("galeria-lightbox-open");
  }

  function refreshGaleriaLightbox() {
    if (!galeriaMidia) return;
    var item = galeriaMidia.items[galeriaMidia.idx];
    var lightbox = $("galeria-lightbox");
    if (!lightbox || lightbox.hidden) return;
    if (!item || item.tipo !== "foto") {
      closeGaleriaLightbox();
      return;
    }
    var lightboxImg = $("galeria-lightbox-img");
    var lightboxCap = $("galeria-lightbox-caption");
    var indexEl = $("galeria-lightbox-index");
    var totalEl = $("galeria-lightbox-total");
    var prevBtn = $("galeria-lightbox-prev");
    var nextBtn = $("galeria-lightbox-next");
    if (!lightboxImg) return;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.titulo;
    if (lightboxCap) lightboxCap.textContent = item.titulo;
    if (indexEl) indexEl.textContent = String(galeriaMidia.idx + 1);
    if (totalEl) totalEl.textContent = String(galeriaMidia.items.length);
    var single = galeriaMidia.items.length <= 1;
    if (prevBtn) prevBtn.hidden = single;
    if (nextBtn) nextBtn.hidden = single;
  }

  function openGaleriaLightbox() {
    if (!galeriaMidia) return;
    var item = galeriaMidia.items[galeriaMidia.idx];
    if (!item || item.tipo !== "foto") return;
    var lightbox = $("galeria-lightbox");
    if (!lightbox) return;
    lightbox.hidden = false;
    document.body.classList.add("galeria-lightbox-open");
    refreshGaleriaLightbox();
  }

  function initGaleriaChrome() {
    var backdrop = $("galeria-lightbox-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        e.preventDefault();
        closeGaleriaLightbox();
      });
    }
    var lbClose = $("galeria-lightbox-close");
    if (lbClose) {
      lbClose.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeGaleriaLightbox();
      });
    }
    var lbPrev = $("galeria-lightbox-prev");
    if (lbPrev) {
      lbPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        if (galeriaMidia) galeriaMidia.show(galeriaMidia.idx - 1);
      });
    }
    var lbNext = $("galeria-lightbox-next");
    if (lbNext) {
      lbNext.addEventListener("click", function (e) {
        e.stopPropagation();
        if (galeriaMidia) galeriaMidia.show(galeriaMidia.idx + 1);
      });
    }

    document.addEventListener("keydown", function (e) {
      var lb = $("galeria-lightbox");
      if (lb && !lb.hidden) {
        if (e.key === "Escape") closeGaleriaLightbox();
        if (e.key === "ArrowLeft" && galeriaMidia && galeriaMidia.items.length > 1) {
          galeriaMidia.show(galeriaMidia.idx - 1);
        }
        if (e.key === "ArrowRight" && galeriaMidia && galeriaMidia.items.length > 1) {
          galeriaMidia.show(galeriaMidia.idx + 1);
        }
        return;
      }
      if (!galeriaMidia) return;
      var panel = $("panel-galeria");
      if (!panel || !panel.classList.contains("active")) return;
      if (e.key === "ArrowLeft" && galeriaMidia.prev) galeriaMidia.show(galeriaMidia.idx - 1);
      if (e.key === "ArrowRight" && galeriaMidia.next) galeriaMidia.show(galeriaMidia.idx + 1);
    });
  }

  function bindGaleria(g) {
    var panel = $("panel-galeria");
    galeriaMidia = null;
    if (!panel || !g) return;

    var fotos = g.fotos || [];
    var slideshow = panel.querySelector(".galeria-slideshow");
    if (slideshow && fotos.length) {
      var idx = 0;
      var stage = slideshow.querySelector(".galeria-midia-stage");
      var indexEl = slideshow.querySelector(".slideshow-index");
      var prev = slideshow.querySelector(".slideshow-prev");
      var next = slideshow.querySelector(".slideshow-next");

      function showFoto(n) {
        idx = (n + fotos.length) % fotos.length;
        galeriaMidia.idx = idx;
        var f = fotos[idx];
        stage.innerHTML = renderMidiaStageHtml(
          { tipo: "foto", titulo: f.titulo, src: f.src },
          "sidebar"
        );
        if (indexEl) indexEl.textContent = String(idx + 1);
        var imgBtn = stage.querySelector(".slideshow-img-btn");
        if (imgBtn) imgBtn.addEventListener("click", openGaleriaLightbox);
        refreshGaleriaLightbox();
      }

      galeriaMidia = {
        items: fotos.map(function (f) {
          return { tipo: "foto", titulo: f.titulo, src: f.src };
        }),
        idx: 0,
        prev: !!prev,
        next: !!next,
        show: showFoto,
      };

      if (prev) prev.addEventListener("click", function () { showFoto(idx - 1); });
      if (next) next.addEventListener("click", function () { showFoto(idx + 1); });

      var fsBtn = slideshow.querySelector(".btn-slideshow-fs");
      if (fsBtn) fsBtn.addEventListener("click", openGaleriaLightbox);

      var imgBtn = stage.querySelector(".slideshow-img-btn");
      if (imgBtn) imgBtn.addEventListener("click", openGaleriaLightbox);
    }

    panel.querySelectorAll(".video-embed-poster").forEach(function (poster) {
      var wrap = poster.closest(".video-embed-wrap");
      var id = poster.dataset.ytId;
      
      poster.addEventListener("click", function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        playGalleryVideo(wrap, null, id);
      });
    });

    panel.querySelectorAll(".btn-video-yt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.ytId;
        if (id) openYoutubeWatch(id);
      });
    });

    panel.querySelectorAll(".btn-video-fs").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.ytId;
        var block = btn.closest(".video-embed-block");
        var iframeWrap = block ? block.querySelector(".video-embed-wrap") : null;
        fullscreenVideoWrap(iframeWrap, id);
      });
    });
  }

  function renderRoteirosPanel(territorio) {
    roteiroPanelData = null;
    var rs = territorio.roteiros || [];
    if (!rs.length) return "";
    return rs
      .map(function (r) {
        var ig = r.instagram
          ? '<p><a href="' +
            esc(r.instagram) +
            '" target="_blank" rel="noopener">Instagram</a></p>'
          : "";
        var paradas = "";
        var midiaHtml = "";
        if (r.ref === "MI_ROTEIRO_CONTRA_COSTA" && window.MI_ROTEIRO_CONTRA_COSTA) {
          var pts = (window.MI_ROTEIRO_CONTRA_COSTA.points || []).filter(function (p) {
            return !/^line\s*\d*$/i.test(String(p.name || "").trim());
          });
          if (pts.length) {
            var allItems = [];
            var stopFirstIndex = {};
            pts.forEach(function (p, si) {
              var stopItems = midiaItems({ fotos: p.fotos, videos: p.videos });
              if (stopItems.length) stopFirstIndex[si] = allItems.length;
              stopItems.forEach(function (it) {
                allItems.push(it);
              });
            });
            if (allItems.length) {
              roteiroPanelData = {
                items: allItems,
                stopFirstIndex: stopFirstIndex,
                roteiroId: r.id,
              };
              midiaHtml =
                '<div class="roteiro-midia-wrap">' +
                renderSidebarMidiaCarousel(allItems, "roteiro-midia-carousel") +
                "</div>";
            }
            paradas =
              "<ol class='roteiro-paradas'>" +
              pts
                .map(function (p, si) {
                  return (
                    '<li><button type="button" class="roteiro-parada-btn" data-stop="' +
                    si +
                    '">' +
                    esc(p.name) +
                    "</button></li>"
                  );
                })
                .join("") +
              "</ol>";
          }
        }
        return (
          '<div class="card card-roteiro"><h3>' +
          esc(r.titulo) +
          "</h3><p>" +
          esc(r.descricao) +
          "</p>" +
          midiaHtml +
          paradas +
          (r.recomendacoes ? "<p><em>" + esc(r.recomendacoes) + "</em></p>" : "") +
          ig +
          '<button type="button" class="btn btn-primary btn-roteiro" data-roteiro="' +
          esc(r.id) +
          '">Ver rota no mapa</button></div>'
        );
      })
      .join("");
  }

  function bindRoteiroPanel(territorio) {
    roteiroSidebarMidia = null;
    var panel = $("panel-roteiros");
    if (!panel || !roteiroPanelData) return;

    var wrap = panel.querySelector(".roteiro-midia-wrap");
    if (wrap && roteiroPanelData.items.length) {
      roteiroSidebarMidia = bindSidebarMidiaCarousel(wrap, roteiroPanelData.items);
    }

    panel.querySelectorAll(".roteiro-parada-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var si = parseInt(btn.dataset.stop, 10);
        if (activeRoteiroId !== roteiroPanelData.roteiroId) {
          activeRoteiroId = roteiroPanelData.roteiroId;
          renderTerritorioMap(territorio, { fit: false });
        }
        focusRoteiroStop(si);
        if (
          roteiroSidebarMidia &&
          roteiroPanelData.stopFirstIndex[si] != null
        ) {
          roteiroSidebarMidia.show(roteiroPanelData.stopFirstIndex[si]);
        }
      });
    });
  }

  function renderMemoria(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (it) {
        return (
          '<div class="card"><h3>' +
          esc(it.titulo) +
          "</h3><p>" +
          esc(it.texto) +
          "</p></div>"
        );
      })
      .join("");
  }

  function selectTerritorio(slug, opts) {
    opts = opts || {};
    clearMapFrameLock();
    var t = getTerritorio(slug);
    if (!t) return;
    if (slug !== "lagoa-grande") activeLagoaRegId = null;
    mode = "territorio";
    activeSlug = slug;
    activeRoteiroId = null;
    activeTiSlug = null;
    toggleUiForMode();
    renderChips(t);
    setHeaderContext(t.nome, t.subtitulo || "");

    $("panel-territorio").innerHTML = renderTerritorioPanel(t);
    bindTiLinks();

    var combinedGaleria = getCombinedGaleria(t);
    $("panel-cultura").innerHTML = renderCultura(t.cultura);
    $("panel-galeria").innerHTML = renderGaleria(combinedGaleria);
    bindGaleria(combinedGaleria);
    $("panel-memoria").innerHTML = renderMemoria(t.memoria);
    $("panel-roteiros").innerHTML = renderRoteirosPanel(t);
    bindRoteiroPanel(t);
    updateTabsVisibility(t);

    document.querySelectorAll(".btn-roteiro").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeRoteiroId = btn.dataset.roteiro;
        renderTerritorioMap(t);
        showToast("Rota no mapa");
      });
    });

    document.querySelectorAll(".btn-link-mapa").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ponto = (t.pontos || []).find(function (p) {
          return p.id === btn.dataset.ponto;
        });
        if (!ponto) return;
        activeRoteiroId = null;
        renderTerritorioMap(t, { fit: false });
        map.setView(ponto.coords, 15);
        markersLayer.eachLayer(function (layer) {
          if (layer.pontoId === ponto.id) layer.openPopup();
        });
      });
    });

    renderTerritorioMap(t);
    updateUrl();
    updateFormNavLink();
    frameTerritorioView(t, activeLagoaRegId, opts.fromShare);

    if (opts.fromShare) {
      setSidebarClosed(true);
      updateSidebarToggleState();
    } else if (isMobile()) {
      openSidebarMobile();
    } else {
      var main = document.querySelector(".main");
      if (main) {
        main.classList.remove("sidebar-closed");
        var btnMenu = $("btn-menu");
        if (btnMenu) btnMenu.classList.remove("collapsed");
      }
      updateSidebarToggleState();
    }
  }

  function getSharePayload() {
    var title = "Identidade e Memória";
    var subtitle = "Movimento Irun — Territórios da Bahia";
    if (mode === "territorio" && activeSlug) {
      var t = getTerritorio(activeSlug);
      if (t) {
        if (activeLagoaRegId && activeSlug === "lagoa-grande") {
          var reg = (window.MI_LAGOAS_GEO || []).find(function (r) {
            return r.id === activeLagoaRegId;
          });
          if (reg) {
            title = reg.nome;
            subtitle = t.subtitulo || t.nome;
          } else {
            title = t.nome;
            subtitle = t.subtitulo || t.ti || "Rede Movimento Irun";
          }
        } else {
          title = t.nome;
          subtitle = t.subtitulo || t.ti || "Rede Movimento Irun";
        }
      }
    } else if (mode === "ti" && activeTiSlug) {
      var ti = (window.MI_TI_BAHIA || []).find(function (x) {
        return x.slug === activeTiSlug;
      });
      if (ti) {
        title = ti.nome;
        subtitle = "Território de Identidade — Bahia";
      }
    } else if (mode === "rede") {
      title = "Rede Movimento Irun";
      subtitle = "6 territórios";
    } else if (mode === "ti") {
      title = "27 Territórios de Identidade da Bahia";
      subtitle = "Mapa interativo";
    }
    updateUrl();
    var url = buildShareUrl();
    var text = "Identidade e Memória — Movimento Irun\n" + title + "\n" + url;
    return { title: title, subtitle: subtitle, url: url, text: text };
  }

  function openShareDialog() {
    var p = getSharePayload();
    var w = Math.min(900, screen.width - 40);
    var h = Math.min(600, screen.height - 40);
    $("share-url").value = p.url;
    $("share-embed").value =
      '<iframe src="' +
      p.url +
      '" width="' +
      w +
      '" height="' +
      h +
      '" style="border:0;" allowfullscreen loading="lazy" title="Identidade e Memória"></iframe>';
    var ctx = $("share-context");
    if (ctx) {
      ctx.innerHTML =
        "<strong>" +
        esc(p.title) +
        "</strong>" +
        esc(p.subtitle);
    }
    $("dialog-share").showModal();
  }

  function runShareAction(kind) {
    var p = getSharePayload();
    if (kind === "copy") {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(p.url).then(function () {
          showToast("Link copiado!");
        });
      }
      return;
    }
    if (kind === "whatsapp") {
      window.open(
        "https://wa.me/?text=" + encodeURIComponent(p.text),
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    if (kind === "telegram") {
      window.open(
        "https://t.me/share/url?url=" +
          encodeURIComponent(p.url) +
          "&text=" +
          encodeURIComponent(p.title),
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    if (kind === "email") {
      location.href =
        "mailto:?subject=" +
        encodeURIComponent("Identidade e Memória — " + p.title) +
        "&body=" +
        encodeURIComponent(p.text);
      return;
    }
    if (kind === "native" && navigator.share) {
      navigator.share({ title: p.title, text: p.text, url: p.url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(p.url).then(function () {
        showToast("Link copiado!");
      });
    }
  }

  function bindShareUi() {
    var grid = $("share-grid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-share]");
        if (btn) runShareAction(btn.getAttribute("data-share"));
      });
    }
    var nativeBtn = $("btn-share-native");
    if (nativeBtn) {
      nativeBtn.addEventListener("click", function () {
        runShareAction("native");
      });
    }
  }

  function copyField(id) {
    var el = $(id);
    el.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value).then(function () {
        showToast("Copiado!");
      });
    }
  }

  function updateFormNavLink() {
    var el = $("nav-formulario");
    if (!el) return;
    el.href = activeSlug
      ? "formulario.html?territorio=" + encodeURIComponent(activeSlug)
      : "formulario.html";
  }

  function updateSidebarToggleState() {
    var btn = $("btn-conteudo-header");
    var menuBtn = $("btn-menu");
    var isOpen = false;
    if (isMobile()) {
      isOpen = $("sidebar").classList.contains("open");
    } else {
      var main = document.querySelector(".main");
      isOpen = main ? !main.classList.contains("sidebar-closed") : true;
    }
    if (btn) btn.classList.toggle("header-nav-active", isOpen);
    if (menuBtn) menuBtn.classList.toggle("header-nav-active", isOpen);
  }

  function openSidebarMobile() {
    var main = document.querySelector(".main");
    if (main) main.classList.remove("sidebar-closed");
    $("sidebar").classList.add("open");
    $("sidebar-backdrop").hidden = false;
    $("sidebar-backdrop").classList.add("visible");
    updateSidebarToggleState();
  }

  function closeSidebarMobile() {
    $("sidebar").classList.remove("open");
    $("sidebar-backdrop").hidden = true;
    $("sidebar-backdrop").classList.remove("visible");
    updateSidebarToggleState();
  }

  function toggleSidebar() {
    if (isMobile()) {
      var isOpen = $("sidebar").classList.contains("open");
      if (isOpen) closeSidebarMobile();
      else openSidebarMobile();
      return;
    }
    var main = document.querySelector(".main");
    if (!main) return;
    var isClosed = main.classList.contains("sidebar-closed");
    setSidebarClosed(!isClosed);
    updateSidebarToggleState();
    setTimeout(function () {
      if (map) debouncedMapResize();
    }, 250);
  }

  function init() {
    initMap();
    bindTabs();
    initGaleriaChrome();
    toggleUiForMode();
    updateSidebarToggleState();
    var offEl = $("offline-note");
    if (offEl) {
      offEl.hidden = navigator.onLine;
      window.addEventListener("online", function () {
        offEl.hidden = true;
      });
      window.addEventListener("offline", function () {
        offEl.hidden = false;
      });
    }

    function listen(id, event, fn) {
      var el = $(id);
      if (el) el.addEventListener(event, fn);
    }

    listen("btn-ti", "click", function () {
      renderTiMap(null, false);
    });
    listen("btn-rede", "click", function () {
      renderRedeMap();
    });
    listen("btn-share", "click", openShareDialog);
    bindShareUi();
    if (window.MITheme) window.MITheme.bindToggle($("btn-theme"));
    listen("btn-copy-embed", "click", function () {
      copyField("share-embed");
    });
    listen("btn-close-share", "click", function () {
      var d = $("dialog-share");
      if (d) d.close();
    });
    listen("btn-conteudo-header", "click", toggleSidebar);
    listen("btn-menu", "click", toggleSidebar);
    listen("btn-sidebar", "click", toggleSidebar);
    listen("sidebar-backdrop", "click", closeSidebarMobile);

    var terr = qs("territorio");
    var vista = qs("vista");
    var tiParam = qs("ti");
    var regiaoParam = qs("regiao");
    var fromShare = !!(terr || vista === "rede" || tiParam);
    loadingFromShare = fromShare;

    if (terr && getTerritorio(terr)) {
      if (regiaoParam && terr === "lagoa-grande") activeLagoaRegId = regiaoParam;
      selectTerritorio(terr, { fromShare: fromShare });
    } else if (vista === "rede") {
      renderRedeMap();
    } else if (tiParam) {
      var tiInit = (window.MI_TI_BAHIA || []).find(function (x) {
        return x.slug === tiParam;
      });
      if (tiInit) renderTiMap(tiInit.slug, true);
      else renderTiMap(null, false);
    } else renderTiMap(null, false);

    loadingFromShare = false;

    window.addEventListener("resize", debouncedMapResize);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
