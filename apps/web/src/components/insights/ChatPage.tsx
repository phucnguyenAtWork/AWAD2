import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../common/Card';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { insightsService, type InsightLog } from '../../services/insights';

export function ChatPage() {
  const { token, user, logout } = useAuth();
  const { currency } = useCurrency();
  const accountId = user?.id ?? '';
  const [logs, setLogs] = useState<InsightLog[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token || !accountId) return;
    void insightsService
      .listLogs(token, accountId, 50, { onUnauthorized: logout })
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'));
  }, [accountId, logout, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, sending]);

  const handleSend = async () => {
    if (!token || !accountId) {
      setError('Please sign in again.');
      return;
    }
    if (!input.trim()) return;
    setSending(true);
    setError('');
    try {
      const { log } = await insightsService.chat(
        token,
        { prompt: input.trim(), displayCurrency: currency },
        { onUnauthorized: logout },
      );
      setLogs((prev) => [log, ...prev]);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const messages = useMemo(() => {
    const flattened: { id: string | number; role: 'user' | 'ai'; text: string; timestamp: string | null }[] = [];
    logs.forEach((log) => {
      if (log.userQuery) {
        flattened.push({ id: `${log.id}-u`, role: 'user', text: log.userQuery, timestamp: log.timestamp });
      }
      if (log.aiResponse) {
        flattened.push({ id: `${log.id}-ai`, role: 'ai', text: log.aiResponse, timestamp: log.timestamp });
      }
    });
    return flattened.sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
  }, [logs]);

  const renderAiText = (text: string) => {
    // Split on the action confirmation marker
    const parts = text.split(/\n\n✅ /);
    return (
      <>
        <div className="whitespace-pre-wrap leading-relaxed">{parts[0]}</div>
        {parts[1] && (
          <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-800 text-xs font-medium">
            ✅ {parts[1]}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-4">
      <Card className="p-4">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">AI Finance Assistant</h1>
        <p className="text-sm text-slate-500">
          Log transactions, create budgets, or ask questions naturally.
          Try: "I spent 50k on coffee" or "Create a 2M budget for food this month"
        </p>
        <p className="text-xs text-slate-400 mt-1">Answers will use your preferred currency: {currency}</p>
      </Card>

      {error && <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <Card className="p-0 overflow-hidden">
        <div className="h-[60vh] overflow-y-auto bg-slate-50 p-4 space-y-4">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm">Start by telling me about a transaction or asking a question</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border border-slate-100'}`}>
                <div className="text-[11px] opacity-70 mb-1 font-medium">{msg.role === 'user' ? 'You' : 'AI Assistant'}</div>
                {msg.role === 'ai' ? renderAiText(msg.text) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm shadow-sm">
                <div className="text-[11px] opacity-70 mb-1 font-medium">AI Assistant</div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !sending) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="e.g. I spent 50k on coffee, or create a budget for food..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              disabled={sending}
            />
            <button
              onClick={() => void handleSend()}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-indigo-500 transition-colors"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
