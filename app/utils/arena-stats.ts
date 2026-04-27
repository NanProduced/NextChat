import { ELO_INITIAL_RATING } from "./elo";

export type EloEntry = {
  model: string;
  rating: number;
  battles: number;
  wins: number;
  losses: number;
};

export type PairwiseRecord = {
  modelA: string;
  modelB: string;
  winsA: number;
  winsB: number;
  draws: number;
};

export function getModelKey(model: string, providerName: string): string {
  return `${model}@${providerName}`;
}

export function getPairwiseKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function getModelWinRate(
  elo: Record<string, EloEntry>,
  modelKey: string,
): number {
  const entry = elo[modelKey];
  if (!entry || entry.battles === 0) return 0;
  return Math.round((entry.wins / entry.battles) * 10000) / 100;
}

export function getModelBattleCount(
  elo: Record<string, EloEntry>,
  modelKey: string,
): number {
  return elo[modelKey]?.battles ?? 0;
}

export function getPairwiseRecord(
  pairwise: Record<string, PairwiseRecord>,
  a: string,
  b: string,
): PairwiseRecord {
  const key = getPairwiseKey(a, b);
  const record = pairwise[key];
  if (!record) {
    return { modelA: a < b ? a : b, modelB: a < b ? b : a, winsA: 0, winsB: 0, draws: 0 };
  }
  return record;
}

export function getLeaderboard(
  elo: Record<string, EloEntry>,
): EloEntry[] {
  return Object.values(elo).sort((a, b) => b.rating - a.rating);
}

export function ensureEloEntry(
  elo: Record<string, EloEntry>,
  modelKey: string,
): EloEntry {
  if (!elo[modelKey]) {
    elo[modelKey] = { model: modelKey, rating: ELO_INITIAL_RATING, battles: 0, wins: 0, losses: 0 };
  }
  return elo[modelKey];
}

export function ensurePairwiseRecord(
  pairwise: Record<string, PairwiseRecord>,
  a: string,
  b: string,
): PairwiseRecord {
  const key = getPairwiseKey(a, b);
  if (!pairwise[key]) {
    const [smaller, larger] = a < b ? [a, b] : [b, a];
    pairwise[key] = { modelA: smaller, modelB: larger, winsA: 0, winsB: 0, draws: 0 };
  }
  return pairwise[key];
}
