import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useAllModels } from "../utils/hooks";
import { Avatar } from "./emoji";
import { IconButton } from "./button";
import Locale from "../locales";
import { ServiceProvider } from "../constant";
import { getModelProvider } from "../utils/model";
import CloseIcon from "../icons/close.svg";
import SearchIcon from "../icons/search.svg";
import ChevronDownIcon from "../icons/chevron-down.svg";
import ChevronUpIcon from "../icons/chevron-up.svg";
import styles from "./model-selector.module.scss";

export type ModelOption = {
  name: string;
  providerName: string;
  displayName: string;
  available: boolean;
  isDefault: boolean;
};

export type ModelSelectorVariant = "full" | "compact";

type ModelSelectorProps = {
  multiple?: boolean;
  maxSelections?: number;
  selectedValues: string[];
  onSelection: (values: string[]) => void;
  onClose: () => void;
  variant?: ModelSelectorVariant;
};

type ArenaPreset = {
  label: string;
  description?: string;
  models: string[];
  icon?: string;
};

const ARENA_PRESETS: ArenaPreset[] = [
  {
    label: Locale.Chat.Arena.PresetGPTvsClaude,
    description: "GPT-4o vs Claude 3.5 Sonnet",
    models: ["gpt-4o@OpenAI", "claude-3-5-sonnet-20240620@Anthropic"],
    icon: "⚔️",
  },
  {
    label: Locale.Chat.Arena.PresetDomestic,
    description: "通义千问 vs DeepSeek",
    models: ["qwen-max@Alibaba", "deepseek-chat@DeepSeek"],
    icon: "🇨🇳",
  },
  {
    label: Locale.Chat.Arena.PresetOpenSource,
    description: "DeepSeek vs ChatGLM",
    models: ["deepseek-chat@DeepSeek", "glm-4@ChatGLM"],
    icon: "🔓",
  },
];

const VISIBLE_MODELS_COUNT = 6;

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

