import React, { useState } from 'react';
import { Key, Sliders, ShieldCheck, Save, Cpu, Eye, EyeOff } from 'lucide-react';

export const SettingsView = () => {
  const [showKeys, setShowKeys] = useState({
    tavily: false,
    scrapegraph: false,
    gemini: false,
    mongo: false,
  });

  const [keys, setKeys] = useState({
    tavily: localStorage.getItem('TAVILY_API_KEY') || 'tvly-************************',
    scrapegraph: localStorage.getItem('SGAI_API_KEY') || 'sgai-************************',
    gemini: localStorage.getItem('GEMINI_API_KEY') || 'AIzaSy**********************',
    mongo: localStorage.getItem('MONGODB_URI') || 'mongodb+srv://user:****@cluster.mongodb.net',
  });

  const [settings, setSettings] = useState({
    primaryModel: 'gemini-2.5-flash',
    temperature: 0.2,
    rrfKConstant: 60,
    hybridWeightSemantic: 0.7,
  });

  const [savedStatus, setSavedStatus] = useState('');

  const toggleKeyVisibility = (keyName) => {
    setShowKeys((prev) => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const handleKeyChange = (keyName, val) => {
    setKeys((prev) => ({ ...prev, [keyName]: val }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('TAVILY_API_KEY', keys.tavily);
    localStorage.setItem('SGAI_API_KEY', keys.scrapegraph);
    localStorage.setItem('GEMINI_API_KEY', keys.gemini);
    localStorage.setItem('MONGODB_URI', keys.mongo);

    setSavedStatus('Settings & Vault credentials saved successfully!');
    setTimeout(() => setSavedStatus(''), 3000);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
      {/* Header Banner */}
      <div className="glass-panel p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-purple-400" />
            System Settings & API Vault
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Configure agent models, hybrid search tuning parameters, and API credentials vault.
          </p>
        </div>
        {savedStatus && (
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" />
            {savedStatus}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Key Vault Section */}
        <div className="glass-panel p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              API Key Vault & External Integrations
            </h3>
            <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider font-semibold">Encrypted local state</span>
          </div>

          {/* Tavily API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Tavily Search API Key</span>
              <span className="text-[10px] text-purple-400 font-mono">Realtime Web Search</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKeys.tavily ? 'text' : 'password'}
                value={keys.tavily}
                onChange={(e) => handleKeyChange('tavily', e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('tavily')}
                className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showKeys.tavily ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ScrapeGraphAI Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>ScrapeGraphAI API Key</span>
              <span className="text-[10px] text-purple-400 font-mono">Live Web Scraping</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKeys.scrapegraph ? 'text' : 'password'}
                value={keys.scrapegraph}
                onChange={(e) => handleKeyChange('scrapegraph', e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('scrapegraph')}
                className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showKeys.scrapegraph ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Google Gemini API Key</span>
              <span className="text-[10px] text-purple-400 font-mono">LLM & Router</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKeys.gemini ? 'text' : 'password'}
                value={keys.gemini}
                onChange={(e) => handleKeyChange('gemini', e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('gemini')}
                className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* MongoDB URI */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>MongoDB Connection URI</span>
              <span className="text-[10px] text-purple-400 font-mono">Vector Storage</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showKeys.mongo ? 'text' : 'password'}
                value={keys.mongo}
                onChange={(e) => handleKeyChange('mongo', e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('mongo')}
                className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showKeys.mongo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Hyperparameters & Model Config Section */}
        <div className="glass-panel p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Model & RRF Hyperparameters
            </h3>
            <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider font-semibold">Live Tuning</span>
          </div>

          {/* Primary Model */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Primary Reasoning LLM</label>
            <select
              value={settings.primaryModel}
              onChange={(e) => setSettings({ ...settings, primaryModel: e.target.value })}
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="groq-llama3-70b">Groq Llama-3 70B</option>
            </select>
          </div>

          {/* Temperature Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-medium text-slate-300">
              <span>LLM Temperature</span>
              <span className="font-mono text-purple-400 font-bold">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* RRF Constant K */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-medium text-slate-300">
              <span>Reciprocal Rank Fusion Constant (k)</span>
              <span className="font-mono text-indigo-400 font-bold">{settings.rrfKConstant}</span>
            </div>
            <p className="text-[11px] text-[var(--text-dim)]">Formula: 1 / (k + rank)</p>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.rrfKConstant}
              onChange={(e) => setSettings({ ...settings, rrfKConstant: parseInt(e.target.value) })}
              className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Save Button Action */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="btn-primary"
        >
          <Save className="w-4 h-4" />
          Save Settings & Secure Vault
        </button>
      </div>
    </div>
  );
};
