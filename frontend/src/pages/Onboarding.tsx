import { useState, useEffect } from 'react';
import { useUserStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Zap } from 'lucide-react';
import axios from 'axios';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const { setOnboardingData, completeOnboarding, setUserName, userId } = useUserStore();

  const [formData, setFormData] = useState({
    name: '',
    targetExam: 'JEE Mains',
    goalDate: '2025-04-01',
    dailyHours: 4,
  });

  const [chapters, setChapters] = useState<any[]>([]);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 4) {
      axios.get('http://localhost:8000/subjects').then(async res => {
        const subs = res.data;
        const allChapters: any[] = [];
        for (const sub of subs) {
          const chRes = await axios.get(`http://localhost:8000/subjects/${sub.id}/chapters`);
          allChapters.push({ subject: sub.name, list: chRes.data });
        }
        setChapters(allChapters);
      });
    }
  }, [step]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      setUserName(formData.name);
      setOnboardingData({
        targetExam: formData.targetExam,
        goalDate: formData.goalDate,
        dailyHours: formData.dailyHours,
      });

      await axios.post(`http://localhost:8000/agents/strategy/initialize`, {
        user_id: userId,
        goalDate: formData.goalDate,
        dailyHours: formData.dailyHours,
        targetExam: formData.targetExam,
        completedChapters: completedChapters
      });

      completeOnboarding();
    } catch (error) {
      console.error("Failed to initialize strategy:", error);
      completeOnboarding();
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (id: number) => {
    setCompletedChapters(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-screen w-screen bg-white flex items-center justify-center p-8 overflow-hidden">
      <div className="max-w-2xl w-full max-h-full flex flex-col">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">IDENTITY</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Who are you?</h1>
              </div>
              <input
                autoFocus
                className="w-full text-4xl font-bold border-b-2 border-black outline-none py-2 placeholder:text-neutral-100"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <button onClick={handleNext} disabled={!formData.name} className="btn-minimal w-full flex items-center justify-between">
                Establish Identity <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">GOAL</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Target & Window.</h1>
              </div>
              <div className="space-y-6">
                <select className="w-full p-4 border border-black text-sm font-bold" value={formData.targetExam} onChange={(e) => setFormData({ ...formData, targetExam: e.target.value })}>
                  <option>JEE Mains</option>
                </select>
                <input type="date" className="w-full p-4 border border-black text-sm font-bold" value={formData.goalDate} onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })} />
              </div>
              <button onClick={handleNext} className="btn-minimal w-full flex items-center justify-between">
                Lock Parameters <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">TIME ALLOCATION</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Daily Study Time.</h1>
              </div>
              <div className="flex items-center gap-4">
                <input type="range" min="1" max="16" className="flex-1 accent-black" value={formData.dailyHours} onChange={(e) => setFormData({ ...formData, dailyHours: parseInt(e.target.value) })} />
                <span className="text-4xl font-black">{formData.dailyHours}H</span>
              </div>
              <button onClick={handleNext} className="btn-minimal w-full flex items-center justify-between">
                Review Syllabus <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col h-full overflow-hidden">
              <div className="mb-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Phase 04_Baseline</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Existing Knowledge.</h1>
                <p className="text-[10px] text-neutral-400 mt-2 uppercase font-bold">Select topics you have already completed</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 space-y-8 scroll-area">
                {chapters.map(group => (
                  <div key={group.subject}>
                    <h3 className="text-[10px] font-black uppercase text-neutral-300 mb-4 tracking-[0.2em]">{group.subject}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.list.map((ch: any) => (
                        <button
                          key={ch.id}
                          onClick={() => toggleChapter(ch.id)}
                          className={`p-3 text-[9px] font-black uppercase border text-left transition-all ${completedChapters.includes(ch.id) ? 'bg-black text-white border-black' : 'border-neutral-100 text-neutral-300 hover:border-black'}`}
                        >
                          {ch.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 bg-white">
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="btn-minimal w-full flex items-center justify-between"
                >
                  {loading ? 'Initializing Strategy...' : 'Initiate MindLeap'}
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} fill="black" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
