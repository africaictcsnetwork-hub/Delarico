import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  MessageCircle,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildWhatsAppUrl } from '../utils/whatsapp';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}

const STARTER_PROMPTS = [
  'Bamburi Cement & Mabati G28 prices?',
  'How does bulk wholesale pricing work?',
  'How do I join Affiliate & earn 3–5%?',
  'Delivery to Siaya & M-Pesa payment info',
];

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Habari! Welcome to DELARICO Customer Care. Ask me about Kenyan cement, mabati, steel bars, timber, water tanks, wholesale prices, site delivery, bulk BOQ quotes, saved items, or our 3–5% Affiliate program.',
};

export const CustomerSupportChat: React.FC = () => {
  const { settings } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      window.setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages.length]);

  const directWaUrl = buildWhatsAppUrl(
    `Hello ${settings.businessName}, I need assistance from customer care.`,
    settings.whatsappNumber
  );

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.id !== 'welcome' && !m.isError)
        .slice(-10)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          text: m.text,
        }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload.slice(0, -1),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(
          data.error || 'Customer Care AI could not respond right now. Please try again.'
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
        },
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to reach AI Customer Care. Please contact us on WhatsApp.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: errorMessage,
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Expandable Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="DELARICO AI Customer Care Chat"
          className="w-[calc(100vw-2rem)] sm:w-96 max-h-[76vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-navy-900 text-white px-4 py-3 flex items-center justify-between border-b border-gold-500/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gold-500 text-navy-950 flex items-center justify-center shrink-0 relative">
                <Bot className="w-4 h-4" />
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900 absolute -bottom-0.5 -right-0.5"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight truncate">
                  Delarico Customer Care
                </div>
                <div className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
                  <span>Online · Instant Platform Support</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={directWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp ${settings.whatsappNumber}`}
                className="p-1.5 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setMessages([INITIAL_WELCOME])}
                title="Clear conversation"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close customer care chat"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-navy-900 text-white rounded-br-xs'
                      : msg.isError
                      ? 'bg-red-50 text-red-900 border border-red-200 rounded-bl-xs'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-bl-xs'
                  }`}
                >
                  {msg.isError && (
                    <div className="flex items-center gap-1.5 font-semibold text-red-800 mb-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Assistant Notice</span>
                    </div>
                  )}
                  <p>{msg.text}</p>
                  {msg.isError && (
                    <a
                      href={directWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp {settings.whatsappNumber}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Quick Starter Questions when fresh */}
            {messages.length <= 1 && !sending && (
              <div className="pt-1 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500">Quick Questions:</div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="text-left px-2.5 py-1.5 text-[11px] font-medium text-navy-900 bg-white border border-slate-200 rounded-lg hover:border-navy-900 hover:bg-gold-500/10 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Platform Links Strip */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
              <Link
                to="/products"
                onClick={() => setIsOpen(false)}
                className="text-royal-700 hover:underline font-medium inline-flex items-center gap-1"
              >
                <ShoppingBag className="w-3 h-3" />
                <span>Products</span>
              </Link>
              <span className="text-slate-300">·</span>
              <Link
                to="/request-quote"
                onClick={() => setIsOpen(false)}
                className="text-royal-700 hover:underline font-medium"
              >
                Bulk Quote
              </Link>
              <span className="text-slate-300">·</span>
              <Link
                to="/affiliates"
                onClick={() => setIsOpen(false)}
                className="text-royal-700 hover:underline font-medium"
              >
                Earn 3–5%
              </Link>
            </div>
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 font-semibold hover:underline whitespace-nowrap shrink-0"
            >
              WhatsApp Desk
            </a>
          </div>

          {/* Input Box */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={800}
              placeholder="Ask about prices, orders, delivery, quotes..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-royal-600"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="p-2 bg-navy-900 text-gold-400 rounded-lg hover:bg-navy-800 disabled:opacity-40 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Unified Bottom-Right Launcher Pill (Customer Care AI + Quick WhatsApp link inside) */}
      <div className="flex items-center gap-2">
        <a
          href={directWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chat on WhatsApp (${settings.whatsappNumber})`}
          title={`WhatsApp ${settings.whatsappNumber}`}
          className="inline-flex items-center justify-center w-10 h-10 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-transform duration-150 hover:-translate-y-0.5"
        >
          <MessageCircle className="w-4 h-4" />
        </a>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Open Delarico AI Customer Care Chat"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white text-xs font-semibold rounded-full shadow-lg border border-gold-500/50 hover:bg-navy-800 transition-transform duration-150 hover:-translate-y-0.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          <span>{isOpen ? 'Close Care' : 'Customer Care AI'}</span>
        </button>
      </div>
    </div>
  );
};
