"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Tv, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { layoutConfig } from "@/lib/config/layout";
import "./landing-chat.css";

interface ChatPreset {
  id: string;
  question: string;
  answer: string;
}

interface ChatMessage {
  id: string;
  role: "agent" | "visitor";
  text: string;
}

const CHAT_PRESETS: ChatPreset[] = [
  {
    id: "pricing",
    question: "How much does it cost?",
    answer:
      "OneSign starts at $9/mo for Solo (1 screen). Growth is $39/mo for 5 screens and Network is $89/mo for 15 screens. Every new account gets a 14-day Solo trial — no credit card required.",
  },
  {
    id: "setup",
    question: "How do I connect a screen?",
    answer:
      "Install the OneSign TV player on your display, open the app to get a pairing code, then enter that code in your console under Screens. Your display shows up instantly and is ready for content.",
  },
  {
    id: "devices",
    question: "What devices are supported?",
    answer:
      "OneSign runs on Android TV, Amazon Fire TV, and most smart TVs with an Android-based player. Any TV with HDMI works — just plug in a compatible stick or box and pair it.",
  },
  {
    id: "trial",
    question: "Is there a free trial?",
    answer:
      "Yes — every new account gets a 14-day Solo trial with 1 screen and 500 MB of storage. No credit card needed to sign up. Choose a paid plan when your trial ends to keep going.",
  },
  {
    id: "scheduling",
    question: "Can I schedule content?",
    answer:
      "Absolutely. Build playlists in the console, set start and end times, and OneSign swaps content automatically — no need to touch the screen again.",
  },
];

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function replyDelayMs(text: string, reducedMotion: boolean): number {
  if (reducedMotion) return 400;
  const base = 700;
  const perChar = 16;
  return Math.min(base + text.length * perChar, 2000);
}

export function LandingLiveChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usedPresetIds, setUsedPresetIds] = useState<Set<string>>(() => new Set());
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandName = layoutConfig.brand.name;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [open, messages, isAgentTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([
      {
        id: "welcome",
        role: "agent",
        text: `Hi there! 👋 Ask us anything about ${brandName} — or pick a question below to get started.`,
      },
    ]);
  }, [open, messages.length, brandName]);

  function handlePresetClick(preset: ChatPreset) {
    if (usedPresetIds.has(preset.id) || isAgentTyping) return;

    setUsedPresetIds((current) => new Set(current).add(preset.id));
    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: "visitor", text: preset.question },
    ]);
    setIsAgentTyping(true);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = replyDelayMs(preset.answer, reducedMotion);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsAgentTyping(false);
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: "agent", text: preset.answer },
      ]);
      typingTimeoutRef.current = null;
    }, delay);
  }

  const presetsDisabled = isAgentTyping;

  const availablePresets = CHAT_PRESETS.filter((preset) => !usedPresetIds.has(preset.id));

  return (
    <div className="landing-chat">
      {open ? (
        <div
          id="landing-chat-panel"
          className="landing-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="OneSign AI chat"
        >
          <header className="landing-chat-header">
            <div className="landing-chat-header-brand">
              <div className="landing-chat-header-title-row">
                <BrandMark
                  icon={Tv}
                  logoColor={layoutConfig.brand.logoColor}
                  iconSize={14}
                  boxWidth="1.75rem"
                  boxHeight="1.625rem"
                  borderRadius="0.375rem"
                />
                <span className="landing-chat-brand-name">OneSign</span>
                <span className="landing-chat-ai-chip">AI</span>
              </div>
              <p className="landing-chat-header-subtitle">
                Quick answers · Live support coming soon
              </p>
            </div>
            <button
              type="button"
              className="landing-chat-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={bodyRef} className="landing-chat-body">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`landing-chat-message-row landing-chat-message-row--${message.role}`}
              >
                <div
                  className={`landing-chat-message landing-chat-message--${message.role}`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  {message.role === "agent" ? (
                    <span className="landing-chat-message-meta">OneSign AI · Just now</span>
                  ) : null}
                </div>
              </div>
            ))}

            {isAgentTyping ? (
              <div className="landing-chat-message-row landing-chat-message-row--agent">
                <div
                  className="landing-chat-message landing-chat-message--agent landing-chat-typing"
                  role="status"
                  aria-live="polite"
                  aria-label="Support is typing"
                >
                  <span className="landing-chat-typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            ) : null}

            {availablePresets.length > 0 ? (
              <div
                className={`landing-chat-presets${presetsDisabled ? " landing-chat-presets--disabled" : ""}`}
                aria-label="Suggested questions"
              >
                <p className="landing-chat-presets-label">Suggested questions</p>
                <div className="landing-chat-presets-list">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="landing-chat-preset"
                      onClick={() => handlePresetClick(preset)}
                      disabled={presetsDisabled}
                    >
                      {preset.question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <footer className="landing-chat-footer">
            <input
              type="text"
              className="landing-chat-input"
              placeholder="Type a message…"
              disabled
              aria-disabled="true"
              aria-label="Message input (coming soon)"
            />
            <button
              type="button"
              className="landing-chat-send"
              disabled
              aria-label="Send message (coming soon)"
            >
              <Send size={16} />
            </button>
          </footer>
        </div>
      ) : null}

      <button
        type="button"
        className="landing-chat-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="landing-chat-panel"
        aria-label={open ? "Close chat" : "Open live chat"}
      >
        {open ? <X size={22} strokeWidth={2.25} /> : <MessageCircle size={22} strokeWidth={2.25} />}
      </button>
    </div>
  );
}
