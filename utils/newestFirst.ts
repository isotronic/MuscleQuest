type HasToDate = { toDate: () => Date };

/** A copy of items with the most recent first, by the date getDate reads. */
export function newestFirst<T>(
  items: readonly T[],
  getDate: (item: T) => HasToDate,
): T[] {
  return items
    .map((item) => ({ item, time: getDate(item).toDate().getTime() }))
    .sort((a, b) => b.time - a.time)
    .map(({ item }) => item);
}
