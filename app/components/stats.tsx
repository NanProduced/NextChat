import { useMemo } from "react";
import styles from "./stats.module.scss";
import { ErrorBoundary } from "./error";
import { useNavigate } from "react-router-dom";
import { IconButton } from "./button";
import CloseIcon from "../icons/close.svg";
import Locale from "../locales";
import { Path } from "../constant";
import { useChatStore } from "../store";
import {
  calculateChatStats,
  hasAnyData,
  parseDateKeyToMonthDay,
} from "../utils/chat-stats";
import { List, ListItem } from "./ui-lib";

function EmptyState() {
  return (
    <div className={styles["empty-state"]}>
      <div className={styles["empty-state-icon"]}>📊</div>
      <div className={styles["empty-state-title"]}>
        {Locale.Stats.Page.NoData}
      </div>
      <div className={styles["empty-state-subtitle"]}>
        {Locale.Stats.Page.NoDataSubTitle}
      </div>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  const formattedValue =
    typeof props.value === "number" && props.value >= 1000
      ? `${(props.value / 1000).toFixed(1)}k`
      : props.value;

  return (
    <div
      className={styles["stat-card"]}
      data-highlight={props.highlight ? "true" : undefined}
    >
      <div className={styles["stat-card-value"]}>{formattedValue}</div>
      <div className={styles["stat-card-label"]}>{props.label}</div>
    </div>
  );
}

function TrendChart(props: { data: Array<{ date: string; count: number }> }) {
  const maxCount = useMemo(() => {
    return Math.max(...props.data.map((d) => d.count), 1);
  }, [props.data]);

  const getDayLabel = (dateStr: string) => {
    const parsed = parseDateKeyToMonthDay(dateStr);
    if (parsed) {
      return Locale.Stats.Trend.Day(`${parsed.month}/${parsed.day}`);
    }
    return dateStr;
  };

  return (
    <div className={styles["trend-chart"]}>
      <div className={styles["trend-chart-bars"]}>
        {props.data.map((item, index) => {
          const heightPercent =
            maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div key={index} className={styles["trend-bar"]}>
              <div className={styles["trend-bar-container"]}>
                <div
                  className={styles["trend-bar-fill"]}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <div className={styles["trend-bar-label"]}>
                {getDayLabel(item.date)}
              </div>
              <div className={styles["trend-bar-count"]}>{item.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopSessionsList(props: {
  sessions: Array<{ id: string; topic: string; messageCount: number }>;
  onViewSession: (sessionId: string) => void;
}) {
  if (props.sessions.length === 0) {
    return (
      <div className={styles["empty-list"]}>{Locale.Stats.Page.NoData}</div>
    );
  }

  return (
    <List>
      {props.sessions.map((session, index) => (
        <ListItem
          key={session.id}
          title={session.topic || `Session ${index + 1}`}
          subTitle={`${session.messageCount} ${Locale.Stats.TopSessions.Messages}`}
        >
          <IconButton
            text={Locale.Stats.TopSessions.View}
            onClick={() => props.onViewSession(session.id)}
          />
        </ListItem>
      ))}
    </List>
  );
}

export function StatsPage() {
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const sessions = chatStore.sessions;

  const stats = useMemo(() => {
    return calculateChatStats(sessions as any);
  }, [sessions]);

  const hasData = useMemo(() => {
    return hasAnyData(sessions as any);
  }, [sessions]);

  const handleViewSession = (sessionId: string) => {
    const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex !== -1) {
      chatStore.selectSession(sessionIndex);
      navigate(Path.Chat);
    }
  };

  return (
    <ErrorBoundary>
      <div className={styles["stats-page"]}>
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              {Locale.Stats.Page.Title}
            </div>
            <div className="window-header-submai-title">
              {Locale.Stats.Page.SubTitle}
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
              />
            </div>
          </div>
        </div>

        <div className={styles["stats-page-body"]}>
          {!hasData ? (
            <EmptyState />
          ) : (
            <>
              <div className={styles["stats-section"]}>
                <div className={styles["stats-section-title"]}>
                  {Locale.Stats.Summary.Title}
                </div>
                <div className={styles["stats-cards"]}>
                  <StatCard
                    label={Locale.Stats.Summary.TotalSessions}
                    value={stats.summary.totalSessions}
                  />
                  <StatCard
                    label={Locale.Stats.Summary.TotalMessages}
                    value={stats.summary.totalMessages}
                    highlight
                  />
                  <StatCard
                    label={Locale.Stats.Summary.UserMessages}
                    value={stats.summary.userMessages}
                  />
                  <StatCard
                    label={Locale.Stats.Summary.AssistantMessages}
                    value={stats.summary.assistantMessages}
                  />
                  <StatCard
                    label={Locale.Stats.Summary.EstimatedTokens}
                    value={stats.summary.estimatedTokens}
                  />
                </div>
              </div>

              <div className={styles["stats-section"]}>
                <div className={styles["stats-section-title"]}>
                  {Locale.Stats.Trend.Title}
                </div>
                <TrendChart data={stats.last7DaysTrend} />
              </div>

              <div className={styles["stats-section"]}>
                <div className={styles["stats-section-title"]}>
                  {Locale.Stats.TopSessions.Title}
                </div>
                <TopSessionsList
                  sessions={stats.topSessions}
                  onViewSession={handleViewSession}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
