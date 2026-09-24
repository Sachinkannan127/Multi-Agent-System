import React, { useState, useEffect, useRef } from 'react';
import { Send, User, RefreshCw, Cpu, Sparkles, Terminal } from 'lucide-react';
import { GeminiSparkle } from '../components/common/GeminiSparkle';
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
    <div className="flex-1 flex gap-6 h-full min-h-0">
      {/* Thread Controls & Session Panel */}
      <div className="w-80 gemini-card p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              Thread Session Memory
            </h3>
            <button
              onClick={() => loadThreadMemory(threadId)}
              className="p-1.5 rounded-full text-slate-400 hover:text-blue-400 hover:bg-white/5 transition cursor-pointer"
              title="Refresh Thread Memory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Active Thread Session
            </label>
            <input
              type="text"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              placeholder="Enter thread_id"
            />
          </div>

          {/* Quick Route Info Card */}
          {latestRoute && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Classified Intent Route:</span>
                <Badge route={latestRoute} />
              </div>
              {latestReasoning && (
                <p className="text-xs text-slate-300 italic border-l-2 border-blue-500/50 pl-2">
                  "{latestReasoning}"
                </p>
              )}
            </div>
          )}

          {/* Tool Execution Trace Card */}
          {latestTools && latestTools.length > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>Executed Tools ({latestTools.length}):</span>
              </div>
              {latestTools.map((t, idx) => (
                <div key={idx} className="text-[11px] bg-slate-950/80 p-2 rounded-xl border border-emerald-900/40 text-slate-300 font-mono">
                  <span className="text-emerald-300 font-bold">{t.tool}</span>
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
                className="w-full text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-blue-900/20 border border-slate-800 hover:border-blue-500/40 text-xs text-slate-300 transition cursor-pointer"
              >
                <div className="font-medium text-blue-400 text-[11px]">{qp.label}</div>
                <div className="truncate text-slate-400 text-[10px]">{qp.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Gemini Chat Interface */}
      <div className="flex-1 gemini-card flex flex-col justify-between overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="p-4 rounded-full bg-slate-900 border border-white/10 mb-3 shadow-xl">
                <GeminiSparkle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold gemini-gradient-text">Gemini Stateful Assistant</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Type a prompt to start conversation memory for thread <span className="font-mono text-blue-400 font-bold">{threadId}</span>.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'human' || msg.role === 'user';
              return (
                <div key={idx} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-blue-400 shrink-0 shadow-md">
                      <GeminiSparkle className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[78%] rounded-3xl p-4 text-sm ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none shadow-lg shadow-blue-600/20'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}>
                    {msg.route && (
                      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <Badge route={msg.route} />
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80 text-xs text-emerald-400 font-mono">
                        ⚙️ Tools Executed: {msg.tool_calls.map(tc => tc.tool).join(', ')}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {loading && <Loader label="Gemini evaluating intent & executing multi-agent graph..." />}
          <div ref={messagesEndRef} />
        </div>

        {/* Gemini Rounded Pill Input Bar */}
        <form onSubmit={handleSend} className="p-4 bg-[#131314]/90 border-t border-slate-800/80 flex items-center gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Ask Gemini agent (thread: ${threadId})...`}
            className="flex-1 gemini-input-pill text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="btn-gemini text-sm px-6 py-3 rounded-full"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
