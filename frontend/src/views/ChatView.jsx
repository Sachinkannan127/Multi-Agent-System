import React, { useState, useEffect, useRef } from 'react';
import { Send, User, RefreshCw, Cpu, Sparkles, Terminal, Paperclip, Copy, Check } from 'lucide-react';
import { langgraphApi } from '../api/langgraphApi';
import { Badge } from '../components/common/Badge';
import { Loader } from '../components/common/Loader';

export const ChatView = () => {
  const [threadId, setThreadId] = useState('session_1');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [latestRoute, setLatestRoute] = useState(null);
  const [latestReasoning, setLatestReasoning] = useState('');
  const [latestTools, setLatestTools] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreadMemory = async (id) => {
    try {
      const res = await langgraphApi.getThreadMemory(id);
      if (res.status === 'success' && res.history) {
        setMessages(res.history);
        setLatestRoute(res.route);
        setLatestTools(res.tool_calls_executed || []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    loadThreadMemory(threadId);
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt.trim();
    setPrompt('');

    const updatedMessages = [...messages, { role: 'human', content: userText }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await langgraphApi.sendGraphChat(userText, threadId);
      if (res.status === 'success') {
        setLatestRoute(res.route);
        setLatestReasoning(res.reasoning);
        setLatestTools(res.tool_calls_executed || []);

        setMessages([
          ...updatedMessages,
          { role: 'ai', content: res.response, route: res.route, tool_calls: res.tool_calls_executed }
        ]);
      }
    } catch (err) {
      setMessages([
        ...updatedMessages,
        { role: 'ai', content: `Error: ${err.message}`, isError: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const quickPrompts = [
    { label: 'RAG Document Query', text: 'What candidate skills are listed in the uploaded resume?' },
    { label: 'Live Web Scraping', text: 'Scrape https://news.ycombinator.com and extract top 3 tech stories.' },
    { label: 'Tavily Web Search', text: 'Search Tavily for the latest news on AI technology.' },
    { label: 'Direct LLM Question', text: 'Write a python function to check if a string is a palindrome.' },
  ];

  return (
    <div className="flex-1 flex gap-6 h-full min-h-0 max-w-6xl mx-auto w-full">
      {/* Thread & Tool Memory Sidebar */}
      <div className="w-80 poe-card p-4 flex flex-col justify-between shrink-0 hidden lg:flex">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-xs text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-400" />
              Thread Session Memory
            </h3>
            <button
              onClick={() => loadThreadMemory(threadId)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              title="Refresh Thread Memory"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-3">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Active Session ID
            </label>
            <input
              type="text"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
              placeholder="session_1"
            />
          </div>

          {/* Quick Route Info Card */}
          {latestRoute && (
            <div className="p-3 rounded-xl bg-[#121214] border border-white/10 space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Classified Route:</span>
                <Badge route={latestRoute} />
              </div>
              {latestReasoning && (
                <p className="text-[11px] text-slate-300 italic border-l-2 border-purple-500 pl-2">
                  "{latestReasoning}"
                </p>
              )}
            </div>
          )}

          {/* Tool Execution Trace Card */}
          {latestTools && latestTools.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>Executed Tools ({latestTools.length}):</span>
              </div>
              {latestTools.map((t, idx) => (
                <div key={idx} className="text-[10px] bg-[#121214] p-1.5 rounded border border-emerald-900/40 text-slate-300 font-mono">
                  <span className="text-emerald-300 font-bold">{t.tool}</span>
                  <div className="truncate text-slate-400">{JSON.stringify(t.args)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="space-y-1.5 pt-3 border-t border-white/10">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Quick Prompts
          </span>
          <div className="space-y-1">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(qp.text)}
                className="w-full text-left p-2 rounded-lg bg-[#121214] hover:bg-white/5 border border-white/5 hover:border-purple-500/30 text-xs text-slate-300 transition cursor-pointer"
              >
                <div className="font-medium text-purple-300 text-[11px]">{qp.label}</div>
                <div className="truncate text-slate-400 text-[10px]">{qp.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Poe Chat Viewport (Centered Stage) */}
      <div className="flex-1 poe-card flex flex-col justify-between overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 max-w-3xl mx-auto w-full">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/20 border border-purple-500/30 flex items-center justify-center text-2xl text-purple-400 mb-3 shadow-lg">
                🤖
              </div>
              <h3 className="text-xl font-bold text-white">LangGraph-Agent</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Poe-style stateful conversation stage. Start chatting with thread <span className="font-mono text-purple-400 font-bold">{threadId}</span>.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'human' || msg.role === 'user';
              return (
                <div key={idx} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/20 border border-purple-500/30 flex items-center justify-center text-base text-purple-300 shrink-0 shadow-sm">
                      🤖
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-2`}>
                    <div className={`rounded-2xl p-4 text-xs md:text-sm ${
                      isUser
                        ? 'bg-[#2B2D31] text-white rounded-br-none border border-white/10'
                        : 'bg-[#18181A] border border-white/10 text-slate-200 rounded-bl-none'
                    }`}>
                      {msg.route && (
                        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                          <Badge route={msg.route} />
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-emerald-400 font-mono">
                          ⚙️ Executed Tools: {msg.tool_calls.map(tc => tc.tool).join(', ')}
                        </div>
                      )}
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                        <button
                          onClick={() => copyToClipboard(msg.content, idx)}
                          className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                        >
                          {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 text-xs font-bold">
                      SA
                    </div>
                  )}
                </div>
              );
            })
          )}
          {loading && <Loader label="Evaluating intent & generating response..." />}
          <div ref={messagesEndRef} />
        </div>

        {/* Poe Floating Pill Input Bar */}
        <div className="p-4 bg-[#121214] border-t border-white/10">
          <form onSubmit={handleSend} className="poe-input-bar max-w-3xl mx-auto flex items-center gap-3 px-4 py-2">
            <button
              type="button"
              className="text-slate-400 hover:text-white transition cursor-pointer"
              title="Attach Document/PDF"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Talk to LangGraph-Agent (thread: ${threadId})...`}
              className="flex-1 bg-transparent text-xs md:text-sm text-white focus:outline-none py-2"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-8 h-8 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center justify-center transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
