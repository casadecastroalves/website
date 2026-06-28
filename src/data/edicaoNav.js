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

  const prevEdition = currentIndex > 0 ? filtered[currentIndex - 1] : null;
  const nextEdition =
    currentIndex < filtered.length - 1 ? filtered[currentIndex + 1] : null;

  if (isExposition) {
    return {
      filtered,
      currentIndex,
      prev: prevEdition
        ? {
            href: `/movimento-irun/${prevEdition.slug}`,
            label: 'Exposição Anterior',
          }
        : null,
      next: nextEdition
        ? {
            href: `/movimento-irun/${nextEdition.slug}`,
            label: 'Próxima Exposição',
          }
        : null,
    };
  }

  return {
    filtered,
    currentIndex,
    prev: prevEdition
      ? {
          href: `/movimento-irun/${prevEdition.slug}`,
          label: 'Edição Anterior',
        }
      : {
          href: EDICOES_LIST_URL,
          label: 'Todas as Edições',
        },
    next: nextEdition
      ? {
          href: `/movimento-irun/${nextEdition.slug}`,
          label: 'Próxima Edição',
        }
      : {
          href: EDICOES_LIST_URL,
          label: 'Todas as Edições',
        },
  };
}
