import cms from '../cms/home.json' with { type: 'json' };

export type HeroMode = 'default' | 'promo';

export const heroConfig = {
  mode: (cms.heroMode === 'promo' ? 'promo' : 'default') as HeroMode,

  default: {
    title: cms.heroDefault.title,
    highlight: cms.heroDefault.highlight,
    subtitle: cms.heroDefault.subtitle,
    primaryCta: {
      label: cms.heroDefault.primaryCtaLabel,
      href: cms.heroDefault.primaryCtaHref,
    },
    secondaryCta: {
      label: cms.heroDefault.secondaryCtaLabel,
      href: cms.heroDefault.secondaryCtaHref,
    },
  },

  promo: {
    title: cms.heroPromo.title,
    highlight: cms.heroPromo.highlight,
    subtitle: cms.heroPromo.subtitle,
    primaryCta: {
      label: cms.heroPromo.primaryCtaLabel,
      href: cms.heroPromo.primaryCtaHref,
      external: true,
    },
    secondaryCta: {
      label: cms.heroPromo.secondaryCtaLabel,
      href: cms.heroPromo.secondaryCtaHref,
    },
    imageAlt: cms.heroPromo.imageAlt,
  },
} as const;

export const homePage = cms;
