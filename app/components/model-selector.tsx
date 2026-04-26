import React, { useMemo, useState } from "react";
import { useAllModels } from "../utils/hooks";
import { Avatar } from "./emoji";
import { IconButton } from "./button";
import Locale from "../locales";
import { ServiceProvider } from "../constant";
import { getModelProvider } from "../utils/model";
import CloseIcon from "../icons/close.svg";
import styles from "./model-selector.module.scss";

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export type ModelOption = {
  name: string;
  providerName: string;
  displayName: string;
  available: boolean;
  isDefault: boolean;
};

export function useModelOptions(): ModelOption[] {
  const allModels = useAllModels();
  return useMemo(() => {
    const available = allModels.filter((m) => m.available);
    const defaultModel = available.find((m) => m.isDefault);
    if (defaultModel) {
      return [
        {
          name: defaultModel.name,
          providerName:
            defaultModel.provider?.providerName ?? ServiceProvider.OpenAI,
          displayName: defaultModel.displayName || defaultModel.name,
          available: defaultModel.available,
          isDefault: true,
        },
        ...available
          .filter((m) => m !== defaultModel)
          .map((m) => ({
            name: m.name,
            providerName: m.provider?.providerName ?? ServiceProvider.OpenAI,
            displayName: m.displayName || m.name,
            available: m.available,
            isDefault: false,
          })),
      ];
    }
    return available.map((m) => ({
      name: m.name,
      providerName: m.provider?.providerName ?? ServiceProvider.OpenAI,
      displayName: m.displayName || m.name,
      available: m.available,
      isDefault: false,
    }));
  }, [allModels]);
}

type ArenaPreset = {
  label: string;
  models: string[];
};

const ARENA_PRESETS: ArenaPreset[] = [
  {
    label: Locale.Chat.Arena.PresetGPTvsClaude,
    models: ["gpt-4o@OpenAI", "claude-3-5-sonnet-20240620@Anthropic"],
  },
  {
    label: Locale.Chat.Arena.PresetDomestic,
    models: ["qwen-max@Alibaba", "deepseek-chat@DeepSeek"],
  },
  {
    label: Locale.Chat.Arena.PresetOpenSource,
    models: ["deepseek-chat@DeepSeek", "glm-4@ChatGLM"],
  },
];

type ModelSelectorProps = {
  multiple?: boolean;
  maxSelections?: number;
  selectedValues: string[];
  onSelection: (values: string[]) => void;
  onClose: () => void;
};

