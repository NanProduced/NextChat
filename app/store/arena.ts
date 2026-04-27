import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import { updateElo } from "../utils/elo";
import {
  EloEntry,
  PairwiseRecord,
  getModelKey,
  getPairwiseKey,
  ensureEloEntry,
  ensurePairwiseRecord,
  getLeaderboard,
  getPairwiseRecord,
} from "../utils/arena-stats";

export type ArenaModelResult = {
  model: string;
  providerName: string;
  label: string;
  vote?: "up" | "down";
};

export type ArenaRecord = {
  arenaId: string;
  timestamp: number;
  prompt: string;
  models: ArenaModelResult[];
  voted: boolean;
};

type ArenaStoreState = {
  records: ArenaRecord[];
  pairwise: Record<string, PairwiseRecord>;
  elo: Record<string, EloEntry>;
  blindMode: boolean;
};

const DEFAULT_ARENA_STATE: ArenaStoreState = {
  records: [],
  pairwise: {},
  elo: {},
  blindMode: false,
};

export const useArenaStore = createPersistStore(
  DEFAULT_ARENA_STATE,
  (set, get) => ({
    addRecord(record: ArenaRecord) {
      get().update((state) => {
        state.records.push(record);
        for (const m of record.models) {
          const key = getModelKey(m.model, m.providerName);
          ensureEloEntry(state.elo, key);
        }
      });
    },

    vote(
      arenaId: string,
      votedModelKey: string,
      vote: "up" | "down",
    ) {
      const state = get();
      const record = state.records.find((r) => r.arenaId === arenaId);
      if (!record || record.voted) return;

      get().update((state) => {
        const rec = state.records.find((r) => r.arenaId === arenaId);
        if (!rec || rec.voted) return;

        rec.voted = true;
        const votedModel = rec.models.find(
          (m) => getModelKey(m.model, m.providerName) === votedModelKey,
        );
        if (votedModel) {
          votedModel.vote = vote;
        }

        const allModelKeys = rec.models.map((m) =>
          getModelKey(m.model, m.providerName),
        );

        for (const otherKey of allModelKeys) {
          if (otherKey === votedModelKey) continue;

          const pKey = getPairwiseKey(votedModelKey, otherKey);
          const pairwise = ensurePairwiseRecord(state.pairwise, votedModelKey, otherKey);

          const votedIsA = pairwise.modelA === votedModelKey;

          if (vote === "up") {
            if (votedIsA) {
              pairwise.winsA += 1;
            } else {
              pairwise.winsB += 1;
            }
          } else {
            if (votedIsA) {
              pairwise.winsB += 1;
            } else {
              pairwise.winsA += 1;
            }
          }

          state.pairwise[pKey] = pairwise;

          const votedEntry = ensureEloEntry(state.elo, votedModelKey);
          const otherEntry = ensureEloEntry(state.elo, otherKey);

          const scoreForVoted = vote === "up" ? 1 : 0;
          const [newVotedRating, newOtherRating] = updateElo(
            votedEntry.rating,
            otherEntry.rating,
            scoreForVoted,
          );

          votedEntry.rating = newVotedRating;
          votedEntry.battles += 1;
          otherEntry.rating = newOtherRating;
          otherEntry.battles += 1;

          if (vote === "up") {
            votedEntry.wins += 1;
            otherEntry.losses += 1;
          } else {
            votedEntry.losses += 1;
            otherEntry.wins += 1;
          }

          state.elo[votedModelKey] = votedEntry;
          state.elo[otherKey] = otherEntry;
        }
      });
    },

    hasVoted(arenaId: string | undefined): boolean {
      if (!arenaId) return false;
      const record = get().records.find((r) => r.arenaId === arenaId);
      return record?.voted ?? false;
    },

    toggleBlindMode() {
      get().update((state) => {
        state.blindMode = !state.blindMode;
      });
    },

    getLeaderboard() {
      return getLeaderboard(get().elo);
    },

    getPairwiseRecord(a: string, b: string) {
      return getPairwiseRecord(get().pairwise, a, b);
    },

    getRecord(arenaId: string): ArenaRecord | undefined {
      return get().records.find((r) => r.arenaId === arenaId);
    },
  }),
  {
    name: StoreKey.Arena,
    version: 1,
  },
);
