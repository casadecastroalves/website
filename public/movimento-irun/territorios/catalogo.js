/**
 * Catálogo unificado — registos com tiSlug + tags (DADOS-SPEC)
 * Fonte: MI_DADOS.registos ou migração desde territorios[].pontos
 */
(function () {
  "use strict";

  var REGISTO_OVERRIDES = {
    "hostel-recanto-da-vila": {
      camada: "turismo-comunitario",
      tags: ["hospedagem"],
    },
    "festa-das-rendeiras": {
      camada: "festas",
      tags: ["patronal", "artesanato"],
    },
    "casarao-dos-olhos-dagua": {
      fitMap: false,
      tags: ["historia", "patrimonio"],
    },
  };

  var CAMADA_DEFAULT_TAGS = {
    natureza: ["natureza"],
    historia: ["historia"],
    instituicoes: ["instituicao"],
    produtos: ["produto"],
    projetos: ["projeto"],
    festas: ["festividade"],
    "turismo-comunitario": ["turismo"],
  };

  function defaultTagsForCamada(camada) {
    return (CAMADA_DEFAULT_TAGS[camada] || []).slice();
  }

  function applyOverrides(registo) {
    var o = REGISTO_OVERRIDES[registo.id];
    if (!o) return registo;
    if (o.camada) registo.camada = o.camada;
    if (o.tags) registo.tags = o.tags.slice();
    if (o.fitMap === false) registo.fitMap = false;
    return registo;
  }

  function clonePonto(p) {
    var r = {
      id: p.id,
      titulo: p.titulo,
      camada: p.camada,
      coords: p.coords ? p.coords.slice() : [],
      resumo: p.resumo || "",
      tags: p.tags ? p.tags.slice() : defaultTagsForCamada(p.camada),
      fitMap: p.fitMap !== false,
    };
    if (p.fotos) r.fotos = p.fotos;
    if (p.videos) r.videos = p.videos;
    if (p.links) r.links = p.links;
    if (p.emoji) r.emoji = p.emoji;
    if (p.camadaLabel) r.camadaLabel = p.camadaLabel;
    return r;
  }

  function pontoFromRegisto(reg) {
    return clonePonto(reg);
  }

  function buildRegistoFromPonto(p, redeSlug, tiSlug) {
    var reg = clonePonto(p);
    reg.tiSlug = tiSlug;
    reg.redeSlug = redeSlug;
    if (!reg.tags || !reg.tags.length) {
      reg.tags = defaultTagsForCamada(reg.camada);
    }
    return applyOverrides(reg);
  }

  function migrateFromTerritorios(D) {
    var list = [];
    (D.territorios || []).forEach(function (t) {
      var tiSlug = (D.redeTiMap && D.redeTiMap[t.slug]) || t.slug;
      (t.pontos || []).forEach(function (p) {
        if (!p || !p.id || !p.coords) return;
        list.push(buildRegistoFromPonto(p, t.slug, tiSlug));
      });
    });
    return list;
  }

  function init(D) {
    if (!D) return [];
    var list = D.registos && D.registos.length ? D.registos : migrateFromTerritorios(D);
    list = list.map(function (r) {
      return applyOverrides(
        Object.assign(
          {
            tags: defaultTagsForCamada(r.camada),
            fitMap: r.fitMap !== false,
          },
          r
        )
      );
    });
    D.registos = list;
    return list;
  }

  function getRegistos(D) {
    if (!D.registos || !D.registos.length) init(D);
    return D.registos || [];
  }

  function getPontosForTerritorio(D, redeSlug) {
    return getRegistos(D)
      .filter(function (r) {
        return r.redeSlug === redeSlug;
      })
      .map(pontoFromRegisto);
  }

  function query(D, filtro) {
    filtro = filtro || {};
    var list = getRegistos(D);
    if (filtro.redeSlugs && filtro.redeSlugs.length) {
      list = list.filter(function (r) {
        return filtro.redeSlugs.indexOf(r.redeSlug) >= 0;
      });
    }
    if (filtro.tiSlugs && filtro.tiSlugs.length) {
      list = list.filter(function (r) {
        return filtro.tiSlugs.indexOf(r.tiSlug) >= 0;
      });
    }
    if (filtro.camadas && filtro.camadas.length) {
      list = list.filter(function (r) {
        return filtro.camadas.indexOf(r.camada) >= 0;
      });
    }
    if (filtro.tags && filtro.tags.length) {
      list = list.filter(function (r) {
        var tags = r.tags || [];
        return filtro.tags.some(function (t) {
          return tags.indexOf(t) >= 0;
        });
      });
    }
    var porTi = {};
    list.forEach(function (r) {
      porTi[r.tiSlug] = (porTi[r.tiSlug] || 0) + 1;
    });
    return {
      registos: list,
      total: list.length,
      porTi: porTi,
    };
  }

  window.MI_CATALOGO = {
    init: init,
    getRegistos: getRegistos,
    getPontosForTerritorio: getPontosForTerritorio,
    query: query,
    pontoFromRegisto: pontoFromRegisto,
  };
})();
