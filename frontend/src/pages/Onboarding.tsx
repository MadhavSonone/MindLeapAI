import { useState, useEffect } from 'react';
import { useUserStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Zap, Shield, X } from 'lucide-react';
import axios from 'axios';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const { setOnboardingData, completeOnboarding, setUserName, userId } = useUserStore();

  const [formData, setFormData] = useState({
    name: '',
    targetExam: 'JEE Main',
    customExamName: '',
    syllabusText: '',
    pyqText: '',
    syllabusFile: null as File | null,
    pyqFile: null as File | null,
    goalDate: '2026-03-01',
    dailyHours: 4,
  });

  const [chapters, setChapters] = useState<any[]>([]);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 4 && formData.targetExam !== 'Custom') {
      axios.get(`http://localhost:8000/subjects?exam_name=${formData.targetExam}`).then(async res => {
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
      const examName = formData.targetExam === 'Custom' ? formData.customExamName : formData.targetExam;
      setUserName(formData.name);
      setOnboardingData({
        targetExam: examName,
        goalDate: formData.goalDate,
        dailyHours: formData.dailyHours,
      });

      const fData = new FormData();
      fData.append("user_id", userId.toString());
      fData.append("goalDate", formData.goalDate);
      fData.append("dailyHours", formData.dailyHours.toString());
      fData.append("targetExam", examName);
      fData.append("completedChapters", JSON.stringify(completedChapters));
      fData.append("customSyllabus", formData.syllabusText);
      fData.append("customPyqs", formData.pyqText);
      if (formData.syllabusFile) fData.append("syllabusFile", formData.syllabusFile);
      if (formData.pyqFile) fData.append("pyqFile", formData.pyqFile);

      await axios.post(`http://localhost:8000/agents/strategy/initialize`, fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      completeOnboarding();
    } catch (error) {
      console.error("Onboarding failed:", error);
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
                <select className="w-full p-4 border border-black text-sm font-bold outline-none" value={formData.targetExam} onChange={(e) => setFormData({ ...formData, targetExam: e.target.value })}>
                  <option>JEE Main</option>
                  <option>Aptitude Test</option>
                  {/* <option>NEET</option> */}
                  {/* <option>UPSC</option> */}
                  <option>Custom</option>
                </select>
                {formData.targetExam === 'Custom' && (
                  <input
                    className="w-full p-4 border border-black text-sm font-bold outline-none"
                    placeholder="ENTER CUSTOM EXAM NAME"
                    value={formData.customExamName}
                    onChange={(e) => setFormData({ ...formData, customExamName: e.target.value })}
                  />
                )}
                <input type="date" className="w-full p-4 border border-black text-sm font-bold outline-none" value={formData.goalDate} onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })} />
              </div>
              <button onClick={() => {
                if (formData.targetExam === 'Custom') setStep(2.5); // Special sub-step
                else setStep(3);
              }} className="btn-minimal w-full flex items-center justify-between">
                Lock Parameters <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 2.5 && (
            <motion.div key="step2.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 max-h-[80vh] flex flex-col">
              <div className="shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">CONTEXT_FEED</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Syllabus & PYQs.</h1>
              </div>
              <div className="space-y-6 flex-1 overflow-y-auto scroll-area pr-4">
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">Syllabus Context</label>
                  <div className="grid grid-cols-2 gap-4">
                    <textarea
                      className="p-4 border border-neutral-100 text-xs font-bold outline-none min-h-[120px] focus:border-black transition-colors col-span-2 md:col-span-1"
                      placeholder="Paste syllabus text..."
                      value={formData.syllabusText}
                      onChange={(e) => setFormData({ ...formData, syllabusText: e.target.value })}
                    />
                    <div className="border-2 border-dashed border-neutral-100 p-4 flex flex-col items-center justify-center text-center group hover:border-black transition-all cursor-pointer relative">
                      <Zap size={24} className="text-neutral-200 group-hover:text-black mb-2" />
                      <span className="text-[8px] font-black uppercase text-neutral-300 group-hover:text-black">Upload Syllabus PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setFormData({ ...formData, syllabusFile: e.target.files?.[0] || null })}
                      />
                      {formData.syllabusFile && (
                        <div className="flex items-center gap-2 mt-2 bg-neutral-50 px-2 py-1 rounded">
                          <span className="text-[8px] font-bold text-black underline truncate max-w-[150px]">{formData.syllabusFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, syllabusFile: null }); }} className="text-neutral-400 hover:text-black">
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">PYQ Patterns</label>
                  <div className="grid grid-cols-2 gap-4">
                    <textarea
                      className="p-4 border border-neutral-100 text-xs font-bold outline-none min-h-[120px] focus:border-black transition-colors col-span-2 md:col-span-1"
                      placeholder="Paste sample questions..."
                      value={formData.pyqText}
                      onChange={(e) => setFormData({ ...formData, pyqText: e.target.value })}
                    />
                    <div className="border-2 border-dashed border-neutral-100 p-4 flex flex-col items-center justify-center text-center group hover:border-black transition-all cursor-pointer relative">
                      <Shield size={24} className="text-neutral-200 group-hover:text-black mb-2" />
                      <span className="text-[8px] font-black uppercase text-neutral-300 group-hover:text-black">Upload PYQ PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setFormData({ ...formData, pyqFile: e.target.files?.[0] || null })}
                      />
                      {formData.pyqFile && (
                        <div className="flex items-center gap-2 mt-2 bg-neutral-50 px-2 py-1 rounded">
                          <span className="text-[8px] font-bold text-black underline truncate max-w-[150px]">{formData.pyqFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, pyqFile: null }); }} className="text-neutral-400 hover:text-black">
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(3)} className="btn-minimal w-full flex items-center justify-between shrink-0">
                Analyze Context <ArrowRight size={14} />
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
