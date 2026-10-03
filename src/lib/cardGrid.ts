export interface CardGridLayout {
  sizes: number[];
  index: number;
  columns: number;
  width: number;
}

/** Keep one target size for each layout produced by the flexible grid. */
export function getCardGridLayout(
  containerWidth: number,
  gap: number,
  targetSize: number,
  scale = 1,
): CardGridLayout {
  const columnsFor = (size: number) =>
    Math.max(
      1,
      Math.floor((containerWidth + gap) / (Math.round(size * scale) + gap)),
    );
  const sizes: number[] = [];
  let previousColumns = 0;
  for (let size = 120; size <= 300; size += 10) {
    const columns = columnsFor(size);
    if (columns !== previousColumns) sizes.push(size);
    previousColumns = columns;
  }
  // Keep the largest preference available without adding a repeated layout.
  if (sizes.length > 1) sizes[sizes.length - 1] = 300;
  const columns = columnsFor(targetSize);
  const index = Math.max(
    0,
    sizes.findIndex((size) => columnsFor(size) === columns),
  );
  return {
    sizes,
    index,
    columns,
    width: Math.max(0, (containerWidth - gap * (columns - 1)) / columns),
  };
}
