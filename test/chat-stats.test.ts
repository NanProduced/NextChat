import type { SimpleChatMessage, SimpleChatSession, MessageRole } from "@/app/utils/chat-stats";
import {
  calculateTotalSessions,
  calculateTotalMessages,
  countMessagesByRole,
  calculateEstimatedTokens,
  parseMessageDate,
  formatDateKey,
  getLast7Days,
  calculateLast7DaysTrend,
  getTopLongestSessions,
  calculateChatStats,
  hasAnyData,
} from "@/app/utils/chat-stats";

function createMockMessage(
  role: MessageRole,
  content: string,
  date?: string,
): SimpleChatMessage {
  return {
    id: "msg-" + Math.random().toString(36).substr(2, 9),
    date: date || new Date().toLocaleString(),
    role,
    content,
  };
}

function createMockSession(
  messages: SimpleChatMessage[],
  topic: string = "Test Session",
): SimpleChatSession {
  return {
    id: "session-" + Math.random().toString(36).substr(2, 9),
    topic,
    messages,
  };
}

describe("chat-stats", () => {
  describe("calculateTotalSessions", () => {
    test("should return 0 for empty sessions array", () => {
      expect(calculateTotalSessions([])).toBe(0);
    });

    test("should return correct count for multiple sessions", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([]),
        createMockSession([]),
        createMockSession([]),
      ];
      expect(calculateTotalSessions(sessions)).toBe(3);
    });
  });

  describe("calculateTotalMessages", () => {
    test("should return 0 for empty sessions", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([]),
        createMockSession([]),
      ];
      expect(calculateTotalMessages(sessions)).toBe(0);
    });

    test("should return correct total message count", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([
          createMockMessage("user", "Hello"),
          createMockMessage("assistant", "Hi there!"),
        ]),
        createMockSession([createMockMessage("user", "How are you?")]),
      ];
      expect(calculateTotalMessages(sessions)).toBe(3);
    });
  });

  describe("countMessagesByRole", () => {
    test("should return 0 when no messages match the role", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([createMockMessage("user", "Hello")]),
      ];
      expect(countMessagesByRole(sessions, "assistant")).toBe(0);
    });

    test("should return correct count for user messages", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([
          createMockMessage("user", "Hello"),
          createMockMessage("assistant", "Hi"),
          createMockMessage("user", "How are you?"),
        ]),
        createMockSession([createMockMessage("user", "Good morning")]),
      ];
      expect(countMessagesByRole(sessions, "user")).toBe(3);
    });

    test("should return correct count for assistant messages", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([
          createMockMessage("user", "Hello"),
          createMockMessage("assistant", "Hi"),
        ]),
        createMockSession([
          createMockMessage("assistant", "How can I help?"),
          createMockMessage("assistant", "Anything else?"),
        ]),
      ];
      expect(countMessagesByRole(sessions, "assistant")).toBe(3);
    });
  });

  describe("calculateEstimatedTokens", () => {
    test("should return 0 for empty sessions", () => {
      const sessions: SimpleChatSession[] = [createMockSession([])];
      expect(calculateEstimatedTokens(sessions)).toBe(0);
    });

    test("should calculate estimated tokens correctly for ASCII text", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([createMockMessage("user", "Hello World")]),
      ];
      const tokens = calculateEstimatedTokens(sessions);
      expect(tokens).toBeGreaterThan(0);
    });

    test("should calculate estimated tokens correctly for Unicode text", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([createMockMessage("user", "你好世界")]),
      ];
      const tokens = calculateEstimatedTokens(sessions);
      expect(tokens).toBeGreaterThan(0);
    });

    test("should handle multimodal content correctly", () => {
      const multimodalMessage: SimpleChatMessage = {
        id: "msg-1",
        date: new Date().toLocaleString(),
        role: "user",
        content: [
          { type: "text", text: "Describe this image" },
          { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
        ],
      };
      const sessions: SimpleChatSession[] = [
        createMockSession([multimodalMessage]),
      ];
      const tokens = calculateEstimatedTokens(sessions);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("parseMessageDate", () => {
    test("should parse valid date string", () => {
      const date = parseMessageDate("2024-01-15 10:30:00");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });

    test("should return null for invalid date string", () => {
      expect(parseMessageDate("invalid-date")).toBeNull();
      expect(parseMessageDate("")).toBeNull();
    });
  });

  describe("formatDateKey", () => {
    test("should format date correctly", () => {
      const date = new Date(2024, 0, 15, 10, 30, 0);
      expect(formatDateKey(date)).toBe("2024-01-15");
    });

    test("should pad single digit month and day", () => {
      const date = new Date(2024, 3, 5, 10, 30, 0);
      expect(formatDateKey(date)).toBe("2024-04-05");
    });
  });

  describe("getLast7Days", () => {
    test("should return 7 days", () => {
      const days = getLast7Days();
      expect(days.length).toBe(7);
    });

    test("should return dates in ascending order", () => {
      const days = getLast7Days();
      for (let i = 1; i < days.length; i++) {
        expect(days[i] > days[i - 1]).toBe(true);
      }
    });
  });

  describe("calculateLast7DaysTrend", () => {
    test("should return 7 days with zero counts for empty sessions", () => {
      const trend = calculateLast7DaysTrend([]);
      expect(trend.length).toBe(7);
      trend.forEach((day) => {
        expect(day.count).toBe(0);
      });
    });

    test("should count messages for today", () => {
      const today = new Date();
      const sessions: SimpleChatSession[] = [
        createMockSession([
          createMockMessage("user", "Hello", today.toLocaleString()),
          createMockMessage("assistant", "Hi", today.toLocaleString()),
        ]),
      ];

      const trend = calculateLast7DaysTrend(sessions);
      const todayKey = formatDateKey(today);
      const todayData = trend.find((d) => d.date === todayKey);

      expect(todayData?.count).toBe(2);
    });

    test("should not count messages older than 7 days", () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const sessions: SimpleChatSession[] = [
        createMockSession([
          createMockMessage("user", "Old message", twoWeeksAgo.toLocaleString()),
        ]),
      ];

      const trend = calculateLast7DaysTrend(sessions);
      const totalCount = trend.reduce((sum, day) => sum + day.count, 0);

      expect(totalCount).toBe(0);
    });
  });

  describe("getTopLongestSessions", () => {
    test("should return empty array for empty sessions", () => {
      expect(getTopLongestSessions([])).toEqual([]);
    });

    test("should return sessions sorted by message count descending", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession(
          [
            createMockMessage("user", "1"),
            createMockMessage("assistant", "1"),
          ],
          "Session A - 2 messages",
        ),
        createMockSession(
          [
            createMockMessage("user", "1"),
            createMockMessage("assistant", "1"),
            createMockMessage("user", "2"),
            createMockMessage("assistant", "2"),
            createMockMessage("user", "3"),
          ],
          "Session B - 5 messages",
        ),
        createMockSession(
          [createMockMessage("user", "1")],
          "Session C - 1 message",
        ),
      ];

      const topSessions = getTopLongestSessions(sessions, 5);

      expect(topSessions[0].messageCount).toBe(5);
      expect(topSessions[1].messageCount).toBe(2);
      expect(topSessions[2].messageCount).toBe(1);
    });

    test("should respect the topN parameter", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([createMockMessage("user", "1")], "Session 1"),
        createMockSession([createMockMessage("user", "2")], "Session 2"),
        createMockSession([createMockMessage("user", "3")], "Session 3"),
        createMockSession([createMockMessage("user", "4")], "Session 4"),
        createMockSession([createMockMessage("user", "5")], "Session 5"),
        createMockSession([createMockMessage("user", "6")], "Session 6"),
      ];

      const top3 = getTopLongestSessions(sessions, 3);
      expect(top3.length).toBe(3);
    });
  });

  describe("calculateChatStats", () => {
    test("should return complete stats object", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession(
          [
            createMockMessage("user", "Hello"),
            createMockMessage("assistant", "Hi there!"),
          ],
          "First Session",
        ),
      ];

      const stats = calculateChatStats(sessions);

      expect(stats.summary.totalSessions).toBe(1);
      expect(stats.summary.totalMessages).toBe(2);
      expect(stats.summary.userMessages).toBe(1);
      expect(stats.summary.assistantMessages).toBe(1);
      expect(stats.last7DaysTrend.length).toBe(7);
      expect(stats.topSessions.length).toBe(1);
    });
  });

  describe("hasAnyData", () => {
    test("should return false for empty sessions", () => {
      expect(hasAnyData([])).toBe(false);
      expect(hasAnyData([createMockSession([])])).toBe(false);
    });

    test("should return true for sessions with messages", () => {
      const sessions: SimpleChatSession[] = [
        createMockSession([createMockMessage("user", "Hello")]),
      ];
      expect(hasAnyData(sessions)).toBe(true);
    });
  });
});
