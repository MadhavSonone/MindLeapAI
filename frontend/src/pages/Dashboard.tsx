import React, { useEffect, useState } from 'react';
import { useUserStore } from '../store/useStore';
import {
  CheckCircle2, Circle, Trophy, Flame, Target,
  ChevronRight, Calendar, AlertTriangle, TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useMockStore } from '../store/useStore';

interface Task {
  id: number;
  chapter_name: string;
  task_type: string;
  target_date: string;
  estimated_minutes: number;
  concepts: string;
  is_completed: boolean;
  priority: number;
}

interface ActivityStats {
  [date: string]: number;
}

const Dashboard = () => {
  const { userName, targetExam, userId } = useUserStore();
  const { startTest } = useMockStore();
  const navigate = useNavigate();
  const [weeklyTasks, setWeeklyTasks] = useState<Task[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [activity, setActivity] = useState<ActivityStats>({});
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [insight, setInsight] = useState<string>('Analyzing your adherence...');

  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tasksRes, masteryRes, streakRes] = await Promise.all([
        axios.get(`http://localhost:8000/dashboard/weekly/${userId}`),
        axios.get(`http://localhost:8000/agents/performance/heatmap?user_id=${userId}`),
        axios.get(`http://localhost:8000/stats/streak/${userId}`)
      ]);
      const actRes = await axios.get(`http://localhost:8000/stats/activity/${userId}`);
      setActivity(actRes.data.reduce((acc: any, d: any) => ({ ...acc, [d.date]: d.count }), {}));

      const insightRes = await axios.get(`http://localhost:8000/dashboard/insight/${userId}`);
      setInsight(insightRes.data.insight);

      setWeeklyTasks(tasksRes.data);
      setMastery(masteryRes.data);
      setStreak(streakRes.data.streak);
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleTask = async (taskId: number) => {
    try {
      await axios.post(`http://localhost:8000/tasks/${taskId}/toggle`);
      // Update local state for immediate feedback
      setWeeklyTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleStartMission = (task: Task) => {
    if (task.task_type === 'MOCK') {
      // Start full mock
      startTest(180, 'full');
      navigate('/mock');
    } else {
      // For LEARN, PRACTICE, REVISE, go to study section to interact with content
      navigate('/study');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedTasks = weeklyTasks.filter(t => t.target_date === selectedDate);


  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header - Sticky */}
      <header className="p-12 border-b border-neutral-50 flex justify-between items-end bg-white shrink-0">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter leading-none mt-4">Dashboard.</h1>
          <p className="text-[10px] text-neutral-400 mt-4 font-black uppercase tracking-[0.3em]">Student: {userName} | Exam: {targetExam}</p>
        </div>
        <div className="flex gap-16">
          <Stat label="Real Streak" value={streak.toString()} unit="Days" icon={<Flame size={14} />} />
          <Stat label="Activity" value={Object.keys(activity).length.toString()} unit="Logs" icon={<Trophy size={14} />} />
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 scroll-area">
        <div className="p-12 grid grid-cols-12 gap-12 max-w-[1600px] mx-auto">

          {/* Left Column: Weekly & Priority */}
          <div className="col-span-12 lg:col-span-8 space-y-16">

            {/* Mission Selector */}
            <div>
              <SectionHeader title="Mission Control" icon={<Calendar size={12} />} />
              <div className="flex gap-2 overflow-x-auto pb-4 scroll-area">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const dateStr = d.toISOString().split('T')[0];
                  const isSelected = selectedDate === dateStr;
                  const dayTasks = weeklyTasks.filter(t => t.target_date === dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex-1 min-w-[80px] p-4 border transition-all ${isSelected ? 'border-black bg-black text-white' : 'border-neutral-100 hover:border-black bg-white text-black'}`}
                    >
                      <div className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'opacity-80' : 'opacity-40'} mb-2`}>
                        {i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-black">{d.getDate()}</div>
                      <div className={`text-[8px] font-bold uppercase mt-2 ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        {dayTasks.length} Tasks
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Activity Heatmap (Consistency for Current Month) */}
            <div>
              <SectionHeader title={`${new Date().toLocaleDateString('en-US', { month: 'long' })} Consistency`} icon={<TrendingUp size={12} />} />
              <div className="grid grid-cols-7 gap-2 max-w-[400px]">
                {/* Day Headers */}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                  <div key={d} className="text-[8px] font-black text-neutral-300 text-center mb-2">{d}</div>
                ))}

                {(() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
                  const daysInMonth = new Date(year, month + 1, 0).getDate();

                  const cells = [];

                  // Add leading empty cells
                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="w-8 h-8 opacity-0" />);
                  }

                  // Add day cells
                  for (let i = 1; i <= daysInMonth; i++) {
                    const d = new Date(year, month, i);
                    const dateStr = d.toISOString().split('T')[0];
                    const intensity = activity[dateStr] || 0;
                    const isFuture = d > now;

                    cells.push(
                      <div
                        key={dateStr}
                        className={`w-8 h-8 border ${isFuture ? 'border-neutral-50 opacity-20' : 'border-neutral-200'} transition-all hover:scale-110 flex items-center justify-center text-[8px] font-black ${intensity > 0 ? 'text-white' : 'text-neutral-400'}`}
                        style={{
                          backgroundColor: intensity === 0 ? '#f5f5f5' : `rgba(0,0,0,${Math.min(0.3 + intensity * 0.2, 1)})`,
                        }}
                        title={`${dateStr}: ${intensity} Activities`}
                      >
                        {i}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>


          </div>

          {/* Right Column: Today's Priorities */}
          <div className="col-span-12 lg:col-span-4 space-y-12">
            <div>
              <SectionHeader title={`Missions for ${selectedDate === todayStr ? 'Today' : new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`} icon={<Target size={12} />} />
              <div className="space-y-4">
                {selectedTasks.length > 0 ? selectedTasks.sort((a, b) => b.priority - a.priority).map(task => (
                  <div key={task.id} className={`p-6 border ${task.is_completed ? 'border-neutral-100 opacity-50' : task.priority >= 3 ? 'border-black bg-black text-white' : 'border-neutral-100 bg-white'} group transition-all relative overflow-hidden`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest">{task.task_type} • {task.estimated_minutes}M</span>
                      <button onClick={() => handleToggleTask(task.id)}>
                        {task.is_completed ? <CheckCircle2 size={16} className="text-neutral-300" /> : <Circle size={16} />}
                      </button>
                    </div>
                    <h4 className="text-sm font-bold uppercase mb-2">{task.chapter_name}</h4>
                    <p className="text-[10px] opacity-60 leading-relaxed font-medium mb-4">{task.concepts}</p>

                    <div className="flex justify-between items-center mt-6">
                      <span className="text-[9px] uppercase font-black opacity-50">
                        Priority: {task.priority >= 3 ? 'High' : task.priority === 2 ? 'Normal' : 'Low'}
                      </span>
                      {!task.is_completed && (task.task_type === 'MOCK' || task.task_type === 'PRACTICE') && (
                        <button
                          onClick={() => handleStartMission(task)}
                          className={`flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest ${task.priority >= 3 ? 'bg-white text-black' : 'bg-black text-white'}`}
                        >
                          {task.task_type === 'MOCK' ? 'Start Test' : 'Start Module'} <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="p-12 border border-dashed border-neutral-100 text-center">
                    <p className="text-[10px] font-black uppercase text-neutral-200">No Tasks for Today. Take a Break!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Insight */}
            <div className="p-8 bg-neutral-50 border-l-4 border-black">
              <span className="text-[9px] font-black uppercase text-black block mb-4 tracking-widest">Strategic Analysis</span>
              <p className="text-sm font-medium leading-relaxed italic">"{insight}"</p>
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
