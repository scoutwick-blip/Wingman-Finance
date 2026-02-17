
import React, { useState, useEffect } from 'react';
import { Transaction, Category, AIAdvice } from '../types';
import { getFinancialAdvice } from '../services/geminiService';

interface AIAdvisorProps {
  transactions: Transaction[];
  categories: Category[];
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ transactions, categories }) => {
  const [advice, setAdvice] = useState<AIAdvice | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdvice = async () => {
    setLoading(true);
    const result = await getFinancialAdvice(transactions, categories);
    setAdvice(result);
    setLoading(false);
  };

  useEffect(() => {
    if (transactions.length > 0) fetchAdvice();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-semibold text-slate-900 tracking-tighter uppercase italic">Wingman AI</h3>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.3em]">Insights & Guidance</p>
      </div>

      <div className="bg-slate-900 p-10 rounded-3xl text-white shadow-xl relative overflow-hidden border-b-8 border-indigo-600">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-8xl">💡</div>
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center text-4xl">🤖</div>
          <div className="space-y-2">
            <h4 className="text-lg font-semibold uppercase tracking-wide">Financial Health Check</h4>
            <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto">
              Analyze your spending patterns and receive tailored recommendations to reach your goals.
            </p>
          </div>
          <button 
            onClick={fetchAdvice} disabled={loading}
            className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-semibold text-xs uppercase tracking-wide shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Get New Advice'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-20 space-y-4">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Processing history...</p>
        </div>
      )}

      {advice && !loading && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Advisor Summary</h5>
            <p className="text-slate-800 leading-relaxed font-bold italic border-l-4 border-indigo-500 pl-6">"{advice.summary}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h5 className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-6">Recommendations</h5>
              <ul className="space-y-4">
                {advice.tips.map((tip, idx) => (
                  <li key={idx} className="flex gap-4 text-slate-700">
                    <span className="text-emerald-500">✨</span>
                    <span className="text-xs font-bold leading-normal">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h5 className="text-xs font-bold text-rose-500 uppercase tracking-wide mb-6">Budget Alerts</h5>
              {advice.alerts.length > 0 ? (
                <ul className="space-y-4">
                  {advice.alerts.map((alert, idx) => (
                    <li key={idx} className="flex gap-4 text-slate-700">
                      <span className="text-rose-500">📢</span>
                      <span className="text-xs font-bold leading-normal">{alert}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 font-bold uppercase italic tracking-wide">All systems go. No alerts.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
