export const ARRAY_CELL_WIDTH = 56;

export const ARRAY_TRACK_PADDING = 8;

export function indexToX(index: number) {
  return ARRAY_TRACK_PADDING + index * (ARRAY_CELL_WIDTH );
}

export function getTrackWidth(length: number) {
  if (length <= 0) {
    return 0;
  }

  return (
    ARRAY_TRACK_PADDING * 2 +
    length * ARRAY_CELL_WIDTH +
    (length - 1) 
  );
}
