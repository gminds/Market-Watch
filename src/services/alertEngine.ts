import { AlertItem, MarketProfileData, SignalType, UserSettings, SymbolCode } from '../types/market';
import { signalTrackerService } from './signalTrackerService';

export class AlertEngine {
  private alertHistory: AlertItem[] = [];
  private lastAlertTimestamp: number = 0;
  private symbolLastAlertMap: Map<SymbolCode, number> = new Map();
  private sentAlertKeys: Set<string> = new Set();
  private audioContext: AudioContext | null = null;

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem('mps_alert_history');
      if (stored) {
        this.alertHistory = JSON.parse(stored);
      }
    } catch (e) {
      this.alertHistory = [];
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem('mps_alert_history', JSON.stringify(this.alertHistory.slice(0, 100)));
    } catch (e) {
      // ignore
    }
  }

  public getAlertHistory(): AlertItem[] {
    return [...this.alertHistory];
  }

  public clearAlertHistory() {
    this.alertHistory = [];
    this.sentAlertKeys.clear();
    this.saveHistory();
  }

  /**
   * Evaluates current market profile state against settings & generates alerts
   */
  public evaluateAndAlert(profile: MarketProfileData, settings: UserSettings): AlertItem | null {
    if (!profile) return null;

    // Suppress if symbol is muted to eliminate noise
    if (signalTrackerService.isSymbolMuted(profile.symbol)) {
      return null;
    }

    const threshold = settings.alertScoreThreshold || 75;
    const isHighScore = profile.marketScore >= threshold;
    const hasImbalanceEvent = profile.events.some((e) => e.severity === 'critical' || e.severity === 'high');

    if (!isHighScore && !hasImbalanceEvent) {
      return null;
    }

    // Duplicate check key: symbol + date + shape + score + bias
    const alertKey = `${profile.symbol}_${profile.dateStr}_${profile.profileShape}_${profile.marketScore}_${profile.bias}_${profile.close.toFixed(4)}`;

    if (this.sentAlertKeys.has(alertKey)) {
      return null; // Suppress duplicate alert
    }

    // Per-symbol cooldown check (minimum 10 minutes between alerts for the same asset)
    const lastSymbolAlert = this.symbolLastAlertMap.get(profile.symbol) || 0;
    if (Date.now() - lastSymbolAlert < 600000) {
      return null;
    }

    // Global cooldown check (minimum 2 minutes between any alert)
    if (Date.now() - this.lastAlertTimestamp < 120000) {
      return null;
    }

    const signalType: SignalType =
      profile.bias.includes('Bullish')
        ? 'BULLISH_IMBALANCE'
        : profile.bias.includes('Bearish')
        ? 'BEARISH_IMBALANCE'
        : 'NO_TRADE';

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

    const newAlert: AlertItem = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      timeStr,
      dateStr: profile.dateStr,
      symbol: profile.symbol,
      title: `${profile.symbol} Imbalance Alert (${profile.marketScore}/100)`,
      message: `${profile.bias} Market Profile (${profile.profileShape}) detected at ${profile.close.toFixed(5)}. POC: ${profile.poc.toFixed(5)}, VAH: ${profile.vah.toFixed(5)}, VAL: ${profile.val.toFixed(5)}. Range Expansion: ${profile.rangeExpansionRatio}x ATR.`,
      score: profile.marketScore,
      signalType,
      shape: profile.profileShape,
      price: profile.close,
      sentToBrowser: false,
      sentToWebhook: false,
      sentToTelegram: false,
    };

    // Mark as sent
    this.sentAlertKeys.add(alertKey);
    this.lastAlertTimestamp = Date.now();
    this.symbolLastAlertMap.set(profile.symbol, Date.now());
    this.alertHistory.unshift(newAlert);
    this.saveHistory();

    // Trigger Notification Channels
    if (settings.audioAlertsEnabled) {
      this.playChime();
    }

    if (settings.browserNotificationsEnabled) {
      this.sendBrowserNotification(newAlert);
    }

    if (settings.webhookEnabled && settings.webhookUrl) {
      this.sendWebhook(newAlert, settings.webhookUrl);
    }

    if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
      this.sendTelegram(newAlert, settings.telegramBotToken, settings.telegramChatId);
    }

    return newAlert;
  }

  /**
   * Browser Notification API
   */
  public async requestBrowserNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  private sendBrowserNotification(alert: AlertItem) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(alert.title, {
          body: alert.message,
          icon: '/favicon.ico',
          tag: alert.id,
        });
        alert.sentToBrowser = true;
      } catch (e) {
        console.error('Browser notification error:', e);
      }
    }
  }

  /**
   * Webhook dispatcher (Discord / Slack format)
   */
  public async sendWebhook(alert: AlertItem, webhookUrl: string) {
    try {
      const payload = {
        username: 'Market Profile Scanner',
        embeds: [
          {
            title: `🚨 ${alert.title}`,
            description: alert.message,
            color: alert.signalType === 'BULLISH_IMBALANCE' ? 65280 : 16711680,
            fields: [
              { name: 'Symbol', value: alert.symbol, inline: true },
              { name: 'Price', value: alert.price.toFixed(5), inline: true },
              { name: 'Score', value: `${alert.score}/100`, inline: true },
              { name: 'Profile Shape', value: alert.shape, inline: true },
              { name: 'Signal', value: alert.signalType, inline: true },
            ],
            footer: { text: `London Session | ${alert.timeStr} UTC` },
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert.sentToWebhook = true;
    } catch (e) {
      console.warn('Webhook delivery failed:', e);
    }
  }

  /**
   * Telegram Dispatcher
   */
  public async sendTelegram(alert: AlertItem, botToken: string, chatId: string) {
    try {
      const text = `<b>🚨 ${alert.title}</b>\n\n${alert.message}\n\n<b>Price:</b> ${alert.price.toFixed(
        5
      )}\n<b>Score:</b> ${alert.score}/100\n<b>Shape:</b> ${alert.shape}`;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });
      alert.sentToTelegram = true;
    } catch (e) {
      console.warn('Telegram delivery failed:', e);
    }
  }

  /**
   * Audio chime synthesizer using Web Audio API
   */
  public playChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3); // A6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // Audio autoplay restrictions catch
    }
  }
}

export const alertEngine = new AlertEngine();
