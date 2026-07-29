import React, { useState } from 'react';
import { AlertItem } from '../types/market';
import {
  Bell,
  CheckCircle2,
  Filter,
  Flame,
  Globe,
  MessageSquare,
  Search,
  Send,
  Trash2,
  Volume2,
} from 'lucide-react';
import { alertEngine } from '../services/alertEngine';

interface AlertsLogViewProps {
  alertHistory: AlertItem[];
  onClearHistory: () => void;
}

export const AlertsLogView: React.FC<AlertsLogViewProps> = ({
  alertHistory,
  onClearHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [testStatus, setTestStatus] = useState<string>('');

  const filteredAlerts = alertHistory.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.shape.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTestAudio = () => {
    alertEngine.playChime();
    setTestStatus('Played Audio Chime Test');
    setTimeout(() => setTestStatus(''), 3000);
  };

  const handleTestBrowserNotification = async () => {
    const granted = await alertEngine.requestBrowserNotificationPermission();
    if (granted) {
      new Notification('Market Profile Scanner V1 Test', {
        body: 'Browser alert channel verified successfully.',
      });
      setTestStatus('Browser Notification Sent');
    } else {
      setTestStatus('Browser Permission Denied');
    }
    setTimeout(() => setTestStatus(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-lg font-bold text-[#ffffff] flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <span>Auction Imbalance Alerts & Event Stream Log</span>
          </div>
          <div className="text-xs text-[#71717a]">
            Real-time feed of detected market profile imbalances, Initial Balance breakouts, and high-score signals.
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleTestAudio}
            className="px-3 py-1.5 rounded-lg bg-[#161618] hover:bg-[#2d2d30] text-[#e0e0e0] border border-[#2d2d30] flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Test Chime</span>
          </button>
          <button
            onClick={handleTestBrowserNotification}
            className="px-3 py-1.5 rounded-lg bg-[#161618] hover:bg-[#2d2d30] text-[#e0e0e0] border border-[#2d2d30] flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Browser Alert</span>
          </button>
          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>
      </div>

      {testStatus && (
        <div className="p-3 bg-blue-950 text-blue-300 border border-blue-800 rounded-lg font-mono text-xs text-center">
          {testStatus}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-4 font-mono text-xs shadow-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alert history by title, shape, or message..."
            className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg pl-9 pr-3 py-2 text-[#e0e0e0] placeholder-[#71717a] focus:outline-none focus:border-blue-500 font-mono text-xs"
          />
        </div>
      </div>

      {/* Table / List of Alerts */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0c0c0e] text-[#71717a] uppercase text-[10px] tracking-wider border-b border-[#2d2d30]">
                <th className="p-3">Time UTC</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Alert Title</th>
                <th className="p-3">Price</th>
                <th className="p-3">Score</th>
                <th className="p-3">Profile Shape</th>
                <th className="p-3">Channels Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d2d30]/80 text-[#e0e0e0]">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-[#161618] transition-colors">
                    <td className="p-3 font-semibold text-blue-400">{alert.timeStr}</td>
                    <td className="p-3 font-bold">{alert.symbol}</td>
                    <td className="p-3">
                      <div className="font-bold text-[#ffffff]">{alert.title}</div>
                      <div className="text-[11px] text-[#71717a] font-sans mt-0.5">
                        {alert.message}
                      </div>
                    </td>
                    <td className="p-3 font-bold">{alert.price.toFixed(5)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          alert.score >= 80
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}
                      >
                        {alert.score}
                      </span>
                    </td>
                    <td className="p-3 text-amber-400 font-semibold">{alert.shape}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            alert.sentToBrowser ? 'bg-emerald-950 text-emerald-400' : 'bg-[#161618] text-[#71717a]'
                          }`}
                        >
                          Browser
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            alert.sentToWebhook ? 'bg-emerald-950 text-emerald-400' : 'bg-[#161618] text-[#71717a]'
                          }`}
                        >
                          Webhook
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            alert.sentToTelegram ? 'bg-emerald-950 text-emerald-400' : 'bg-[#161618] text-[#71717a]'
                          }`}
                        >
                          Telegram
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#71717a] font-mono text-xs">
                    No Alert Logs Match Filter Criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
