export function frameStats(
  current: Uint8ClampedArray,
  previous?: Uint8ClampedArray,
) {
  let luminance = 0,
    motion = 0;
  for (let i = 0; i < current.length; i += 4) {
    const value =
      0.2126 * current[i] + 0.7152 * current[i + 1] + 0.0722 * current[i + 2];
    luminance += value;
    if (previous) {
      const old =
        0.2126 * previous[i] +
        0.7152 * previous[i + 1] +
        0.0722 * previous[i + 2];
      motion += Math.abs(value - old);
    }
  }
  const count = current.length / 4;
  return {
    luminance: count ? luminance / count : 0,
    motion: previous && count ? motion / count : 0,
  };
}
export function groupEvents(
  samples: { time: number; motion: number }[],
  threshold: number,
) {
  const events: { start: number; end: number; peak: number }[] = [];
  for (const sample of samples) {
    if (sample.motion < threshold) continue;
    const last = events.at(-1);
    if (last && sample.time - last.end <= 2) {
      last.end = sample.time;
      last.peak = Math.max(last.peak, sample.motion);
    } else
      events.push({
        start: sample.time,
        end: sample.time,
        peak: sample.motion,
      });
  }
  return events;
}
