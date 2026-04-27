import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../common/Card';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { insightsService, type InsightLog, type ActionResult, type HistoryMessage } from '../../services/insights';
import { financeService } from '../../services/finance';
import type { Transaction } from '../../services/types';

export function ChatPage() {
  const { token, user, logout } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const accountId = user?.id ?? '';
  const [logs, setLogs] = useState<InsightLog[]>([]);
  const [actionMap, setActionMap] = useState<Record<number, ActionResult>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token || !accountId) return;
    void insightsService
      .listLogs(token, accountId, 50, { onUnauthorized: logout })
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'));
  }, [accountId, logout, token]);

  useEffect(() => {
    if (!token) return;
    void financeService
      .listTransactions(token, { onUnauthorized: logout })
      .then(setTransactions)
      .catch(() => {/* non-critical: sidebar will just be empty */});
  }, [token, logout]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, sending]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    let income = 0;
    let expense = 0;
    let count = 0;
    for (const t of transactions) {
      const d = new Date(t.occurredAt || t.occurred_at);
      if (d.getMonth() !== m || d.getFullYear() !== y) continue;
      count += 1;
      const amt = Number(t.amount || 0);
      if (t.type === 'INCOME') income += amt;
      else if (t.type === 'EXPENSE') expense += amt;
    }
    return { income, expense, net: income - expense, count };
  }, [transactions]);

  const handleSend = async () => {
    if (!token || !accountId) {
      setError('Please sign in again.');
      return;
    }
    if (!input.trim()) return;
    setSending(true);
    setError('');
    try {
      // Build conversation history from existing messages for multi-turn context
      const history: HistoryMessage[] = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.historyContent ?? msg.text,
      }));

      const { log, action } = await insightsService.chat(
        token,
        { prompt: input.trim(), displayCurrency: currency, history },
        { onUnauthorized: logout },
      );
      setLogs((prev) => [log, ...prev]);
      if (action) {
        setActionMap((prev) => ({ ...prev, [log.id]: action }));
      }
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
      const newFeedback = currentLog?.feedback === feedback ? 0 : feedback;
      const updated = await insightsService.submitFeedback(token, logId, newFeedback as 1 | -1 | 0, { onUnauthorized: logout });
      setLogs((prev) => prev.map((l) => (l.id === logId ? updated : l)));
    } catch {
      // silent fail for feedback
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!token) return;
    const confirmed = window.confirm('Delete this chat response from history? This also removes it from the database.');
    if (!confirmed) return;

    try {
      await insightsService.deleteLog(token, logId, { onUnauthorized: logout });
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      setActionMap((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat log');
    }
  };

  const messages = useMemo(() => {
    const flattened: { id: string | number; logId: number; role: 'user' | 'ai'; text: string; historyContent?: string; timestamp: string | null; latencyMs: number | null; feedback: number | null; action?: ActionResult }[] = [];
    logs.forEach((log) => {
      if (log.user_query) {
        flattened.push({ id: `${log.id}-u`, logId: log.id, role: 'user', text: log.user_query, timestamp: log.timestamp, latencyMs: null, feedback: null });
      }
      if (log.ai_response) {
        const act = actionMap[log.id] ?? (log.action && typeof log.action === 'object' && !Array.isArray(log.action) ? log.action as ActionResult : undefined);
        const historyContent =
          log.context_snapshot &&
          typeof log.context_snapshot === 'object' &&
          !Array.isArray(log.context_snapshot) &&
          'model_output' in log.context_snapshot &&
          log.context_snapshot.model_output
            ? JSON.stringify(log.context_snapshot.model_output)
            : log.ai_response;
        let displayText = log.ai_response;
        try {
          const parsed = JSON.parse(log.ai_response);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.message === 'string') {
            displayText = parsed.message;
          }
        } catch {
          // Keep raw ai_response when it is normal prose.
        }
        flattened.push({ id: `${log.id}-ai`, logId: log.id, role: 'ai', text: displayText, historyContent, timestamp: log.timestamp, latencyMs: log.latency_ms, feedback: log.feedback, action: act });
      }
    });
    return flattened.sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
  }, [logs, actionMap]);

  const renderAiText = (text: string) => {
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

  const formatActionMessage = (act: ActionResult): string => {
    if (!act.success) return `Failed: ${act.error ?? 'Unknown error'}`;
    const r = act.record ?? {};
    const fmtAmt = (v: unknown) => v ? `${Number(v).toLocaleString('vi-VN')} VND` : '';
    switch (act.type) {
      case 'create_transaction':
        return `Logged ${(r.type as string) ?? 'EXPENSE'}: ${fmtAmt(r.amount)}${r.categoryName ? ` (${r.categoryName})` : ''}`;
      case 'create_budget':
        return `Budget created: ${fmtAmt(r.amountLimit)} ${(r.period as string) ?? 'MONTHLY'}${r.categoryName ? ` for ${r.categoryName}` : ''}`;
      case 'update_transaction':
        return `Transaction updated${r.amount ? `: ${fmtAmt(r.amount)}` : ''}`;
      case 'update_budget':
        return `Budget updated${r.amountLimit ? `: ${fmtAmt(r.amountLimit)}` : ''}`;
      case 'delete_transaction':
        return `Transaction deleted${r.amount ? `: ${fmtAmt(r.amount)}` : ''}`;
      case 'delete_budget':
        return `Budget deleted`;
      default:
        return 'Action completed';
    }
  };

  const quickPrompts = ['Log 50k lunch expense', 'How much can I save?', 'Set budget 5m for food', 'Delete last transaction'];

  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const total = monthSummary.income + monthSummary.expense;
  const incomePct = total > 0 ? (monthSummary.income / total) * 100 : 0;
  const expensePct = total > 0 ? (monthSummary.expense / total) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <p className="text-xs text-slate-400 mb-3">Powered by FINA Brain + Your Transaction History</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left: Chat panel ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Header card */}
          <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-lg">Your AI Financial Advisor</h2>
                <p className="text-sm text-white/80">I've analyzed your spending patterns.</p>
              </div>
            </div>
          </Card>

          {error && <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}

          {/* Chat messages */}
          <Card className="p-0 overflow-hidden">
            <div className="h-[50vh] overflow-y-auto bg-slate-50 p-4 space-y-4">
              {messages.length === 0 && !sending && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <p className="text-lg font-medium">No conversations yet</p>
                  <p className="text-sm">Start by asking about your finances</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-indigo-600">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border border-slate-100'}`}>
                    {msg.role === 'ai' ? renderAiText(msg.text) : (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                    )}
                    {msg.role === 'ai' && msg.action && (
                      <div
                        className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                          msg.action.success
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border border-rose-200 text-rose-800'
                        }`}
                      >
                        <span>{msg.action.success ? '\u2713' : '\u2717'}</span>
                        <span>{formatActionMessage(msg.action)}</span>
                      </div>
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
                        <button
                          onClick={() => void handleDeleteLog(msg.logId)}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-colors"
                          title="Delete this chat log"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3.5a.75.75 0 000 1.5h.3l.73 10.18A2.5 2.5 0 007.02 18h5.96a2.5 2.5 0 002.49-2.32L16.2 5.5h.3a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v-.25c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5zm1.25 4a.75.75 0 01.75.75v5a.75.75 0 01-1.5 0v-5A.75.75 0 018.75 8zm3.25.75a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-500">
                        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-indigo-600">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm shadow-sm">
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

            {/* Input area */}
            <div className="border-t border-slate-200 p-3 space-y-2">
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
                  placeholder="Ask about your finances..."
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
              <div className="flex gap-2 flex-wrap">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-xs text-slate-500 border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right: This-month summary ── */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">{monthName} at a glance</h3>
                <p className="text-xs text-slate-400">{monthSummary.count} transaction{monthSummary.count === 1 ? '' : 's'} this month</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              </div>
            </div>

            {/* Net balance */}
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500">Net balance</p>
              <p className={`text-2xl font-bold ${monthSummary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatPrice(monthSummary.net)}
              </p>
            </div>

            {/* Income vs Expense bar */}
            {total > 0 ? (
              <div className="mb-4">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${incomePct}%` }} />
                  <div className="bg-rose-500" style={{ width: `${expensePct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>Income {incomePct.toFixed(0)}%</span>
                  <span>Expense {expensePct.toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400 text-center">
                No activity this month yet
              </div>
            )}

            {/* Income row */}
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-600">Income</span>
              </div>
              <span className="text-sm font-semibold text-emerald-700">{formatPrice(monthSummary.income)}</span>
            </div>

            {/* Expense row */}
            <div className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-600">Expense</span>
              </div>
              <span className="text-sm font-semibold text-rose-700">{formatPrice(monthSummary.expense)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
