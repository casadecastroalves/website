/** Normaliza listas do Decap CMS (strings ou { item/p: "..." }). */
export function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.item || item.p || Object.values(item)[0] || '';
      return String(item);
    })
    .filter(Boolean);
}
