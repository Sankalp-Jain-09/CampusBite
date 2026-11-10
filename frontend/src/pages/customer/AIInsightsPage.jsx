import { useEffect, useRef, useState } from 'react';
import { aiApi } from '../../api/ai';
import Button from '../../components/common/Button';
import PageHeader from '../../components/common/PageHeader';
import { AI_SUGGESTIONS } from '../../utils/constants';
import { formatTime } from '../../utils/format';

function errorText(err) {
  if (err.status === 429) return `You're asking a bit too fast — please try again in ${err.retryAfter || 'a few'} seconds.`;
  if (err.status === 503) return err.message || 'The AI assistant is unavailable right now. Please try again later.';
  return err.message || 'Something went wrong.';
}

export default function AIInsightsPage() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const ask = async (q) => {
    const text = (q ?? '').trim();
    if (busy) return;
    setMessages((m) => [...m, { role: 'user', text: text || 'Summarize my orders', at: new Date().toISOString() }]);
    setQuestion('');
    setBusy(true);
    try {
      const res = await aiApi.insights(text || null);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, at: res.generated_at, meta: `${res.orders_considered} orders considered` }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: errorText(err), at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="AI order insights" subtitle="Ask about your own order history. Only your orders are shared with the assistant." />
      <div className="card flex min-h-[420px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="py-6 text-center">
              <p className="font-medium">What would you like to know?</p>
              <p className="mt-1 text-sm text-gray-500">Try one of these, or type your own question.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-brand-600 text-white'
                  : m.role === 'error' ? 'border border-red-200 bg-red-50 text-red-800' : 'bg-gray-100 text-gray-900'}`}>
                {m.text}
                <div className={`mt-1 text-[11px] ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                  {formatTime(m.at)}{m.meta ? ` · ${m.meta}` : ''}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start" role="status">
              <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500">
                <span className="inline-flex gap-1"><span className="animate-bounce">●</span><span className="animate-bounce [animation-delay:150ms]">●</span><span className="animate-bounce [animation-delay:300ms]">●</span></span>
                <span className="sr-only">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {AI_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                onClick={() => ask(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask(question); }}>
            <div className="flex-1">
              <input className="input" maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What did I order from Byte Pizza last week?" aria-label="Your question" disabled={busy} />
              <p className="mt-1 text-right text-[11px] text-gray-400">{question.length}/500</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!question.trim()} loading={busy}>Ask</Button>
              <Button variant="secondary" onClick={() => ask('')} disabled={busy}>Summarize my orders</Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
