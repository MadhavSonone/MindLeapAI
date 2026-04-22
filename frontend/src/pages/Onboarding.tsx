import { useState } from 'react';
import { useUserStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Zap } from 'lucide-react';
import axios from 'axios';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const { setOnboardingData, completeOnboarding, setUserName } = useUserStore();

  const [formData, setFormData] = useState({
    name: '',
    targetExam: 'JEE Mains',
    goalDate: '2025-04-01',
    dailyHours: 4,
  });

  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Update local store
      setUserName(formData.name);
      setOnboardingData({
        targetExam: formData.targetExam,
        goalDate: formData.goalDate,
        dailyHours: formData.dailyHours,
      });

      // 2. Initialize Strategy on Backend
      await axios.post(`http://localhost:8000/agents/strategy/initialize`, {
        user_id: 1,
        goalDate: formData.goalDate,
        dailyHours: formData.dailyHours,
        targetExam: formData.targetExam,
      });

      // 3. Complete onboarding
      completeOnboarding();
    } catch (error) {
      console.error("Failed to initialize strategy:", error);
      // Fallback: still finish so user isn't stuck
      completeOnboarding();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Phase 01_Identity</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Who are you?</h1>
                <p className="text-sm text-neutral-400 mt-4">We need your code name to begin the mission.</p>
              </div>
              <input
                autoFocus
                className="w-full text-4xl font-bold border-b-2 border-black outline-none py-2 placeholder:text-neutral-100"
                placeholder="TestUser"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <button
                onClick={handleNext}
                disabled={!formData.name}
                className="btn-minimal w-full flex items-center justify-between"
              >
                Establish Identity <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Phase 02_Parameters</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Target & Window.</h1>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-400 block mb-2">Primary Objective</label>
                  <select
                    className="w-full p-4 border border-black text-sm font-bold appearance-none bg-white"
                    value={formData.targetExam}
                    onChange={(e) => setFormData({ ...formData, targetExam: e.target.value })}
                  >
                    <option>JEE Mains</option>
                    {/* <option>JEE Advanced</option> */}
                    {/* <option>BITSAT</option> */}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-400 block mb-2">Final Deadline</label>
                  <input
                    type="date"
                    className="w-full p-4 border border-black text-sm font-bold"
                    value={formData.goalDate}
                    onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={handleNext}
                className="btn-minimal w-full flex items-center justify-between"
              >
                Lock Parameters <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Phase 03_Resource</span>
                <h1 className="text-4xl font-black uppercase tracking-tighter mt-2 leading-none">Daily Fuel.</h1>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 block mb-4">Study Hours per Day</label>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="range" min="1" max="16"
                    className="flex-1 accent-black"
                    value={formData.dailyHours}
                    onChange={(e) => setFormData({ ...formData, dailyHours: parseInt(e.target.value) })}
                  />
                  <span className="text-4xl font-black w-20 text-right">{formData.dailyHours}H</span>
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={loading}
                className="btn-minimal w-full flex items-center justify-between"
              >
                {loading ? 'Initializing Strategy...' : 'Initiate MindLeap'}
                {loading ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} fill="black" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
