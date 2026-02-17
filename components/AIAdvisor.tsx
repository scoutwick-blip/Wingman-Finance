
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Category, Bill, Goal, Subscription, Account, UserPreferences } from '../types';
import { chatWithFinancialAdvisor, FinancialContext } from '../services/geminiService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAdvisorProps {
  transactions: Transaction[];
  categories: Category[];
  bills: Bill[];
  goals: Goal[];
  subscriptions: Subscription[];
  accounts: Account[];
  preferences: UserPreferences;
}

const QUICK_ACTIONS = [
  { label: 'Monthly Summary', prompt: 'Give me a concise summary of how I\'m doing financially this month. Include income vs expenses, key budget categories, and whether I\'m on track.' },
  { label: 'Spending Breakdown', prompt: 'Break down my spending this month by category. What are my biggest expenses and where could I realistically cut back?' },
  { label: 'Goal Progress', prompt: 'How am I progressing toward my financial goals? Am I on track to meet my deadlines? Any adjustments needed?' },
  { label: 'Upcoming Bills', prompt: 'What bills do I have coming up? Are any overdue? How much do I need to set aside for bills this month?' },
  { label: 'Subscription Audit', prompt: 'Review my active subscriptions. What\'s my total monthly subscription cost? Are there any I should consider canceling?' },
  { label: 'Save More', prompt: 'Based on my actual spending patterns, give me 3-5 specific and actionable tips to save more money this month.' },
];

export const AIAdvisor: React.FC<AIAdvisorProps> = ({
  transactions, categories, bills, goals, subscriptions, accounts, preferences
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Auto-generate initial analysis
  useEffect(() => {
    if (transactions.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      sendMessage('Give me a quick financial health check for this month. Summarize income vs expenses, highlight any budget categories that need attention, and give me 2-3 actionable tips.', true);
    }
  }, [transactions.length]);

  const buildContext = (): FinancialContext => ({
    transactions,
    categories,
    bills,
    goals,
    subscriptions,
    accounts,
    currency: preferences.currency,
  });

  const sendMessage = async (text: string, isAutoPrompt = false) => {
    if (!text.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    // Don't show the auto-generated initial prompt as a user message
    if (!isAutoPrompt) {
      setMessages(prev => [...prev, userMessage]);
    }

    setLoading(true);

    try {
      const response = await chatWithFinancialAdvisor(text, conversationHistory, buildContext());

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      setConversationHistory(prev => [
        ...prev,
        { role: 'user' as const, text },
        { role: 'model' as const, text: response },
      ]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check your connection and try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationHistory([]);
    hasInitialized.current = false;
  };

  // Render inline bold markers
  const renderInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  // Simple markdown renderer for AI responses
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();

      if (trimmed === '') return <div key={i} className="h-1.5" />;

      // Headers
      if (trimmed.startsWith('### '))
        return <p key={i} className="font-bold text-xs mt-2 mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{renderInline(trimmed.slice(4))}</p>;
      if (trimmed.startsWith('## '))
        return <p key={i} className="font-bold text-sm mt-2 mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{renderInline(trimmed.slice(3))}</p>;

      // Bullet points
      if (trimmed.match(/^[-*]\s/))
        return (
          <div key={i} className="flex gap-2 text-xs pl-2 py-0.5">
            <span style={{ color: 'var(--color-accent)' }}>•</span>
            <span>{renderInline(trimmed.replace(/^[-*]\s/, ''))}</span>
          </div>
        );

      // Numbered lists
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch)
        return (
          <div key={i} className="flex gap-2 text-xs pl-2 py-0.5">
            <span className="font-semibold min-w-[1rem]" style={{ color: 'var(--color-accent)' }}>{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );

      // Regular text
      return <p key={i} className="text-xs leading-relaxed">{renderInline(trimmed)}</p>;
    });
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col pb-4" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-2">
        <div>
          <h3 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Wingman AI</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Your personal financial advisor</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
          >
            New Chat
          </button>
        )}
      </div>

      {/* Quick Actions (shown when no messages or few messages) */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-2 px-2 pb-4">
          {QUICK_ACTIONS.map((action, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(action.prompt)}
              disabled={loading}
              className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              🤖
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                Ask me anything about your finances
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                I can see your transactions, budgets, goals, bills, and subscriptions.
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'text-white'
                : 'shadow-sm'
            }`}
              style={msg.role === 'user'
                ? { backgroundColor: 'var(--color-accent)' }
                : { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', color: 'var(--color-text-primary)' }
              }
            >
              {msg.role === 'assistant' ? (
                <div className="space-y-0.5">{formatMessageContent(msg.content)}</div>
              ) : (
                <p className="text-xs font-medium">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 shadow-sm"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)' }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-accent)', animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-accent)', animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-accent)', animationDelay: '300ms' }}></div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="px-2 pt-3" style={{ borderTop: '1px solid var(--color-border-card)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              focusRingColor: 'var(--color-accent)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Send
          </button>
        </div>

        {/* Quick suggestions below input when conversation is active */}
        {messages.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {QUICK_ACTIONS.slice(0, 4).map((action, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(action.prompt)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-border-card)',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
