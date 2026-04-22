import React, { useEffect, useState } from 'react';
import { useUserStore } from '../store/useStore';
import {
  CheckCircle2, Circle, Trophy, Flame, Target,
  ChevronRight, Calendar, AlertTriangle, TrendingUp
} from 'lucide-react';
import axios from 'axios';

interface Task {
  id: number;
  chapter_id: number;
  task_type: string;
  target_date: string;
  is_completed: boolean;
  priority: number;
}

interface Mastery {
  chapter_id: number;
  mastery_score: number;
  recent_accuracy: number;
}

const Dashboard = () => {
  const { userName, targetExam, userId } = useUserStore();
  const [weeklyTasks, setWeeklyTasks] = useState<Task[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tasksRes, masteryRes, streakRes] = await Promise.all([
          axios.get(`http://localhost:8000/dashboard/weekly/${userId}`),
          axios.get(`http://localhost:8000/agents/performance/heatmap?user_id=${userId}`),
          axios.get(`http://localhost:8000/stats/streak/${userId}`)
        ]);
        setWeeklyTasks(tasksRes.data);
        setMastery(masteryRes.data);
        setStreak(streakRes.data.streak);
      } catch (err) {
        console.error("Error fetching dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = weeklyTasks.filter(t => t.target_date === todayStr);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header - Sticky */}
      <header className="p-12 border-b border-neutral-50 flex justify-between items-end bg-white shrink-0">
        <div>
          {/* <Badge>JEE MAINS</Badge> */}
          <h1 className="text-6xl font-black uppercase tracking-tighter leading-none mt-4">Dashboard.</h1>
          <p className="text-[10px] text-neutral-400 mt-4 font-black uppercase tracking-[0.3em]">Student: {userName} | Exam: {targetExam}</p>
        </div>
        <div className="flex gap-16">
          <Stat label="Real Streak" value={streak.toString()} unit="Days" icon={<Flame size={14} />} />
          <Stat label="Evaluation" value="Active" unit="Status" icon={<Trophy size={14} />} />
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 scroll-area">
        <div className="p-12 grid grid-cols-12 gap-12 max-w-[1600px] mx-auto">

          {/* Left Column: Weekly & Priority */}
          <div className="col-span-12 lg:col-span-8 space-y-16">

            {/* Weekly Timeline */}
            <div>
              <SectionHeader title="Weekly Mission Grid" icon={<Calendar size={12} />} />
              <div className="grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayTasks = weeklyTasks.filter(t => t.target_date === dateStr);

                  return (
                    <div key={dateStr} className="flex flex-col gap-2">
                      <span className="text-[9px] font-black uppercase text-neutral-300 text-center mb-2">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <div className={`flex-1 min-h-[120px] border ${i === 0 ? 'border-black' : 'border-neutral-100'} p-2 space-y-1`}>
                        {dayTasks.map(t => (
                          <div key={t.id} className={`w-full h-2 ${t.is_completed ? 'bg-neutral-100' : 'bg-black'}`} title={t.task_type} />
                        ))}
                        {dayTasks.length === 0 && <div className="h-full flex items-center justify-center opacity-10 text-[8px] font-black uppercase rotate-90">No Data</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Heatmap */}
            <div>
              <SectionHeader title="Mastery Heatmap" icon={<TrendingUp size={12} />} />
              <div className="grid grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-1.5">
                {Array.from({ length: 80 }).map((_, i) => {
                  const chapterMastery = mastery.find(m => m.chapter_id === i + 1);
                  const score = chapterMastery?.mastery_score || 0;

                  return (
                    <div
                      key={i}
                      className="aspect-square border border-neutral-50 transition-all hover:scale-110 cursor-help"
                      style={{
                        backgroundColor: score === 0 ? '#f9f9f9' : `rgba(0,0,0,${score / 100})`,
                        borderColor: score > 50 ? '#000' : '#eee'
                      }}
                      title={`Chapter ${i + 1}: ${score}% Mastery`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-[8px] font-black uppercase text-neutral-300 tracking-[0.2em]">
                <span>Conceptual Basics</span>
                <span>Advanced Modules</span>
              </div>
            </div>
          </div>

          {/* Right Column: Today's Priorities */}
          <div className="col-span-12 lg:col-span-4 space-y-12">
            <div>
              <SectionHeader title="Today's Priority Stack" icon={<Target size={12} />} />
              <div className="space-y-4">
                {todayTasks.length > 0 ? todayTasks.sort((a, b) => b.priority - a.priority).map(task => (
                  <div key={task.id} className={`p-6 border ${task.priority >= 3 ? 'border-black bg-black text-white' : 'border-neutral-100 bg-white'} group transition-all`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest">{task.task_type}</span>
                      {task.priority >= 3 && <AlertTriangle size={12} />}
                    </div>
                    <h4 className="text-sm font-bold uppercase mb-2">Chapter {task.chapter_id}</h4>
                    <div className="flex justify-between items-center mt-6">
                      <span className="text-[9px] uppercase font-black opacity-50">Priority: {task.priority}</span>
                      <button className={`p-2 ${task.priority >= 3 ? 'bg-white text-black' : 'bg-black text-white'}`}>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 border border-dashed border-neutral-100 text-center">
                    <p className="text-[10px] font-black uppercase text-neutral-200">System Ready. No Tasks for Today.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Insight */}
            <div className="p-8 bg-neutral-50 border-l-4 border-black">
              <span className="text-[9px] font-black uppercase text-black block mb-4 tracking-widest">Agent Intelligence</span>
              <p className="text-sm font-medium leading-relaxed italic">"Optimal learning trajectory detected. Focus on high-priority unit mocks to solidify concept retention before next week's integration phase."</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---
const SectionHeader = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-8">
    <div className="p-2 bg-black text-white">{icon}</div>
    <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">{title}</h3>
  </div>
);

const Stat = ({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: React.ReactNode }) => (
  <div className="text-right">
    <span className="text-[10px] font-black uppercase text-neutral-300 block mb-2 tracking-widest">{label}</span>
    <div className="flex items-end gap-2 justify-end">
      <div className="mb-1">{icon}</div>
      <span className="text-3xl font-black tracking-tighter">{value}</span>
      <span className="text-[10px] font-black text-neutral-300 mb-1 uppercase">{unit}</span>
    </div>
  </div>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-black text-white px-3 py-1 text-[9px] font-black uppercase tracking-widest">
    {children}
  </span>
);

export default Dashboard;
