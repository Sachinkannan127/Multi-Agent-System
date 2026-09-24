import React, { useState } from 'react';
import { Compass, Zap, ArrowRight } from 'lucide-react';
import { routerApi } from '../api/routerApi';
import { Badge } from '../components/common/Badge';
import { Loader } from '../components/common/Loader';

export const RouterDebugView = () => {
  const [testPrompt, setTestPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [classification, setClassification] = useState(null);

  const samplePrompts = [
    { text: 'Summarize candidate skills from the uploaded resume PDF.', expected: 'rag' },
    { text: 'Scrape https://news.ycombinator.com and extract top stories.', expected: 'toolcalling' },
    { text: 'Search Tavily for latest AI news.', expected: 'toolcalling' },
    { text: 'What is the capital of France?', expected: 'direct' },
  ];

  const handleClassify = async (promptToTest) => {
    const query = promptToTest || testPrompt;
    if (!query.trim() || loading) return;

    setLoading(true);
    try {
      const res = await routerApi.classifyPrompt(query);
      setClassification(res);
    } catch (err) {
      alert(`Router Classification Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8 pr-2">
      {/* View Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            Smart Prompt Intent Router Classifier
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Evaluates user intent and dynamically routes prompts to 'rag', 'toolcalling', or 'direct'.
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
          LLM Prompt Classifier Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Prompt Tester */}
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
            Prompt Classification Tester
          </h3>

          <div className="space-y-3">
            <textarea
              rows={4}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Type any question or prompt to evaluate intent classification..."
              className="w-full glass-input text-sm resize-none"
            />
            <button
              onClick={() => handleClassify()}
              disabled={loading || !testPrompt.trim()}
              className="btn-primary w-full justify-center"
            >
              <Zap className="w-4 h-4" />
              <span>Evaluate Intent Classification</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs font-medium text-slate-400">Sample Test Prompts:</span>
            <div className="space-y-2">
              {samplePrompts.map((sp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTestPrompt(sp.text);
                    handleClassify(sp.text);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 transition flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate pr-2">{sp.text}</span>
                  <Badge route={sp.expected} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Classification Result Inspection Card */}
        <div className="glass-panel p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
              Classification Diagnostic Output
            </h3>

            {loading && <Loader label="Evaluating intent with LLM prompt router classifier..." />}

            {classification ? (
              <div className="space-y-4 pt-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400">Determined Route:</span>
                  <Badge route={classification.route} />
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-purple-400">Reasoning Rationale:</span>
                  <p className="text-xs text-slate-300 italic border-l-2 border-purple-500 pl-3 leading-relaxed">
                    "{classification.reasoning || 'No specific reasoning provided.'}"
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-emerald-400">Executed Response Preview:</span>
                  <div className="text-xs text-slate-200 font-mono bg-slate-950 p-3 rounded-lg max-h-48 overflow-y-auto leading-relaxed border border-slate-900">
                    {classification.response}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                <Compass className="w-10 h-10 text-slate-600" />
                <p className="text-xs">Select or type a prompt to test classification output.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