export function ModelSelector(props: ModelSelectorProps) {
  const {
    multiple = false,
    maxSelections,
    selectedValues,
    onSelection,
    onClose,
  } = props;
  const modelOptions = useModelOptions();
  const [search, setSearch] = useState("");

  const filteredModels = useMemo(() => {
    if (!search.trim()) return modelOptions;
    const q = search.toLowerCase().trim();
    return modelOptions.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q),
    );
  }, [modelOptions, search]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    filteredModels.forEach((m) => {
      const key = m.providerName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredModels]);

  const isSelected = (value: string) => selectedValues.includes(value);

  const handleSelect = (value: string) => {
    if (multiple) {
      if (isSelected(value)) {
        onSelection(selectedValues.filter((v) => v !== value));
      } else {
        if (maxSelections && selectedValues.length >= maxSelections) return;
        onSelection([...selectedValues, value]);
      }
    } else {
      onSelection([value]);
      onClose();
    }
  };

  const isDisabled = (value: string) => {
    if (!multiple) return false;
    return (
      !isSelected(value) &&
      !!maxSelections &&
      selectedValues.length >= maxSelections
    );
  };

  const selectedModels = useMemo(() => {
    return selectedValues
      .map((v) => {
        const [name, providerName] = getModelProvider(v);
        return modelOptions.find(
          (m) => m.name === name && m.providerName === providerName,
        );
      })
      .filter(Boolean) as ModelOption[];
  }, [selectedValues, modelOptions]);

  return (
    <div className={styles["model-selector"]} onClick={onClose}>
      <div
        className={styles["model-selector-content"]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["model-selector-header"]}>
          <div className={styles["model-selector-search"]}>
            <SearchIcon className={styles["model-selector-search-icon"]} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={Locale.Chat.Arena.SelectModels}
              className={styles["model-selector-search-input"]}
              autoFocus
            />
            {search && (
              <CloseIcon
                className={styles["model-selector-search-clear"]}
                onClick={() => setSearch("")}
              />
            )}
          </div>
          {multiple && (
            <div className={styles["model-selector-count"]}>
              {Locale.Chat.Arena.ModelCount(selectedValues.length)}
              {maxSelections && ` / ${maxSelections}`}
            </div>
          )}
          <IconButton
            icon={<CloseIcon />}
            onClick={onClose}
            className={styles["model-selector-close"]}
          />
        </div>

        {multiple && selectedModels.length > 0 && (
          <div className={styles["model-selector-chips"]}>
            {selectedModels.map((m) => (
              <div
                key={`${m.name}@${m.providerName}`}
                className={styles["model-chip"]}
              >
                <span className={styles["model-chip-name"]}>
                  {m.displayName}
                </span>
                <span className={styles["model-chip-provider"]}>
                  {m.providerName}
                </span>
                <CloseIcon
                  className={styles["model-chip-remove"]}
                  onClick={() =>
                    onSelection(
                      selectedValues.filter(
                        (v) => v !== `${m.name}@${m.providerName}`,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {multiple && (
          <div className={styles["model-selector-presets"]}>
            <span className={styles["model-selector-presets-label"]}>
              {Locale.Chat.Arena.Presets}
            </span>
            {ARENA_PRESETS.map((preset) => {
              const available = preset.models.filter((m) =>
                modelOptions.some((o) => `${o.name}@${o.providerName}` === m),
              );
              if (available.length < 2) return null;
              return (
                <div
                  key={preset.label}
                  className={styles["model-selector-preset"]}
                  onClick={() => onSelection(available)}
                >
                  {preset.label}
                </div>
              );
            })}
          </div>
        )}

        <div className={styles["model-selector-list"]}>
          {groupedModels.length === 0 && (
            <div className={styles["model-selector-empty"]}>
              {search
                ? `No models matching "${search}"`
                : "No models available"}
            </div>
          )}
          {groupedModels.map(([providerName, models]) => (
            <div key={providerName} className={styles["model-selector-group"]}>
              <div className={styles["model-selector-group-label"]}>
                {providerName}
              </div>
              {models.map((m) => {
                const value = `${m.name}@${m.providerName}`;
                const selected = isSelected(value);
                const disabled = isDisabled(value);
                return (
                  <div
                    key={value}
                    className={`${styles["model-selector-item"]} ${
                      selected ? styles["model-selector-item-selected"] : ""
                    } ${
                      disabled ? styles["model-selector-item-disabled"] : ""
                    }`}
                    onClick={() => {
                      if (!disabled) handleSelect(value);
                    }}
                  >
                    <Avatar model={value} />
                    <div className={styles["model-selector-item-info"]}>
                      <span className={styles["model-selector-item-name"]}>
                        {m.displayName}
                      </span>
                      {!selected && (
                        <span
                          className={styles["model-selector-item-provider"]}
                        >
                          {m.providerName}
                        </span>
                      )}
                    </div>
                    {selected && (
                      <div className={styles["model-selector-item-check"]}>
                        ✓
                      </div>
                    )}
                    {m.isDefault && !selected && (
                      <span className={styles["model-selector-item-default"]}>
                        ★
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {multiple && selectedValues.length < 2 && (
          <div className={styles["model-selector-hint"]}>
            {Locale.Chat.Arena.MinModels}
          </div>
        )}
        {multiple &&
          maxSelections &&
          selectedValues.length >= maxSelections && (
            <div className={styles["model-selector-hint"]}>
              {Locale.Chat.Arena.MaxModels}
            </div>
          )}
      </div>
    </div>
  );
}
