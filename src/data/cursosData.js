import cms from '../cms/cursos.json' with { type: 'json' };
import { normalizeList } from './cmsHelpers.js';

function mapEixo(eixo) {
  return {
    ...eixo,
    topicos: normalizeList(eixo.topicos),
  };
}

function mapOficina(oficina) {
  return {
    ...oficina,
    imagens: (oficina.imagens ?? []).map((img) =>
      typeof img === 'string' ? { src: img, alt: '' } : img
    ),
  };
}

export const cursosPage = {
  hero: cms.hero,
  programaBemViver: {
    ...cms.programaBemViver,
    paragrafos: normalizeList(cms.programaBemViver.paragrafos),
  },
  eixosTitulo: cms.eixosTitulo,
  eixosSubtitulo: cms.eixosSubtitulo,
  eixos: cms.eixos.map(mapEixo),
  oficinasTitulo: cms.oficinasTitulo,
  oficinasSubtitulo: cms.oficinasSubtitulo,
  oficinas: cms.oficinas.map(mapOficina),
  cronograma: {
    ...cms.cronograma,
    ciclos: cms.cronograma.ciclos ?? [],
  },
  apoio: cms.apoio,
};

/** Eixos partilhados com a página Movimento Irun */
export const cursosEixos = cursosPage.eixos;

export function statusClass(status) {
  if (status === 'Encerrado') return 'closed';
  return 'finished';
}
