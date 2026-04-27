import { useAccessStore } from "../store/access";
import { getHeaders } from "../client/api";

export type ConnectionTestResult = {
  success: boolean;
  latency?: number;
  modelCount?: number;
  error?: string;
  timestamp: number;
};

export type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

export async function testOpenAIConnection(
  baseUrl: string,
  apiKey: string,
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    let url = baseUrl.trim();

    if (!url) {
      return {
        success: false,
        error: "接口地址不能为空",
        timestamp: Date.now(),
      };
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    const testUrl = `${url}/v1/models`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(testUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorMessage = `HTTP ${response.status}`;

      if (response.status === 401) {
        errorMessage = "API Key 无效或未授权";
      } else if (response.status === 403) {
        errorMessage = "访问被拒绝，请检查权限";
      } else if (response.status === 404) {
        errorMessage = "接口地址无效或路径不正确（/v1/models 不存在）";
      } else if (response.status >= 500) {
        errorMessage = "服务器内部错误，请稍后重试";
      }

      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // ignore parse error
      }

      return {
        success: false,
        latency,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }

    const data = await response.json();

    const modelCount = data?.data?.length || 0;

    return {
      success: true,
      latency,
      modelCount,
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    const latency = Date.now() - startTime;

    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        latency,
        error: "连接超时（10秒），请检查网络或端点地址",
        timestamp: Date.now(),
      };
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        success: false,
        latency,
        error: "无法连接到服务器，请检查网络连接或CORS设置",
        timestamp: Date.now(),
      };
    }

    const message =
      error instanceof Error ? error.message : "未知错误";

    return {
      success: false,
      latency,
      error: message,
      timestamp: Date.now(),
    };
  }
}

export async function testCurrentOpenAIConfig(): Promise<ConnectionTestResult> {
  const accessStore = useAccessStore.getState();
  return testOpenAIConnection(accessStore.openaiUrl, accessStore.openaiApiKey);
}

export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getConnectionQuality(latency: number): "excellent" | "good" | "fair" | "poor" {
  if (latency < 300) return "excellent";
  if (latency < 800) return "good";
  if (latency < 2000) return "fair";
  return "poor";
}
