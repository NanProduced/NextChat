export const ELO_INITIAL_RATING = 1000;
export const ELO_K_FACTOR = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  k: number = ELO_K_FACTOR,
): [number, number] {
  const eA = expectedScore(ratingA, ratingB);
  const eB = 1 - eA;
  const scoreB = 1 - scoreA;
  return [
    Math.round((ratingA + k * (scoreA - eA)) * 100) / 100,
    Math.round((ratingB + k * (scoreB - eB)) * 100) / 100,
  ];
}
