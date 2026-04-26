import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { StoreKey } from "../constant";

export enum VoteResult {
  Better = "better",
  Worse = "worse",
  Tie = "tie",
}

export type ArenaModelIdentifier = {
  model: string;
  providerName: string;
};

export type ArenaBlindModel = ArenaModelIdentifier & {
  blindLabel: string;
};

export type ArenaDuelRecord = {
  id: string;
  arenaId: string;
  sessionId: string;
  prompt: string;
  models: ArenaBlindModel[];
  votes: Record<string, VoteResult | null>;
  isRevealed: boolean;
  createdAt: number;
  completedAt?: number;
};

export type PairwiseRecord = {
  id: string;
  modelA: string;
  modelAProvider: string;
  modelB: string;
  modelBProvider: string;
  winsA: number;
  winsB: number;
  ties: number;
};

export type ModelEloRecord = {
  model: string;
  providerName: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  lastUpdated: number;
};

export const DEFAULT_ELO = 1000;
export const K_FACTOR = 32;

function getModelKey(model: string, providerName: string): string {
  return `${model}@${providerName}`;
}

function getPairwiseKey(
  modelA: string,
  providerA: string,
  modelB: string,
  providerB: string,
): string {
  const keyA = getModelKey(modelA, providerA);
  const keyB = getModelKey(modelB, providerB);
  return keyA < keyB ? `${keyA}:${keyB}` : `${keyB}:${keyA}`;
}

function computeExpectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function computeNewElo(
  currentElo: number,
  expectedScore: number,
  actualScore: number,
): number {
  return Math.round(currentElo + K_FACTOR * (actualScore - expectedScore));
}

const DEFAULT_ARENA_STATE = {
  duels: [] as ArenaDuelRecord[],
  pairwise: [] as PairwiseRecord[],
  eloRecords: [] as ModelEloRecord[],
};

