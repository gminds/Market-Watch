/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveTabType,
  AlertItem,
  Candle,
  DailyProfileRecord,
  DataProviderStatus,
  MarketProfileData,
  ScannerPairItem,
  SimilaritySearchResult,
  SymbolCode,
  TradeSignal,
  UserSettings,
} from './types/market';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SmartNewsView } from './components/SmartNewsView';
import { ScannerGrid } from './components/ScannerGrid';
import { CorrelationView } from './components/CorrelationView';
import { SimilarityView } from './components/SimilarityView';
import { ChartView } from './components/ChartView';
import { ProfileLibraryView } from './components/ProfileLibraryView';
import { AlertsLogView } from './components/AlertsLogView';
import { SettingsView } from './components/SettingsView';
import { SignalOutcomeTrackerView } from './components/SignalOutcomeTrackerView';
import { RiskManagementView } from './components/RiskManagementView';
import { NotificationToast } from './components/NotificationToast';

import { dataProviderService } from './services/dataProviders';
import { buildMarketProfile, profileRecordToMarketProfile } from './services/tpoEngine';
import { formatPrice, getSymbolConfig } from './config/symbols';
import { alertEngine } from './services/alertEngine';
import { storageService } from './services/storageService';
import { scannerEngine } from './services/scannerEngine';
import { similarityEngine } from './services/similarityEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('dashboard');

  const [settings, setSettings] = useState<UserSettings>(() => storageService.getUserSettings());
  const [activeProvider, setActiveProvider] = useState<DataProviderStatus>(() =>
    dataProviderService.getActiveProvider()
  );

  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentProfile, setCurrentProfile] = useState<MarketProfileData | null>(null);
  const [yesterdayProfile, setYesterdayProfile] = useState<DailyProfileRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<DailyProfileRecord[]>([]);

  const [similarityResult, setSimilarityResult] = useState<SimilaritySearchResult | null>(null);

  const [scannerItems, setScannerItems] = useState<ScannerPairItem[]>([]);
  const [tradeSignal, setTradeSignal] = useState<TradeSignal | null>(null);
  const [alertHistory, setAlertHistory] = useState<AlertItem[]>(() => alertEngine.getAlertHistory());
  const [activeToastAlert, setActiveToastAlert] = useState<AlertItem | null>(null);

  // Asset Switching & Loading States
  const [isSwitchingSymbol, setIsSwitchingSymbol] = useState<boolean>(false);
  const [switchingTargetSymbol, setSwitchingTargetSymbol] = useState<SymbolCode | null>(null);
  const requestSeqRef = useRef<number>(0);

  // Recalculate Profile Similarity Search whenever yesterdayProfile or historyRecords updates
  // Strictly uses Yesterday's completed Market Profile to search historical database and forecast today
  useEffect(() => {
    if (historyRecords.length > 0) {
      const symbolHistory = historyRecords.filter((r) => (r.symbol || 'GBPUSD') === settings.symbol);
      const targetRecord =
        yesterdayProfile && (yesterdayProfile.symbol || 'GBPUSD') === settings.symbol
          ? yesterdayProfile
          : symbolHistory[0] || historyRecords.find((r) => (r.symbol || 'GBPUSD') === settings.symbol);

      if (targetRecord) {
        if (!yesterdayProfile || (yesterdayProfile.symbol || 'GBPUSD') !== settings.symbol) {
          setYesterdayProfile(targetRecord);
        }
        const targetMarketProfile = profileRecordToMarketProfile(targetRecord, settings.symbol);
        const res = similarityEngine.searchSimilarProfiles(targetMarketProfile, historyRecords, 10);
        setSimilarityResult(res);
      }
    }
  }, [yesterdayProfile, historyRecords, settings.symbol]);

  // Subscribe to provider changes
  useEffect(() => {
    const unsubscribe = dataProviderService.subscribeProviderChange((provider) => {
      setActiveProvider(provider);
    });
    return unsubscribe;
  }, []);

  // Run full scan across all supported pairs & populate scanner grid
  const refreshScan = async () => {
    const { items, profiles } = await scannerEngine.runFullScan(settings);
    setScannerItems(items);

    const activeProfile = profiles.get(settings.symbol);
    if (activeProfile) {
      setCurrentProfile(activeProfile);

      const activeCandles = scannerEngine.getPairCandles(settings.symbol);
      if (activeCandles && activeCandles.length > 0) {
        setCandles([...activeCandles]);
      }

      // Evaluate alert conditions
      const triggeredAlert = alertEngine.evaluateAndAlert(activeProfile, settings);
      if (triggeredAlert) {
        setAlertHistory(alertEngine.getAlertHistory());
      }
    }
  };

  // Initial Data Loading & Setup for Selected Symbol
  useEffect(() => {
    const currentReqId = ++requestSeqRef.current;
    let isCancelled = false;

    const initData = async () => {
      setIsSwitchingSymbol(true);
      setSwitchingTargetSymbol(settings.symbol);

      // Yield turn to allow UI to paint loading state immediately
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (isCancelled || requestSeqRef.current !== currentReqId) return;

      const fetchedCandles = await dataProviderService.fetchHistoricalCandles(settings.symbol, 300);
      if (isCancelled || requestSeqRef.current !== currentReqId) return;

      setCandles(fetchedCandles);

      // Yield turn
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (isCancelled || requestSeqRef.current !== currentReqId) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const profile = buildMarketProfile(
        settings.symbol,
        fetchedCandles,
        todayStr,
        true,
        settings.sessionStartUTC,
        settings.sessionEndUTC,
        settings.tpoPriceStepPips
      );

      if (isCancelled || requestSeqRef.current !== currentReqId) return;
      setCurrentProfile(profile);

      // Seed & Load History
      const history = storageService.seedInitialHistoryIfEmpty(profile);
      setHistoryRecords(history);
      
      // Select yesterday's profile specifically for the active symbol
      const symbolHistory = history.filter((r) => (r.symbol || 'GBPUSD') === settings.symbol);
      if (symbolHistory.length > 0) {
        setYesterdayProfile(symbolHistory[0]);
      } else {
        setYesterdayProfile(null);
      }

      // Generate Trade Signal
      if (profile.marketScore >= settings.alertScoreThreshold) {
        const isLong = profile.bias.includes('Bullish');
        const entryPrice = profile.close;
        const symbolConfig = getSymbolConfig(settings.symbol);
        const pipVal = symbolConfig.pipValue;
        const stopLoss = isLong ? profile.val - pipVal * 15 : profile.vah + pipVal * 15;
        const takeProfit = isLong
          ? profile.close + (profile.close - stopLoss) * 1.8
          : profile.close - (stopLoss - profile.close) * 1.8;

        setTradeSignal({
          id: `sig-${Date.now()}`,
          dateStr: todayStr,
          timeStr: fetchedCandles[fetchedCandles.length - 1]?.timeStr || '12:00',
          timestamp: Date.now(),
          symbol: settings.symbol,
          type: isLong ? 'BULLISH_IMBALANCE' : 'BEARISH_IMBALANCE',
          bias: profile.bias,
          score: profile.marketScore,
          entryPrice,
          stopLoss,
          takeProfit,
          riskReward: 1.8,
          targetPips: Math.round(Math.abs(takeProfit - entryPrice) / pipVal),
          stopPips: Math.round(Math.abs(entryPrice - stopLoss) / pipVal),
          rationale: [
            `Sustained ${profile.bias} auction alignment (${profile.profileShape})`,
            `ATR Expansion Ratio at ${profile.rangeExpansionRatio}x normal daily range`,
            `Point of Control migrating ${isLong ? 'higher' : 'lower'} at ${formatPrice(profile.poc, settings.symbol)}`,
          ],
        });
      } else {
        setTradeSignal(null);
      }

      // Initial scanner pass
      await refreshScan();

      if (!isCancelled && requestSeqRef.current === currentReqId) {
        setIsSwitchingSymbol(false);
        setSwitchingTargetSymbol(null);
      }
    };

    initData();

    return () => {
      isCancelled = true;
    };
  }, [settings.symbol, settings.sessionStartUTC, settings.sessionEndUTC, settings.tpoPriceStepPips, settings.alertScoreThreshold]);

  // Recurring 3-second live scan & market profile calculation (paused during asset switching)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      if (!isSwitchingSymbol) {
        refreshScan();
      }
    }, 3000);

    return () => clearInterval(tickInterval);
  }, [settings, isSwitchingSymbol]);

  const handleSelectPair = (symbol: SymbolCode) => {
    if (symbol === settings.symbol && !isSwitchingSymbol) return;

    setIsSwitchingSymbol(true);
    setSwitchingTargetSymbol(symbol);
    setTradeSignal(null);
    setYesterdayProfile(null);
    setSimilarityResult(null);
    scannerEngine.clearPairCandles(symbol);

    React.startTransition(() => {
      const updated = { ...settings, symbol };
      setSettings(updated);
      storageService.saveUserSettings(updated);
    });
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    storageService.saveUserSettings(newSettings);
  };

  const handleClearAlertHistory = () => {
    alertEngine.clearAlertHistory();
    setAlertHistory([]);
  };

  return (
    <div className="min-h-screen bg-[#050506] text-[#e0e0e0] font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Terminal Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onUpdateSettings={handleSaveSettings}
        activeProvider={activeProvider}
        marketScore={currentProfile ? currentProfile.marketScore : 50}
      />

      {/* Main Tab Content */}
      <main className="pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentProfile={currentProfile}
            yesterdayProfile={yesterdayProfile}
            candles={candles}
            settings={settings}
            tradeSignal={tradeSignal}
            scannerItems={scannerItems}
            similarityResult={similarityResult || undefined}
            onSelectPair={handleSelectPair}
            onOpenFullChart={() => setActiveTab('chart')}
            onOpenSimilarityTab={() => setActiveTab('similarity')}
            onOpenForecastTab={() => setActiveTab('forecast')}
            onOpenNewsTab={() => setActiveTab('news')}
            isSwitchingSymbol={isSwitchingSymbol}
            switchingTargetSymbol={switchingTargetSymbol}
          />
        )}

        {activeTab === 'risk' && <RiskManagementView />}

        {activeTab === 'news' && currentProfile && (
          <SmartNewsView
            activeSymbol={settings.symbol}
            onSelectPair={handleSelectPair}
            similarityResult={similarityResult}
            currentProfile={currentProfile}
          />
        )}

        {activeTab === 'scanner' && (
          <div className="max-w-7xl mx-auto px-4 py-6">
            <ScannerGrid
              scannerItems={scannerItems}
              onSelectPair={handleSelectPair}
              activeSymbol={settings.symbol}
              activeProfile={currentProfile}
              switchingTargetSymbol={switchingTargetSymbol}
            />
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="max-w-7xl mx-auto px-4 py-6">
            <SignalOutcomeTrackerView
              currentProfile={currentProfile}
              onSelectPair={handleSelectPair}
            />
          </div>
        )}

        {activeTab === 'correlation' && <CorrelationView />}

        {activeTab === 'similarity' && currentProfile && similarityResult && (
          <SimilarityView
            currentProfile={currentProfile}
            searchResult={similarityResult}
            onSelectPair={handleSelectPair}
          />
        )}

        {activeTab === 'chart' && currentProfile && (
          <ChartView
            candles={candles}
            profile={currentProfile}
            tradeSignal={tradeSignal}
          />
        )}

        {activeTab === 'library' && (
          <ProfileLibraryView history={historyRecords} />
        )}

        {activeTab === 'alerts' && (
          <AlertsLogView
            alertHistory={alertHistory}
            onClearHistory={handleClearAlertHistory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </main>
    </div>
  );
}
