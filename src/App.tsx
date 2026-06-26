import React, { useState } from "react";
import LandingPage from "./components/LandingPage";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const handleLogin = (jwt: string, userData: any) => {
    setToken(jwt);
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setCurrentView('landing');
  };

  return (
    <>
      {currentView === 'landing' && (
        <LandingPage onNavigate={(view) => setCurrentView(view)} />
      )}
      
      {(currentView === 'login' || currentView === 'register') && (
        <Auth 
          initialMode={currentView} 
          onLogin={handleLogin} 
          onNavigateLanding={() => setCurrentView('landing')} 
        />
      )}

      {currentView === 'dashboard' && token && user && (
        <Dashboard token={token} user={user} onLogout={handleLogout} />
      )}
    </>
  );
}