export const useArenaStore = createPersistStore(
  { ...DEFAULT_ARENA_STATE },
  (set, get) => ({
    reset() {
      set(() => ({ ...DEFAULT_ARENA_STATE }));
    },

    createDuel(
      arenaId: string,
      sessionId: string,
      prompt: string,
      models: ArenaModelIdentifier[],
    ): ArenaDuelRecord {
      const shuffled = [...models].sort(() => Math.random() - 0.5);
      const blindModels: ArenaBlindModel[] = shuffled.map((m, i) => ({
        ...m,
        blindLabel: String.fromCharCode(65 + i),
      }));

      const votes: Record<string, VoteResult | null> = {};
      blindModels.forEach((m) => {
        votes[m.blindLabel] = null;
      });

      const duel: ArenaDuelRecord = {
        id: nanoid(),
        arenaId,
        sessionId,
        prompt,
        models: blindModels,
        votes,
        isRevealed: false,
        createdAt: Date.now(),
      };

      set((state) => {
        state.duels = [...state.duels, duel];
      });

      return duel;
    },

    getDuelByArenaId(arenaId: string): ArenaDuelRecord | undefined {
      return get().duels.find((d) => d.arenaId === arenaId);
    },

    getDuelsBySessionId(sessionId: string): ArenaDuelRecord[] {
      return get().duels.filter((d) => d.sessionId === sessionId);
    },

    hasVoted(arenaId: string): boolean {
      const duel = get().getDuelByArenaId(arenaId);
      if (!duel) return false;
      return Object.values(duel.votes).some((v) => v !== null);
    },

    submitVote(
      arenaId: string,
      blindLabel: string,
      vote: VoteResult,
    ): boolean {
      const state = get();
      const duelIndex = state.duels.findIndex((d) => d.arenaId === arenaId);

      if (duelIndex === -1) return false;

      const duel = state.duels[duelIndex];

      if (duel.votes[blindLabel] !== null) {
        return false;
      }

      const updatedVotes = { ...duel.votes, [blindLabel]: vote };

      const votedModel = duel.models.find((m) => m.blindLabel === blindLabel);
      if (!votedModel) return false;

      set((s) => {
        const updatedDuels = [...s.duels];
        updatedDuels[duelIndex] = {
          ...duel,
          votes: updatedVotes,
        };
        s.duels = updatedDuels;
      });

      return true;
    },

    submitTieVote(arenaId: string): boolean {
      const state = get();
      const duelIndex = state.duels.findIndex((d) => d.arenaId === arenaId);

      if (duelIndex === -1) return false;

      const duel = state.duels[duelIndex];

      if (Object.values(duel.votes).some((v) => v !== null)) {
        return false;
      }

      const updatedVotes: Record<string, VoteResult | null> = {};
      duel.models.forEach((m) => {
        updatedVotes[m.blindLabel] = VoteResult.Tie;
      });

      set((s) => {
        const updatedDuels = [...s.duels];
        updatedDuels[duelIndex] = {
          ...duel,
          votes: updatedVotes,
          isRevealed: true,
          completedAt: Date.now(),
        };
        s.duels = updatedDuels;
        s._updateStatsFromDuel(updatedDuels[duelIndex]);
      });

      return true;
    },

    revealAndComplete(arenaId: string): ArenaDuelRecord | undefined {
      const state = get();
      const duelIndex = state.duels.findIndex((d) => d.arenaId === arenaId);

      if (duelIndex === -1) return undefined;

      const duel = state.duels[duelIndex];

      const allVoted = Object.values(duel.votes).every((v) => v !== null);
      if (!allVoted) return undefined;

      const completedDuel: ArenaDuelRecord = {
        ...duel,
        isRevealed: true,
        completedAt: Date.now(),
      };

      set((s) => {
        const updatedDuels = [...s.duels];
        updatedDuels[duelIndex] = completedDuel;
        s.duels = updatedDuels;
        s._updateStatsFromDuel(completedDuel);
      });

      return completedDuel;
    },

    _updateStatsFromDuel(duel: ArenaDuelRecord) {
      set((s) => {
        const pairwiseMap = new Map(s.pairwise.map((p) => [p.id, p]));
        const eloMap = new Map(
          s.eloRecords.map((e) => [
            getModelKey(e.model, e.providerName),
            e,
          ]),
        );

        const models = duel.models;
        const votes = duel.votes;

        const betterLabels = Object.entries(votes)
          .filter(([_, v]) => v === VoteResult.Better)
          .map(([label]) => label);

        const worseLabels = Object.entries(votes)
          .filter(([_, v]) => v === VoteResult.Worse)
          .map(([label]) => label);

        if (betterLabels.length === 1 && worseLabels.length === 1) {
          const winnerLabel = betterLabels[0];
          const loserLabel = worseLabels[0];

          const winner = models.find((m) => m.blindLabel === winnerLabel)!;
          const loser = models.find((m) => m.blindLabel === loserLabel)!;

          const pairwiseKey = getPairwiseKey(
            winner.model,
            winner.providerName,
            loser.model,
            loser.providerName,
          );
          const winnerKey = getModelKey(winner.model, winner.providerName);
          const loserKey = getModelKey(loser.model, loser.providerName);

          let pairwise = pairwiseMap.get(pairwiseKey);
          if (!pairwise) {
            const keyA = getModelKey(winner.model, winner.providerName);
            const keyB = getModelKey(loser.model, loser.providerName);
            const isAReversed = keyA > keyB;
            pairwise = {
              id: pairwiseKey,
              modelA: isAReversed ? loser.model : winner.model,
              modelAProvider: isAReversed
                ? loser.providerName
                : winner.providerName,
              modelB: isAReversed ? winner.model : loser.model,
              modelBProvider: isAReversed
                ? winner.providerName
                : loser.providerName,
              winsA: 0,
              winsB: 0,
              ties: 0,
            };
          }

          const winnerIsA =
            pairwise.modelA === winner.model &&
            pairwise.modelAProvider === winner.providerName;

          if (winnerIsA) {
            pairwise.winsA += 1;
          } else {
            pairwise.winsB += 1;
          }

          pairwiseMap.set(pairwiseKey, pairwise);

          const winnerElo = eloMap.get(winnerKey) ?? {
            model: winner.model,
            providerName: winner.providerName,
            elo: DEFAULT_ELO,
            matches: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            lastUpdated: Date.now(),
          };

          const loserElo = eloMap.get(loserKey) ?? {
            model: loser.model,
            providerName: loser.providerName,
            elo: DEFAULT_ELO,
            matches: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            lastUpdated: Date.now(),
          };

          const expectedWinner = computeExpectedScore(winnerElo.elo, loserElo.elo);
          const expectedLoser = computeExpectedScore(loserElo.elo, winnerElo.elo);

          const newWinnerElo = computeNewElo(winnerElo.elo, expectedWinner, 1);
          const newLoserElo = computeNewElo(loserElo.elo, expectedLoser, 0);

          eloMap.set(winnerKey, {
            ...winnerElo,
            elo: newWinnerElo,
            matches: winnerElo.matches + 1,
            wins: winnerElo.wins + 1,
            lastUpdated: Date.now(),
          });

          eloMap.set(loserKey, {
            ...loserElo,
            elo: newLoserElo,
            matches: loserElo.matches + 1,
            losses: loserElo.losses + 1,
            lastUpdated: Date.now(),
          });
        } else if (
          betterLabels.length === 0 &&
          worseLabels.length === 0 &&
          Object.values(votes).every((v) => v === VoteResult.Tie)
        ) {
          for (let i = 0; i < models.length; i++) {
            for (let j = i + 1; j < models.length; j++) {
              const modelA = models[i];
              const modelB = models[j];
              const pairwiseKey = getPairwiseKey(
                modelA.model,
                modelA.providerName,
                modelB.model,
                modelB.providerName,
              );
              const keyA = getModelKey(modelA.model, modelA.providerName);
              const keyB = getModelKey(modelB.model, modelB.providerName);

              let pairwise = pairwiseMap.get(pairwiseKey);
              if (!pairwise) {
                const isAReversed = keyA > keyB;
                pairwise = {
                  id: pairwiseKey,
                  modelA: isAReversed ? modelB.model : modelA.model,
                  modelAProvider: isAReversed
                    ? modelB.providerName
                    : modelA.providerName,
                  modelB: isAReversed ? modelA.model : modelB.model,
                  modelBProvider: isAReversed
                    ? modelA.providerName
                    : modelB.providerName,
                  winsA: 0,
                  winsB: 0,
                  ties: 0,
                };
              }
              pairwise.ties += 1;
              pairwiseMap.set(pairwiseKey, pairwise);

              const eloA = eloMap.get(keyA) ?? {
                model: modelA.model,
                providerName: modelA.providerName,
                elo: DEFAULT_ELO,
                matches: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                lastUpdated: Date.now(),
              };

              const eloB = eloMap.get(keyB) ?? {
                model: modelB.model,
                providerName: modelB.providerName,
                elo: DEFAULT_ELO,
                matches: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                lastUpdated: Date.now(),
              };

              const expectedA = computeExpectedScore(eloA.elo, eloB.elo);
              const expectedB = computeExpectedScore(eloB.elo, eloA.elo);

              const newEloA = computeNewElo(eloA.elo, expectedA, 0.5);
              const newEloB = computeNewElo(eloB.elo, expectedB, 0.5);

              eloMap.set(keyA, {
                ...eloA,
                elo: newEloA,
                matches: eloA.matches + 1,
                ties: eloA.ties + 1,
                lastUpdated: Date.now(),
              });

              eloMap.set(keyB, {
                ...eloB,
                elo: newEloB,
                matches: eloB.matches + 1,
                ties: eloB.ties + 1,
                lastUpdated: Date.now(),
              });
            }
          }
        }

        s.pairwise = Array.from(pairwiseMap.values());
        s.eloRecords = Array.from(eloMap.values());
      });
    },

    getModelElo(model: string, providerName: string): ModelEloRecord {
      const key = getModelKey(model, providerName);
      return (
        get().eloRecords.find((e) => getModelKey(e.model, e.providerName) === key) ?? {
          model,
          providerName,
          elo: DEFAULT_ELO,
          matches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          lastUpdated: Date.now(),
        }
      );
    },

    getTopModels(limit: number = 10): ModelEloRecord[] {
      return [...get().eloRecords]
        .sort((a, b) => b.elo - a.elo)
        .slice(0, limit);
    },

    getPairwiseRecord(
      modelA: string,
      providerA: string,
      modelB: string,
      providerB: string,
    ): PairwiseRecord | undefined {
      const key = getPairwiseKey(modelA, providerA, modelB, providerB);
      return get().pairwise.find((p) => p.id === key);
    },

    migrateLegacyData() {},
  }),
  {
    name: StoreKey.Arena,
    version: 1,
    migrate(persistedState: any, version: number) {
      const state = persistedState ?? { ...DEFAULT_ARENA_STATE };

      if (!state.duels) state.duels = [];
      if (!state.pairwise) state.pairwise = [];
      if (!state.eloRecords) state.eloRecords = [];

      return state;
    },
  },
);
