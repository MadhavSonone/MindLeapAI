import { useState, useEffect } from 'react';
import { useMockStore, useUserStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface Question {
  id: number;
  content: string;
  chapter_id?: number;
  options_json: string; // JSON array string
}

const Mock = () => {
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const {
    isActive, timeLeft, currentQuestionIndex, answers, mockType, chapterId, questions,
    startTest, endTest, setAnswer, setIndex, setQuestions, decrementTime
  } = useMockStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // Remove local questions state
  // const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(isActive && questions.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number } | null>(null);

  // Load Questions
  useEffect(() => {
    if (isActive && questions.length === 0) {
      setLoadingQuestions(true);
      setError(null);
      const url = mockType === 'unit' && chapterId
        ? `http://localhost:8000/mock/generate/unit/${chapterId}`
        : `http://localhost:8000/mock/generate`;

      axios.get(url)
        .then(res => {
          console.log(res.data)
          if (res.data.length === 0) {
            setError("No questions available for this module.");
          } else {
            setQuestions(res.data);
          }
        })
        .catch(err => {
          console.error("Fetch Error:", err);
          setError("Failed to download mission payload. Please check your connection.");
        })
        .finally(() => setLoadingQuestions(false));
    }
  }, [isActive, mockType, chapterId, questions.length]);

  const handleAutoSubmit = () => {
    setIsSubmitting(true);
    axios.post('http://localhost:8000/mock/submit', {
      user_id: userId,
      answers: answers
    }).then(res => {
      setFinalScore({ score: res.data.score, total: res.data.total });
      setIsSubmitting(false);
      setShowResults(true);
    });
  };

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => decrementTime(), 1000);
    } else if (isActive && timeLeft === 0) {
      handleAutoSubmit();
    }
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isActive && !showResults) {
    return (
      <div className="h-full flex items-center justify-center p-12 bg-neutral-50">
        <div className="max-w-xl w-full p-12 bg-white border border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
          <Clock className="mx-auto mb-6" size={48} />
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Mock Test.</h1>
          <p className="text-sm text-neutral-400 mb-8 uppercase tracking-widest font-medium">Complete Syllabus | 180 Minutes</p>
          <ul className="text-left space-y-3 mb-10 text-xs font-bold uppercase text-neutral-500">
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Attempt this test with your full concentration.</li>
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Try to finish this test in one go</li>
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Do not skip this test if you are not prepared for it.</li>
          </ul>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/mock-review')}
              className="flex-1 border border-black py-4 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all"
            >
              Attempt History
            </button>
            <button
              onClick={() => startTest(180)}
              className="flex-1 bg-black text-white py-4 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              Start New Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Debrief Complete.</h1>
          <div className="mb-8">
            <span className="text-[10px] font-black uppercase text-neutral-400 block mb-2">Final Score</span>
            <span className="text-6xl font-black">{finalScore?.score} <span className="text-2xl text-neutral-200">/ {finalScore?.total}</span></span>
          </div>
          <p className="text-sm text-neutral-400 mb-8 font-medium">Agent Analyst has processed your data. Your study strategy has been updated in the Dashboard.</p>
          <button
            onClick={() => { setShowResults(false); endTest(); navigate('/mock-review'); }}
            className="btn-minimal px-12"
          >
            Review Report
          </button>
        </motion.div>
      </div>
    );
  }

  if (loadingQuestions) {
    return (
      <div className="h-screen w-screen fixed top-0 left-0 bg-white flex flex-col items-center justify-center gap-6 z-[100]">
        <Loader2 className="animate-spin" size={48} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Downloading Mission Payload...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen fixed top-0 left-0 bg-white flex flex-col items-center justify-center gap-8 z-[100] p-12 text-center">
        <div className="p-4 bg-neutral-50 rounded-full">
          <Clock size={32} className="text-neutral-300" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Sync Error.</h2>
          <p className="text-sm text-neutral-400 uppercase tracking-widest max-w-xs leading-loose">{error}</p>
        </div>
        <button
          onClick={() => { endTest(); navigate('/dashboard'); }}
          className="btn-minimal px-12"
        >
          Return to Base
        </button>
      </div>
    );
  }

  // Safety Shield: If active but questions not ready
  if (isActive && questions.length === 0 && !loadingQuestions) {
    return (
      <div className="h-screen w-screen fixed top-0 left-0 bg-white flex flex-col items-center justify-center gap-6 z-[100]">
        <Loader2 className="animate-spin" size={48} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Calibrating Simulation Parameters...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen fixed top-0 left-0 bg-white flex flex-col z-50">
      <header className="px-12 py-6 border-b border-black flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">Mock Test</span>
          <span className="text-xs font-bold uppercase tracking-widest">Attempting...</span>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase text-neutral-300">Time Remaining</span>
            <span className={`text-2xl font-black tabular-nums ${timeLeft < 300 ? 'text-red-500 animate-pulse' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <button
            onClick={handleAutoSubmit}
            className="btn-minimal px-8 border-2"
          >
            Final Submit
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-24 scroll-area">
          {questions.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <span className="text-[10px] font-black uppercase text-neutral-400 mb-6 block">Question {currentQuestionIndex + 1}</span>
              <h2 className="text-3xl font-medium leading-relaxed mb-12 font-serif">
                {questions[currentQuestionIndex].content}
              </h2>

              <div className="grid gap-4 mb-20">
                {(() => {
                  try {
                    const opts = JSON.parse(questions[currentQuestionIndex].options_json || '[]');
                    const hasAnswer = answers[questions[currentQuestionIndex].id];
                    
                    return (
                      <>
                        {opts.map((opt: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setAnswer(questions[currentQuestionIndex].id, opt)}
                            className={`w-full text-left p-6 border transition-all ${answers[questions[currentQuestionIndex].id] === opt ? 'border-black bg-black text-white' : 'border-neutral-100 hover:border-black'}`}
                          >
                            <span className="text-[10px] font-black uppercase mr-4 opacity-50">{String.fromCharCode(65 + idx)}</span>
                            <span className="text-sm font-bold">{opt}</span>
                          </button>
                        ))}
                        {hasAnswer && (
                          <button 
                            onClick={() => setAnswer(questions[currentQuestionIndex].id, '')}
                            className="text-[9px] font-black uppercase text-neutral-300 hover:text-black transition-colors mt-2 text-left w-fit"
                          >
                            [ Clear Selection ]
                          </button>
                        )}
                      </>
                    );
                  } catch (e) {
                    return <p className="text-xs text-neutral-400 uppercase font-black">Error: Options Malformed.</p>;
                  }
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="w-80 border-l border-black p-8 bg-neutral-50 overflow-y-auto">
          <h3 className="text-[10px] font-black uppercase mb-8 tracking-widest">Questions</h3>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setIndex(i)}
                className={`aspect-square text-[10px] font-black border flex items-center justify-center transition-all ${currentQuestionIndex === i ? 'border-black bg-black text-white' : answers[q.id] ? 'border-black' : 'border-neutral-200 text-neutral-300'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="px-12 py-6 border-t border-black flex justify-between items-center bg-white">
        <button
          disabled={currentQuestionIndex === 0}
          onClick={() => setIndex(currentQuestionIndex - 1)}
          className="btn-minimal flex items-center gap-2"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          onClick={() => setIndex(Math.max(0, Math.min(questions.length - 1, currentQuestionIndex + 1)))}
          className="btn-minimal flex items-center gap-2"
        >
          Save & Next <ChevronRight size={14} />
        </button>
      </footer>

      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 text-white flex flex-col items-center justify-center z-[100] p-12 text-center"
          >
            <Loader2 className="animate-spin mb-8" size={64} />
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Analyzing Simulation.</h2>
            <p className="text-sm text-neutral-400 max-w-sm uppercase tracking-widest leading-loose">Agent Analyst is computing your chapter-wise accuracy and updating your mastery heatmap...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Mock;
