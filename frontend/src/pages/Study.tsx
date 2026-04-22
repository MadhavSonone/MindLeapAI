import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { InlineMath } from 'react-katex';
import {
  BookOpen, ChevronRight, Zap, MessageSquare,
  ChevronLeft, History, Play, Calendar, Trophy
} from 'lucide-react';
import { Button } from '../components/ui';
import * as Accordion from '@radix-ui/react-accordion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useUserStore, useMockStore } from '../store/useStore';

// --- Types ---
interface Subject { id: number; name: string; }
interface Chapter { id: number; name: string; subject_id: number; }
interface Question { id: number; content: string; chapter_id: number; options_json: string; }
interface ChapterStats { chapter_id: number; name: string; total: number; solved: number; }

const Study = () => {
  const { startTest } = useMockStore();
  const [view, setView] = useState<'selection' | 'workspace'>('selection');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterStats, setChapterStats] = useState<ChapterStats[]>([]);

  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [tutorResponse, setTutorResponse] = useState<string | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(false);

  // 1. Load Initial Data
  useEffect(() => {
    axios.get(`http://localhost:8000/subjects`).then(res => setSubjects(res.data));
    axios.get(`http://localhost:8000/stats/progress/1`).then(res => setChapterStats(res.data));
  }, []);

  // 2. Load Chapters when a subject is expanded (implied by stats mapping)
  useEffect(() => {
    axios.get(`http://localhost:8000/subjects/1/chapters`).then(res => setChapters(res.data));
  }, []);

  const startPractice = (chapterId: number) => {
    // Start a 15-minute Unit Mock for the selected chapter
    startTest(15, 'unit', chapterId);
  };

  const scheduleMock = (chapterId: number) => {
    axios.post(`http://localhost:8000/agents/practice/schedule-mock`, {
      user_id: userId,
      chapter_id: chapterId
    }).then(() => {
      alert("Unit Mock scheduled for tomorrow!");
    });
  };

  const handleAskTutor = () => {
    if (!currentQuestion) return;
    setLoadingTutor(true);
    axios.get(`http://localhost:8000/agents/tutor/explain/${currentQuestion.id}?user_id=${userId}`)
      .then(res => setTutorResponse(res.data.explanation))
      .finally(() => setLoadingTutor(false));
  };

  if (view === 'selection') {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <header className="p-12 border-b border-neutral-50 shrink-0">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Syllabus.</h1>
          <p className="text-xs text-neutral-400 mt-2 uppercase tracking-widest font-bold">Select a module to practice</p>
        </header>

        <div className="flex-1 scroll-area">
          <div className="p-12 max-w-5xl">
            <Accordion.Root type="multiple" className="space-y-6">
              {subjects.map(subject => (
                <Accordion.Item key={subject.id} value={subject.name} className="border-b border-neutral-100 pb-6">
                  <Accordion.Trigger className="w-full flex justify-between items-center py-4 group">
                    <span className="text-xl font-black uppercase tracking-tight group-data-[state=open]:text-black text-neutral-300 transition-colors">
                      {subject.name}
                    </span>
                    <ChevronRight size={20} className="transition-transform duration-300 group-data-[state=open]:rotate-90" />
                  </Accordion.Trigger>

                  <Accordion.Content className="pt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {chapterStats.filter(cs => chapters.find(c => c.id === cs.chapter_id)?.subject_id === subject.id).map(stats => (
                      <div key={stats.chapter_id} className="border border-neutral-100 p-6 flex flex-col hover:border-black transition-all group">
                        <div className="flex justify-between items-start mb-6">
                          <div className="h-16 w-16">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { value: stats.solved },
                                    { value: Math.max(0, stats.total - stats.solved) }
                                  ]}
                                  innerRadius={20}
                                  outerRadius={28}
                                  paddingAngle={0}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  <Cell fill="#000" />
                                  <Cell fill="#f0f0f0" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <Badge score={Math.round((stats.solved / (stats.total || 1)) * 100)} />
                        </div>

                        <h4 className="text-sm font-black uppercase mb-2 leading-tight">{stats.name}</h4>
                        <p className="text-[10px] text-neutral-400 uppercase font-bold mb-6">
                          {stats.solved} / {stats.total} Questions Solved
                        </p>

                        <div className="mt-auto flex gap-2">
                          <button
                            onClick={() => startPractice(stats.chapter_id)}
                            className="flex-1 bg-black text-white text-[9px] font-black uppercase py-2 flex items-center justify-center gap-2"
                          >
                            <Play size={10} /> Practice
                          </button>
                          <button
                            onClick={() => scheduleMock(stats.chapter_id)}
                            className="p-2 border border-neutral-100 hover:border-black transition-colors"
                            title="Schedule Unit Mock"
                          >
                            <Calendar size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </div>
      </div>
    );
  }

  // --- Workspace View (Legacy) ---
  return (
    <div className="h-full flex flex-col bg-white">
      <header className="p-8 border-b border-neutral-50 flex justify-between items-center bg-white sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('selection')} className="p-2 hover:bg-neutral-50 border border-transparent hover:border-black">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-3">
            <BookOpen size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Workspace: {chapters.find(c => c.id === selectedChapter)?.name}</span>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <span className="text-[9px] font-black text-neutral-300 uppercase">Q: {questions.indexOf(currentQuestion!) + 1} / {questions.length}</span>
          <History size={14} className="text-neutral-300" />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 scroll-area p-12 lg:p-24">
          {currentQuestion ? (
            <div className="max-w-2xl mx-auto">
              <div className="mb-16">
                <h1 className="text-3xl font-medium leading-relaxed font-serif">
                  {currentQuestion.content}
                </h1>
              </div>

              <div className="grid gap-4 mb-20">
                {(() => {
                  try {
                    const opts = JSON.parse(currentQuestion.options_json || '[]');
                    return opts.map((opt: string, idx: number) => (
                      <button key={idx} className="group w-full p-6 border border-neutral-100 hover:border-black text-left flex justify-between items-center transition-all">
                        <span className="text-sm font-medium">
                          <InlineMath>{opt}</InlineMath>
                        </span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    ));
                  } catch (e) {
                    return <p className="text-xs text-neutral-400 font-black">Options Error.</p>;
                  }
                })()}
              </div>

              <div className="flex justify-between items-center border-t border-neutral-50 pt-8">
                <Button variant="outline" size="sm">Report Issue</Button>
                <div className="flex gap-3">
                  <Button variant="secondary">Skip</Button>
                  <Button onClick={handleAskTutor}>Submit Response</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-100 uppercase font-black text-6xl">
              Ready.
            </div>
          )}
        </div>

        <aside className="w-96 border-l border-neutral-100 bg-neutral-50 flex flex-col">
          <header className="p-8 border-b border-neutral-100 bg-white flex items-center gap-3">
            <Zap size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Tutor Insight</span>
          </header>
          <div className="flex-1 scroll-area p-8">
            {loadingTutor ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-300">
                <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin" />
                <span className="text-[9px] font-black uppercase">Solving...</span>
              </div>
            ) : tutorResponse ? (
              <div className="prose-academic text-sm leading-loose">
                {tutorResponse}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <MessageSquare size={32} className="text-neutral-200 mb-4" />
                <p className="text-[10px] font-black uppercase text-neutral-300 leading-relaxed">Agent Tutor is monitoring this session.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const Badge = ({ score }: { score: number }) => (
  <div className="flex flex-col items-end">
    <span className="text-[18px] font-black leading-none">{score}</span>
    <span className="text-[8px] font-black uppercase text-neutral-300">% Mastery</span>
  </div>
);

export default Study;
