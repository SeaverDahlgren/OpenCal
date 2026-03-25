export type BusyWindow = {
  start: string;
  end: string;
};

export type FreeWindow = {
  start: string;
  end: string;
};

export function findFreeWindows(args: {
  rangeStart: string;
  rangeEnd: string;
  busyWindows: BusyWindow[];
  minDurationMinutes: number;
}): FreeWindow[] {
  const { rangeStart, rangeEnd, busyWindows, minDurationMinutes } = args;
  const startMs = new Date(rangeStart).getTime();
  const endMs = new Date(rangeEnd).getTime();

  const sortedBusy = [...busyWindows]
    .map((window) => ({
      start: new Date(window.start).getTime(),
      end: new Date(window.end).getTime(),
    }))
    .filter((window) => window.end > startMs && window.start < endMs)
    .sort((a, b) => a.start - b.start);

  const mergedBusy: Array<{ start: number; end: number }> = [];
  for (const window of sortedBusy) {
    const last = mergedBusy[mergedBusy.length - 1];
    if (!last || window.start > last.end) {
      mergedBusy.push(window);
      continue;
    }
    last.end = Math.max(last.end, window.end);
  }

  const freeWindows: FreeWindow[] = [];
  let cursor = startMs;
  const minDurationMs = minDurationMinutes * 60 * 1000;

  for (const window of mergedBusy) {
    if (window.start - cursor >= minDurationMs) {
      freeWindows.push({
        start: new Date(cursor).toISOString(),
        end: new Date(window.start).toISOString(),
      });
    }
    cursor = Math.max(cursor, window.end);
  }

  if (endMs - cursor >= minDurationMs) {
    freeWindows.push({
      start: new Date(cursor).toISOString(),
      end: new Date(endMs).toISOString(),
    });
  }

  return freeWindows;
}
