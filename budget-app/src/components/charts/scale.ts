/** Pas « rond » (1, 2, 2,5, 5 × 10ⁿ) pour des graduations lisibles. */
export function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= rough) ?? 10 * power;
}

export function ticksBetween(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 1000; value += step) ticks.push(Math.round(value));
  return ticks;
}

/** Colonne avec données arrondies de 4 px en haut, base carrée. */
export function columnPath(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/**
 * Courbe monotone (Fritsch–Carlson) : douce sans jamais dépasser les données.
 */
export function monotonePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) return points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join("");

  const dx = points.slice(1).map((p, i) => p.x - points[i].x);
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / dx[i]);
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const [a, b] = [slopes[i - 1], slopes[i]];
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1] = [points[i], points[i + 1]];
    const h = dx[i] / 3;
    path += `C${p0.x + h},${p0.y + h * tangents[i]} ${p1.x - h},${p1.y - h * tangents[i + 1]} ${p1.x},${p1.y}`;
  }
  return path;
}
