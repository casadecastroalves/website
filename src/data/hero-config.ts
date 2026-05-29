/**
 * Hero da homepage — altere `mode` para trocar entre campanha e hero institucional
 * sem editar o markup em index.astro.
 */
export type HeroMode = 'default' | 'promo';

export const heroConfig = {
  mode: 'promo' as HeroMode,

  default: {
    title: 'Onde a poesia se faz',
    highlight: 'Aliança e Resistência',
    subtitle:
      'A antiga residência do poeta Castro Alves hoje abriga um espaço vivo de cultura, memória, arte contemporânea e saberes ancestrais no coração de Salvador.',
    primaryCta: { label: 'Conheça a Casa', href: '/a-casa' },
    secondaryCta: { label: 'Agendar Visita', href: '/contato' },
  },

  promo: {
    title: '11ª Edição do Movimento Irun',
    highlight: 'Sente O Tempo Passar',
    subtitle:
      'Show do duo iRê iRê: Maíra e Ícaro Santiago, exposição da Escola das Águas Nascentes, oficinas, Design Caboclo, feira agroecológica da Chapada Diamantina, gira de saberes e diálogos institucionais',
    primaryCta: {
      label: 'INSCREVA-SE',
      href: 'https://docs.google.com/forms/d/e/1FAIpQLSdYlaHZ_6jtI8SrXIyznc4ejZ9JRGsyC8JqBJ85dG9HoKNdhA/viewform',
      external: true,
    },
    secondaryCta: { label: 'Ver Programação', href: '/movimento-irun/edicao-11' },
    imageAlt: 'Duo iRê iRê - 11ª Edição do Movimento Irun',
  },
} as const;
