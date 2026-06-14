import cms from '../cms/movimento-irun.json' with { type: 'json' };
import { normalizeList } from './cmsHelpers.js';

export const movimentoIrunPage = {
  hero: cms.hero,
  conceito: normalizeList(cms.conceito),
};
