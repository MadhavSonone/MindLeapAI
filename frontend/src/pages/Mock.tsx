import { useState, useEffect } from 'react';
import { useMockStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui';

const Mock = () => {
  const { 
    isActive, timeLeft, currentQuestionIndex, answers,
    startTest, endTest, setAnswer, setIndex, decrementTime 
  } = useMockStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Mock data for simulation
  const mockQuestions = [
    { id: 1, text: "The work done in pulling a body of mass 5kg up an inclined plane of angle 30 degrees...", options: ["A", "B", "C", "D"] },
    { id: 2, text: "A gas expands from volume V1 to V2 in an adiabatic process...", options: ["A", "B", "C", "D"] },
    { id: 3, text: "The limit of (sin x / x) as x approaches 0 is...", options: ["0", "1", "Infinity", "Undefined"] },
  ];

  const handleAutoSubmit = () => {
    setIsSubmitting(true);
    // Simulate API call to Analyst
    setTimeout(() => {
      setIsSubmitting(false);
      setShowResults(true);
    }, 3000);
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
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Mission Simulation.</h1>
          <p className="text-sm text-neutral-400 mb-8 uppercase tracking-widest font-medium">Standard JEE Mock | 180 Minutes | High Fidelity</p>
          <ul className="text-left space-y-3 mb-10 text-xs font-bold uppercase text-neutral-500">
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Auto-submission on time expiry</li>
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Full agent analysis post-session</li>
            <li className="flex items-center gap-3"><div className="w-1 h-1 bg-black" /> Distraction-free environment</li>
          </ul>
          <button 
            onClick={() => startTest(180)}
            className="btn-minimal w-full py-4 text-sm"
          >
            Commence Simulation
          </button>
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
             <p className="text-sm text-neutral-400 mb-8 font-medium">Agent Analyst has processed your data. Your study strategy has been updated in the Dashboard.</p>
             <button 
               onClick={() => { setShowResults(false); endTest(); }}
               className="btn-minimal px-12"
             >
               Return to Base
             </button>
          </motion.div>
       </div>
    );
  }

  return (
    <div className="h-screen w-screen fixed top-0 left-0 bg-white flex flex-col z-50">
      {/* Simulation Header */}
      <header className="px-12 py-6 border-b border-black flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
           <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1">Sim_Mode</span>
           <span className="text-xs font-bold uppercase tracking-widest">JEE_FULL_MOCK_v2</span>
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

      {/* Main Simulation Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Question Area */}
        <div className="flex-1 p-24 scroll-area">
           <div className="max-w-3xl mx-auto">
              <span className="text-[10px] font-black uppercase text-neutral-400 mb-6 block">Question {currentQuestionIndex + 1}</span>
              <h2 className="text-3xl font-medium leading-relaxed mb-12 font-serif">
                {mockQuestions[currentQuestionIndex].text}
              </h2>

              <div className="grid gap-4 mb-20">
                {mockQuestions[currentQuestionIndex].options.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => setAnswer(mockQuestions[currentQuestionIndex].id, opt)}
                    className={`w-full text-left p-6 border transition-all ${answers[mockQuestions[currentQuestionIndex].id] === opt ? 'border-black bg-black text-white' : 'border-neutral-100 hover:border-black'}`}
                  >
                    <span className="text-[10px] font-black uppercase mr-4 opacity-50">{opt}</span>
                    <span className="text-sm font-bold">Option content for choice {opt}</span>
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* Question Palette (Timeline) */}
        <div className="w-80 border-l border-black p-8 bg-neutral-50 overflow-y-auto">
           <h3 className="text-[10px] font-black uppercase mb-8 tracking-widest">Question Matrix</h3>
           <div className="grid grid-cols-4 gap-2">
             {mockQuestions.map((_, i) => (
               <button 
                key={i}
                onClick={() => setIndex(i)}
                className={`aspect-square text-[10px] font-black border flex items-center justify-center transition-all ${currentQuestionIndex === i ? 'border-black bg-black text-white' : answers[mockQuestions[i].id] ? 'border-black' : 'border-neutral-200 text-neutral-300'}`}
               >
                 {i + 1}
               </button>
             ))}
           </div>

           <div className="mt-12 p-6 border border-neutral-200 bg-white space-y-4">
              <div className="flex justify-between text-[9px] font-black uppercase">
                 <span className="text-neutral-400">Answered</span>
                 <span>{Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between text-[9px] font-black uppercase">
                 <span className="text-neutral-400">Remaining</span>
                 <span>{mockQuestions.length - Object.keys(answers).length}</span>
              </div>
           </div>
        </div>

      </div>

      {/* Control Bar */}
      <footer className="px-12 py-6 border-t border-black flex justify-between items-center bg-white">
         <button 
          disabled={currentQuestionIndex === 0}
          onClick={() => setIndex(currentQuestionIndex - 1)}
          className="btn-minimal flex items-center gap-2"
         >
           <ChevronLeft size={14} /> Previous
         </button>
         <div className="flex gap-4">
           <Button variant="outline" className="text-[10px] font-black">Mark for Review</Button>
           <Button variant="outline" className="text-[10px] font-black">Clear Response</Button>
         </div>
         <button 
          onClick={() => setIndex(Math.min(mockQuestions.length - 1, currentQuestionIndex + 1))}
          className="btn-minimal flex items-center gap-2"
         >
           Save & Next <ChevronRight size={14} />
         </button>
      </footer>

      {/* Submitting Overlay */}
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
             <p className="text-sm text-neutral-400 max-w-sm uppercase tracking-widest leading-loose">Agent Analyst and Strategy Agent are synchronizing your performance data to update your study track...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Mock;
