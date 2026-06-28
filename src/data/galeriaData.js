import cms from '../cms/galeria.json' with { type: 'json' };

export const galeriaMovimentoIrun = cms.movimentoIrunExposicao ?? [];
export const fotosGeraisMovimentoIrun = galeriaMovimentoIrun.map((f) => f.src);
