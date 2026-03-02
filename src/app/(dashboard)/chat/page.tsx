"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What would happen if I maxed out my 401k?",
  "Should I pay off my car loan early or invest?",
  "How much house can I afford?",
  "What's my projected retirement age at current savings rate?",
  "Where can I cut expenses the most?",
  "Am I on track for my financial goals?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map(
              (m: { id: string; role: string; content: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
              })
            )
          );
        }
      } catch {
        // Silent fail — empty chat is fine
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    // Optimistically add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) throw new Error("Chat request failed");
      if (!response.body) throw new Error("No response body");

      // Create placeholder assistant message
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      // Stream tokens into the assistant message
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m
          )
        );
      }
    } catch {
      toast.error("Failed to get response. Please try again.");
      // Remove the empty assistant message if it was added
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch("/api/chat", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      setMessages([]);
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear conversation");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show typing indicator when loading and no assistant message is being streamed yet
  const showTypingIndicator =
    loading &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role !== "assistant" ||
      messages[messages.length - 1]?.content === "");

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Chat</h1>
          <p className="text-muted-foreground text-sm">
            Ask questions about your finances — powered by AI
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearHistory}>
            <Trash2 className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4">
          {!historyLoaded ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-lg font-semibold">
                  Ask me anything about your finances
                </h2>
                <p className="text-sm text-muted-foreground">
                  I have context of all your uploaded financial data and can help
                  with projections, comparisons, and what-if scenarios.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    className="text-left text-xs p-3 rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content || (
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {showTypingIndicator && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            AI responses are for informational purposes only. Consult a
            financial advisor for professional advice.
          </p>
        </div>
      </div>
    </div>
  );
}
