import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, RefreshCw, Cpu, Code2, Sparkles, Terminal, Layers } from 'lucide-react';
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

    // Append optimistic user message
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

  const quickPrompts = [
    { label: 'RAG Document Query', text: 'What candidate skills are listed in the uploaded resume?' },
    { label: 'Live Web Scraping', text: 'Scrape https://news.ycombinator.com and extract top 3 tech stories.' },
    { label: 'Tavily Web Search', text: 'Search Tavily for the latest news on AI technology.' },
    { label: 'Direct LLM Question', text: 'Write a python function to check if a string is a palindrome.' },
  ];

  return (
    <div className="flex-1 flex gap-6 h-[calc(100vh-140px)]">
      {/* Thread Controls & Session Panel */}
      <div className="w-80 glass-panel p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Thread Session Memory
            </h3>
            <button
              onClick={() => loadThreadMemory(threadId)}
              className="p-1 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-white/5 transition"
              title="Refresh Thread Memory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text-dim)] mb-1.5">
              Active Thread ID
            </label>
            <input
              type="text"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className="w-full glass-input text-sm"
              placeholder="Enter thread_id"
            />
          </div>

          {/* Quick Route Info Card */}
          {latestRoute && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Last Classified Route:</span>
                <Badge route={latestRoute} />
              </div>
              {latestReasoning && (
                <p className="text-xs text-slate-300 italic border-l-2 border-purple-500/50 pl-2">
                  "{latestReasoning}"
                </p>
              )}
            </div>
          )}

          {/* Tool Execution Trace Card */}
          {latestTools && latestTools.length > 0 && (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>Executed Tools ({latestTools.length}):</span>
              </div>
              {latestTools.map((t, idx) => (
                <div key={idx} className="text-[11px] bg-slate-950/60 p-2 rounded border border-emerald-900/40 text-slate-300">
                  <span className="font-mono text-emerald-300 font-bold">{t.tool}</span>
                  <div className="truncate text-slate-400">{JSON.stringify(t.args)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Quick Prompts:
          </span>
          <div className="space-y-1.5">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(qp.text)}
                className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-purple-900/20 border border-slate-800 hover:border-purple-500/30 text-xs text-slate-300 transition"
              >
                <div className="font-medium text-purple-300 text-[11px]">{qp.label}</div>
                <div className="truncate text-slate-400 text-[10px]">{qp.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="flex-1 glass-panel flex flex-col justify-between overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-3">
                <Bot className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">LangGraph Stateful Assistant</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Type a prompt to start conversation memory for thread <span className="font-mono text-purple-400 font-bold">{threadId}</span>.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'human' || msg.role === 'user';
              return (
                <div key={idx} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                      <Bot className="w-4.5 h-4.5" />
                    </div>
                  )}

                  <div className={`max-w-[78%] rounded-2xl p-4 text-sm ${
                    isUser
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none shadow-lg shadow-purple-600/20'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}>
                    {msg.route && (
                      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <Badge route={msg.route} />
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80 text-xs text-emerald-400 font-mono">
                        ⚙️ Tools Called: {msg.tool_calls.map(tc => tc.tool).join(', ')}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                      <User className="w-4.5 h-4.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {loading && <Loader label="Evaluating intent & executing stateful graph workflow..." />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 bg-slate-950/60 border-t border-slate-800 flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Ask stateful agent (thread: ${threadId})...`}
            className="flex-1 glass-input text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
