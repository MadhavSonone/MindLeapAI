import React, { useEffect, useState } from 'react';
import { useUserStore } from '../store/useStore';
import { CheckCircle2, Circle, Trophy, Flame, Target, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface Task {
  id: number;
  chapter_id: number;
  task_type: string;
  target_date: string;
  is_completed: boolean;
}

interface Mastery {
  chapter_id: number;
  mastery_score: number;
  recent_accuracy: number;
}

const Dashboard = () => {
  const { userName, targetExam } = useUserStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);

  useEffect(() => {
    // Fetch daily tasks
    axios.get(`http://localhost:8000/subjects/tasks`).then(() => {
      // Mock fetching tasks for today for now, normally we'd have a /tasks endpoint
      setTasks([
        { id: 1, chapter_id: 1, task_type: 'LEARN', target_date: '2024-04-22', is_completed: false },
        { id: 2, chapter_id: 2, task_type: 'PRACTICE', target_date: '2024-04-22', is_completed: true },
      ]);
    });

    // Fetch performance heatmap
    axios.get(`http://localhost:8000/agents/performance/heatmap?user_id=1`).then(res => {
      setMastery(res.data);
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="p-8 border-b border-neutral-50 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Command Center.</h1>
          <p className="text-xs text-neutral-400 mt-2 font-medium uppercase tracking-widest">Aspirant: {userName} | Target: {targetExam}</p>
        </div>
        <div className="flex gap-12">
          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-neutral-300 block mb-1">Daily Streak</span>
            <div className="flex items-center gap-2 justify-end">
              <Flame size={14} />
              <span className="text-xl font-black">12 Days</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-neutral-300 block mb-1">Estimated Rank</span>
            <div className="flex items-center gap-2 justify-end">
              <Trophy size={14} />
              <span className="text-xl font-black">~1,240</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-12 grid grid-cols-12 gap-12">

        {/* Daily Mission */}
        <div className="col-span-4 space-y-8">
          <div>
            <h3 className="text-[10px] font-black uppercase text-neutral-300 tracking-[0.2em] mb-6">Today's Mission</h3>
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`p-4 border ${task.is_completed ? 'border-neutral-100 bg-neutral-50' : 'border-black'} flex items-center justify-between group cursor-pointer`}>
                  <div className="flex items-center gap-4">
                    {task.is_completed ? <CheckCircle2 size={16} className="text-neutral-300" /> : <Circle size={16} />}
                    <div>
                      <p className={`text-[11px] font-black uppercase ${task.is_completed ? 'text-neutral-300' : ''}`}>
                        {task.task_type}: Chapter {task.chapter_id}
                      </p>
                      <p className="text-[9px] text-neutral-400 uppercase">Estimated 2.5H</p>
                    </div>
                  </div>
                  {!task.is_completed && <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-black text-white">
            <div className="flex items-center gap-2 mb-4">
              <Target size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Priority Alert</span>
            </div>
            <p className="text-sm font-medium leading-relaxed">Agent Analyst detects weakness in <span className="underline">Thermodynamics</span>. Strategy adjusted to include extra revision session today.</p>
          </div>
        </div>

        {/* Syllabus & Performance */}
        <div className="col-span-8 space-y-12">
          <div>
            <h3 className="text-[10px] font-black uppercase text-neutral-300 tracking-[0.2em] mb-6">Syllabus Mastery</h3>
            <div className="grid grid-cols-3 gap-6">
              {['Physics', 'Chemistry', 'Maths'].map(sub => (
                <div key={sub} className="p-6 border border-neutral-100">
                  <span className="text-[10px] font-black uppercase mb-4 block">{sub}</span>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black">64</span>
                    <span className="text-[10px] font-black text-neutral-300 mb-1">%</span>
                  </div>
                  <div className="w-full h-1 bg-neutral-100">
                    <div className="h-full bg-black" style={{ width: '64%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase text-neutral-300 tracking-[0.2em] mb-6">Mastery Heatmap</h3>
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square border border-white ${i % 7 === 0 ? 'bg-black' : i % 3 === 0 ? 'bg-neutral-200' : 'bg-neutral-50'}`}
                  title={`Chapter ${i + 1}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[9px] font-black uppercase text-neutral-300 tracking-widest">
              <span>Core Basics</span>
              <span>Advanced Concepts</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
