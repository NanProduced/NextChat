type MessageRole = "user" | "assistant" | "system" | "function";

type MultimodalContent = {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
};

interface SimpleChatMessage {
  id: string;
  date: string;
  role: MessageRole;
  content: string | MultimodalContent[];
}

interface SimpleChatSession {
  id: string;
  topic: string;
  messages: SimpleChatMessage[];
}

export interface ChatStatsSummary {
  totalSessions: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  estimatedTokens: number;
}

export interface DailyMessageCount {
  date: string;
  count: number;
}

export interface TopSession {
  id: string;
  topic: string;
  messageCount: number;
}

export interface ChatStatsResult {
  summary: ChatStatsSummary;
  last7DaysTrend: DailyMessageCount[];
  topSessions: TopSession[];
}

function estimateTokenLength(input: string): number {
  let tokenLength = 0;

  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);

    if (charCode < 128) {
      if (charCode <= 122 && charCode >= 65) {
        tokenLength += 0.25;
      } else {
        tokenLength += 0.5;
      }
    } else {
      tokenLength += 1.5;
    }
  }

  return tokenLength;
}

function getMessageTextContent(message: SimpleChatMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  for (const c of message.content) {
    if (c.type === "text") {
      return c.text ?? "";
    }
  }
  return "";
}

export function calculateTotalSessions(sessions: SimpleChatSession[]): number {
  return sessions.length;
}

export function calculateTotalMessages(sessions: SimpleChatSession[]): number {
  return sessions.reduce(
    (total, session) => total + session.messages.length,
    0,
  );
}

export function countMessagesByRole(
  sessions: SimpleChatSession[],
  role: MessageRole,
): number {
  return sessions.reduce(
    (total, session) =>
      total + session.messages.filter((msg) => msg.role === role).length,
    0,
  );
}

export function calculateEstimatedTokens(
  sessions: SimpleChatSession[],
): number {
  let totalTokens = 0;

  for (const session of sessions) {
    for (const message of session.messages) {
      const textContent = getMessageTextContent(message);
      totalTokens += estimateTokenLength(textContent);
    }
  }

  return Math.round(totalTokens);
}

function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

function parseDateComponents(
  dateStr: string,
): { year: number; month: number; day: number } | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const timeSeparatorIndex = trimmed.search(/[T ]/);
  const datePart =
    timeSeparatorIndex !== -1 ? trimmed.slice(0, timeSeparatorIndex) : trimmed;

  if (datePart.includes("-")) {
    const parts = datePart.split("-");
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (
        !isNaN(year) &&
        !isNaN(month) &&
        !isNaN(day) &&
        year >= 2000 &&
        year <= 2100 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return { year, month, day };
      }
    }
  }

  if (datePart.includes("/")) {
    const parts = datePart.split("/").filter((p) => p.length > 0);
    if (parts.length >= 3) {
      const numParts = parts.map((p) => parseInt(p, 10));
      const [p1, p2, p3] = numParts;

      if (numParts.some(isNaN)) return null;

      if (p1 >= 2000 && p1 <= 2100) {
        return { year: p1, month: p2, day: p3 };
      }

      if (p3 >= 2000 && p3 <= 2100) {
        if (p1 > 12) {
          return { year: p3, month: p2, day: p1 };
        }
        if (p2 > 12) {
          return { year: p3, month: p1, day: p2 };
        }
        return { year: p3, month: p1, day: p2 };
      }
    }
  }

  return null;
}

export function parseMessageDate(dateStr: string): Date | null {
  try {
    if (!dateStr || typeof dateStr !== "string") {
      return null;
    }

    const components = parseDateComponents(dateStr);
    if (!components) {
      const directDate = new Date(dateStr);
      if (!isNaN(directDate.getTime())) {
        return directDate;
      }
      return null;
    }

    const { year, month, day } = components;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  } catch {
    return null;
  }
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKeyToMonthDay(
  dateKey: string,
): { month: number; day: number } | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { month, day };
}

export function getLast7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(formatDateKey(date));
  }

  return days;
}

export function calculateLast7DaysTrend(
  sessions: SimpleChatSession[],
): DailyMessageCount[] {
  const last7Days = getLast7Days();
  const messageCounts: Record<string, number> = {};

  for (const day of last7Days) {
    messageCounts[day] = 0;
  }

  for (const session of sessions) {
    for (const message of session.messages) {
      const date = parseMessageDate(message.date);
      if (!date) continue;

      const dateKey = formatDateKey(date);
      if (messageCounts.hasOwnProperty(dateKey)) {
        messageCounts[dateKey]++;
      }
    }
  }

  return last7Days.map((day) => ({
    date: day,
    count: messageCounts[day] || 0,
  }));
}

export function getTopLongestSessions(
  sessions: SimpleChatSession[],
  topN: number = 5,
): TopSession[] {
  const sessionInfo = sessions
    .filter((session) => session.messages.length > 0)
    .map((session) => ({
      id: session.id,
      topic: session.topic,
      messageCount: session.messages.length,
    }));

  sessionInfo.sort((a, b) => b.messageCount - a.messageCount);

  return sessionInfo.slice(0, topN);
}

export function calculateChatStats(
  sessions: SimpleChatSession[],
): ChatStatsResult {
  return {
    summary: {
      totalSessions: calculateTotalSessions(sessions),
      totalMessages: calculateTotalMessages(sessions),
      userMessages: countMessagesByRole(sessions, "user"),
      assistantMessages: countMessagesByRole(sessions, "assistant"),
      estimatedTokens: calculateEstimatedTokens(sessions),
    },
    last7DaysTrend: calculateLast7DaysTrend(sessions),
    topSessions: getTopLongestSessions(sessions, 5),
  };
}

export function hasAnyData(sessions: SimpleChatSession[]): boolean {
  return calculateTotalMessages(sessions) > 0;
}

export type { SimpleChatMessage, SimpleChatSession, MessageRole };
