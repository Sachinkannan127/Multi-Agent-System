import React, { useState } from 'react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ChatView } from './views/ChatView';
import { RagStudioView } from './views/RagStudioView';
import { ToolsWorkbenchView } from './views/ToolsWorkbenchView';
import { RouterDebugView } from './views/RouterDebugView';
import { HealthDashboardView } from './views/HealthDashboardView';

export function App() {
  const [activeTab, setActiveTab] = useState('chat');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatView />;
      case 'rag':
        return <RagStudioView />;
      case 'tools':
        return <ToolsWorkbenchView />;
      case 'router':
        return <RouterDebugView />;
      case 'health':
        return <HealthDashboardView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col">
      {/* Top Navigation Header */}
      <Header />

      {/* Main Workspace Container */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic View Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
