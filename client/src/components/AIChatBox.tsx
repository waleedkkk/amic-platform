import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAssistantBubbleAlignment, getChatDirection, getChatMarkdownDirection, getChatTextAlignment } from "@/lib/chatDirection";
import { getTypingInterval, getTypingPreview, getTypingUnits } from "@/lib/chatTyping";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Clock3, DatabaseZap, Loader2, Send, User, Sparkles, SkipForward } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type ToolActivity = {
  toolName: string;
  toolLabel: string;
  source: string;
  fetchedAt: string;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  toolActivity?: ToolActivity[];
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const { language } = useI18n();
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const direction = getChatDirection(language);
  const textAlignment = getChatTextAlignment(language);
  const assistantBubbleAlignment = getAssistantBubbleAlignment(language);
  const markdownDirection = getChatMarkdownDirection(language);
  const [visibleTypingUnits, setVisibleTypingUnits] = useState(0);
  const [typingSkipped, setTypingSkipped] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  const lastAssistantMessage = [...displayMessages].reverse().find((msg) => msg.role === "assistant");
  const lastAssistantMessageIndex = lastAssistantMessage
    ? displayMessages.lastIndexOf(lastAssistantMessage)
    : -1;
  const typingMessageKey = lastAssistantMessage
    ? `${lastAssistantMessageIndex}:${lastAssistantMessage.content}`
    : null;
  const typingUnits = lastAssistantMessage ? getTypingUnits(lastAssistantMessage.content) : [];

  useEffect(() => {
    if (!typingMessageKey || !lastAssistantMessage) {
      setVisibleTypingUnits(0);
      setTypingSkipped(false);
      return;
    }

    setVisibleTypingUnits(prefersReducedMotion ? typingUnits.length : 0);
    setTypingSkipped(prefersReducedMotion);
  }, [lastAssistantMessage?.content, prefersReducedMotion, typingMessageKey]);

  useEffect(() => {
    if (
      !typingMessageKey ||
      typingSkipped ||
      prefersReducedMotion ||
      visibleTypingUnits >= typingUnits.length
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleTypingUnits((current) => Math.min(current + 1, typingUnits.length));
    }, getTypingInterval(lastAssistantMessage?.content ?? ""));

    return () => window.clearTimeout(timer);
  }, [lastAssistantMessage?.content, prefersReducedMotion, typingMessageKey, typingSkipped, typingUnits.length, visibleTypingUnits]);

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      dir={direction}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className={cn("flex h-full flex-col p-4", textAlignment)}>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className={cn("flex flex-col space-y-4 p-4", textAlignment)}>
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                const isTypingAssistantMessage =
                  message.role === "assistant" &&
                  index === lastAssistantMessageIndex &&
                  typingMessageKey === `${index}:${message.content}`;
                const isTypingInProgress =
                  isTypingAssistantMessage &&
                  !typingSkipped &&
                  !prefersReducedMotion &&
                  visibleTypingUnits < getTypingUnits(message.content).length;
                const messageContent = isTypingAssistantMessage
                  ? getTypingPreview(message.content, visibleTypingUnits)
                  : message.content;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : `${assistantBubbleAlignment} items-start`
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                      <div
                        dir={direction}
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-2.5",
                          textAlignment,
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="space-y-3">
                          <div dir={markdownDirection.direction} className={cn("assistant-markdown prose prose-sm dark:prose-invert max-w-none", markdownDirection.alignment, markdownDirection.className)}>
                            <Streamdown>{messageContent}</Streamdown>
                          </div>
                          {isTypingInProgress && (
                            <button
                              type="button"
                              onClick={() => {
                                setTypingSkipped(true);
                                setVisibleTypingUnits(getTypingUnits(message.content).length);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={language === "ar" ? "عرض الرد كاملًا" : "Show full reply"}
                            >
                              <SkipForward className="size-3.5" aria-hidden="true" />
                              {language === "ar" ? "عرض الرد كاملًا" : "Show full reply"}
                            </button>
                          )}
                          {message.toolActivity && message.toolActivity.length > 0 && (
                            <div dir={direction} className="flex flex-wrap gap-2 border-t border-border/70 pt-3" aria-label="مصادر بيانات التحليل">
                              {message.toolActivity.map((activity, activityIndex) => (
                                <div key={`${activity.toolName}-${activity.fetchedAt}-${activityIndex}`} className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] leading-5 text-muted-foreground">
                                  <DatabaseZap className="size-3 text-primary" aria-hidden="true" />
                                  <span className="font-medium text-foreground">{activity.toolLabel}</span>
                                  <span>· {activity.source}</span>
                                  <Clock3 className="mr-0.5 size-3" aria-hidden="true" />
                                  <time dateTime={activity.fetchedAt}>{new Date(activity.fetchedAt).toLocaleTimeString(language === "ar" ? "ar" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p dir={direction} className={cn("whitespace-pre-wrap text-sm", textAlignment)}>
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className={cn("flex items-start gap-3", assistantBubbleAlignment)}
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t bg-background/50 items-end"
        dir={direction}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          dir={direction}
          className={cn("flex-1 max-h-32 resize-none min-h-9", textAlignment)}
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
