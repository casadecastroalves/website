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
  var isSatelliteMode = false;

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

  function convertGoogleDriveUrl(url) {
    if (!url || typeof url !== "string") return url;
    var driveRegex = /(?:https?:\/\/)?(?:drive\.google\.com)\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/;
    var match = url.match(driveRegex);
    if (match && match[1]) {
      return "https://lh3.googleusercontent.com/u/0/d/" + match[1];
    }
    return url;
  }

  function renderPopupFotos(fotos) {
    if (!fotos || !fotos.length) return "";
    return (
      '<div class="popup-fotos">' +
      fotos
        .map(function (f) {
          var url = typeof f === "string" ? f : f && f.src;
          url = convertGoogleDriveUrl(url);
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

  function syncLegacyFromNav(nav) {
    if (nav.view === "bahia") {
      mode = "ti";
      lastMainMode = "ti";
      activeSlug = null;
      activeTiSlug = nav.tiSlug;
    } else if (nav.view === "rede") {
      mode = "rede";
      lastMainMode = "rede";
      activeSlug = null;
      activeTiSlug = null;
    } else if (nav.view === "territorio") {
      mode = "territorio";
      lastMainMode = "rede";
      activeSlug = nav.redeSlug;
      activeTiSlug = null;
    }
  }

  function updateUrlFromNav(nav) {
    var u = new URL(location.href);
    u.searchParams.delete("territorio");
    u.searchParams.delete("vista");
    u.searchParams.delete("ti");
    if (nav.view === "bahia") {
      u.searchParams.set("vista", "ti");
      if (nav.tiSlug) u.searchParams.set("ti", nav.tiSlug);
    } else if (nav.view === "rede") {
      u.searchParams.set("vista", "rede");
    } else if (nav.view === "territorio" && nav.redeSlug) {
      u.searchParams.set("territorio", nav.redeSlug);
    }
    history.replaceState(null, "", u);
  }

  function updateUrl() {
    if (window.MI_NAV) updateUrlFromNav(window.MI_NAV.getNav());
  }

  function sheetFechada() {
    if (window.MI_NAV) window.MI_NAV.navigate({ sheet: "fechada" }, { sheetOnly: true });
  }

  function sheetToggle() {
    if (window.MI_NAV) window.MI_NAV.navigate({ sheet: "toggle" }, { sheetOnly: true });
  }

  function setHeaderContext(titulo, subtitulo) {
    var wrap = $("header-context");
    var titleEl = $("header-context-title");
    var subEl = $("header-context-sub");
    if (!wrap || !titleEl) return;

    if (!titulo || titulo === "27 Territórios de Identidade da Bahia") {
      titleEl.textContent = "Bahia — 27 Territórios de Identidade";
      if (subEl) {
        subEl.textContent = subtitulo || "Mapa oficial · Rede com 6 territórios";
        subEl.hidden = !subtitulo;
      }
      wrap.hidden = false;
      return;
    }

    if (mode === "rede" || titulo === "Rede Movimento Irun") {
      titleEl.textContent = "Rede Movimento Irun";
      if (subEl) {
        subEl.textContent = subtitulo || "6 territórios com conteúdo";
        subEl.hidden = false;
      }
    } else {
      titleEl.textContent = titulo;
      if (subEl) {
        subEl.textContent = subtitulo || "";
        subEl.hidden = !subtitulo;
      }
    }
    wrap.hidden = false;
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
    var url;
    var options = {
      maxZoom: 19
    };
    if (isSatelliteMode) {
      url = "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      options.attribution = "&copy; Google Maps";
      options.subdomains = ["0", "1", "2", "3"];
    } else {
      url =
        window.MITheme && window.MITheme.mapTileUrl
          ? window.MITheme.mapTileUrl()
          : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      options.attribution = "&copy; OSM &copy; CARTO";
      options.subdomains = "abcd";
    }

    if (baseTileLayer) map.removeLayer(baseTileLayer);
    baseTileLayer = L.tileLayer(url, options);
    baseTileLayer.addTo(map);
    baseTileLayer.bringToBack();
  }

  function toggleSatelliteMode() {
    isSatelliteMode = !isSatelliteMode;
    var btn = $("btn-satelite");
    if (btn) {
      if (isSatelliteMode) {
        btn.classList.add("active");
        btn.textContent = "Mapa";
      } else {
        btn.classList.remove("active");
        btn.textContent = "Satélite";
      }
    }
    applyMapTheme();
  }

  function onMapBackgroundClick(e) {
    if (mapClickShouldIgnore(e)) return;
    navigateFromMapClick(e.latlng);
  }

  function mapClickShouldIgnore(e) {
    var t = e.originalEvent && e.originalEvent.target;
    if (!t || !t.closest) return false;
    if (t.closest(".leaflet-popup, .leaflet-control, .chip, .map-toggle-sidebar, .btn-painel, .header-more")) {
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
    if (t) setHeaderContext(redeRegiaoNome(t), reg.nome);
    lagoaPolyLayers.forEach(function (poly) {
      var isActive = poly.regId === reg.id;
      poly.setStyle({
        weight: isActive ? 1.1 : 0.55,
        opacity: isActive ? 0.9 : 0.38,
        fillOpacity: 0,
      });
    });
    if (fit !== false && reg.coords && reg.coords.length) {
      map.fitBounds(L.latLngBounds(reg.coords), mapFitOptions({ maxZoom: 15 }));
    }
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
    if (mode !== "territorio") return;
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
    var btnMi = $("btn-movimento-irun");
    if (btnTi) btnTi.classList.toggle("header-nav-active", mode === "ti" && !!activeTiSlug);
    if (btnRede) btnRede.classList.toggle("header-nav-active", mode === "rede");
    if (btnMi) {
      btnMi.classList.toggle(
        "header-nav-active",
        mode === "ti" && !activeTiSlug && !activeSlug
      );
    }
  }

  function toggleUiForMode() {
    var chips = $("layer-chips");
    if (chips) chips.hidden = mode !== "territorio" || !!activeRoteiroId;

    updateHeaderNavActive();
  }

  function getTerritorioCoverUrl(t) {
    if (!t) return "";
    if (t.coverFoto) {
      return typeof t.coverFoto === "string"
        ? convertGoogleDriveUrl(t.coverFoto)
        : convertGoogleDriveUrl(t.coverFoto.src || "");
    }
    var fotos = (t.galeria && t.galeria.fotos) || [];
    for (var i = 0; i < fotos.length; i++) {
      var f = fotos[i];
      var src = typeof f === "string" ? f : f && f.src;
      if (src) {
        return convertGoogleDriveUrl(src);
      }
    }
    return "";
  }

  function getCombinedGaleria(t) {
    var fotos = [];
    var videos = [];
    if (t.galeria) {
      if (t.galeria.fotos) {
        t.galeria.fotos.forEach(function (f) {
          if (typeof f === "string") {
            fotos.push(convertGoogleDriveUrl(f));
          } else if (f && f.src) {
            fotos.push({
              src: convertGoogleDriveUrl(f.src),
              titulo: f.titulo || ""
            });
          }
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
          src = convertGoogleDriveUrl(src);
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

  function getTiNomeOficial(slug) {
    var tiSlug = D.redeTiMap[slug];
    if (!tiSlug) return "";
    var ti = (window.MI_TI_BAHIA || []).find(function (x) {
      return x.slug === tiSlug;
    });
    return ti ? ti.nome : "";
  }

  function redeRegiaoNome(t) {
    return t.nome || getTiNomeOficial(t.slug) || t.slug;
  }

  function redeLugaresLabel(t) {
    return t.subtitulo || "";
  }

  function territorioLabel(t) {
    return redeRegiaoNome(t) + (redeLugaresLabel(t) ? " · " + redeLugaresLabel(t) : "");
  }

  function getTiResumo(slug) {
    if (D.tiResumos && D.tiResumos[slug]) return D.tiResumos[slug];
    return "Território de Identidade da Bahia — divisão oficial por critérios ambientais, econômicos e culturais.";
  }

  function mapFitPaddingCorners() {
    var w = window.innerWidth;
    // No desktop o sidebar é coluna separada (CSS grid) — não adicionar padding extra.
    // No mobile o sidebar sobrepõe o mapa pelo topo, daí padding maior.
    var top    = w <= 480 ? 72 : w <= 768 ? 64 : 56;
    var side   = w <= 480 ? 44 : w <= 768 ? 36 : 32;
    var bottom = w <= 480 ? 56 : w <= 768 ? 48 : 36;
    return {
      paddingTopLeft:     L.point(side, top),
      paddingBottomRight: L.point(side, bottom),
    };
  }

  function mapFitOptions(opts) {
    opts = opts || {};
    var pad = mapFitPaddingCorners();
    return {
      paddingTopLeft: pad.paddingTopLeft,
      paddingBottomRight: pad.paddingBottomRight,
      maxZoom: opts.maxZoom != null ? opts.maxZoom : 14,
      animate: opts.animate !== false,
    };
  }

  function getTiForSlug(slug) {
    var tiSlug = D.redeTiMap[slug];
    if (!tiSlug) return null;
    return (window.MI_TI_BAHIA || []).find(function (x) {
      return x.slug === tiSlug;
    });
  }

  function collectTerritorioContentCoords(territorio) {
    var coords = [];
    var isLagoa = territorio.slug === "lagoa-grande";
    (territorio.pontos || []).forEach(function (p) {
      if (!p.coords || p.coords.length !== 2) return;
      if (p.fitMap === false) return;
      // Casarão fica em Feira de Santana, ~12 km fora do quilombo — excluir do zoom
      if (isLagoa && p.id === "casarao-dos-olhos-dagua") return;
      coords.push(p.coords);
    });
    (territorio.municipios || []).forEach(function (m) {
      if (!m.coords || m.coords.length !== 2) return;
      if (isLagoa && /feira de santana/i.test(m.nome || "")) return;
      coords.push(m.coords);
    });
    if (!coords.length && territorio.pin && territorio.pin.length === 2) {
      coords.push(territorio.pin);
    }
    return coords;
  }

  function fitCoordsList(coords, opts) {
    if (!map || !coords.length) return;
    opts = opts || {};
    if (coords.length === 1) {
      map.setView(coords[0], opts.zoom || 13, { animate: opts.animate !== false });
      return;
    }
    map.fitBounds(L.latLngBounds(coords), mapFitOptions(opts));
  }

  function fitTiPolygon(ti, opts) {
    if (!ti || !ti.coords || !ti.coords.length || !map) return;
    opts = opts || { maxZoom: 13 };
    var pad = mapFitPaddingCorners();
    var fitOpts = mapFitOptions(opts);
    if (opts.focus) {
      fitOpts.paddingBottomRight = L.point(
        pad.paddingBottomRight.x,
        pad.paddingBottomRight.y + (window.innerWidth <= 768 ? 56 : 40)
      );
    }
    map.fitBounds(L.latLngBounds(ti.coords), fitOpts);
  }

  function fitLagoaSubregioesView(territorio, opts) {
    if (!map) return false;
    opts = opts || {};
    if (lagoaPolyLayers.length) {
      map.fitBounds(
        L.featureGroup(lagoaPolyLayers).getBounds(),
        mapFitOptions({ maxZoom: opts.maxZoom != null ? opts.maxZoom : 15 })
      );
      return true;
    }
    var content = collectTerritorioContentCoords(territorio);
    if (content.length) {
      fitCoordsList(content, {
        maxZoom: 15,
        zoom: territorio.zoom || 14,
      });
      return true;
    }
    return false;
  }

  function fitTerritorioView(territorio) {
    if (territorio.slug === "lagoa-grande") {
      if (fitLagoaSubregioesView(territorio)) return;
    }

    var content = collectTerritorioContentCoords(territorio);
    if (content.length) {
      var isRede = !!(D.redeTiMap && D.redeTiMap[territorio.slug]);
      fitCoordsList(content, {
        maxZoom: content.length === 1 ? (isRede ? 15 : 14) : (isRede ? 16 : 15),
        zoom: territorio.zoom || (isRede ? 14 : 13),
      });
      return;
    }

    var ti = getTiForSlug(territorio.slug);
    if (ti) {
      fitTiPolygon(ti, { maxZoom: 12 });
    }
  }

  function scheduleMapRefit(fn) {
    if (!map || typeof fn !== "function") return;
    setTimeout(function () {
      map.invalidateSize();
      fn();
    }, 320);
  }

  function renderTiSidebar(highlightSlug, focusOnly) {
    var geo = window.MI_TI_BAHIA || [];
    var focused = highlightSlug
      ? geo.find(function (x) {
          return x.slug === highlightSlug;
        })
      : null;
      
    if (!focused) return;
    
    // Switch to detail view
    $("sidebar-master").hidden = true;
    $("sidebar-detail").hidden = false;
    
    var focusBlock = 
      '<div class="detail-presentation">' +
      '<h2 class="detail-title">' + esc(focused.nome) + '</h2>' +
      '<p class="detail-subtitle">Território de Identidade Cultural</p>' +
      '<div class="detail-about">' +
      '<p>' + esc(getTiResumo(focused.slug)) + '</p>' +
      '</div>' +
      '</div>';
      
    $("detail-content").innerHTML = focusBlock;
  }

  function execTiMap(highlightSlug, focusOne) {
    clearLayers();
    activeRoteiroId = null;

    renderChips(null);

    var hl = highlightSlug || activeTiSlug;
    var geo = window.MI_TI_BAHIA || [];
    var focused = hl
       ? geo.find(function (x) {
          return x.slug === hl;
        })
       : null;

    if (focusOne && focused) {
      setHeaderContext(focused.nome);
      renderTiSidebar(hl, focusOne);
    } else {
      setHeaderContext("27 Territórios de Identidade da Bahia");
      $("sidebar-detail").hidden = true;
      $("sidebar-master").hidden = false;
      renderMasterList();
    }

    renderTiNavPolygons(hl, { bahiaView: true });

    if (focusOne && focused) {
      fitTiPolygon(focused, { maxZoom: 12, focus: true });
      scheduleMapRefit(function () {
        fitTiPolygon(focused, { maxZoom: 12, focus: true });
      });
    } else {
      var bounds = [];
      geo.forEach(function (ti) {
        ti.coords.forEach(function (c) {
          bounds.push(c);
        });
      });
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [5, 5] });
    }
  }

  function renderTiMap(highlightSlug, focusOne) {
    if (!window.MI_NAV) return;
    var tiSlug = highlightSlug || null;
    if (!highlightSlug && !focusOne) tiSlug = null;
    window.MI_NAV.navigate({
      view: "bahia",
      tiSlug: tiSlug,
      panel: focusOne && tiSlug ? "ti-info" : "lista",
      redeSlug: null,
      territorioSlug: null,
    });
  }

  function stripAccents(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function matchTerritory(ti, queryClean) {
    if (stripAccents(ti.nome).indexOf(queryClean) !== -1) return true;
    
    var redeSlug = tiToRede[ti.slug];
    if (redeSlug) {
      var t = getTerritorio(redeSlug);
      if (t) {
        if (stripAccents(t.nome).indexOf(queryClean) !== -1) return true;
        if (stripAccents(t.subtitulo).indexOf(queryClean) !== -1) return true;
        if (t.municipios && t.municipios.some(function(m) {
          return stripAccents(m.nome).indexOf(queryClean) !== -1;
        })) {
          return true;
        }
      }
    }
    return false;
  }

  function renderMasterList(filterText) {
    var masterList = $("master-list");
    if (!masterList) return;
    
    var queryClean = stripAccents(filterText || "").trim();
    var geo = window.MI_TI_BAHIA || [];
    
    if (queryClean) {
      var matches = geo.filter(function (ti) {
        return matchTerritory(ti, queryClean);
      });
      
      if (!matches.length) {
        masterList.innerHTML = '<p class="search-empty">Nenhum território encontrado.</p>';
        return;
      }
      
      masterList.innerHTML = '<ul class="master-ti-list">' +
        matches.map(function (ti) {
          var redeSlug = tiToRede[ti.slug];
          var tag = redeSlug ? '<span class="tag-rede">Rede</span>' : '';
          return '<li><button type="button" class="master-list-item" data-ti="' + esc(ti.slug) + '">' +
                 '<strong>' + esc(ti.nome) + '</strong>' +
                 tag +
                 '</button></li>';
        }).join('') +
        '</ul>';
        
      bindMasterListLinks();
      return;
    }
    
    var redeItems = D.territorios.map(function (t) {
      var tiSlug = D.redeTiMap[t.slug];
      return {
        slug: t.slug,
        nome: redeRegiaoNome(t),
        subtitulo: redeLugaresLabel(t),
        isRede: true,
        tiSlug: tiSlug
      };
    });
    
    var otherItems = geo.filter(function (ti) {
      return !tiToRede[ti.slug];
    }).map(function (ti) {
      return {
        slug: ti.slug,
        nome: ti.nome,
        isRede: false,
        tiSlug: ti.slug
      };
    });
    
    var redeHtml = '<ul class="master-ti-list">' +
      redeItems.map(function (item) {
        return '<li><button type="button" class="master-list-item" data-rede="' + esc(item.slug) + '">' +
               '<strong>' + esc(item.nome) + '</strong>' +
               (item.subtitulo ? '<small>' + esc(item.subtitulo) + '</small>' : '') +
               '<span class="tag-rede">Rede</span>' +
               '</button></li>';
      }).join('') +
      '</ul>';
      
    var todosHtml = '<ul class="master-ti-list">' +
      otherItems.map(function (item) {
        return '<li><button type="button" class="master-list-item" data-ti="' + esc(item.slug) + '">' +
               '<strong>' + esc(item.nome) + '</strong>' +
               '</button></li>';
      }).join('') +
      '</ul>';
      
    var intro =
      '<div class="master-intro">' +
      '<p>' + esc(D.conceitos.divisao) + "</p>" +
      "</div>";

    masterList.innerHTML =
      intro +
      '<div class="accordion-section">' +
      '  <button type="button" class="accordion-header" id="accordion-header-rede" aria-expanded="true" aria-controls="accordion-content-rede">' +
      '    <span>Territórios da Rede (6)</span>' +
      '  </button>' +
      '  <div class="accordion-content" id="accordion-content-rede">' +
      redeHtml +
      '  </div>' +
      '</div>' +
      '<div class="accordion-section">' +
      '  <button type="button" class="accordion-header collapsed" id="accordion-header-todos" aria-expanded="false">' +
      '    <span>Territórios de Identidade (' + otherItems.length + ')</span>' +
      '  </button>' +
      '  <div class="accordion-content" id="accordion-content-todos" style="display:none;">' +
      todosHtml +
      '  </div>' +
      '</div>';
      
    bindMasterListLinks();
    bindAccordionToggles(masterList);
  }

  function bindMasterListLinks() {
    var geo = window.MI_TI_BAHIA || [];
    document.querySelectorAll(".master-list-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var redeSlug = btn.dataset.rede;
        var tiSlug = btn.dataset.ti;
        
        if (redeSlug) {
          selectTerritorio(redeSlug);
        } else if (tiSlug) {
          var ti = geo.find(function (x) {
            return x.slug === tiSlug;
          });
          if (ti) navigateToTi(ti);
        }
      });
    });
  }

  function bindAccordionToggles(container) {
    var root = container || document;
    root.querySelectorAll(".accordion-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var content = header.nextElementSibling;
        if (!content) return;
        
        var isCollapsed = header.classList.contains("collapsed");
        
        if (isCollapsed) {
          header.classList.remove("collapsed");
          header.setAttribute("aria-expanded", "true");
          
          content.style.display = "block";
          var scrollHeight = content.scrollHeight;
          content.style.height = "0px";
          content.style.opacity = "0";
          content.style.overflow = "hidden";
          content.style.transition = "height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
          
          content.offsetHeight; // force reflow
          
          content.style.height = scrollHeight + "px";
          content.style.opacity = "1";
          
          setTimeout(function () {
            if (!header.classList.contains("collapsed")) {
              content.style.height = "auto";
              content.style.overflow = "";
              content.style.transition = "";
            }
          }, 260);
        } else {
          header.classList.add("collapsed");
          header.setAttribute("aria-expanded", "false");
          
          content.style.height = content.scrollHeight + "px";
          content.style.overflow = "hidden";
          content.style.transition = "height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
          
          content.offsetHeight; // force reflow
          
          content.style.height = "0px";
          content.style.opacity = "0";
          
          setTimeout(function () {
            if (header.classList.contains("collapsed")) {
              content.style.display = "none";
              content.style.height = "";
              content.style.overflow = "";
              content.style.transition = "";
            }
          }, 260);
        }
      });
    });
  }

  function goBackToMasterList() {
    activeRoteiroId = null;
    var searchInput = $("search-input");
    if (searchInput) searchInput.value = "";
    if (!window.MI_NAV) return;
    var nav = window.MI_NAV.getNav();
    var view = nav.lastListView === "rede" ? "rede" : "bahia";
    window.MI_NAV.navigate({
      view: view,
      panel: "lista",
      sheet: "aberta",
      redeSlug: null,
      territorioSlug: null,
      tiSlug: null,
    });
  }

  function getTiNomeForTerritorio(t) {
    var tiSlug = D.redeTiMap[t.slug];
    if (!tiSlug) return "";
    var ti = (window.MI_TI_BAHIA || []).find(function (x) {
      return x.slug === tiSlug;
    });
    return ti ? ti.nome : t.ti || "";
  }

  function renderDetailContent(t) {
    var html = '';
    var combined = getCombinedGaleria(t);
    var coverUrl = getTerritorioCoverUrl(t);
    
    if (coverUrl) {
      var coverClass = "detail-cover";
      if (t.coverBg === "white") {
        coverClass += " detail-cover--white";
      }
      if (t.coverFit === "contain") {
        coverClass += " detail-cover--contain";
      }
      html += '<div class="' + coverClass + '">' +
              '<img src="' + esc(coverUrl) + '" alt="' + esc(t.nome) + '" loading="lazy">' +
              '</div>';
    }
    
    var igLink = t.instagram ? ' <a class="detail-ig-link" href="' + esc(t.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">' +
      '<svg class="detail-ig-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>' +
        '<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>' +
        '<line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>' +
      '</svg>' +
      '</a>' : '';

    var tiNome = getTiNomeForTerritorio(t);
    if (tiNome) {
      html +=
        '<p class="detail-ti-overline">Território de Identidade · ' + esc(tiNome) + "</p>";
    }

    html += '<div class="detail-presentation">' +
            '<h2 class="detail-title">' + esc(redeRegiaoNome(t)) + '</h2>' +
            (redeLugaresLabel(t) || igLink
              ? '<p class="detail-subtitle">' + esc(redeLugaresLabel(t)) + igLink + '</p>'
              : (igLink ? '<p class="detail-subtitle">' + igLink + '</p>' : '')) +
            '</div>';
            
    html += '<div class="detail-accordions">';

    // 1. Sobre o Território Accordion
    html += '<div class="accordion-section">' +
            '<button type="button" class="accordion-header collapsed" id="accordion-header-sobre" aria-expanded="false">' +
            '<span>' + (t.slug === "lagoa-grande" ? "Sobre o Quilombo" : "Sobre este lugar") + '</span>' +
            '</button>' +
            '<div class="accordion-content" id="accordion-content-sobre" style="display:none;">' +
            '<div class="detail-about">' +
            paragrafosHtml(t.territorioParagrafos || [t.resumo]) +
            '</div>' +
            '</div>' +
            '</div>';
    
    // 2. Cultura
    var hasCultura = t.cultura && t.cultura.length > 0;
    if (hasCultura) {
      html += '<div class="accordion-section">' +
              '<button type="button" class="accordion-header collapsed" id="accordion-header-cultura" aria-expanded="false">' +
              '<span>Cultura</span>' +
              '</button>' +
              '<div class="accordion-content" id="accordion-content-cultura" style="display:none;">' +
              renderCultura(t.cultura) +
              '</div>' +
              '</div>';
    }

    // 3. Festas
    var festas = (t.pontos || []).filter(function(p) { return p.camada === "festas"; });
    var hasFestas = (t.festas && t.festas.length > 0) || festas.length > 0;
    // Sempre mostrar o acordeão de Festas como placeholder (ou com os pontos da camada)
    html += '<div class="accordion-section">' +
            '<button type="button" class="accordion-header collapsed" id="accordion-header-festas" aria-expanded="false">' +
            '<span>Festas</span>' +
            '</button>' +
            '<div class="accordion-content" id="accordion-content-festas" style="display:none;">' +
            (hasFestas ? renderMemoria(t.festas || []) : '<p style="padding: 12px; color: var(--text-muted); font-size: 0.9rem;">Calendário anual de festas tradicionais em construção...</p>') +
            '</div>' +
            '</div>';
    
    // 4. Memória e Histórias
    var hasMemoria = t.memoria && t.memoria.length > 0;
    if (hasMemoria) {
      html += '<div class="accordion-section">' +
              '<button type="button" class="accordion-header collapsed" id="accordion-header-memoria" aria-expanded="false">' +
              '<span>Memória e Histórias</span>' +
              '</button>' +
              '<div class="accordion-content" id="accordion-content-memoria" style="display:none;">' +
              renderMemoria(t.memoria) +
              '</div>' +
              '</div>';
    }

    // 5. Pontos de Interesse
    var hasPontos = (t.pontos || []).length > 0;
    if (hasPontos) {
      html += '<div class="accordion-section">' +
              '<button type="button" class="accordion-header collapsed" id="accordion-header-pontos" aria-expanded="false">' +
              '<span>Pontos de Interesse</span>' +
              '</button>' +
              '<div class="accordion-content" id="accordion-content-pontos" style="display:none;">' +
              renderPontosLista(t) +
              '</div>' +
              '</div>';
    }

    // 6. Roteiros e Rotas
    var hasRoteiros = t.roteiros && t.roteiros.length > 0;
    if (hasRoteiros) {
      html += '<div class="accordion-section">' +
              '<button type="button" class="accordion-header collapsed" id="accordion-header-roteiros" aria-expanded="false">' +
              '<span>Roteiros e Rotas</span>' +
              '</button>' +
              '<div class="accordion-content" id="accordion-content-roteiros" style="display:none;">' +
              renderRoteirosPanel(t) +
              '</div>' +
              '</div>';
    }
    
    // 7. Galeria de Fotos e Vídeos
    var hasGaleria = combined.fotos.length > 0 || combined.videos.length > 0;
    if (hasGaleria) {
      html += '<div class="accordion-section">' +
              '<button type="button" class="accordion-header collapsed" id="accordion-header-galeria" aria-expanded="false">' +
              '<span>Galeria de Fotos e Vídeos</span>' +
              '</button>' +
              '<div class="accordion-content" id="accordion-content-galeria" style="display:none;">' +
              renderGaleria(combined) +
              '</div>' +
              '</div>';
    }
    
    html += '</div>';
    return html;
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

  function execRedeMap() {
    clearLayers();
    activeRoteiroId = null;
    renderChips(null);
    setHeaderContext("Rede Movimento Irun", "6 territórios");

    $("sidebar-detail").hidden = true;
    $("sidebar-master").hidden = false;
    renderMasterList();

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
          esc(redeRegiaoNome(t)) +
          "</h4><p>" +
          esc(redeLugaresLabel(t)) +
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

    map.fitBounds(
      L.latLngBounds(
        D.territorios.map(function (t) {
          return t.pin;
        })
      ),
      { padding: [20, 20] }
    );
    bringMarkersToFront();
  }

  function renderRedeMap() {
    if (!window.MI_NAV) return;
    window.MI_NAV.navigate({
      view: "rede",
      panel: "lista",
      redeSlug: null,
      territorioSlug: null,
      tiSlug: null,
    });
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
      src = convertGoogleDriveUrl(src);
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
      return '';
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
  function popupHtml(p, ctxLine) {
    var html = "";
    if (ctxLine) {
      html += '<p class="popup-context">' + esc(ctxLine) + "</p>";
    }
    html += "<h4>" + esc(p.titulo) + "</h4>";
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

  function getPontoEmoji(p) {
    if (p.emoji) return esc(p.emoji);
    var map = {
      natureza: "🌿",
      ambiente: "🌿",
      historico: "📖",
      historia: "📖",
      instituicoes: "🏫",
      projetos: "✨",
      turismo: "📍",
      "turismo-comunitario": "⛵",
      produtos: "🧺",
      festas: "📅",
    };
    return map[p.camada] || "📍";
  }

  function renderPontos(territorio) {
    var popupCtx =
      redeRegiaoNome(territorio) +
      (redeLugaresLabel(territorio) ? " · " + redeLugaresLabel(territorio) : "");

    (territorio.pontos || []).forEach(function (p) {
      if (!activeCamadas[p.camada]) return;

      var ic = L.divIcon({
        className: 'custom-marker-icon',
        html: '<div class="marker-emoji-container" style="background:' + camadaCor(p.camada) + '">' + getPontoEmoji(p) + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      var m = L.marker(p.coords, { icon: ic });
      var pontoMidia = midiaItems(p);
      m.bindPopup(popupHtml(p, popupCtx), { maxWidth: 300 });
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
      if (bounds.length) {
        map.fitBounds(L.latLngBounds(bounds), mapFitOptions({ maxZoom: 13 }));
      }
      return;
    }

    if (roteiroId === "subregioes") {
      renderLagoaPolys();
      if (lagoaPolyLayers.length) {
        map.fitBounds(
          L.featureGroup(lagoaPolyLayers).getBounds(),
          mapFitOptions({ maxZoom: 15 })
        );
      }
    }
  }

  function renderTerritorioMap(territorio, options) {
    options = options || {};
    var shouldFit = options.fit !== false;
    clearLayers();

    // Contorno do TI pai (não no Lagoa Grande: lá as 7 subregiões são a referência visual)
    var tiSlug = D.redeTiMap[territorio.slug];
    var ti =
      territorio.slug !== "lagoa-grande" && tiSlug
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
        weight: 2,
        opacity: 0.85,
        fillColor: tiBoundaryFill,
        fillOpacity: 0.03,
        className: "ti-boundary-poly",
        interactive: false,
      });
      polygonsLayer.addLayer(tiPoly);
    }

    if (territorio.slug === "lagoa-grande") renderLagoaPolys();

    renderMunicipioLabels(territorio);

    if (activeRoteiroId) {
      renderRoteiroOnMap(territorio, activeRoteiroId);
    } else {
      renderPontos(territorio);
    }
    bringMarkersToFront();

    if (!shouldFit) return;

    if (activeRoteiroId) return;

    if (activeLagoaRegId && territorio.slug === "lagoa-grande") {
      var reg = (window.MI_LAGOAS_GEO || []).find(function (r) {
        return r.id === activeLagoaRegId;
      });
      if (reg) focusLagoaReg(reg, false);
      return;
    }

    fitTerritorioView(territorio);
    scheduleMapRefit(function () {
      fitTerritorioView(territorio);
    });
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

  function renderPontosLista(territorio) {
    var pontos = territorio.pontos || [];
    if (!pontos.length) return "";
    return pontos.map(function(p) {
      var corDot = camadaCor(p.camada);
      var resumo = (p.resumo || "").trim();
      return (
        '<div class="ponto-item">' +
          '<button type="button" class="ponto-item-btn btn-link-mapa" data-ponto="' + esc(p.id) + '">' +
            '<span class="ponto-dot" style="background:' + corDot + '"></span>' +
            '<span class="ponto-item-nome">' + esc(p.titulo) + '</span>' +
          '</button>' +
          (resumo ? '<p class="ponto-item-resumo">' + esc(resumo) + '</p>' : '') +
        '</div>'
      );
    }).join("");
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
            "<span>Reproduzir</span></button></div></div>";
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

  function bindGaleria(g, container) {
    var panel = container || $("detail-content");
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
            roteiroPanelData = {
              items: allItems,
              stopFirstIndex: stopFirstIndex,
              roteiroId: r.id,
            };
            if (allItems.length) {
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

  function bindRoteiroPanel(territorio, container) {
    roteiroSidebarMidia = null;
    var panel = container || $("detail-content");
    if (!panel) return;

    var wrap = panel.querySelector(".roteiro-midia-wrap");
    if (wrap && roteiroPanelData && roteiroPanelData.items.length) {
      roteiroSidebarMidia = bindSidebarMidiaCarousel(wrap, roteiroPanelData.items);
    }

    panel.querySelectorAll(".roteiro-parada-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var si = parseInt(btn.dataset.stop, 10);
        if (isNaN(si)) return;
        var rid =
          roteiroPanelData && roteiroPanelData.roteiroId
            ? roteiroPanelData.roteiroId
            : btn.closest(".card-roteiro") &&
              btn.closest(".card-roteiro").querySelector(".btn-roteiro") &&
              btn.closest(".card-roteiro").querySelector(".btn-roteiro").dataset
                .roteiro;
        if (!rid) return;
        if (activeRoteiroId !== rid) {
          activeRoteiroId = rid;
          renderTerritorioMap(territorio, { fit: true });
        }
        focusRoteiroStop(si);
        if (window.innerWidth <= 768) {
          sheetFechada();
        }
        if (
          roteiroSidebarMidia &&
          roteiroPanelData &&
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

  function execSelectTerritorio(slug) {
    var t = getTerritorio(slug);
    if (!t) return;
    if (slug !== "lagoa-grande") activeLagoaRegId = null;
    activeRoteiroId = null;
    renderChips(t);
    setHeaderContext(redeRegiaoNome(t), redeLugaresLabel(t));

    $("sidebar-master").hidden = true;
    $("sidebar-detail").hidden = false;
    
    var detailContent = $("detail-content");
    detailContent.innerHTML = renderDetailContent(t);
    
    var combinedGaleria = getCombinedGaleria(t);
    bindGaleria(combinedGaleria, detailContent);
    bindRoteiroPanel(t, detailContent);
    bindAccordionToggles(detailContent);

    document.querySelectorAll(".btn-roteiro").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var rid = btn.dataset.roteiro;
        if (activeRoteiroId === rid) {
          activeRoteiroId = null;
          renderChips(t);
          renderTerritorioMap(t);
          showToast("Todos os pontos no mapa");
        } else {
          activeRoteiroId = rid;
          renderChips(t);
          renderTerritorioMap(t);
          showToast("Só a rota no mapa — clique de novo para ver todos os pontos");
        }
        if (window.innerWidth <= 768) {
          sheetFechada();
        }
      });
    });

    document.querySelectorAll(".btn-link-mapa").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ponto = (t.pontos || []).find(function (p) {
          return p.id === btn.dataset.ponto;
        });
        if (!ponto) return;
        activeRoteiroId = null;

        // Se a camada esta desativada, ativar e reconstruir o mapa
        if (ponto.camada && !activeCamadas[ponto.camada]) {
          activeCamadas[ponto.camada] = true;
          renderChips(t);
          renderTerritorioMap(t, { fit: false });
        }

        // Navegar diretamente ao ponto (como no prototipo quilombola_map)
        map.setView(ponto.coords, 15, { animate: true });
        
        // Abrir popup do marcador correspondente
        setTimeout(function () {
          markersLayer.eachLayer(function (layer) {
            if (layer.pontoId === ponto.id) layer.openPopup();
          });
        }, 300);

        if (window.innerWidth <= 768) {
          sheetFechada();
        }
      });
    });

    renderTerritorioMap(t);
  }

  function selectTerritorio(slug) {
    if (!getTerritorio(slug) || !window.MI_NAV) return;
    window.MI_NAV.navigate({
      view: "territorio",
      redeSlug: slug,
      territorioSlug: slug,
      tiSlug: null,
      panel: "detalhe",
    });
  }

  function getSharePayload() {
    var title = "Identidade e Memória";
    var subtitle = "Movimento Irun — Territórios da Bahia";
    if (mode === "territorio" && activeSlug) {
      var t = getTerritorio(activeSlug);
      if (t) {
        title = redeRegiaoNome(t);
        subtitle = redeLugaresLabel(t) || t.ti || "Rede Movimento Irun";
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
    var url = location.href.split("#")[0];
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
    var href = activeSlug
      ? "formulario.html?territorio=" + encodeURIComponent(activeSlug)
      : "formulario.html";
    var el = $("nav-formulario");
    if (el) el.href = href;
    var elMenu = $("nav-formulario-menu");
    if (elMenu) elMenu.href = href;
  }

  function isMobileLayout() {
    return window.innerWidth <= 768;
  }

  function ensureMobileSidebarReady() {
    if (!isMobileLayout()) return;
    var main = document.querySelector(".main");
    if (main) main.classList.remove("sidebar-closed");
  }

  function updateSidebarToggleState() {
    var btn = $("btn-painel");
    if (!btn) return;
    var isOpen = false;
    if (isMobileLayout()) {
      isOpen = $("sidebar").classList.contains("open");
    } else {
      var main = document.querySelector(".main");
      isOpen = main ? !main.classList.contains("sidebar-closed") : true;
    }
    btn.classList.toggle("header-nav-active", isOpen);
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      isOpen ? "Fechar lista e conteúdo" : "Abrir lista e conteúdo"
    );
    var sidebar = $("sidebar");
    if (sidebar && isMobileLayout()) {
      sidebar.setAttribute("aria-modal", isOpen ? "true" : "false");
    }
  }

  function openMobileSheet() {
    ensureMobileSidebarReady();
    $("sidebar").classList.add("open");
    $("sidebar-backdrop").hidden = false;
    $("sidebar-backdrop").classList.add("visible");
    updateSidebarToggleState();
    setTimeout(function () {
      if (map) map.invalidateSize();
    }, 350);
  }

  function closeMobileSheet() {
    $("sidebar").classList.remove("open");
    $("sidebar-backdrop").classList.remove("visible");
    updateSidebarToggleState();
    setTimeout(function () {
      if (!$("sidebar").classList.contains("open")) {
        $("sidebar-backdrop").hidden = true;
      }
      if (map) map.invalidateSize();
    }, 350);
  }

  function toggleSidebar() {
    sheetToggle();
  }

  function init() {
    initMap();
    initGaleriaChrome();

    if (window.MI_NAV) {
      window.MI_NAV.registerHandlers({
        $: $,
        isMobileLayout: isMobileLayout,
        map: function () {
          return map;
        },
        openMobileSheet: openMobileSheet,
        closeMobileSheet: closeMobileSheet,
        updateSidebarToggleState: updateSidebarToggleState,
        updateUrlFromNav: updateUrlFromNav,
        onNavigate: function (nav) {
          syncLegacyFromNav(nav);
          if (nav.view === "bahia") {
            execTiMap(nav.tiSlug, nav.panel === "ti-info" && !!nav.tiSlug);
          } else if (nav.view === "rede") {
            execRedeMap();
          } else if (nav.view === "territorio" && nav.redeSlug) {
            execSelectTerritorio(nav.redeSlug);
          }
          toggleUiForMode();
          updateFormNavLink();
        },
      });
    }

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

    listen("btn-movimento-irun", "click", function () {
      renderTiMap(null, false);
    });
    listen("btn-ti", "click", function () {
      renderTiMap(null, false);
    });
    listen("btn-painel", "click", toggleSidebar);
    listen("btn-rede", "click", function () {
      renderRedeMap();
    });
    listen("btn-share", "click", openShareDialog);
    bindShareUi();
    if (window.MITheme) window.MITheme.bindToggle($("btn-theme"));
    listen("btn-satelite", "click", toggleSatelliteMode);
    listen("btn-copy-embed", "click", function () {
      copyField("share-embed");
    });
    listen("btn-close-share", "click", function () {
      var d = $("dialog-share");
      if (d) d.close();
    });
    listen("btn-toggle-sidebar", "click", toggleSidebar);
    listen("btn-theme-menu", "click", function () {
      var t = $("btn-theme");
      if (t) t.click();
    });
    listen("btn-share-menu", "click", openShareDialog);
    listen("nav-formulario-menu", "click", function () {
      var a = $("nav-formulario");
      if (a && a.href) location.href = a.href;
    });
    listen("sidebar-backdrop", "click", sheetFechada);
    listen("sidebar-drag-handle", "click", function () {
      if (window.innerWidth <= 768) sheetFechada();
    });

    var searchInput = $("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        renderMasterList(e.target.value);
      });
    }

    listen("btn-detail-back", "click", goBackToMasterList);

    var terr = qs("territorio");
    var vista = qs("vista");
    var tiParam = qs("ti");
    if (terr && getTerritorio(terr)) {
      selectTerritorio(terr);
    } else if (vista === "rede") {
      renderRedeMap();
    } else if (tiParam) {
      var tiInit = (window.MI_TI_BAHIA || []).find(function (x) {
        return x.slug === tiParam;
      });
      if (tiInit) renderTiMap(tiInit.slug, true);
      else renderTiMap(null, false);
    } else {
      renderTiMap(null, false);
    }

    window.addEventListener("resize", function () {
      map.invalidateSize();
      if (isMobileLayout()) {
        ensureMobileSidebarReady();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

