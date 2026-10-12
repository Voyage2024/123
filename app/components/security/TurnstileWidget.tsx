"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  language?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_LANG: Record<string, string> = {
  EN: "en",
  RU: "ru",
  ES: "es",
  PT: "pt-BR",
};

export default function TurnstileWidget({
  lang,
  resetVersion,
  onTokenChange,
  labels,
}: {
  lang: string;
  resetVersion: number;
  onTokenChange: (token: string) => void;
  labels: { loading: string; unavailable: string };
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onTokenChange);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return;

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      language: TURNSTILE_LANG[String(lang).toUpperCase()] ?? "auto",
      action: "join_request",
      callback: (token) => callbackRef.current(token),
      "error-callback": () => callbackRef.current(""),
      "expired-callback": () => callbackRef.current(""),
      "timeout-callback": () => callbackRef.current(""),
    });
    widgetIdRef.current = widgetId;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      callbackRef.current("");
    };
  }, [lang, scriptReady, siteKey]);

  useEffect(() => {
    if (resetVersion < 1 || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    callbackRef.current("");
  }, [resetVersion]);

  if (!siteKey) {
    return <p role="status" className="text-xs leading-5 text-amber-100/70">{labels.unavailable}</p>;
  }

  return (
    <div className="min-h-[66px]">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          setScriptFailed(false);
          setScriptReady(true);
        }}
        onError={() => {
          setScriptFailed(true);
          setScriptReady(false);
          callbackRef.current("");
        }}
      />
      <div ref={containerRef} aria-label={labels.loading} />
      {scriptFailed && <p role="alert" className="mt-2 text-xs text-amber-100/70">{labels.unavailable}</p>}
      {!scriptReady && !scriptFailed && <p className="mt-1 text-[10px] text-zinc-600">{labels.loading}</p>}
    </div>
  );
}
