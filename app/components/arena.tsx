import React, { useMemo, RefObject } from "react";
import { useAllModels } from "../utils/hooks";
import { ChatMessage } from "../store";
import { ChatControllerPool } from "../client/controller";
import { IconButton } from "./button";
import Locale from "../locales";
import { getMessageTextContent } from "../utils";
import { getModelProvider } from "../utils/model";
import { ServiceProvider } from "../constant";
import StopIcon from "../icons/pause.svg";
import CloseIcon from "../icons/close.svg";
import styles from "./arena.module.scss";
import dynamic from "next/dynamic";
import { ModelSelector } from "./model-selector";

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <div className={styles["arena-loading"]}>...</div>,
});

export type ArenaModel = {
  model: string;
  providerName: string;
};

export function ArenaToggle(props: { enabled: boolean; onClick: () => void }) {
  return (
    <div
      className={`${styles["arena-toggle"]} ${
        props.enabled ? styles["arena-toggle-active"] : ""
      }`}
      onClick={props.onClick}
    >
      <span className={styles["arena-toggle-label"]}>
        {Locale.Chat.Arena.Toggle}
      </span>
      <div className={styles["arena-toggle-switch"]}>
        <div className={styles["arena-toggle-dot"]} />
      </div>
    </div>
  );
}

export function BlindModeToggle(props: {
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`${styles["arena-toggle"]} ${styles["arena-blind-toggle"]} ${
        props.enabled ? styles["arena-toggle-active"] : ""
      }`}
      onClick={props.onClick}
    >
      <span className={styles["arena-toggle-label"]}>
        {Locale.Chat.Arena.BlindToggle}
      </span>
      <div className={styles["arena-toggle-switch"]}>
        <div className={styles["arena-toggle-dot"]} />
      </div>
    </div>
  );
}

export function ArenaModelSelector(props: {
  selected: ArenaModel[];
  onChange: (models: ArenaModel[]) => void;
  onClose: () => void;
}) {
  const selectedValues = useMemo(
    () =>
      props.selected.map((s) => `${s.model}@${s.providerName}`),
    [props.selected],
  );

  const handleSelectionChange = (values: string[]) => {
    const newModels = values.map((v) => {
      const [model, providerName] = getModelProvider(v);
      return { model, providerName: providerName ?? ServiceProvider.OpenAI };
    });
    props.onChange(newModels);
  };

  return (
    <ModelSelector
      multiple={true}
      maxSelections={4}
      selectedValues={selectedValues}
      onSelection={handleSelectionChange}
      onClose={props.onClose}
      variant="compact"
    />
  );
}

function ArenaVoteButtons(props: {
  messageId: string;
  onVote: (messageId: string, vote: "up" | "down") => void;
}) {
  return (
    <div className={styles["arena-vote-row"]}>
      <button
        className={`${styles["arena-vote-btn"]} ${styles["arena-vote-btn-up"]}`}
        onClick={() => props.onVote(props.messageId, "up")}
      >
        {Locale.Chat.Arena.VoteUp}
      </button>
      <button
        className={`${styles["arena-vote-btn"]} ${styles["arena-vote-btn-down"]}`}
        onClick={() => props.onVote(props.messageId, "down")}
      >
        {Locale.Chat.Arena.VoteDown}
      </button>
    </div>
  );
}

export function ArenaResponseGrid(props: {
  messages: ChatMessage[];
  sessionId: string;
  fontSize: number;
  fontFamily: string;
  parentRef?: RefObject<HTMLDivElement>;
  blindMode?: boolean;
  hasVoted?: boolean;
  onVote?: (messageId: string, vote: "up" | "down") => void;
}) {
  const {
    messages,
    sessionId,
    fontSize,
    fontFamily,
    parentRef,
    blindMode = false,
    hasVoted = false,
    onVote,
  } = props;

  const columns = messages.length;

  const onStop = (messageId: string) => {
    ChatControllerPool.stop(sessionId, messageId);
  };

  const showModelIdentity = !blindMode || hasVoted;

  return (
    <div
      className={styles["arena-grid"]}
      style={{ "--arena-columns": columns } as React.CSSProperties}
    >
      {messages.map((msg) => (
        <div key={msg.id} className={styles["arena-column"]}>
          <div className={styles["arena-column-header"]}>
            {blindMode && msg.arenaLabel && (
              <div className={styles["arena-blind-label"]}>
                {msg.arenaLabel}
              </div>
            )}
            {showModelIdentity && (
              <div
                className={
                  blindMode && hasVoted
                    ? styles["arena-model-reveal"]
                    : undefined
                }
              >
                <div className={styles["arena-column-model"]}>
                  {msg.model || "unknown"}
                </div>
                {msg.arenaProviderName && (
                  <div className={styles["arena-column-provider"]}>
                    {msg.arenaProviderName}
                  </div>
                )}
              </div>
            )}
            {msg.streaming ? (
              <IconButton
                icon={<StopIcon />}
                text={Locale.Chat.Arena.Stop}
                className={styles["arena-stop-btn"]}
                onClick={() => onStop(msg.id)}
              />
            ) : null}
          </div>
          <div className={styles["arena-column-content"]}>
            {msg.streaming && !msg.content ? (
              <div className={styles["arena-streaming"]}>
                {Locale.Chat.Arena.Streaming}
              </div>
            ) : null}
            {msg.isError ? (
              <div className={styles["arena-error"]}>
                {Locale.Chat.Arena.Error}
              </div>
            ) : null}
            <Markdown
              key={msg.streaming ? "loading" : "done"}
              content={getMessageTextContent(msg)}
              loading={msg.streaming && msg.content.length === 0}
              fontSize={fontSize}
              fontFamily={fontFamily}
              parentRef={parentRef}
              defaultShow={true}
            />
          </div>
          {!msg.streaming &&
            !msg.isError &&
            onVote &&
            (hasVoted ? (
              <div className={styles["arena-vote-row"]}>
                <span className={styles["arena-vote-voted"]}>
                  {msg.arenaVote === "up" ? "👍" : msg.arenaVote === "down" ? "👎" : Locale.Chat.Arena.Voted}
                </span>
              </div>
            ) : (
              <ArenaVoteButtons
                messageId={msg.id}
                onVote={onVote}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
