import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronLeft, Calendar, Award, BarChart2, BookOpen, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useStore';

interface MockAttempt {
  id: number;
  score: number;
  total_questions: number;
  timestamp: string;
  report_json: string;
  review_text: string;
}

const MockReview = () => {
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const [attempts, setAttempts] = useState<MockAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<MockAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  const handleRecalibrate = async () => {
    try {
      await axios.post('http://localhost:8000/agents/strategy/recalibrate', { user_id: userId });
      alert("AI Strategy Recalibrated! Check your Dashboard for the updated mission grid.");
    } catch (error) {
      console.error("Recalibration failed:", error);
    }
  };

  useEffect(() => {
    axios.get(`http://localhost:8000/mock/history/${userId}`)
      .then(res => {
        setAttempts(res.data);
        if (res.data.length > 0) setSelectedAttempt(res.data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const getReport = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Syncing Attempts...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <header className="p-12 border-b border-neutral-50 flex justify-between items-center bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/mock')} className="p-2 border border-transparent hover:border-black transition-all">
            <ChevronLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1 mb-2 block w-fit">Exam</span>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Attempt Reviews.</h1>
          </div>
        </div>
        <div className="flex gap-12 items-center">
          <button
            onClick={handleRecalibrate}
            className="flex items-center gap-3 border border-black px-6 py-2 hover:bg-neutral-50 transition-all group"
          >
            <Zap size={14} className="group-hover:fill-black" />
            <span className="text-[10px] font-black uppercase tracking-widest">Recalibrate Strategy</span>
          </button>
          <div className="text-right">
            <span className="text-[9px] font-black uppercase text-neutral-300 block mb-1">Total Attempts</span>
            <span className="text-2xl font-black">{attempts.length}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Attempt List */}
        <aside className="w-80 border-r border-neutral-50 flex flex-col bg-neutral-50/50">
          <div className="p-6 border-b border-neutral-50 flex items-center gap-3">
            <Clock size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">History</span>
          </div>
          <div className="flex-1 scroll-area p-0">
            {attempts.map(attempt => (
              <button
                key={attempt.id}
                onClick={() => setSelectedAttempt(attempt)}
                className={`w-full text-left p-6 border-b border-neutral-50 transition-all ${selectedAttempt?.id === attempt.id ? 'bg-white border-l-4 border-l-black' : 'hover:bg-white/50'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-black text-neutral-400">
                    {new Date(attempt.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-tighter">
                    {Math.round((attempt.score / attempt.total_questions) * 100)}%
                  </span>
                </div>
                <h4 className="text-xs font-bold uppercase">Mock Test #{attempt.id}</h4>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content: Detailed Report */}
        <main className="flex-1 scroll-area p-12">
          {selectedAttempt ? (
            <div className="max-w-4xl mx-auto space-y-16">

              {/* Summary Hero */}
              <div className="grid grid-cols-3 gap-8 pb-16 border-b border-neutral-100">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-neutral-400">Total Score</span>
                  <div className="text-5xl font-black">{selectedAttempt.score} <span className="text-xl text-neutral-200">/ {selectedAttempt.total_questions}</span></div>
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-neutral-400">Accuracy</span>
                  <div className="text-5xl font-black">{Math.round((selectedAttempt.score / selectedAttempt.total_questions) * 100)}%</div>
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-neutral-400">Attempted on</span>
                  <div className="text-lg font-bold uppercase mt-2">{new Date(selectedAttempt.timestamp).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Chapter Report */}
              <div>
                <div className="flex items-center gap-3 mb-12">
                  <BarChart2 size={16} />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">Chapter-wise Evaluation</h3>
                </div>

                <div className="grid gap-6">
                  {Object.entries(getReport(selectedAttempt.report_json)).map(([chapter, accuracy]: [string, any]) => (
                    <div key={chapter} className="border border-neutral-100 p-8 flex justify-between items-center group hover:border-black transition-all">
                      <div className="flex items-center gap-6">
                        <div className={`h-12 w-1 border-r-4 ${accuracy > 70 ? 'border-black' : accuracy > 40 ? 'border-neutral-300' : 'border-neutral-100'}`} />
                        <div>
                          <h4 className="text-sm font-black uppercase mb-1">{chapter}</h4>
                          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">
                            Evaluation: {accuracy > 70 ? 'Superior' : accuracy > 40 ? 'Nominal' : 'Critical Gap'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black">{Math.round(accuracy) || 0}%</span>
                        <div className="w-32 h-1 bg-neutral-50 mt-2 overflow-hidden">
                          <div
                            className="h-full bg-black transition-all duration-1000"
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Insight */}
              <div className="p-8 border border-neutral-100 bg-neutral-50/50">
                <div className="flex items-center gap-3 mb-4">
                  <Award size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Performance Analyst Insight</span>
                </div>
                <div className="text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap italic">
                  {selectedAttempt.review_text || "The Performance Analyst is still calculating your qualitative review. Check back in a few moments."}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <BookOpen size={48} className="text-neutral-100 mb-6" />
              <p className="text-[10px] font-black uppercase text-neutral-300">No Simulation Data Selected.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MockReview;
