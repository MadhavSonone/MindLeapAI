import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Study from './pages/Study';
import Mock from './pages/Mock';
import MockReview from './pages/MockReview';
import Vault from './pages/Vault';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import Sidebar from './components/Sidebar';
import { useUserStore, useMockStore } from './store/useStore';
import 'katex/dist/katex.min.css';

function App() {
  const { isOnboarded, token } = useUserStore();
  const { isActive: isMockActive } = useMockStore();

  if (!token) {
    return <Auth />;
  }

  if (!isOnboarded) {
    return <Onboarding />;
  }

  return (
    <Router>
      {isMockActive ? (
        <Mock />
      ) : (
        <div className="flex h-screen w-screen bg-white">
          <Sidebar />
          <main className="flex-1 h-full overflow-hidden">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/study" element={<Study />} />
              <Route path="/mock" element={<Mock />} />
              <Route path="/mock-review" element={<MockReview />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </Router>
  );
}

export default App;
