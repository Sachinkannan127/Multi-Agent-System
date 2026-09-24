import React, { useState } from 'react';
import { Upload, Layers, Search, Database, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { ragApi } from '../api/ragApi';
import { Loader } from '../components/common/Loader';

export const RagStudioView = () => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState('');

  // Hybrid Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [topK, setTopK] = useState(3);
  const [rrfK, setRrfK] = useState(60);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadStatus('Uploading PDF document...');

    try {
      // 1. Upload
      const uploadRes = await ragApi.uploadPdf(file);
      const uploadedFilename = uploadRes.filename;
      setFilename(uploadedFilename);

      // 2. Embed & store in MongoDB
      setUploadStatus('Chunking text & computing vector embeddings...');
      await ragApi.embedPdf(uploadedFilename);

      setUploadStatus(`Document '${uploadedFilename}' embedded & indexed successfully!`);
    } catch (err) {
      setUploadStatus(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleHybridSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const res = await ragApi.hybridSearch(searchQuery, topK, rrfK);
      setSearchResults(res);
    } catch (err) {
      alert(`Search Error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-8">
      {/* View Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            RAG & Hybrid Search Studio
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Combines Semantic Vector Search (Dense), BM25 Term Frequency Search (Sparse), and Reciprocal Rank Fusion (RRF).
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          BM25 + Vector + RRF Enabled
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PDF Upload & Embed Card */}
        <div className="glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-200 border-b border-slate-800 pb-3">
            <Upload className="w-4 h-4 text-purple-400" />
            Document Upload & Vector Store Indexing
          </h3>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-purple-500/50 rounded-2xl p-6 text-center transition cursor-pointer bg-slate-950/40">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="pdf-input"
              />
              <label htmlFor="pdf-input" className="cursor-pointer block space-y-2">
                <FileText className="w-8 h-8 text-purple-400 mx-auto" />
                <div className="text-xs font-medium text-slate-300">
                  {file ? file.name : 'Click or drag PDF here to upload'}
                </div>
                <div className="text-[10px] text-slate-500">Supports PDF format up to 25MB</div>
              </label>
            </div>

            <button
              type="submit"
              disabled={!file || uploading}
              className="btn-primary w-full justify-center"
            >
              {uploading ? 'Processing Document...' : 'Upload & Embed in MongoDB'}
            </button>
          </form>

          {uploadStatus && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              uploadStatus.includes('successfully')
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}>
              {uploadStatus.includes('successfully') ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>

        {/* Hybrid Search Tester & Results Panel */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-200 border-b border-slate-800 pb-3">
            <Search className="w-4 h-4 text-indigo-400" />
            Hybrid Search Playground (RRF Re-ranker)
          </h3>

          <form onSubmit={handleHybridSearch} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter query to test Hybrid Search (e.g. candidate skills)..."
                className="flex-1 glass-input text-sm"
              />
              <button type="submit" disabled={searching || !searchQuery.trim()} className="btn-primary">
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Top K Results: <span className="font-bold text-white">{topK}</span></label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">RRF Constant (k): <span className="font-bold text-white">{rrfK}</span></label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={rrfK}
                  onChange={(e) => setRrfK(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </form>

          {searching && <Loader label="Computing Dense Vector Cosine Similarity & Sparse BM25 RRF scores..." />}

          {searchResults && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Found <span className="font-bold text-indigo-400">{searchResults.total_results}</span> ranked chunks</span>
                <span>Mode: <span className="font-mono text-purple-300">{searchResults.search_mode}</span></span>
              </div>

              {searchResults.results.map((r, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-mono font-bold text-indigo-300">Chunk ID: {r.chunk_id}</span>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold">
                        RRF Score: {r.rrf_score}
                      </span>
                      <span className="text-slate-400">Semantic Score: <span className="text-cyan-300 font-mono">{r.semantic_score}</span></span>
                      <span className="text-slate-400">BM25 Score: <span className="text-emerald-300 font-mono">{r.keyword_score}</span></span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg font-mono leading-relaxed border border-slate-900">
                    {r.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
