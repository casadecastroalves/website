export const EDICOES_LIST_URL = '/movimento-irun/edicoes';

export function getFilteredEditions(allEdicoes, isExposition = false) {
  return allEdicoes.filter((e) => {
    if (e.slug === '11-edicoes') return false;
    const isItemExpo = e.slug.startsWith('expo-');
    return isExposition ? isItemExpo : !isItemExpo;
  });
}

export function getEditionNav(allEdicoes, currentSlug, isExposition = false) {
  const filtered = getFilteredEditions(allEdicoes, isExposition);
  const currentIndex = filtered.findIndex((e) => e.slug === currentSlug);

  if (currentIndex === -1) {
    return { prev: null, next: null, filtered, currentIndex };
  }

  const prevEdition =
    currentIndex > 0 ? filtered[currentIndex - 1] : filtered[filtered.length - 1];
  const nextEdition =
    currentIndex < filtered.length - 1 ? filtered[currentIndex + 1] : filtered[0];

  const labelPrefix = isExposition ? 'Exposição' : 'Edição';

  return {
    filtered,
    currentIndex,
    prev: {
      href: `/movimento-irun/${prevEdition.slug}`,
      label: `${labelPrefix} Anterior (${prevEdition.num || prevEdition.titulo})`,
    },
    next: {
      href: `/movimento-irun/${nextEdition.slug}`,
      label: `Próxima ${labelPrefix} (${nextEdition.num || nextEdition.titulo})`,
    },
  };
}
