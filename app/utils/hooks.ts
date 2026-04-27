import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { LLMModel } from "../client/api";

export const CUSTOM_ENDPOINT_PREFIX = "custom:";

export function isCustomEndpointProvider(providerName: string): boolean {
  return providerName.startsWith(CUSTOM_ENDPOINT_PREFIX);
}

export function getCustomEndpointName(providerName: string): string {
  if (isCustomEndpointProvider(providerName)) {
    return providerName.slice(CUSTOM_ENDPOINT_PREFIX.length);
  }
  return providerName;
}

export function makeCustomEndpointProviderName(endpointName: string): string {
  return CUSTOM_ENDPOINT_PREFIX + endpointName;
}

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
            id: makeCustomEndpointProviderName(endpoint.name),
            providerName: makeCustomEndpointProviderName(endpoint.name),
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
