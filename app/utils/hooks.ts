import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { LLMModel } from "../client/api";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const models = useMemo(() => {
    const baseModels = collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.customModels].join(","),
      accessStore.defaultModel,
    );

    const customEndpointModels: LLMModel[] = (accessStore.customEndpoints ?? [])
      .filter((e) => e.name && e.baseUrl && e.models?.length > 0)
      .flatMap((endpoint) =>
        endpoint.models.map((modelName, i) => ({
          name: modelName,
          available: true,
          sorted: 9000 + i,
          displayName: modelName,
          provider: {
            id: endpoint.name,
            providerName: endpoint.name,
            providerType: "openai" as const,
            sorted: 9000,
          },
        })),
      );

    if (customEndpointModels.length > 0) {
      return [...baseModels, ...customEndpointModels];
    }

    return baseModels;
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    accessStore.customEndpoints,
    configStore.customModels,
    configStore.models,
  ]);

  return models;
}
