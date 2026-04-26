import React, { useMemo, useState } from "react";
import { IconButton } from "./button";
import { Select } from "./ui-lib";
import { ServiceProvider } from "../constant";
import Locale from "../locales";
import CloseIcon from "../icons/close.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import styles from "./custom-models.module.scss";

type ParsedModel = {
  raw: string;
  name: string;
  displayName?: string;
  providerName?: string;
  disabled: boolean;
};

function parseCustomModels(customModelsStr: string): ParsedModel[] {
  if (!customModelsStr.trim()) return [];
  return customModelsStr
    .split(",")
    .filter((s) => s.trim())
    .map((raw) => {
      const trimmed = raw.trim();
      const disabled = trimmed.startsWith("-");
      let rest = disabled ? trimmed.slice(1) : trimmed;
      if (rest.startsWith("+")) rest = rest.slice(1);

      const eqIndex = rest.indexOf("=");
      let name = rest;
      let displayName: string | undefined;
      if (eqIndex > 0) {
        name = rest.slice(0, eqIndex);
        displayName = rest.slice(eqIndex + 1);
      }

      const atIndex = name.lastIndexOf("@");
      let providerName: string | undefined;
      if (atIndex > 0) {
        providerName = name.slice(atIndex + 1);
        name = name.slice(0, atIndex);
      }

      return { raw: trimmed, name, displayName, providerName, disabled };
    });
}

function buildCustomModelsStr(models: ParsedModel[]): string {
  return models
    .map((m) => {
      let s = m.disabled ? `-${m.name}` : m.name;
      if (m.providerName) s += `@${m.providerName}`;
      if (m.displayName) s += `=${m.displayName}`;
      return s;
    })
    .join(",");
}

export function CustomModelManager(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { value, onChange } = props;
  const models = useMemo(() => parseCustomModels(value), [value]);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addProvider, setAddProvider] = useState(ServiceProvider.OpenAI);
  const [addDisplayName, setAddDisplayName] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const handleAdd = () => {
    if (!addName.trim()) return;
    const newModel: ParsedModel = {
      raw: "",
      name: addName.trim(),
      providerName: addProvider,
      displayName: addDisplayName.trim() || undefined,
      disabled: false,
    };
    const newStr = buildCustomModelsStr([...models, newModel]);
    onChange(newStr);
    setAddName("");
    setAddDisplayName("");
    setShowAdd(false);
  };

  const handleRemove = (index: number) => {
    const newModels = models.filter((_, i) => i !== index);
    onChange(buildCustomModelsStr(newModels));
  };

  const handleToggle = (index: number) => {
    const newModels = models.map((m, i) =>
      i === index ? { ...m, disabled: !m.disabled } : m,
    );
    onChange(buildCustomModelsStr(newModels));
  };

  return (
    <div className={styles["custom-models"]}>
      <div className={styles["custom-models-header"]}>
        <span className={styles["custom-models-count"]}>
          {models.length} model(s)
        </span>
        <div className={styles["custom-models-actions"]}>
          <IconButton
            icon={<AddIcon />}
            text={Locale.Settings.Access.CustomModel.AddModel || "Add"}
            onClick={() => setShowAdd(!showAdd)}
            className={styles["custom-models-add-btn"]}
          />
          <IconButton
            icon={<span>?</span>}
            text={Locale.Settings.Access.CustomModel.Help || "Syntax Help"}
            onClick={() => setShowHelp(!showHelp)}
            className={styles["custom-models-help-btn"]}
          />
        </div>
      </div>

      {showHelp && (
        <div className={styles["custom-models-help"]}>
          <div className={styles["custom-models-help-title"]}>
            Custom Model Syntax
          </div>
          <table className={styles["custom-models-help-table"]}>
            <thead>
              <tr>
                <th>Syntax</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>model-name</code>
                </td>
                <td>Enable a model</td>
              </tr>
              <tr>
                <td>
                  <code>-model-name</code>
                </td>
                <td>Disable a model</td>
              </tr>
              <tr>
                <td>
                  <code>+model-name</code>
                </td>
                <td>Explicitly enable</td>
              </tr>
              <tr>
                <td>
                  <code>name=Display Name</code>
                </td>
                <td>Set display name</td>
              </tr>
              <tr>
                <td>
                  <code>name@Provider</code>
                </td>
                <td>Target specific provider</td>
              </tr>
              <tr>
                <td>
                  <code>-all</code>
                </td>
                <td>Disable all default models</td>
              </tr>
              <tr>
                <td>
                  <code>+all</code>
                </td>
                <td>Enable all default models</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className={styles["custom-models-add"]}>
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Model name (e.g. gpt-4o)"
            className={styles["custom-models-add-input"]}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Select
            value={addProvider}
            onChange={(e) => setAddProvider(e.target.value as ServiceProvider)}
            className={styles["custom-models-add-provider"]}
          >
            {Object.entries(ServiceProvider).map(([k, v]) => (
              <option value={v} key={k}>
                {k}
              </option>
            ))}
          </Select>
          <input
            type="text"
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            className={styles["custom-models-add-display"]}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <IconButton
            icon={<AddIcon />}
            onClick={handleAdd}
            className={styles["custom-models-add-confirm"]}
          />
        </div>
      )}

      {models.length > 0 && (
        <div className={styles["custom-models-list"]}>
          {models.map((m, i) => (
            <div
              key={i}
              className={`${styles["custom-model-item"]} ${
                m.disabled ? styles["custom-model-item-disabled"] : ""
              }`}
            >
              <div className={styles["custom-model-item-info"]}>
                <span className={styles["custom-model-item-name"]}>
                  {m.displayName || m.name}
                </span>
                {m.displayName && m.displayName !== m.name && (
                  <span className={styles["custom-model-item-raw"]}>
                    {m.name}
                  </span>
                )}
                {m.providerName && (
                  <span className={styles["custom-model-item-provider"]}>
                    {m.providerName}
                  </span>
                )}
              </div>
              <div className={styles["custom-model-item-actions"]}>
                <IconButton
                  icon={m.disabled ? <span>+</span> : <DeleteIcon />}
                  onClick={() => handleToggle(i)}
                  className={styles["custom-model-item-toggle"]}
                />
                <IconButton
                  icon={<CloseIcon />}
                  onClick={() => handleRemove(i)}
                  className={styles["custom-model-item-remove"]}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles["custom-models-raw"]}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder="model1,model2,model3"
          className={styles["custom-models-raw-input"]}
        />
      </div>
    </div>
  );
}
