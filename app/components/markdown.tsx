import React, { useMemo, useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Mermaid } from "./mermaid";
import { useAppConfig } from "../store/config";
import { useLocation } from "react-router-dom";

import "katex/dist/katex.min.css";

import styles from "./markdown.module.scss";
import { IconButton } from "./button";
import CopyIcon from "../icons/copy.svg";
import CheckIcon from "../icons/check.svg";
import { extractThinkParts, hasThinkTag } from "../utils";
import Locale from "../locales";

function PreCode(props: { children: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (ref.current) {
      const code = ref.current.innerText;
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <pre className={styles["pre-code"]}>
      <IconButton icon={copied ? CheckIcon : CopyIcon} onClick={handleCopy} />
      <code ref={ref}>{props.children}</code>
    </pre>
  );
}

export function Markdown(props: {
  content: string;
  loading?: boolean;
  fontSize?: number;
  fontFamily?: string;
  parentRef?: React.RefObject<HTMLDivElement>;
  defaultShow?: boolean;
}) {
  const location = useLocation();
  const config = useAppConfig();
  const theme = config.theme;
  const mdRef = useRef<HTMLDivElement>(null);

  const { cleanContent, thinkParts } = useMemo(
    () =>
      hasThinkTag(props.content)
        ? extractThinkParts(props.content)
        : { cleanContent: props.content, thinkParts: [] },
    [props.content],
  );

  return (
    <>
      {thinkParts.length > 0 && (
        <div className={styles["think-blocks"]}>
          {thinkParts.map((thinkContent, i) => (
            <ThinkBlock key={i} content={thinkContent} index={i + 1} />
          ))}
        </div>
      )}

      <div
        ref={mdRef}
        onContextMenu={(e) => e.preventDefault()}
        className={`${styles.markdownBody} ${
          theme === "dark" ? styles["markdown-body-dark"] : ""
        }`}
        style={{
          fontSize: `${props.fontSize ?? 14}px`,
          fontFamily: props.fontFamily,
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={{
            pre: PreCode,
            p: (pProps) => <p {...pProps} dir="auto" />,
            a: (aProps) => (
              <a
                {...aProps}
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </>
  );
}

function ThinkBlock(props: { content: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [props.content]);

  return (
    <div className={styles["think-block"]}>
      <button
        className={styles["think-header"]}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={styles["think-icon"]}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span className={styles["think-label"]}>
          {Locale.Chat.Think.Label}
        </span>
        <span className={styles["think-chevron"]}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <div
        className={`${styles["think-content"]} ${
          expanded ? styles["think-expanded"] : styles["think-collapsed"]
        }`}
        style={
          !expanded && contentHeight > 0
            ? { maxHeight: "0px", gridTemplateRows: "0fr" }
            : undefined
        }
      >
        <div className={styles["think-inner"]} ref={contentRef}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: (pProps) => <p {...pProps} dir="auto" />,
            }}
          >
            {props.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
