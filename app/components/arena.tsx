import React, { useMemo, RefObject, useCallback } from "react";
import { useAllModels } from "../utils/hooks";
import { ChatMessage } from "../store";
import { ChatControllerPool } from "../client/controller";
import { IconButton } from "./button";
import Locale from "../locales";
import { getMessageTextContent } from "../utils";
import { ServiceProvider } from "../constant";
import StopIcon from "../icons/pause.svg";
import CloseIcon from "../icons/close.svg";
import {
  useArenaStore,
  VoteResult,
  ArenaDuelRecord,
} from "../store/arena";
import styles from "./arena.module.scss";
import dynamic from "next/dynamic";

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

export function ArenaModelSelector(props: {
  selected: ArenaModel[];
  onChange: (models: ArenaModel[]) => void;
  onClose: () => void;
}) {
  const allModels = useAllModels();
  const availableModels = useMemo(
    () => allModels.filter((m) => m.available),
    [allModels],
  );

  const isSelected = (model: string, providerName: string) =>
    props.selected.some(
      (s) => s.model === model && s.providerName === providerName,
    );

  const toggleModel = (model: string, providerName: string) => {
    if (isSelected(model, providerName)) {
      props.onChange(
        props.selected.filter(
          (s) => !(s.model === model && s.providerName === providerName),
        ),
      );
    } else {
      if (props.selected.length >= 4) return;
      props.onChange([...props.selected, { model, providerName }]);
    }
  };

  return (
    <div className={styles["arena-model-selector"]}>
      <div className={styles["arena-model-selector-header"]}>
        <span className={styles["arena-model-selector-title"]}>
          {Locale.Chat.Arena.SelectModels}
        </span>
        <span className={styles["arena-model-selector-count"]}>
          {Locale.Chat.Arena.ModelCount(props.selected.length)}
        </span>
        <IconButton
          icon={<CloseIcon />}
          text={Locale.Chat.Arena.Close}
          onClick={props.onClose}
          className={styles["arena-model-selector-close"]}
        />
      </div>
      <div className={styles["arena-model-selector-list"]}>
        {availableModels.map((m) => {
          const providerName =
            m.provider?.providerName ?? (ServiceProvider.OpenAI as string);
          const selected = isSelected(m.name, providerName);
          const disabled = !selected && props.selected.length >= 4;
          return (
            <div
              key={`${m.name}@${providerName}`}
              className={`${styles["arena-model-item"]} ${
                selected ? styles["arena-model-item-selected"] : ""
              } ${disabled ? styles["arena-model-item-disabled"] : ""}`}
              onClick={() => {
                if (!disabled) toggleModel(m.name, providerName);
              }}
            >
              <div className={styles["arena-model-checkbox"]}>
                {selected && "✓"}
              </div>
              <div className={styles["arena-model-info"]}>
                <span className={styles["arena-model-name"]}>
                  {m.displayName || m.name}
                </span>
                <span className={styles["arena-model-provider"]}>
                  {providerName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {props.selected.length < 2 && (
        <div className={styles["arena-model-selector-hint"]}>
          {Locale.Chat.Arena.MinModels}
        </div>
      )}
    </div>
  );
}

type VotePanelProps = {
  duel: ArenaDuelRecord | undefined;
  messages: ChatMessage[];
  onVote: (blindLabel: string, vote: VoteResult) => void;
  onVoteTie: () => void;
  onReveal: () => void;
};

function VotePanel(props: VotePanelProps) {
  const { duel, messages, onVote, onVoteTie, onReveal } = props;

  if (!duel) return null;

  const allVoted = Object.values(duel.votes).every((v) => v !== null);
  const isRevealed = duel.isRevealed;

  const getBetterCount = () =>
    Object.values(duel.votes).filter((v) => v === VoteResult.Better).length;
  const getWorseCount = () =>
    Object.values(duel.votes).filter((v) => v === VoteResult.Worse).length;

  return (
    <div className={styles["arena-vote-panel"]}>
      {!isRevealed ? (
        <>
          <div className={styles["arena-vote-title"]}>
            {Locale.Chat.Arena.BlindTestTitle}
          </div>
          <div className={styles["arena-vote-hint"]}>
            {Locale.Chat.Arena.BlindTestHint}
          </div>
          <div className={styles["arena-vote-actions"]}>
            <button
              className={`${styles["arena-vote-btn"]} ${
                styles["arena-vote-btn-tie"]
              }`}
              onClick={onVoteTie}
              disabled={allVoted}
            >
              {Locale.Chat.Arena.VoteTie}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles["arena-vote-result-title"]}>
            {Locale.Chat.Arena.VoteResultTitle}
          </div>
          <div className={styles["arena-vote-revealed"]}>
            {duel.models.map((m) => {
              const vote = duel.votes[m.blindLabel];
              return (
                <div
                  key={m.blindLabel}
                  className={`${styles["arena-vote-revealed-item"]} ${
                    vote === VoteResult.Better
                      ? styles["arena-vote-revealed-winner"]
                      : vote === VoteResult.Worse
                      ? styles["arena-vote-revealed-loser"]
                      : styles["arena-vote-revealed-tie"]
                  }`}
                >
                  <span className={styles["arena-vote-revealed-label"]}>
                    {m.blindLabel}
                  </span>
                  <span className={styles["arena-vote-revealed-arrow"]}>
                    →
                  </span>
                  <span className={styles["arena-vote-revealed-model"]}>
                    {m.model}
                  </span>
                  <span className={styles["arena-vote-revealed-provider"]}>
                    ({m.providerName})
                  </span>
                  <span
                    className={`${styles["arena-vote-revealed-badge"]} ${
                      vote === VoteResult.Better
                        ? styles["arena-vote-badge-better"]
                        : vote === VoteResult.Worse
                        ? styles["arena-vote-badge-worse"]
                        : styles["arena-vote-badge-tie"]
                    }`}
                  >
                    {vote === VoteResult.Better
                      ? Locale.Chat.Arena.VoteBetter
                      : vote === VoteResult.Worse
                      ? Locale.Chat.Arena.VoteWorse
                      : Locale.Chat.Arena.VoteTie}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

type ColumnVoteButtonsProps = {
  blindLabel: string;
  vote: VoteResult | null;
  onVote: (blindLabel: string, vote: VoteResult) => void;
  isRevealed: boolean;
  hasAnyVote: boolean;
};

function ColumnVoteButtons(props: ColumnVoteButtonsProps) {
  const { blindLabel, vote, onVote, isRevealed, hasAnyVote } = props;

  if (isRevealed) return null;

  const canVote = !hasAnyVote || vote !== null;

  return (
    <div className={styles["arena-column-vote"]}>
      <button
        className={`${styles["arena-column-vote-btn"]} ${
          styles["arena-column-vote-better"]
        } ${vote === VoteResult.Better ? styles["arena-column-vote-active"] : ""}`}
        onClick={() => onVote(blindLabel, VoteResult.Better)}
        disabled={!canVote}
        title={Locale.Chat.Arena.VoteBetter}
      >
        <span className={styles["arena-column-vote-icon"]}>👍</span>
        <span className={styles["arena-column-vote-text"]}>
          {Locale.Chat.Arena.VoteBetter}
        </span>
      </button>
      <button
        className={`${styles["arena-column-vote-btn"]} ${
          styles["arena-column-vote-worse"]
        } ${vote === VoteResult.Worse ? styles["arena-column-vote-active"] : ""}`}
        onClick={() => onVote(blindLabel, VoteResult.Worse)}
        disabled={!canVote}
        title={Locale.Chat.Arena.VoteWorse}
      >
        <span className={styles["arena-column-vote-icon"]}>👎</span>
        <span className={styles["arena-column-vote-text"]}>
          {Locale.Chat.Arena.VoteWorse}
        </span>
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
}) {
  const { messages, sessionId, fontSize, fontFamily, parentRef } = props;
  const {
    getDuelByArenaId,
    submitVote,
    submitTieVote,
    revealAndComplete,
  } = useArenaStore();

  const arenaMessages = messages.filter((m) => m.arenaId);
  const arenaId = arenaMessages[0]?.arenaId;

  const duel = arenaId ? getDuelByArenaId(arenaId) : undefined;

  const allStreaming = arenaMessages.every((m) => m.streaming);
  const anyError = arenaMessages.some((m) => m.isError);

  const handleVote = useCallback(
    (blindLabel: string, vote: VoteResult) => {
      if (!arenaId) return;
      const success = submitVote(arenaId, blindLabel, vote);
      if (success) {
        const currentDuel = getDuelByArenaId(arenaId);
        if (currentDuel) {
          const betterCount = Object.values(currentDuel.votes).filter(
            (v) => v === VoteResult.Better,
          ).length;
          const worseCount = Object.values(currentDuel.votes).filter(
            (v) => v === VoteResult.Worse,
          ).length;
          const nullCount = Object.values(currentDuel.votes).filter(
            (v) => v === null,
          ).length;

          if (
            (betterCount === 1 && worseCount === 1) ||
            (betterCount + worseCount >= 2 && nullCount === 0)
          ) {
            revealAndComplete(arenaId);
          }
        }
      }
    },
    [arenaId, submitVote, getDuelByArenaId, revealAndComplete],
  );

  const handleVoteTie = useCallback(() => {
    if (!arenaId) return;
    submitTieVote(arenaId);
  }, [arenaId, submitTieVote]);

  const handleReveal = useCallback(() => {
    if (!arenaId) return;
    revealAndComplete(arenaId);
  }, [arenaId, revealAndComplete]);

  const getBlindLabelForMessage = useCallback(
    (msg: ChatMessage): string => {
      if (!duel) {
        const modelIndex = arenaMessages.findIndex((m) => m.id === msg.id);
        return String.fromCharCode(65 + modelIndex);
      }
      const model = duel.models.find(
        (m) => m.model === msg.model && m.providerName === msg.arenaProviderName,
      );
      return model?.blindLabel ?? String.fromCharCode(65 + arenaMessages.findIndex((m) => m.id === msg.id));
    },
    [duel, arenaMessages],
  );

  const shouldShowVoteButtons =
    !allStreaming &&
    !anyError &&
    duel &&
    !duel.isRevealed &&
    arenaMessages.length >= 2;

  const hasAnyVote = duel ? Object.values(duel.votes).some((v) => v !== null) : false;
  const allVoted = duel ? Object.values(duel.votes).every((v) => v !== null) : false;

  const columns = arenaMessages.length;

  const onStop = (messageId: string) => {
    ChatControllerPool.stop(sessionId, messageId);
  };

  const displayModelName = (msg: ChatMessage): string => {
    if (!duel) return msg.model || "unknown";

    const blindLabel = getBlindLabelForMessage(msg);

    if (duel.isRevealed) {
      const model = duel.models.find((m) => m.blindLabel === blindLabel);
      if (model) {
        return `${blindLabel}: ${model.model}`;
      }
    }

    return blindLabel;
  };

  const displayProviderName = (msg: ChatMessage): string | undefined => {
    if (!duel || !duel.isRevealed) return undefined;
    return msg.arenaProviderName;
  };

  return (
    <div>
      {shouldShowVoteButtons && (
        <VotePanel
          duel={duel}
          messages={arenaMessages}
          onVote={handleVote}
          onVoteTie={handleVoteTie}
          onReveal={handleReveal}
        />
      )}

      <div
        className={styles["arena-grid"]}
        style={{ "--arena-columns": columns } as React.CSSProperties}
      >
        {arenaMessages.map((msg) => {
          const blindLabel = getBlindLabelForMessage(msg);
          const vote = duel?.votes[blindLabel] ?? null;

          return (
            <div
              key={msg.id}
              className={`${styles["arena-column"]} ${
                duel?.isRevealed && vote === VoteResult.Better
                  ? styles["arena-column-winner"]
                  : ""
              } ${
                duel?.isRevealed && vote === VoteResult.Worse
                  ? styles["arena-column-loser"]
                  : ""
              }`}
            >
              <div className={styles["arena-column-header"]}>
                <div className={styles["arena-column-model-info"]}>
                  <div
                    className={`${styles["arena-column-model"]} ${
                      !duel?.isRevealed ? styles["arena-column-model-blind"] : ""
                    }`}
                  >
                    {displayModelName(msg)}
                  </div>
                  {displayProviderName(msg) && (
                    <div className={styles["arena-column-provider"]}>
                      {displayProviderName(msg)}
                    </div>
                  )}
                </div>
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
              {shouldShowVoteButtons && (
                <ColumnVoteButtons
                  blindLabel={blindLabel}
                  vote={vote}
                  onVote={handleVote}
                  isRevealed={duel?.isRevealed ?? false}
                  hasAnyVote={hasAnyVote}
                />
              )}
            </div>
          );
        })}
      </div>

      {allVoted && duel && !duel.isRevealed && (
        <div className={styles["arena-reveal-section"]}>
          <button
            className={styles["arena-reveal-btn"]}
            onClick={handleReveal}
          >
            {Locale.Chat.Arena.RevealResult}
          </button>
        </div>
      )}
    </div>
  );
}
