interface NamedFavoritableEntity {
  name: string;
  favorite?: boolean;
}

const NAME_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function compareEntityNames(
  left: Pick<NamedFavoritableEntity, 'name'>,
  right: Pick<NamedFavoritableEntity, 'name'>,
): number {
  return NAME_COLLATOR.compare(left.name, right.name);
}

export function compareFavoritesFirst(
  left: Pick<NamedFavoritableEntity, 'favorite'>,
  right: Pick<NamedFavoritableEntity, 'favorite'>,
): number {
  return Number(Boolean(right.favorite)) - Number(Boolean(left.favorite));
}
