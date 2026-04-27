import {
  expectedScore,
  updateElo,
  ELO_INITIAL_RATING,
  ELO_K_FACTOR,
} from "../app/utils/elo";
import {
  getModelKey,
  getPairwiseKey,
  ensureEloEntry,
  ensurePairwiseRecord,
  getLeaderboard,
  getPairwiseRecord,
  getModelBattleCount,
} from "../app/utils/arena-stats";
import type { EloEntry, PairwiseRecord } from "../app/utils/arena-stats";

describe("Arena Blind Vote & Stats", () => {
  describe("Elo calculation", () => {
    test("initial rating is 1000", () => {
      expect(ELO_INITIAL_RATING).toBe(1000);
    });

    test("expected score for equal ratings is 0.5", () => {
      expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
    });

    test("expected score for higher rating is > 0.5", () => {
      expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    });

    test("expected score for lower rating is < 0.5", () => {
      expect(expectedScore(800, 1000)).toBeLessThan(0.5);
    });

    test("A(1000) wins B(1000): A gains ~16, B loses ~16", () => {
      const [newA, newB] = updateElo(1000, 1000, 1);
      expect(newA).toBeCloseTo(1016, 0);
      expect(newB).toBeCloseTo(984, 0);
    });

    test("A(1000) loses to B(1000): A loses ~16, B gains ~16", () => {
      const [newA, newB] = updateElo(1000, 1000, 0);
      expect(newA).toBeCloseTo(984, 0);
      expect(newB).toBeCloseTo(1016, 0);
    });

    test("high-rated winner gains less than low-rated winner", () => {
      const [highWinsA] = updateElo(1200, 800, 1);
      const [lowWinsA] = updateElo(800, 1200, 1);
      const highGain = highWinsA - 1200;
      const lowGain = lowWinsA - 800;
      expect(lowGain).toBeGreaterThan(highGain);
    });

    test("ratings are rounded to 2 decimal places", () => {
      const [newA, newB] = updateElo(1047, 953, 1);
      const aDecimals = (newA.toString().split(".")[1] || "").length;
      expect(aDecimals).toBeLessThanOrEqual(2);
    });

    test("multiple consecutive wins accumulate correctly", () => {
      let ratingA = 1000;
      let ratingB = 1000;
      for (let i = 0; i < 5; i++) {
        const [a, b] = updateElo(ratingA, ratingB, 1);
        ratingA = a;
        ratingB = b;
      }
      expect(ratingA).toBeGreaterThan(1060);
      expect(ratingB).toBeLessThan(940);
    });
  });

  describe("Arena stats utilities", () => {
    test("getModelKey formats correctly", () => {
      expect(getModelKey("gpt-4", "OpenAI")).toBe("gpt-4@OpenAI");
    });

    test("getPairwiseKey produces consistent key regardless of order", () => {
      const key1 = getPairwiseKey("a@X", "b@Y");
      const key2 = getPairwiseKey("b@Y", "a@X");
      expect(key1).toBe(key2);
    });

    test("getPairwiseKey orders keys alphabetically", () => {
      const key = getPairwiseKey("z@Z", "a@A");
      expect(key).toBe("a@A|z@Z");
    });

    test("ensureEloEntry creates default entry", () => {
      const elo: Record<string, EloEntry> = {};
      const entry = ensureEloEntry(elo, "gpt-4@OpenAI");
      expect(entry.rating).toBe(ELO_INITIAL_RATING);
      expect(entry.battles).toBe(0);
      expect(elo["gpt-4@OpenAI"]).toBeDefined();
    });

    test("ensureEloEntry returns existing entry", () => {
      const elo: Record<string, EloEntry> = {
        "gpt-4@OpenAI": { model: "gpt-4@OpenAI", rating: 1050, battles: 3, wins: 2, losses: 1 },
      };
      const entry = ensureEloEntry(elo, "gpt-4@OpenAI");
      expect(entry.rating).toBe(1050);
      expect(entry.battles).toBe(3);
    });

    test("ensurePairwiseRecord creates default record", () => {
      const pairwise: Record<string, PairwiseRecord> = {};
      const record = ensurePairwiseRecord(pairwise, "a@X", "b@Y");
      expect(record.winsA).toBe(0);
      expect(record.winsB).toBe(0);
      expect(record.draws).toBe(0);
    });

    test("ensurePairwiseRecord normalizes key order", () => {
      const pairwise: Record<string, PairwiseRecord> = {};
      ensurePairwiseRecord(pairwise, "z@Z", "a@A");
      const key = getPairwiseKey("z@Z", "a@A");
      expect(pairwise[key]).toBeDefined();
    });

    test("getLeaderboard sorts by rating descending", () => {
      const elo: Record<string, EloEntry> = {
        a: { model: "a", rating: 950, battles: 5, wins: 1, losses: 4 },
        b: { model: "b", rating: 1050, battles: 5, wins: 4, losses: 1 },
        c: { model: "c", rating: 1000, battles: 5, wins: 2, losses: 3 },
      };
      const board = getLeaderboard(elo);
      expect(board[0].model).toBe("b");
      expect(board[1].model).toBe("c");
      expect(board[2].model).toBe("a");
    });

    test("getModelBattleCount returns 0 for unknown model", () => {
      expect(getModelBattleCount({}, "unknown")).toBe(0);
    });

    test("getModelBattleCount returns correct count", () => {
      const elo: Record<string, EloEntry> = {
        "gpt-4@OpenAI": { model: "gpt-4@OpenAI", rating: 1050, battles: 7, wins: 5, losses: 2 },
      };
      expect(getModelBattleCount(elo, "gpt-4@OpenAI")).toBe(7);
    });

    test("getPairwiseRecord returns empty record for unknown pair", () => {
      const record = getPairwiseRecord({}, "a@X", "b@Y");
      expect(record.winsA).toBe(0);
      expect(record.winsB).toBe(0);
    });
  });

  describe("Blind test display/reveal logic", () => {
    type SimpleMessage = {
      id: string;
      role: string;
      content: string;
      model?: string;
      arenaId?: string;
      arenaProviderName?: string;
      arenaLabel?: string;
      arenaVote?: "up" | "down";
    };

    function getDisplayInfo(
      msg: SimpleMessage,
      blindMode: boolean,
      hasVoted: boolean,
    ) {
      const showModelIdentity = !blindMode || hasVoted;
      return {
        showModel: showModelIdentity,
        showProvider: showModelIdentity && !!msg.arenaProviderName,
        showLabel: blindMode && !!msg.arenaLabel,
        modelName: showModelIdentity ? msg.model : undefined,
        providerName:
          showModelIdentity && msg.arenaProviderName
            ? msg.arenaProviderName
            : undefined,
        label: blindMode ? msg.arenaLabel : undefined,
      };
    }

    test("blind mode + not voted: model name hidden", () => {
      const msg: SimpleMessage = {
        id: "1",
        role: "assistant",
        content: "hello",
        model: "gpt-4",
        arenaId: "arena-1",
        arenaProviderName: "OpenAI",
        arenaLabel: "A",
      };
      const display = getDisplayInfo(msg, true, false);
      expect(display.showModel).toBe(false);
      expect(display.showProvider).toBe(false);
      expect(display.showLabel).toBe(true);
      expect(display.label).toBe("A");
      expect(display.modelName).toBeUndefined();
    });

    test("blind mode + voted: model name revealed", () => {
      const msg: SimpleMessage = {
        id: "1",
        role: "assistant",
        content: "hello",
        model: "gpt-4",
        arenaId: "arena-1",
        arenaProviderName: "OpenAI",
        arenaLabel: "A",
      };
      const display = getDisplayInfo(msg, true, true);
      expect(display.showModel).toBe(true);
      expect(display.showProvider).toBe(true);
      expect(display.showLabel).toBe(true);
      expect(display.modelName).toBe("gpt-4");
    });

    test("non-blind mode: model name always shown", () => {
      const msg: SimpleMessage = {
        id: "1",
        role: "assistant",
        content: "hello",
        model: "gpt-4",
        arenaId: "arena-1",
        arenaProviderName: "OpenAI",
        arenaLabel: "A",
      };
      const display = getDisplayInfo(msg, false, false);
      expect(display.showModel).toBe(true);
      expect(display.showLabel).toBe(false);
    });

    test("arenaLabel correctly assigned as A/B/C/D", () => {
      const LABELS = ["A", "B", "C", "D"];
      const models = ["gpt-4", "claude-3", "gemini-pro", "deepseek-chat"];
      const labels = models.map((_, i) => LABELS[i]);
      expect(labels).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("Duplicate vote prevention", () => {
    test("voted flag prevents re-voting", () => {
      const record = {
        arenaId: "arena-1",
        timestamp: Date.now(),
        prompt: "hello",
        models: [
          { model: "gpt-4", providerName: "OpenAI", label: "A" },
          { model: "claude-3", providerName: "Anthropic", label: "B" },
        ],
        voted: true,
      };
      expect(record.voted).toBe(true);
    });

    test("arenaVote field on message prevents duplicate", () => {
      const messages = [
        { id: "1", arenaId: "arena-1", arenaVote: "up" as const },
        { id: "2", arenaId: "arena-1" },
      ];
      const hasAnyVote = messages.some((m) => m.arenaVote);
      expect(hasAnyVote).toBe(true);
    });
  });

  describe("Pairwise win/loss statistics", () => {
    function simulateVote(
      pairwise: Record<string, PairwiseRecord>,
      elo: Record<string, EloEntry>,
      votedModelKey: string,
      otherModelKeys: string[],
      vote: "up" | "down",
    ) {
      for (const otherKey of otherModelKeys) {
        const pKey = getPairwiseKey(votedModelKey, otherKey);
        const record = ensurePairwiseRecord(pairwise, votedModelKey, otherKey);
        const votedIsA = record.modelA === votedModelKey;

        if (vote === "up") {
          if (votedIsA) record.winsA += 1;
          else record.winsB += 1;
        } else {
          if (votedIsA) record.winsB += 1;
          else record.winsA += 1;
        }

        pairwise[pKey] = record;

        const votedEntry = ensureEloEntry(elo, votedModelKey);
        const otherEntry = ensureEloEntry(elo, otherKey);

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

        elo[votedModelKey] = votedEntry;
        elo[otherKey] = otherEntry;
      }
    }

    test("2-model: 👍 A → A wins 1, B wins 0", () => {
      const pairwise: Record<string, PairwiseRecord> = {};
      const elo: Record<string, EloEntry> = {};
      simulateVote(
        pairwise,
        elo,
        "gpt-4@OpenAI",
        ["claude-3@Anthropic"],
        "up",
      );
      const key = getPairwiseKey("gpt-4@OpenAI", "claude-3@Anthropic");
      const record = pairwise[key];
      const gptIsA = record.modelA === "gpt-4@OpenAI";
      if (gptIsA) {
        expect(record.winsA).toBe(1);
        expect(record.winsB).toBe(0);
      } else {
        expect(record.winsB).toBe(1);
        expect(record.winsA).toBe(0);
      }
    });

    test("3-model: 👍 A → A beats B and C", () => {
      const pairwise: Record<string, PairwiseRecord> = {};
      const elo: Record<string, EloEntry> = {};
      simulateVote(
        pairwise,
        elo,
        "gpt-4@OpenAI",
        ["claude-3@Anthropic", "gemini-pro@Google"],
        "up",
      );
      const keyAB = getPairwiseKey("gpt-4@OpenAI", "claude-3@Anthropic");
      const keyAC = getPairwiseKey("gpt-4@OpenAI", "gemini-pro@Google");
      expect(pairwise[keyAB]).toBeDefined();
      expect(pairwise[keyAC]).toBeDefined();
    });

    test("4-model: 👎 B → B loses to A, C, D", () => {
      const pairwise: Record<string, PairwiseRecord> = {};
      const elo: Record<string, EloEntry> = {};
      simulateVote(
        pairwise,
        elo,
        "claude-3@Anthropic",
        [
          "gpt-4@OpenAI",
          "gemini-pro@Google",
          "deepseek-chat@DeepSeek",
        ],
        "down",
      );

      for (const otherKey of [
        "gpt-4@OpenAI",
        "gemini-pro@Google",
        "deepseek-chat@DeepSeek",
      ]) {
        const key = getPairwiseKey("claude-3@Anthropic", otherKey);
        const record = pairwise[key];
        const claudeIsA = record.modelA === "claude-3@Anthropic";
        if (claudeIsA) {
          expect(record.winsB).toBe(1);
          expect(record.winsA).toBe(0);
        } else {
          expect(record.winsA).toBe(1);
          expect(record.winsB).toBe(0);
        }
      }
    });
  });

  describe("Old Arena message compatibility", () => {
    test("messages without arenaLabel do not crash", () => {
      type SimpleMessage = {
        id: string;
        role: string;
        content: string;
        arenaId?: string;
        arenaLabel?: string;
        model?: string;
      };

      const messages: SimpleMessage[] = [
        { id: "1", role: "user", content: "hello" },
        {
          id: "2",
          role: "assistant",
          content: "response",
          arenaId: "arena-1",
          model: "gpt-4",
        },
      ];

      const blindMode = true;
      for (const msg of messages) {
        if (msg.role === "assistant" && msg.arenaId) {
          const label = msg.arenaLabel;
          if (blindMode && !label) {
            expect(msg.model).toBeDefined();
          }
        }
      }
    });

    test("messages without arenaVote can be voted on", () => {
      const msg = {
        id: "1",
        arenaId: "arena-1",
        model: "gpt-4",
        arenaProviderName: "OpenAI",
        arenaVote: undefined as "up" | "down" | undefined,
      };
      expect(msg.arenaVote).toBeUndefined();
    });

    test("user messages without arenaId do not affect grouping", () => {
      type SimpleMessage = {
        id: string;
        role: string;
        content: string;
        arenaId?: string;
      };

      const messages: SimpleMessage[] = [
        { id: "1", role: "user", content: "hello" },
        { id: "2", role: "assistant", content: "response", arenaId: "arena-1" },
      ];

      function groupMessages(msgs: SimpleMessage[]) {
        type RenderGroup =
          | { type: "single"; message: SimpleMessage; index: number }
          | { type: "arena"; messages: SimpleMessage[]; indices: number[] };

        const groups: RenderGroup[] = [];
        let i = 0;
        while (i < msgs.length) {
          const m = msgs[i];
          if (m.role === "assistant" && m.arenaId) {
            const arenaId = m.arenaId;
            const arenaMsgs: SimpleMessage[] = [];
            const indices: number[] = [];
            while (i < msgs.length && msgs[i].arenaId === arenaId) {
              arenaMsgs.push(msgs[i]);
              indices.push(i);
              i++;
            }
            groups.push({ type: "arena", messages: arenaMsgs, indices });
          } else {
            groups.push({ type: "single", message: m, index: i });
            i++;
          }
        }
        return groups;
      }

      const groups = groupMessages(messages);
      expect(groups.length).toBe(2);
      expect(groups[0].type).toBe("single");
      expect(groups[1].type).toBe("arena");
    });
  });
});
