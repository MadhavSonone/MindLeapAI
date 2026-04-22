import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { InlineMath } from 'react-katex';
import {
  BookOpen, ChevronRight, Zap, MessageSquare,
  ChevronLeft, History, Filter
} from 'lucide-react';
import { Button } from '../components/ui';

interface Subject { id: number; name: string; }
interface Chapter { id: number; name: string; subject_id: number; }
interface Question { id: number; content: string; chapter_id: number; }

const Study = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [tutorResponse, setTutorResponse] = useState<string | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(false);

  useEffect(() => {
    axios.get(`http://localhost:8000/subjects`).then(res => setSubjects(res.data));
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      axios.get(`http://localhost:8000/subjects/${selectedSubject}/chapters`).then(res => setChapters(res.data));
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedChapter) {
      axios.get(`http://localhost:8000/chapters/${selectedChapter}/questions`).then(res => {
        setQuestions(res.data);
        if (res.data.length > 0) setCurrentQuestion(res.data[0]);
      });
    }
  }, [selectedChapter]);

  const handleAskTutor = () => {
    if (!currentQuestion) return;
    setLoadingTutor(true);
    axios.get(`http://localhost:8000/agents/tutor/explain/${currentQuestion.id}?user_id=1`)
      .then(res => setTutorResponse(res.data.explanation))
      .finally(() => setLoadingTutor(false));
  };

  return (
    <div className="h-full flex bg-white">

      {/* Syllabus Sidebar */}
      <aside className="w-72 border-r border-neutral-100 flex flex-col">
        <header className="p-8 border-b border-neutral-50">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">Select Module</h3>
          <div className="flex gap-2">
            <button className="flex-1 p-2 border border-black text-[9px] font-black uppercase">Physics</button>
            <button className="flex-1 p-2 border border-neutral-100 text-[9px] font-black uppercase text-neutral-300">Chem</button>
            <button className="flex-1 p-2 border border-neutral-100 text-[9px] font-black uppercase text-neutral-300">Math</button>
          </div>
        </header>
        <div className="flex-1 scroll-area p-6">
          <ul className="space-y-4">
            {subjects.map(sub => (
              <li key={sub.id}>
                <button
                  onClick={() => setSelectedSubject(sub.id)}
                  className={`text-[11px] font-black uppercase mb-3 block ${selectedSubject === sub.id ? 'text-black' : 'text-neutral-300'}`}
                >
                  {sub.name}
                </button>
                {selectedSubject === sub.id && (
                  <div className="pl-4 space-y-2 border-l border-neutral-50">
                    {chapters.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChapter(ch.id)}
                        className={`text-[10px] block w-full text-left uppercase py-1 ${selectedChapter === ch.id ? 'font-black' : 'text-neutral-400'}`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Study Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="p-8 border-b border-neutral-50 flex justify-between items-center bg-white sticky top-0">
          <div className="flex items-center gap-3">
            <BookOpen size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Interactive Study</span>
          </div>
          <div className="flex gap-6 items-center">
            <span className="text-[9px] font-black text-neutral-300 uppercase">Q: {questions.indexOf(currentQuestion!) + 1} / {questions.length}</span>
            <History size={14} className="text-neutral-300" />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Question Workspace */}
          <div className="flex-1 scroll-area p-12 lg:p-20">
            {currentQuestion ? (
              <div className="max-w-2xl">
                <div className="mb-16">
                  <span className="text-[9px] font-black uppercase text-neutral-300 bg-neutral-50 px-2 py-1 mb-6 inline-block">Chapter {currentQuestion.chapter_id}</span>
                  <h1 className="text-2xl font-medium leading-relaxed font-serif">
                    <InlineMath>{currentQuestion.content}</InlineMath>
                  </h1>
                </div>

                <div className="grid gap-3 mb-16">
                  {[1, 2, 3, 4].map(idx => (
                    <button key={idx} className="group w-full p-5 border border-neutral-100 hover:border-black text-left flex justify-between items-center transition-all">
                      <span className="text-sm font-medium">Concept exploration for option {idx}</span>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
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
                Workspace
              </div>
            )}
          </div>

          {/* AI Copilot Sidepanel */}
          <aside className="w-96 border-l border-neutral-100 bg-neutral-50 flex flex-col">
            <header className="p-8 border-b border-neutral-100 bg-white flex items-center gap-3">
              <Zap size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Tutor Intelligence</span>
            </header>
            <div className="flex-1 scroll-area p-8">
              {loadingTutor ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-300">
                  <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin" />
                  <span className="text-[9px] font-black uppercase">Agent_Tutor Thinking...</span>
                </div>
              ) : tutorResponse ? (
                <div className="prose-academic text-sm leading-loose">
                  {tutorResponse}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <MessageSquare size={32} className="text-neutral-200 mb-4" />
                  <p className="text-[10px] font-black uppercase text-neutral-300 leading-relaxed">Agent Tutor will analyze your response and provide conceptual deep-dives here.</p>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-neutral-100 bg-white">
              <input
                className="w-full py-4 text-xs bg-transparent border-b border-black outline-none placeholder:text-neutral-200"
                placeholder="Specific concept query..."
              />
            </div>
          </aside>
        </div>
      </div>

    </div>
  );
};

export default Study;
