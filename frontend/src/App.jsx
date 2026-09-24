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

  const goToWorkspace = () => setActiveTab('chat');
  const goToLanding = () => setActiveTab('landing');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'landing':
        return <LandingView onExplore={goToWorkspace} onLaunch={goToWorkspace} />;
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
    <div className="h-screen max-h-screen p-6 flex flex-col overflow-hidden bg-[var(--bg-dark)]">
      {/* Top Navigation Header */}
      <Header onGoHome={goToLanding} />

      {/* Main Container */}
      {activeTab === 'landing' ? (
        /* Full-width Landing Page Hero Layout */
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <LandingView onExplore={goToWorkspace} onLaunch={goToWorkspace} />
        </main>
      ) : (
        /* Dashboard Workspace Layout with 280px Sidebar */
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            {renderActiveView()}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
