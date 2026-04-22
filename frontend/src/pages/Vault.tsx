import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import * as Accordion from '@radix-ui/react-accordion';
import {
  FileText, Database, MessageSquare, Send,
  Plus, Save, Loader2, BookOpen, Layers, Trash2, Clock, CheckCircle, ChevronDown
} from 'lucide-react';
import { useUserStore } from '../store/useStore';

const Vault = () => {
  const { userId } = useUserStore();
  const [syllabus, setSyllabus] = useState('');
  const [pyqs, setPyqs] = useState('');
  const [documents, setDocuments] = useState<{ id: number, name: string, type: string, status: string }[]>([]);
  const [chatQuery, setChatQuery] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'tutor', text: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    axios.get(`http://localhost:8000/user/preferences/${userId}`)
      .then(res => {
        setSyllabus(res.data.custom_syllabus || '');
        setPyqs(res.data.custom_pyqs || '');
        setDocuments(res.data.documents || []);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    const fData = new FormData();
    fData.append("user_id", userId.toString());
    fData.append("file_type", type);
    fData.append("file", file);

    try {
      const res = await axios.post('http://localhost:8000/vault/upload', fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments(prev => [...prev, { id: Date.now(), name: res.data.file_name, type, status: 'PROCESSING' }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm("Are you sure you want to remove this record?")) return;
    try {
      await axios.delete(`http://localhost:8000/vault/document/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post('http://localhost:8000/user/preferences/update', {
        user_id: userId,
        custom_syllabus: syllabus,
        custom_pyqs: pyqs
      });
      alert("Vault Updated Successfully.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChat = async () => {
    if (!chatQuery.trim()) return;
    const userMsg = chatQuery;
    setChatLog(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatQuery('');
    setIsThinking(true);

    try {
      const res = await axios.post('http://localhost:8000/agents/tutor/vault/chat', {
        user_id: userId,
        query: userMsg
      });
      setChatLog(prev => [...prev, { role: 'tutor', text: res.data.response }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'tutor', text: "Error syncing with tutor agent." }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center animate-pulse font-black text-[10px] uppercase">Opening Vault...</div>;

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="p-12 border-b border-neutral-50 flex justify-between items-center bg-white shrink-0">
        <div>
          <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1 mb-2 block w-fit">Knowledge Base</span>
          <h1 className="text-4xl font-black uppercase tracking-tighter">The Vault.</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-3 border border-black px-8 py-3 hover:bg-black hover:text-white transition-all group"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span className="text-[10px] font-black uppercase tracking-widest">Update Records</span>
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Document Editor */}
        <div className="w-1/2 border-r border-neutral-50 p-12 scroll-area flex flex-col gap-12">
          {/* Syllabus Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Active Syllabus</span>
              </div>
              <label className="cursor-pointer text-[8px] font-black uppercase bg-neutral-100 px-2 py-1 hover:bg-black hover:text-white transition-all">
                Upload PDF
                <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileUpload(e, 'syllabus')} />
              </label>
            </div>
            <textarea
              className="w-full min-h-[200px] p-6 border border-neutral-100 outline-none focus:border-black text-xs font-bold leading-relaxed scroll-area"
              placeholder="Paste your syllabus context here..."
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
            />
            <Accordion.Root type="single" collapsible>
              <Accordion.Item value="docs" className="border border-neutral-50">
                <Accordion.Trigger className="w-full p-2 flex justify-between items-center hover:bg-neutral-50 transition-all group">
                  <span className="text-[8px] font-black uppercase text-neutral-400">View Stored Syllabus PDFs ({documents.filter(d => d.type === 'syllabus').length})</span>
                  <ChevronDown size={10} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="p-2 space-y-2 bg-neutral-50/10">
                  {documents.filter(d => d.type === 'syllabus').map(doc => (
                    <div key={doc.id} className="p-2 border border-neutral-50 flex justify-between items-center bg-white group">
                      <span className="text-[9px] font-bold truncate max-w-[180px]">{doc.name}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-[7px] font-black uppercase ${doc.status === 'COMPLETED' ? 'text-green-500' : 'text-neutral-400'}`}>{doc.status}</span>
                        <button onClick={() => handleDeleteDocument(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>

          {/* PYQ Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BookOpen size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">PYQ Patterns & Notes</span>
              </div>
              <label className="cursor-pointer text-[8px] font-black uppercase bg-neutral-100 px-2 py-1 hover:bg-black hover:text-white transition-all">
                Upload PDF
                <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileUpload(e, 'pyq')} />
              </label>
            </div>
            <textarea
              className="w-full min-h-[200px] p-6 border border-neutral-100 outline-none focus:border-black text-xs font-bold leading-relaxed scroll-area"
              placeholder="Store recurring patterns, tough questions, or key formulas here..."
              value={pyqs}
              onChange={(e) => setPyqs(e.target.value)}
            />
            <Accordion.Root type="single" collapsible>
              <Accordion.Item value="docs" className="border border-neutral-50">
                <Accordion.Trigger className="w-full p-2 flex justify-between items-center hover:bg-neutral-50 transition-all group">
                  <span className="text-[8px] font-black uppercase text-neutral-400">View Stored PYQ PDFs ({documents.filter(d => d.type === 'pyq').length})</span>
                  <ChevronDown size={10} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="p-2 space-y-2 bg-neutral-50/10">
                  {documents.filter(d => d.type === 'pyq').map(doc => (
                    <div key={doc.id} className="p-2 border border-neutral-50 flex justify-between items-center bg-white group">
                      <span className="text-[9px] font-bold truncate max-w-[180px]">{doc.name}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-[7px] font-black uppercase ${doc.status === 'COMPLETED' ? 'text-green-500' : 'text-neutral-400'}`}>{doc.status}</span>
                        <button onClick={() => handleDeleteDocument(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>

          {/* Supplementary Notes Section */}
          <div className="space-y-4 pt-12 border-t border-neutral-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Plus size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">General Notes</span>
              </div>
              <label className="cursor-pointer text-[8px] font-black uppercase bg-neutral-100 px-2 py-1 hover:bg-black hover:text-white transition-all">
                Add Record
                <input type="file" className="hidden" accept=".pdf,.txt" onChange={(e) => handleFileUpload(e, 'notes')} />
              </label>
            </div>
            <Accordion.Root type="single" collapsible>
              <Accordion.Item value="docs" className="border border-neutral-50">
                <Accordion.Trigger className="w-full p-2 flex justify-between items-center hover:bg-neutral-50 transition-all group">
                  <span className="text-[8px] font-black uppercase text-neutral-400">View Stored Note Records ({documents.filter(d => d.type === 'notes').length})</span>
                  <ChevronDown size={10} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="p-2 space-y-2 bg-neutral-50/10">
                  {documents.filter(d => d.type === 'notes').map(doc => (
                    <div key={doc.id} className="p-2 border border-neutral-50 flex justify-between items-center bg-white group">
                      <span className="text-[9px] font-bold truncate max-w-[180px]">{doc.name}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-[7px] font-black uppercase ${doc.status === 'COMPLETED' ? 'text-green-500' : 'text-neutral-400'}`}>{doc.status}</span>
                        <button onClick={() => handleDeleteDocument(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>
        </div>

        {/* Tutor Chat Interface */}
        <div className="w-1/2 flex flex-col bg-neutral-50/30">
          <div className="p-6 border-b border-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Vault Tutor</span>
            </div>
            <span className="text-[8px] font-black uppercase bg-neutral-100 px-2 py-1">Contextual Reasoning Enabled</span>
          </div>

          <div className="flex-1 p-12 scroll-area space-y-8">
            {chatLog.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                <Database size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase">Ask questions about your stored records.</p>
              </div>
            )}
            {chatLog.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-6 ${msg.role === 'user' ? 'bg-black text-white text-right' : 'bg-white border border-neutral-100 text-left'} text-xs font-bold leading-loose shadow-sm`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-100 p-6 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-black rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-white border-t border-neutral-50">
            <div className="relative">
              <input
                className="w-full p-4 pr-16 border border-black outline-none text-xs font-bold"
                placeholder="QUERY_KNOWLEDGE_BASE"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChat()}
              />
              <button
                onClick={handleChat}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-50 transition-all"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vault;
