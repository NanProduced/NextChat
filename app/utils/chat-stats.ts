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

function getMessageTextContent(
  message: SimpleChatMessage,
): string {
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

export function calculateTotalSessions(
  sessions: SimpleChatSession[],
): number {
  return sessions.length;
}

export function calculateTotalMessages(
  sessions: SimpleChatSession[],
): number {
  return sessions.reduce((total, session) => total + session.messages.length, 0);
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

export function parseMessageDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
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
  const sessionInfo = sessions.map((session) => ({
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
