import React, { useState } from 'react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { LandingView } from './views/LandingView';
import { ChatView } from './views/ChatView';
import { RagStudioView } from './views/RagStudioView';
import { ToolsWorkbenchView } from './views/ToolsWorkbenchView';
import { RouterDebugView } from './views/RouterDebugView';
import { ProfileView } from './views/ProfileView';
import { SettingsView } from './views/SettingsView';
import { HealthDashboardView } from './views/HealthDashboardView';

export function App() {
  const [activeTab, setActiveTab] = useState('landing');

  const goToLanding = () => setActiveTab('landing');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'landing':
        return (
          <LandingView
            onSelectTab={(tab) => setActiveTab(tab)}
            onExplore={() => setActiveTab('chat')}
            onLaunch={() => setActiveTab('chat')}
          />
        );
      case 'chat':
        return <ChatView />;
      case 'rag':
        return <RagStudioView />;
      case 'tools':
        return <ToolsWorkbenchView />;
      case 'router':
        return <RouterDebugView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <SettingsView />;
      case 'health':
        return <HealthDashboardView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="h-screen max-h-screen flex flex-col overflow-hidden bg-[var(--poe-bg)]">
      {/* Top Header Navigation Bar */}
      <Header activeTab={activeTab} onGoHome={goToLanding} />

      {/* Main Viewport Container */}
      {activeTab === 'landing' ? (
        /* Full-width Poe Explore Landing Page (No Sidebar) */
        <main className="flex-1 flex flex-col overflow-hidden min-h-0 p-6">
          {renderActiveView()}
        </main>
      ) : (
        /* Poe Workspace Layout with Left Sidebar Drawer */
        <div className="flex-1 flex overflow-hidden min-h-0">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="flex-1 flex flex-col overflow-hidden min-h-0 p-6">
            {renderActiveView()}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
