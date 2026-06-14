import cms from '../cms/edicoes.json' with { type: 'json' };

function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.item || item.p || Object.values(item)[0] || '';
      return String(item);
    })
    .filter(Boolean);
}

export const edicoesData = cms.edicoes.map((ed) => ({
  ...ed,
  detalhes: normalizeList(ed.detalhes),
}));
