import React, { useState } from 'react';
import {
  AppTheme,
  DataProviderId,
  SymbolCode,
  UserSettings,
} from '../types/market';
import {
  Bell,
  CheckCircle2,
  Cloud,
  Clock,
  Database,
  Globe,
  Palette,
  Send,
  Shield,
  Sliders,
  Volume2,
  Wifi,
} from 'lucide-react';
import { alertEngine } from '../services/alertEngine';
import { dataProviderService } from '../services/dataProviders';
import { PROVIDER_CATALOG } from '../config/providers';

interface SettingsViewProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<UserSettings>({ ...settings });
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [testWebhookStatus, setTestWebhookStatus] = useState<string>('');

  const handleChange = (key: keyof UserSettings, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveStatus('Settings Saved & Synced Successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleSendTestWebhook = async () => {
    if (!formData.webhookUrl) {
      setTestWebhookStatus('Please enter a Webhook URL first.');
      return;
    }
    setTestWebhookStatus('Sending test payload...');
    await alertEngine.sendWebhook(
      {
        id: 'test-webhook',
        timestamp: Date.now(),
        timeStr: '12:00',
        dateStr: new Date().toISOString().split('T')[0],
        symbol: formData.symbol,
        title: 'Market Profile Scanner Test Webhook',
        message: 'This is a test notification from Market Profile Scanner V1.',
        score: 88,
        signalType: 'BULLISH_IMBALANCE',
        shape: 'P Profile',
        price: dataProviderService.getBasePrice(formData.symbol),
        sentToBrowser: false,
        sentToWebhook: true,
        sentToTelegram: false,
      },
      formData.webhookUrl
    );
    setTestWebhookStatus('Webhook Test Triggered!');
    setTimeout(() => setTestWebhookStatus(''), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-lg font-bold text-[#ffffff] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <span>Market Scanner Configuration & Sync</span>
          </div>
          <div className="text-xs text-[#71717a]">
            Configure market parameters, session times, alert thresholds, webhook integrations, and color themes.
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold shadow-lg transition-colors flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save & Sync Preferences</span>
        </button>
      </div>

      {saveStatus && (
        <div className="p-3 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg font-mono text-xs text-center font-bold">
          {saveStatus}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Market & Session Settings */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-sans border-b border-[#2d2d30] pb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Market Profile & Session Parameters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                Primary Asset Symbol
              </label>
              <select
                value={formData.symbol}
                onChange={(e) => handleChange('symbol', e.target.value as SymbolCode)}
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500"
              >
                <option value="GBPUSD">GBP/USD (British Pound vs Dollar)</option>
                <option value="EURUSD">EUR/USD (Euro vs Dollar)</option>
                <option value="USDJPY">USD/JPY (Dollar vs Yen)</option>
                <option value="AUDUSD">AUD/USD (Aussie vs Dollar)</option>
                <option value="GBPJPY">GBP/JPY (Pound vs Yen)</option>
                <option value="XAUUSD">XAU/USD (Gold Spot)</option>
                <option value="USDCAD">USD/CAD (Dollar vs Canadian Dollar)</option>
                <option value="USDCHF">USD/CHF (Dollar vs Swiss Franc)</option>
                <option value="NZDUSD">NZD/USD (Kiwi vs Dollar)</option>
                <option value="BTCUSD">BTC/USD (Bitcoin vs Dollar)</option>
                <option value="ETHUSD">ETH/USD (Ethereum vs Dollar)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                ATR Calculation Period
              </label>
              <input
                type="number"
                value={formData.atrPeriod}
                onChange={(e) => handleChange('atrPeriod', Number(e.target.value))}
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                Alert Score Threshold (0 - 100)
              </label>
              <input
                type="number"
                min="50"
                max="95"
                value={formData.alertScoreThreshold}
                onChange={(e) => handleChange('alertScoreThreshold', Number(e.target.value))}
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                London Session Start (UTC)
              </label>
              <input
                type="text"
                value={formData.sessionStartUTC}
                onChange={(e) => handleChange('sessionStartUTC', e.target.value)}
                placeholder="08:00"
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                London Session End (UTC)
              </label>
              <input
                type="text"
                value={formData.sessionEndUTC}
                onChange={(e) => handleChange('sessionEndUTC', e.target.value)}
                placeholder="16:30"
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                Daily Profile Definition
              </label>
              <select
                value={formData.dayType}
                onChange={(e) => handleChange('dayType', e.target.value)}
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500"
              >
                <option value="UTC">00:00 - 23:59 UTC (Default Full Day)</option>
                <option value="Broker">Broker Server Time</option>
                <option value="NYClose">New York Close (17:00 EST)</option>
                <option value="Custom">Custom Session Definition</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Provider Selection */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-sans border-b border-[#2d2d30] pb-2 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span>Preferred Market Data Provider Module</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
            {PROVIDER_CATALOG.map((prov) => (
              <label
                key={prov.id}
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                  formData.preferredProvider === prov.id
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 font-bold'
                    : 'bg-[#0c0c0e] border-[#2d2d30] text-[#71717a] hover:border-[#2d2d30]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#ffffff] font-bold text-xs">{prov.name}</span>
                  <input
                    type="radio"
                    name="preferredProvider"
                    checked={formData.preferredProvider === prov.id}
                    onChange={() => handleChange('preferredProvider', prov.id as DataProviderId)}
                    className="accent-blue-500"
                  />
                </div>
                <div className="text-[10px] text-[#71717a] font-sans">{prov.statusMessage}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Notification Integration Channels */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-sans border-b border-[#2d2d30] pb-2 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <span>Alert & Notification Destinations</span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 p-3 bg-[#0c0c0e] rounded-lg border border-[#2d2d30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.audioAlertsEnabled}
                  onChange={(e) => handleChange('audioAlertsEnabled', e.target.checked)}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-[#e0e0e0] font-semibold">Audio Synthesizer Chime</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-[#0c0c0e] rounded-lg border border-[#2d2d30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.browserNotificationsEnabled}
                  onChange={(e) => handleChange('browserNotificationsEnabled', e.target.checked)}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-[#e0e0e0] font-semibold">Browser Web Notifications</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-[#0c0c0e] rounded-lg border border-[#2d2d30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.webhookEnabled}
                  onChange={(e) => handleChange('webhookEnabled', e.target.checked)}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-[#e0e0e0] font-semibold">Enable Webhook Alerts</span>
              </label>
            </div>

            {/* Webhook URL Input */}
            <div className="space-y-1">
              <label className="block text-[#71717a] text-[11px]">
                Discord / Slack / Custom Webhook Endpoint URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) => handleChange('webhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSendTestWebhook}
                  className="px-3 py-2 rounded-lg bg-[#161618] hover:bg-[#2d2d30] text-[#e0e0e0] border border-[#2d2d30] flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>Test Webhook</span>
                </button>
              </div>
              {testWebhookStatus && (
                <div className="text-[10px] text-blue-400 pt-1">{testWebhookStatus}</div>
              )}
            </div>
          </div>
        </div>

        {/* Color Theme & Cloud Syncing */}
        <div className="bg-[#111113] border border-[#2d2d30] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-sans border-b border-[#2d2d30] pb-2 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-400" />
            <span>Theme & Cloud Preferences Sync</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div>
              <label className="block text-[#71717a] text-[11px] mb-1">
                Terminal Color Theme
              </label>
              <select
                value={formData.theme}
                onChange={(e) => handleChange('theme', e.target.value as AppTheme)}
                className="w-full bg-[#0c0c0e] border border-[#2d2d30] rounded-lg px-3 py-2 text-[#e0e0e0] focus:outline-none focus:border-blue-500"
              >
                <option value="sierra-slate">Sierra Chart Dark Slate</option>
                <option value="bloomberg-terminal">Bloomberg Terminal Dark</option>
                <option value="cyberpunk-dark">Cyberpunk Vivid Neon</option>
                <option value="tradingview-dark">TradingView Midnight</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#0c0c0e] rounded-lg border border-[#2d2d30]">
              <div className="space-y-0.5">
                <div className="text-[#e0e0e0] font-semibold flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span>Cloud Preferences Sync</span>
                </div>
                <div className="text-[10px] text-[#71717a] font-sans">
                  Sync settings and saved profiles automatically across devices.
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.cloudSyncEnabled}
                onChange={(e) => handleChange('cloudSyncEnabled', e.target.checked)}
                className="accent-blue-500 w-4 h-4"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-sm font-bold shadow-2xl transition-colors flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Save & Apply All Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
