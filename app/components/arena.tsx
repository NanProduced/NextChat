import React, { useMemo, RefObject } from "react";
import { useAllModels } from "../utils/hooks";
import { ChatMessage } from "../store";
import { ChatControllerPool } from "../client/controller";
import { IconButton } from "./button";
import Locale from "../locales";
import { getMessageTextContent } from "../utils";
import { ServiceProvider } from "../constant";
import StopIcon from "../icons/pause.svg";
import CloseIcon from "../icons/close.svg";
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

export function ArenaResponseGrid(props: {
  messages: ChatMessage[];
  sessionId: string;
  fontSize: number;
  fontFamily: string;
  parentRef?: RefObject<HTMLDivElement>;
}) {
  const { messages, sessionId, fontSize, fontFamily, parentRef } = props;

  const columns = messages.length;

  const onStop = (messageId: string) => {
    ChatControllerPool.stop(sessionId, messageId);
  };

  return (
    <div
      className={styles["arena-grid"]}
      style={{ "--arena-columns": columns } as React.CSSProperties}
    >
      {messages.map((msg) => (
        <div key={msg.id} className={styles["arena-column"]}>
          <div className={styles["arena-column-header"]}>
            <div className={styles["arena-column-model"]}>
              {msg.model || "unknown"}
            </div>
            {msg.arenaProviderName && (
              <div className={styles["arena-column-provider"]}>
                {msg.arenaProviderName}
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
        </div>
      ))}
    </div>
  );
}
