import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Clock,
  Database,
  Layers,
  LineChart,
  Sliders,
  Volume2,
  VolumeX,
  Wifi,
  ChevronDown,
  Zap,
  Sparkles,
} from 'lucide-react';
import { ActiveTabType, DataProviderStatus, UserSettings } from '../types/market';
import { dataProviderService } from '../services/dataProviders';

interface HeaderProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  activeProvider: DataProviderStatus;
  marketScore: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onUpdateSettings,
  activeProvider,
  marketScore,
}) => {
  const [londonTimeStr, setLondonTimeStr] = useState<string>('');
  const [utcTimeStr, setUtcTimeStr] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<{ text: string; isActive: boolean }>({
    text: 'LONDON SESSION ACTIVE',
    isActive: true,
  });
  const [showProviderDropdown, setShowProviderDropdown] = useState<boolean>(false);

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const utcH = String(now.getUTCHours()).padStart(2, '0');
      const utcM = String(now.getUTCMinutes()).padStart(2, '0');
      const utcS = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTimeStr(`${utcH}:${utcM}:${utcS} UTC`);

      // London Time
      const londonTimeString = now.toLocaleTimeString('en-GB', {
        timeZone: 'Europe/London',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLondonTimeStr(`${londonTimeString} LON`);

      // Calculate session status
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const [startH, startM] = settings.sessionStartUTC.split(':').map(Number);
      const [endH, endM] = settings.sessionEndUTC.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        setSessionStatus({ text: 'LONDON SESSION ACTIVE', isActive: true });
      } else {
        setSessionStatus({ text: 'POST/PRE SESSION', isActive: false });
      }
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, [settings.sessionStartUTC, settings.sessionEndUTC]);

  const allProviders = dataProviderService.getAllProviders();

  return (
    <header className="bg-[#0c0c0e] border-b border-[#2d2d30] text-[#e0e0e0] sticky top-0 z-40 shadow-2xl">
      {/* Top Utility & Status Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between text-xs border-b border-[#2d2d30]/80 gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-blue-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span>MARKET PROFILE SCANNER V1</span>
          </div>
          <div className="h-3 w-px bg-[#2d2d30] hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2 text-[#71717a] font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[#e0e0e0] font-semibold">{londonTimeStr}</span>
            <span className="text-[#71717a]">|</span>
            <span>{utcTimeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Session Indicator */}
          <div
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border ${
              sessionStatus.isActive
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sessionStatus.isActive ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {sessionStatus.text} ({settings.sessionStartUTC} - {settings.sessionEndUTC})
          </div>

          {/* Data Provider Selector */}
          <div className="relative">
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              className="px-2.5 py-0.5 rounded bg-[#161618] hover:bg-[#202023] text-[#e0e0e0] font-mono text-[11px] flex items-center gap-1.5 border border-[#2d2d30] transition-colors"
            >
              <Wifi className="w-3 h-3 text-blue-400" />
              <span>{activeProvider.name}</span>
              <ChevronDown className="w-3 h-3 text-[#71717a]" />
            </button>

            {showProviderDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-[#111113] border border-[#2d2d30] rounded-md shadow-2xl z-50 p-1.5">
                <div className="text-[10px] uppercase tracking-wider text-[#71717a] px-2 py-1 font-semibold border-b border-[#2d2d30]">
                  Data Provider Modules
                </div>
                <div className="mt-1 space-y-0.5 max-h-60 overflow-y-auto">
                  {allProviders.map((prov) => (
                    <button
                      key={prov.id}
                      onClick={() => {
                        dataProviderService.setActiveProvider(prov.id);
                        setShowProviderDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between font-mono ${
                        prov.id === activeProvider.id
                          ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold'
                          : 'hover:bg-[#161618] text-[#e0e0e0]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            prov.isAvailable ? 'bg-emerald-400' : 'bg-red-500'
                          }`}
                        />
                        <span>{prov.name}</span>
                      </div>
                      <span className="text-[10px] text-[#71717a]">{prov.latencyMs}ms</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mute Audio Toggle */}
          <button
            onClick={() =>
              onUpdateSettings({ ...settings, audioAlertsEnabled: !settings.audioAlertsEnabled })
            }
            className={`p-1 rounded border transition-colors ${
              settings.audioAlertsEnabled
                ? 'bg-[#161618] text-blue-400 border-[#2d2d30]'
                : 'bg-[#050506] text-[#71717a] border-[#2d2d30]'
            }`}
            title={settings.audioAlertsEnabled ? 'Audio Alerts Enabled' : 'Audio Alerts Muted'}
          >
            {settings.audioAlertsEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'scanner'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Multi-Pair Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('correlation')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'correlation'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Correlation Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('similarity')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'similarity'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Similarity Search</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'chart'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Interactive Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'library'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Profile Archive</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'alerts'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts & Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-[#71717a] hover:text-[#e0e0e0] hover:bg-[#161618]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Market Score Badge */}
        <div className="flex items-center gap-3 font-mono">
          <div className="text-right hidden md:block">
            <div className="text-[10px] uppercase text-[#71717a] font-sans tracking-wide">
              Market Score
            </div>
            <div
              className={`text-sm font-bold ${
                marketScore >= 80
                  ? 'text-emerald-400'
                  : marketScore >= 60
                  ? 'text-blue-400'
                  : 'text-[#e0e0e0]'
              }`}
            >
              {marketScore} / 100
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base shadow-inner border ${
              marketScore >= 80
                ? 'bg-emerald-950 text-emerald-400 border-emerald-600'
                : marketScore >= 60
                ? 'bg-blue-950 text-blue-400 border-blue-600'
                : 'bg-[#161618] text-[#e0e0e0] border-[#2d2d30]'
            }`}
          >
            {marketScore}
          </div>
        </div>
      </div>
    </header>
  );
};
