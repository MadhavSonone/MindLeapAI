import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, PenTool, LogOut, Zap } from 'lucide-react';
import { useUserStore } from '../store/useStore';

const Sidebar = () => {
  const { userName } = useUserStore();

  return (
    <aside className="w-64 border-r border-neutral-100 flex flex-col h-full bg-white">
      <div className="p-8">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} fill="black" />
          <h1 className="text-lg font-black tracking-tighter uppercase">MindLeap</h1>
        </div>
        <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">Agentic JEE Prep</p>
      </div>

      <nav className="flex-1 px-8 py-4">
        <div className="mb-10">
          <h3 className="text-[9px] font-black uppercase text-neutral-300 tracking-[0.2em] mb-6">Menu</h3>
          <div className="space-y-4">
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </NavLink>
            <NavLink 
              to="/study" 
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <BookOpen size={14} />
              Study Module
            </NavLink>
            <NavLink 
              to="/mock" 
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <PenTool size={14} />
              Mock Simulation
            </NavLink>
          </div>
        </div>
      </nav>

      <div className="p-8 border-t border-neutral-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-black">
            {userName[0]}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase">{userName}</p>
            <p className="text-[9px] text-neutral-400 uppercase">Aspirant_Core</p>
          </div>
        </div>
        <button className="text-[9px] font-black uppercase text-neutral-400 hover:text-black flex items-center gap-2">
          <LogOut size={12} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
