import React, { useState } from "react";
import { IconButton } from "./button";
import { useAccessStore, CustomEndpoint } from "../store/access";
import Locale from "../locales";
import CloseIcon from "../icons/close.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import styles from "./custom-endpoints.module.scss";
import { nanoid } from "nanoid";
import { showConfirm } from "./ui-lib";

export function CustomEndpointManager() {
  const accessStore = useAccessStore();
  const endpoints = accessStore.customEndpoints ?? [];
  const useCustomConfig = accessStore.useCustomConfig;

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBaseUrl, setAddBaseUrl] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [addModels, setAddModels] = useState("");

  const handleAdd = () => {
    if (!addName.trim() || !addBaseUrl.trim()) return;
    const newEndpoint: CustomEndpoint = {
      id: nanoid(),
      name: addName.trim(),
      baseUrl: addBaseUrl.trim().replace(/\/+$/, ""),
      apiKey: addApiKey.trim(),
      models: addModels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    accessStore.update((state) => {
      state.customEndpoints = [...(state.customEndpoints ?? []), newEndpoint];
    });
    setAddName("");
    setAddBaseUrl("");
    setAddApiKey("");
    setAddModels("");
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    showConfirm(Locale.Settings.Access.CustomEndpoints.DeleteConfirm).then(
      (ok) => {
        if (!ok) return;
        accessStore.update((state) => {
          state.customEndpoints = (state.customEndpoints ?? []).filter(
            (e) => e.id !== id,
          );
        });
      },
    );
  };

  const handleEditApiKey = (id: string, apiKey: string) => {
    accessStore.update((state) => {
      const eps = state.customEndpoints ?? [];
      const idx = eps.findIndex((e) => e.id === id);
      if (idx >= 0) eps[idx].apiKey = apiKey;
    });
  };

  return (
    <div className={styles["custom-endpoints"]}>
      {!useCustomConfig && (
        <div className={styles["custom-endpoints-warning"]}>
          {Locale.Settings.Access.CustomEndpoints.ConfigRequired}
        </div>
      )}

      <div className={styles["custom-endpoints-toolbar"]}>
        <IconButton
          icon={<AddIcon />}
          text={Locale.Settings.Access.CustomEndpoints.Add}
          onClick={() => setShowAdd(!showAdd)}
          className={styles["custom-endpoints-add-btn"]}
        />
        <span className={styles["custom-endpoints-count"]}>
          {Locale.Settings.Access.CustomEndpoints.EndpointCount.replace(
            "{0}",
            String(endpoints.length),
          )}
        </span>
      </div>

      {showAdd && (
        <div className={styles["custom-endpoints-form"]}>
          <div className={styles["custom-endpoints-form-row"]}>
            <label>{Locale.Settings.Access.CustomEndpoints.Name}</label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={
                Locale.Settings.Access.CustomEndpoints.NamePlaceholder
              }
            />
          </div>
          <div className={styles["custom-endpoints-form-row"]}>
            <label>{Locale.Settings.Access.CustomEndpoints.BaseUrl}</label>
            <input
              type="text"
              value={addBaseUrl}
              onChange={(e) => setAddBaseUrl(e.target.value)}
              placeholder={
                Locale.Settings.Access.CustomEndpoints.UrlPlaceholder
              }
            />
          </div>
          <div className={styles["custom-endpoints-form-row"]}>
            <label>{Locale.Settings.Access.CustomEndpoints.ApiKey}</label>
            <input
              type="password"
              value={addApiKey}
              onChange={(e) => setAddApiKey(e.target.value)}
              placeholder={
                Locale.Settings.Access.CustomEndpoints.KeyPlaceholder
              }
            />
          </div>
          <div className={styles["custom-endpoints-form-row"]}>
            <label>{Locale.Settings.Access.CustomEndpoints.Models}</label>
            <input
              type="text"
              value={addModels}
              onChange={(e) => setAddModels(e.target.value)}
              placeholder={
                Locale.Settings.Access.CustomEndpoints.ModelsPlaceholder
              }
            />
          </div>
          <div className={styles["custom-endpoints-form-actions"]}>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Settings.Access.CustomEndpoints.Add}
              onClick={handleAdd}
              type="primary"
            />
            <IconButton
              icon={<CloseIcon />}
              text={Locale.Settings.Access.CustomEndpoints.Cancel}
              onClick={() => setShowAdd(false)}
            />
          </div>
        </div>
      )}

      {endpoints.length > 0 ? (
        <div className={styles["custom-endpoints-list"]}>
          {endpoints.map((ep) => (
            <div key={ep.id} className={styles["custom-endpoint-card"]}>
              <div className={styles["custom-endpoint-card-header"]}>
                <div className={styles["custom-endpoint-card-title-row"]}>
                  <span className={styles["custom-endpoint-card-name"]}>
                    {ep.name}
                  </span>
                  {!useCustomConfig && (
                    <span className={styles["custom-endpoint-card-badge"]}>
                      未启用
                    </span>
                  )}
                </div>
                <IconButton
                  icon={<DeleteIcon />}
                  onClick={() => handleRemove(ep.id)}
                  className={styles["custom-endpoint-card-delete"]}
                />
              </div>
              <div className={styles["custom-endpoint-card-url"]}>
                {ep.baseUrl}
              </div>
              <div className={styles["custom-endpoint-card-apikey"]}>
                <input
                  type="password"
                  value={ep.apiKey}
                  onChange={(e) => handleEditApiKey(ep.id, e.target.value)}
                  placeholder="API Key"
                />
              </div>
              <div className={styles["custom-endpoint-card-models"]}>
                {ep.models.map((m) => (
                  <span key={m} className={styles["custom-endpoint-model-tag"]}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <div className={styles["custom-endpoints-empty"]}>
            {Locale.Settings.Access.CustomEndpoints.NoEndpoints}
          </div>
        )
      )}

      {endpoints.length > 0 && (
        <div className={styles["custom-endpoints-guide"]}>
          {Locale.Settings.Access.CustomEndpoints.UsageGuide}
        </div>
      )}
    </div>
  );
}