export function ModelSelector(props: ModelSelectorProps) {
  const {
    multiple = false,
    maxSelections,
    selectedValues,
    onSelection,
    onClose,
    variant = "full",
  } = props;

  const modelOptions = useModelOptions();
  const [search, setSearch] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

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

  const visibleModels = useMemo(() => {
    if (search.trim() || showAllModels) {
      return filteredModels;
    }

    const defaultModel = filteredModels.find((m) => m.isDefault);
    const others = filteredModels.filter((m) => !m.isDefault);
    const visible = [
      defaultModel,
      ...others.slice(0, VISIBLE_MODELS_COUNT - (defaultModel ? 1 : 0)),
    ].filter(Boolean) as ModelOption[];

    return visible;
  }, [filteredModels, search, showAllModels]);

  const hiddenModelsCount = useMemo(() => {
    if (search.trim() || showAllModels) return 0;
    return Math.max(0, filteredModels.length - VISIBLE_MODELS_COUNT);
  }, [filteredModels, search, showAllModels]);

  const isSelected = useCallback(
    (value: string) => selectedValues.includes(value),
    [selectedValues],
  );

  const handleSelect = useCallback(
    (value: string) => {
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
    },
    [multiple, maxSelections, selectedValues, onSelection, onClose, isSelected],
  );

  const isDisabled = useCallback(
    (value: string) => {
      if (!multiple) return false;
      return (
        !isSelected(value) &&
        !!maxSelections &&
        selectedValues.length >= maxSelections
      );
    },
    [multiple, maxSelections, selectedValues, isSelected],
  );

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const handlePresetSelect = useCallback(
    (preset: ArenaPreset) => {
      const available = preset.models.filter((m) =>
        modelOptions.some((o) => `${o.name}@${o.providerName}` === m),
      );
      if (
        available.length >= 2 &&
        maxSelections &&
        available.length <= maxSelections
      ) {
        onSelection(available);
      }
    },
    [modelOptions, maxSelections, onSelection],
  );

  const isCompact = variant === "compact";
  const variantClass = styles["variant-" + variant] ?? "";

  return (
    <div
      className={`${styles["model-selector"]} ${variantClass}`}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={Locale.Chat.Arena.SelectModels}
    >
      <div
        className={styles["model-selector-content"]}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles["model-selector-header"]}>
          <div className={styles["model-selector-search"]}>
            <SearchIcon className={styles["model-selector-search-icon"]} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isCompact
                  ? Locale.Chat.Arena.SearchModels
                  : Locale.Chat.Arena.SelectModels
              }
              className={styles["model-selector-search-input"]}
              aria-label="Search models"
            />
            {search && (
              <button
                className={styles["model-selector-search-clear"]}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <CloseIcon />
              </button>
            )}
          </div>

          {multiple && (
            <div className={styles["model-selector-meta"]}>
              <span className={styles["model-selector-count"]}>
                {Locale.Chat.Arena.ModelCount(selectedValues.length)}
                {maxSelections && (
                  <span className={styles["model-selector-count-max"]}>
                    /{maxSelections}
                  </span>
                )}
              </span>
            </div>
          )}

          <IconButton
            icon={<CloseIcon />}
            onClick={onClose}
            className={styles["model-selector-close"]}
            text={Locale.Chat.Arena.Close}
            aria-label="Close dialog"
          />
        </header>

        {!isCompact && multiple && selectedModels.length > 0 && (
          <div className={styles["model-selector-selection"]}>
            <span className={styles["model-selector-selection-label"]}>
              {Locale.Chat.Arena.Selected}
            </span>
            <div className={styles["model-selector-chips"]}>
              {selectedModels.map((m) => (
                <button
                  key={`${m.name}@${m.providerName}`}
                  className={styles["model-chip"]}
                  onClick={() =>
                    onSelection(
                      selectedValues.filter(
                        (v) => v !== `${m.name}@${m.providerName}`,
                      ),
                    )
                  }
                  type="button"
                  aria-label={`Remove ${m.displayName}`}
                >
                  <Avatar model={`${m.name}@${m.providerName}`} size={16} />
                  <span className={styles["model-chip-name"]}>
                    {m.displayName}
                  </span>
                  <CloseIcon className={styles["model-chip-remove"]} />
                </button>
              ))}
            </div>
          </div>
        )}

        {!isCompact && multiple && !search && (
          <div className={styles["model-selector-presets"]}>
            <span className={styles["model-selector-presets-label"]}>
              {Locale.Chat.Arena.Presets}
            </span>
            <div className={styles["model-selector-presets-list"]}>
              {ARENA_PRESETS.map((preset) => {
                const available = preset.models.filter((m) =>
                  modelOptions.some((o) => `${o.name}@${o.providerName}` === m),
                );
                const isAvailable = available.length >= 2;
                const maxOk =
                  !maxSelections || available.length <= maxSelections;

                if (!isAvailable || !maxOk) return null;

                return (
                  <button
                    key={preset.label}
                    className={styles["model-selector-preset"]}
                    onClick={() => handlePresetSelect(preset)}
                    type="button"
                    disabled={!isAvailable}
                    title={preset.description}
                  >
                    {preset.icon && (
                      <span className={styles["model-preset-icon"]}>
                        {preset.icon}
                      </span>
                    )}
                    <span className={styles["model-preset-label"]}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={styles["model-selector-list"]}
          ref={listRef}
          role="listbox"
          aria-multiselectable={multiple}
        >
          {groupedModels.length === 0 ? (
            <div className={styles["model-selector-empty"]} role="status">
              {search ? (
                <>
                  <span className={styles["model-empty-icon"]}>🔍</span>
                  <p>{Locale.Chat.Arena.NoResults}</p>
                  <p className={styles["model-empty-hint"]}>{`"${search}"`}</p>
                </>
              ) : (
                <>
                  <span className={styles["model-empty-icon"]}>📭</span>
                  <p>{Locale.Chat.Arena.NoModels}</p>
                </>
              )}
            </div>
          ) : (
            <>
              {!search && !showAllModels && groupedModels.length > 0 && (
                <div className={styles["model-selector-visible"]}>
                  {visibleModels.map((m) => {
                    const value = `${m.name}@${m.providerName}`;
                    const selected = isSelected(value);
                    const disabled = isDisabled(value);
                    return renderModelItem(
                      m,
                      value,
                      selected,
                      disabled,
                      handleSelect,
                    );
                  })}
                </div>
              )}

              {(showAllModels || search) &&
                groupedModels.map(([providerName, models]) => (
                  <div
                    key={providerName}
                    className={styles["model-selector-group"]}
                  >
                    <div className={styles["model-selector-group-header"]}>
                      <span className={styles["model-group-provider"]}>
                        {providerName}
                      </span>
                      <span className={styles["model-group-count"]}>
                        {models.length}
                      </span>
                    </div>
                    <div className={styles["model-group-items"]}>
                      {models.map((m) => {
                        const value = `${m.name}@${m.providerName}`;
                        const selected = isSelected(value);
                        const disabled = isDisabled(value);
                        return renderModelItem(
                          m,
                          value,
                          selected,
                          disabled,
                          handleSelect,
                        );
                      })}
                    </div>
                  </div>
                ))}

              {!search && !showAllModels && hiddenModelsCount > 0 && (
                <button
                  className={styles["model-selector-show-more"]}
                  onClick={() => setShowAllModels(true)}
                  type="button"
                >
                  <ChevronDownIcon className={styles["model-show-more-icon"]} />
                  <span>{Locale.Chat.Arena.ShowMore(hiddenModelsCount)}</span>
                </button>
              )}

              {!search && showAllModels && (
                <button
                  className={styles["model-selector-show-less"]}
                  onClick={() => setShowAllModels(false)}
                  type="button"
                >
                  <ChevronUpIcon className={styles["model-show-more-icon"]} />
                  <span>{Locale.Chat.Arena.ShowLess}</span>
                </button>
              )}
            </>
          )}
        </div>

        {multiple && (
          <footer className={styles["model-selector-footer"]}>
            {selectedValues.length < 2 ? (
              <div className={styles["model-hint"]} role="alert">
                <span className={styles["model-hint-icon"]}>⚠️</span>
                {Locale.Chat.Arena.MinModelsHint}
              </div>
            ) : maxSelections && selectedValues.length >= maxSelections ? (
              <div className={styles["model-hint"]} role="alert">
                <span className={styles["model-hint-icon"]}>✅</span>
                {Locale.Chat.Arena.MaxModelsHint(maxSelections)}
              </div>
            ) : (
              <div className={styles["model-hint-info"]}>
                {Locale.Chat.Arena.SelectionHint(
                  selectedValues.length,
                  maxSelections || 4,
                )}
              </div>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function renderModelItem(
  m: ModelOption,
  value: string,
  selected: boolean,
  disabled: boolean,
  onSelect: (value: string) => void,
) {
  return (
    <div
      key={value}
      className={`${styles["model-item"]} ${
        selected ? styles["model-item-selected"] : ""
      } ${disabled ? styles["model-item-disabled"] : ""} ${
        m.isDefault ? styles["model-item-default"] : ""
      }`}
      onClick={() => {
        if (!disabled) onSelect(value);
      }}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) onSelect(value);
        }
      }}
    >
      <div className={styles["model-item-avatar"]}>
        <Avatar model={value} size={24} />
      </div>

      <div className={styles["model-item-content"]}>
        <div className={styles["model-item-primary"]}>
          <span className={styles["model-item-name"]}>{m.displayName}</span>
          {m.isDefault && (
            <span className={styles["model-badge-default"]}>
              {Locale.Chat.Arena.DefaultBadge}
            </span>
          )}
        </div>
        <span className={styles["model-item-provider"]}>{m.providerName}</span>
      </div>

      <div className={styles["model-item-actions"]}>
        {selected && (
          <div className={styles["model-item-check"]} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13.5 4.5L6 12L2.5 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
