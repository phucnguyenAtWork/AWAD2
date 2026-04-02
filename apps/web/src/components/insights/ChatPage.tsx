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

  const handleFeedback = async (logId: number, feedback: 1 | -1) => {
    if (!token) return;
    try {
      const currentLog = logs.find((l) => l.id === logId);
      // Toggle: if already selected, clear it; otherwise set it
      const newFeedback = currentLog?.feedback === feedback ? 0 : feedback;
      const updated = await insightsService.submitFeedback(token, logId, newFeedback as 1 | -1 | 0, { onUnauthorized: logout });
      setLogs((prev) => prev.map((l) => (l.id === logId ? updated : l)));
    } catch {
      // silent fail for feedback — non-critical
    }
  };

  const messages = useMemo(() => {
    const flattened: { id: string | number; logId: number; role: 'user' | 'ai'; text: string; timestamp: string | null; latencyMs: number | null; feedback: number | null }[] = [];
    logs.forEach((log) => {
      if (log.user_query) {
        flattened.push({ id: `${log.id}-u`, logId: log.id, role: 'user', text: log.user_query, timestamp: log.timestamp, latencyMs: null, feedback: null });
      }
      if (log.ai_response) {
        flattened.push({ id: `${log.id}-ai`, logId: log.id, role: 'ai', text: log.ai_response, timestamp: log.timestamp, latencyMs: log.latency_ms, feedback: log.feedback });
      }
    });
    return flattened.sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
  }, [logs]);

  const renderAiText = (text: string) => {
    // Split on action confirmation markers
    const successParts = text.split(/\n\n✅ /);
    const failureParts = (successParts[0] ?? '').split(/\n\n❌ /);

    return (
      <>
        <div className="whitespace-pre-wrap leading-relaxed">{failureParts[0]}</div>
        {failureParts[1] && (
          <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-800 text-xs font-medium">
            {failureParts[1]}
          </div>
        )}
        {successParts[1] && (
          <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-800 text-xs font-medium">
            {successParts[1]}
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
          Try: &quot;I spent 50k on coffee&quot; or &quot;Create a 2M budget for food this month&quot;
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
                {msg.role === 'ai' && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => void handleFeedback(msg.logId, 1)}
                      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                        msg.feedback === 1
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent'
                      }`}
                      title="Helpful"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3c-1.034 0-1.997.685-2.321 1.682l-.654 2.014H5.25A2.25 2.25 0 003 8.946v5.304A2.25 2.25 0 005.25 16.5h8.637a2.25 2.25 0 002.19-1.742l1.198-5.124A2.25 2.25 0 0015.088 7H12.5V4.5A1.5 1.5 0 0011 3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => void handleFeedback(msg.logId, -1)}
                      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                        msg.feedback === -1
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent'
                      }`}
                      title="Not helpful"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M19 11.75a1.25 1.25 0 10-2.5 0v-7.5a1.25 1.25 0 102.5 0v7.5zM9 17c1.034 0 1.997-.685 2.321-1.682l.654-2.014h2.775A2.25 2.25 0 0017 11.054V5.75A2.25 2.25 0 0014.75 3.5H6.113a2.25 2.25 0 00-2.19 1.742L2.725 10.366A2.25 2.25 0 004.912 13H7.5v2.5A1.5 1.5 0 009 17z" />
                      </svg>
                    </button>
                    {msg.latencyMs != null && (
                      <span className="text-[10px] text-slate-400 ml-auto">{msg.latencyMs}ms</span>
                    )}
                  </div>
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
