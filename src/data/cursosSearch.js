import cms from '../cms/cursos.json' with { type: 'json' };
import { normalizeList } from './cmsHelpers.js';

/** Entradas de busca geradas a partir do CMS de cursos */
export const cursosSearchEntries = [
  ...cms.eixos.map((eixo) => ({
    title: `Programa Bem Viver — ${eixo.titulo.replace(/\n/g, ' ')}`,
    facilitador: eixo.facilitador,
    excerpt: `${normalizeList(eixo.topicos).slice(0, 2).join(' ')} Facilitadora: ${eixo.facilitador}.`,
    topics: normalizeList(eixo.topicos),
  })),
  ...cms.oficinas.map((oficina) => ({
    title: oficina.titulo,
    facilitador: oficina.facilitador,
    excerpt: oficina.descricao.slice(0, 180),
    topics: [oficina.badge, oficina.status].filter(Boolean),
  })),
];
