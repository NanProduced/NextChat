import React, { useState } from "react";
import { IconButton } from "./button";
import Locale from "../locales";
import {
  testOpenAIConnection,
  ConnectionTestResult,
  ConnectionTestStatus,
  formatLatency,
  getConnectionQuality,
} from "../utils/connection-test";
import LoadingIcon from "./icons/three-dots.svg";
import CheckIcon from "./icons/check.svg";
import ErrorIcon from "./icons/error.svg";
import styles from "./connection-test.module.scss";

type ConnectionTestButtonProps = {
  baseUrl: string;
  apiKey: string;
  onResult?: (result: ConnectionTestResult) => void;
};

export function ConnectionTestButton(props: ConnectionTestButtonProps) {
  const [status, setStatus] = useState<ConnectionTestStatus>("idle");
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setStatus("testing");
    setResult(null);

    try {
      const testResult = await testOpenAIConnection(
        props.baseUrl,
        props.apiKey,
      );

      setResult(testResult);
      setStatus(testResult.success ? "success" : "error");
      props.onResult?.(testResult);
    } catch (error) {
      const errorResult: ConnectionTestResult = {
        success: false,
        error: error instanceof Error ? error.message : "测试失败",
        timestamp: Date.now(),
      };
      setResult(errorResult);
      setStatus("error");
      props.onResult?.(errorResult);
    }
  };

  return (
    <div className={styles["connection-test-wrapper"]}>
      <IconButton
        icon={
          status === "testing" ? (
            <LoadingIcon />
          ) : status === "success" ? (
            <CheckIcon />
          ) : status === "error" ? (
            <ErrorIcon />
          ) : (
            <ConnectionIcon />
          )
        }
        text={
          status === "testing"
            ? Locale.Settings.Access.OpenAI.Endpoint.Testing
            : status === "success"
            ? Locale.Settings.Access.OpenAI.Endpoint.TestSuccess
            : status === "error"
            ? Locale.Settings.Access.OpenAI.Endpoint.TestFailed
            : Locale.Settings.Access.OpenAI.Endpoint.TestButton
        }
        onClick={handleTest}
        disabled={status === "testing"}
        className={`${styles["connection-test-button"]} ${
          styles[`connection-test-${status}`]
        }`}
      />

      {result && (
        <div
          className={`${styles["connection-test-result"]} ${
            styles[`connection-test-result-${result.success ? "success" : "error"}`]
          }`}
        >
          {result.success ? (
            <div className={styles["connection-test-success"]}>
              <span className={styles["connection-test-icon"]}>✓</span>
              <div className={styles["connection-test-details"]}>
                <span className={styles["connection-test-message"]}>
                  {Locale.Settings.Access.OpenAI.Endpoint.ConnectionSuccess.replace(
                    "{0}",
                    String(result.modelCount || 0),
                  )}
                </span>
                <span className={styles["connection-test-latency"]}>
                  {Locale.Settings.Access.OpenAI.Endpoint.Latency.replace(
                    "{0}",
                    formatLatency(result.latency || 0),
                  )}
                  {" • "}
                  {Locale.Settings.Access.OpenAI.Endpoint.Quality[
                    getConnectionQuality(result.latency || 0)
                  ]}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles["connection-test-error"]}>
              <span className={styles["connection-test-icon"]}>✗</span>
              <div className={styles["connection-test-details"]}>
                <span className={styles["connection-test-message"]}>
                  {result.error || Locale.Settings.Access.OpenAI.Endpoint.ConnectionFailed}
                </span>
                {result.latency && (
                  <span className={styles["connection-test-latency"]}>
                    {formatLatency(result.latency)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}
