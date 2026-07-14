export const buildColumnMajorTabIndexes = (columnLengths: number[]): number[][] => {
  let nextTabIndex = 1;

  return columnLengths.map(length => {
    const safeLength = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
    return Array.from({ length: safeLength }, () => nextTabIndex++);
  });
};
