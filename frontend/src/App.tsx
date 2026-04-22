import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Study from './pages/Study';
import Mock from './pages/Mock';
import Onboarding from './pages/Onboarding';
import Sidebar from './components/Sidebar';
import { useUserStore, useMockStore } from './store/useStore';

function App() {
  const { isOnboarded } = useUserStore();
  const { isActive: isMockActive } = useMockStore();

  if (!isOnboarded) {
    return <Onboarding />;
  }

  // If a mock test is active, show only the Mock page (test simulation)
  if (isMockActive) {
    return <Mock />;
  }

  return (
    <Router>
      <div className="flex h-screen w-screen bg-white">
        <Sidebar />
        <main className="flex-1 h-full overflow-hidden">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/study" element={<Study />} />
            <Route path="/mock" element={<Mock />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
