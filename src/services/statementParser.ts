import * as XLSX from 'xlsx';
import { MTAccount, MTTrade, StatementImportSummary } from '../types/risk';

interface RawMt5Deal {
  dealId: string;
  orderId: string;
  positionId: string;
  timeStr: string;
  timestamp: number;
  symbol: string;
  typeStr: string; // 'buy', 'sell', 'balance', 'credit', etc.
  direction: 'in' | 'out' | 'in/out' | 'unknown';
  volume: number;
  price: number;
  commission: number;
  fee: number;
  swap: number;
  profit: number;
  sl: number;
  tp: number;
  comment: string;
}

/**
 * MetaTrader Statement Parser
 * Parses MT4/MT5 Detailed Statements in XLSX, HTML, Open XML, or CSV formats.
 * Reconstructs completed position trades from MT5 Deals records.
 */
export class StatementParser {
  /**
   * Main entry point to parse statement file string or ArrayBuffer
   */
  public parseStatement(fileContent: string | ArrayBuffer, fileName: string): MTAccount {
    const isXlsxFile =
      /\.(xlsx|xls)$/i.test(fileName) ||
      fileContent instanceof ArrayBuffer ||
      (typeof fileContent === 'string' && fileContent.substring(0, 4) === 'PK\x03\x04');

    if (isXlsxFile) {
      return this.parseXlsxStatement(fileContent, fileName);
    }

    const strContent = typeof fileContent === 'string' ? fileContent : new TextDecoder('utf-8').decode(fileContent);
    const trimmed = strContent.trim();

    if (trimmed.startsWith('<?xml') || (trimmed.includes('<xml') && trimmed.includes('<Workbook>'))) {
      return this.parseXmlStatement(strContent, fileName);
    } else if (
      trimmed.includes('<html') ||
      trimmed.includes('<HTML') ||
      trimmed.includes('<table') ||
      trimmed.includes('<TABLE') ||
      trimmed.includes('<tr') ||
      trimmed.includes('<TR')
    ) {
      return this.parseHtmlStatement(strContent, fileName);
    } else {
      return this.parseCsvStatement(strContent, fileName);
    }
  }

  /**
   * Parses Microsoft Excel (.xlsx / .xls) MetaTrader Statements using SheetJS
   */
  private parseXlsxStatement(content: string | ArrayBuffer, fileName: string): MTAccount {
    try {
      const workbook = XLSX.read(content, {
        type: typeof content === 'string' ? 'binary' : 'array',
        cellDates: true,
      });

      let combinedRows: string[][] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const jsonRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
          const strRows = jsonRows.map((row) =>
            (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim())
          );
          combinedRows = combinedRows.concat(strRows);
        }
      });

      return this.parse2DArrayStatement(combinedRows, fileName, 'XLSX Account');
    } catch (e) {
      console.error('Failed to parse XLSX statement:', e);
      const str = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      return this.parseCsvStatement(str, fileName);
    }
  }

  /**
   * Parses MT4 / MT5 Detailed HTML Reports
   */
  private parseHtmlStatement(htmlContent: string, fileName: string): MTAccount {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const trElements = Array.from(doc.querySelectorAll('tr'));
    const rows2D: string[][] = trElements.map((tr) =>
      Array.from(tr.querySelectorAll('td, th')).map((cell) =>
        (cell.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      )
    );

    if (rows2D.length === 0) {
      const lines = htmlContent.split(/\r?\n/);
      const fallbackRows = lines.map((l) => l.split(/[\t,;]/).map((c) => c.replace(/<[^>]*>/g, '').trim()));
      return this.parse2DArrayStatement(fallbackRows, fileName, 'HTML Account', htmlContent);
    }

    const fullText = doc.body ? doc.body.innerText || doc.body.textContent || '' : htmlContent;
    return this.parse2DArrayStatement(rows2D, fileName, 'HTML Account', fullText);
  }

  /**
   * Parses Open XML (.xml) MT4/MT5 Statements
   */
  private parseXmlStatement(xmlContent: string, fileName: string): MTAccount {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const rows = Array.from(doc.querySelectorAll('Row, tr'));
    const rows2D: string[][] = rows.map((row) =>
      Array.from(row.querySelectorAll('Cell Data, Data, td')).map((c) =>
        (c.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      )
    );

    const fullText = doc.textContent || xmlContent;
    return this.parse2DArrayStatement(rows2D, fileName, 'XML Account', fullText);
  }

  /**
   * Fallback CSV/Text statement parser
   */
  private parseCsvStatement(csvContent: string, fileName: string): MTAccount {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows2D: string[][] = lines.map((line) =>
      line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''))
    );

    return this.parse2DArrayStatement(rows2D, fileName, 'CSV Account', csvContent);
  }

  /**
   * Core Engine: Parses 2D array of string cells extracted from XLSX, HTML, XML, or CSV
   */
  private parse2DArrayStatement(
    rows: string[][],
    fileName: string,
    defaultAccountLabel: string,
    rawTextContext: string = ''
  ): MTAccount {
    let accountNumber = '';
    let accountName = '';
    let broker = 'MetaTrader Broker';
    let currency = 'USD';
    let leverage = '1:100';
    let initialDeposit = 0;
    let initialDepositFound = false;

    // Combined text string for metadata extraction
    const combinedText =
      rawTextContext ||
      rows
        .map((r) => r.join(' '))
        .join('\n')
        .replace(/\u00a0/g, ' ');

    // 1. Account Number
    const accMatch =
      combinedText.match(/Account\s*:\s*(\d+)/i) ||
      combinedText.match(/Account\s*#?\s*:\s*([A-Za-z0-9_-]+)/i) ||
      combinedText.match(/Statement\s*:\s*(\d+)/i) ||
      combinedText.match(/Login\s*:\s*(\d+)/i) ||
      combinedText.match(/Account\s+Number\s*:\s*(\d+)/i);

    if (accMatch && accMatch[1]) {
      accountNumber = accMatch[1].trim();
    } else {
      const fnDigits = fileName.match(/\d+/);
      accountNumber = fnDigits
        ? `MT-${fnDigits[0]}`
        : `MT-ACC-${Math.floor(Math.random() * 899999 + 100000)}`;
    }

    // 2. Account Name
    const nameMatch = combinedText.match(
      /(?:Name|Client)\s*:\s*([^:\r\n\t]+?)(?=\s*(?:Currency|Account|Broker|Company|Leverage|Date|Server|$))/i
    );
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 1) {
      accountName = nameMatch[1].trim();
    } else {
      accountName = `${defaultAccountLabel} (${accountNumber})`;
    }

    // 3. Broker
    const brokerMatch = combinedText.match(
      /(?:Broker|Company|Server)\s*:\s*([^:\r\n\t]+?)(?=\s*(?:Account|Name|Currency|Leverage|Date|$))/i
    );
    if (brokerMatch && brokerMatch[1] && brokerMatch[1].trim().length > 1) {
      broker = brokerMatch[1].trim();
    }

    // 4. Currency
    const currMatch = combinedText.match(/Currency\s*:\s*([A-Z]{3})/i);
    if (currMatch && currMatch[1]) {
      currency = currMatch[1].toUpperCase();
    }

    // 5. Leverage
    const levMatch = combinedText.match(/Leverage\s*:\s*(1:\d+)/i);
    if (levMatch && levMatch[1]) {
      leverage = levMatch[1];
    }

    // Check Summary metadata block if present
    let summaryDeposit: number | null = null;
    let summaryNetProfit: number | null = null;
    let summaryEndingBalance: number | null = null;

    const depSummaryMatch = combinedText.match(/(?:Deposit\/Withdrawal|Initial Deposit)\s*:\s*([\d\s\.,-]+)/i);
    if (depSummaryMatch && depSummaryMatch[1]) {
      const parsedDep = this.parseMtFloat(depSummaryMatch[1]);
      if (parsedDep > 0) summaryDeposit = parsedDep;
    }

    const netProfSummaryMatch = combinedText.match(/(?:Total Net Profit|Closed Trade P\/L)\s*:\s*([\d\s\.,-]+)/i);
    if (netProfSummaryMatch && netProfSummaryMatch[1]) {
      summaryNetProfit = this.parseMtFloat(netProfSummaryMatch[1]);
    }

    const endBalSummaryMatch = combinedText.match(/Balance\s*:\s*([\d\s\.,]+)/i);
    if (endBalSummaryMatch && endBalSummaryMatch[1]) {
      const parsedBal = this.parseMtFloat(endBalSummaryMatch[1]);
      if (parsedBal > 0) summaryEndingBalance = parsedBal;
    }

    // Detect if this statement contains MT5 Deals structure
    const isMt5DealsStatement = this.detectMt5DealsFormat(rows, combinedText);

    let trades: MTTrade[] = [];
    let importSummary: StatementImportSummary;

    if (isMt5DealsStatement) {
      const dealsResult = this.parseMt5DealsTable(rows);
      trades = dealsResult.trades;
      importSummary = dealsResult.summary;
      if (dealsResult.deposit > 0) {
        initialDeposit = dealsResult.deposit;
        initialDepositFound = true;
      }
    } else {
      const closedResult = this.parseClosedTransactionsTable(rows);
      trades = closedResult.trades;
      importSummary = closedResult.summary;
      if (closedResult.deposit > 0) {
        initialDeposit = closedResult.deposit;
        initialDepositFound = true;
      }
    }

    // Sort trades chronologically
    trades.sort((a, b) => a.closeTimestamp - b.closeTimestamp);

    // Compute Net Trades Profit
    const totalTradeNetProfit = trades.reduce((sum, t) => sum + t.netProfit, 0);

    // Resolve Initial Deposit if not found
    if (!initialDepositFound || initialDeposit <= 0) {
      if (summaryDeposit && summaryDeposit > 0) {
        initialDeposit = summaryDeposit;
      } else if (summaryEndingBalance && summaryEndingBalance > 0) {
        initialDeposit = parseFloat((summaryEndingBalance - totalTradeNetProfit).toFixed(2));
      } else {
        initialDeposit = 10000;
      }
    }

    // Compute cumulative balance trajectory
    let runningBalance = initialDeposit;
    trades.forEach((t) => {
      runningBalance += t.netProfit;
      t.balanceAfter = parseFloat(runningBalance.toFixed(2));
      t.equityAfter = t.balanceAfter;
    });

    return {
      accountNumber,
      accountName,
      broker,
      currency,
      leverage,
      initialDeposit,
      currentBalance: parseFloat(runningBalance.toFixed(2)),
      currentEquity: parseFloat(runningBalance.toFixed(2)),
      lastUpdated: Date.now(),
      statementFileName: fileName,
      importSummary,
      trades,
    };
  }

  /**
   * Helper to detect if statement uses MT5 Deals table structure
   */
  private detectMt5DealsFormat(rows: string[][], combinedText: string): boolean {
    const textLower = combinedText.toLowerCase();
    if (textLower.includes('deals') || textLower.includes('deals history')) {
      return true;
    }

    for (const row of rows) {
      if (!row || row.length < 3) continue;
      const joined = row.join(' ').toLowerCase();
      if (
        (joined.includes('deal') || joined.includes('ticket')) &&
        (joined.includes('position') || joined.includes('order')) &&
        (joined.includes('direction') || joined.includes('entry') || joined.includes('in/out'))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * MT5 Deals Table Parser & Position Trade Reconstructor
   * Reconstructs completed position trades by grouping Deal records on Position ID.
   * Combines entry and exit deals, sums commissions, fees, swaps, and profit.
   * Ignores Orders and Positions tables.
   */
  private parseMt5DealsTable(rows: string[][]): {
    trades: MTTrade[];
    summary: StatementImportSummary;
    deposit: number;
  } {
    let dealsRead = 0;
    let openPositionsIgnored = 0;
    let duplicateTradesSkipped = 0;
    let parsingErrors = 0;
    let deposit = 0;

    let currentSection: 'DEALS' | 'ORDERS' | 'POSITIONS' | 'SUMMARY' | 'UNKNOWN' = 'UNKNOWN';

    // Column Mapping for Deals
    let colMap = {
      deal: -1,
      time: -1,
      symbol: -1,
      type: -1,
      direction: -1,
      volume: -1,
      price: -1,
      order: -1,
      position: -1,
      commission: -1,
      fee: -1,
      swap: -1,
      profit: -1,
      sl: -1,
      tp: -1,
    };

    const dealsList: RawMt5Deal[] = [];

    rows.forEach((row) => {
      if (!row || row.length < 2) return;

      const rowJoined = row.join(' ').toLowerCase();

      // Detect Section Switch
      if (rowJoined.includes('deals') || rowJoined.includes('deals history')) {
        currentSection = 'DEALS';
      } else if (
        rowJoined.includes('open positions') ||
        rowJoined.includes('positions') ||
        rowJoined.includes('floating p/l')
      ) {
        currentSection = 'POSITIONS';
        return;
      } else if (
        rowJoined.includes('working orders') ||
        rowJoined.includes('orders') ||
        rowJoined.includes('pending orders')
      ) {
        currentSection = 'ORDERS';
        return;
      } else if (
        rowJoined.includes('summary') ||
        rowJoined.includes('details') ||
        rowJoined.includes('total net profit')
      ) {
        currentSection = 'SUMMARY';
        return;
      }

      // Record open positions/orders counts
      if (currentSection === 'POSITIONS' || currentSection === 'ORDERS') {
        // Count non-header, non-empty data rows as ignored open items
        if (row.some((cell) => /\d+/.test(cell))) {
          openPositionsIgnored++;
        }
        return;
      }

      // Check if row is a Deals Table Header
      const isHeaderRow =
        (rowJoined.includes('deal') || rowJoined.includes('ticket') || rowJoined.includes('#')) &&
        (rowJoined.includes('type') || rowJoined.includes('action')) &&
        (rowJoined.includes('volume') || rowJoined.includes('lots') || rowJoined.includes('size')) &&
        (rowJoined.includes('price') || rowJoined.includes('profit'));

      if (isHeaderRow) {
        currentSection = 'DEALS';
        const newMap = {
          deal: -1,
          time: -1,
          symbol: -1,
          type: -1,
          direction: -1,
          volume: -1,
          price: -1,
          order: -1,
          position: -1,
          commission: -1,
          fee: -1,
          swap: -1,
          profit: -1,
          sl: -1,
          tp: -1,
        };

        row.forEach((cellText, idx) => {
          const c = cellText.toLowerCase().trim();
          if (!c) return;

          if (c === 'deal' || c.includes('ticket') || c === '#' || c === 'deal #') {
            if (newMap.deal === -1) newMap.deal = idx;
          } else if (c.includes('time') || c.includes('date')) {
            if (newMap.time === -1) newMap.time = idx;
          } else if (c.includes('symbol') || c.includes('item') || c === 'pair') {
            if (newMap.symbol === -1) newMap.symbol = idx;
          } else if (c.includes('type') || c === 'cmd' || c === 'action') {
            if (newMap.type === -1) newMap.type = idx;
          } else if (c.includes('direction') || c.includes('entry') || c === 'in/out' || c === 'dir') {
            if (newMap.direction === -1) newMap.direction = idx;
          } else if (c.includes('volume') || c.includes('lots') || c.includes('size') || c.includes('qty')) {
            if (newMap.volume === -1) newMap.volume = idx;
          } else if (c === 'price') {
            if (newMap.price === -1) newMap.price = idx;
          } else if (c === 'order') {
            if (newMap.order === -1) newMap.order = idx;
          } else if (c.includes('position') || c.includes('pos id')) {
            if (newMap.position === -1) newMap.position = idx;
          } else if (c.includes('commission') || c.includes('comm')) {
            if (newMap.commission === -1) newMap.commission = idx;
          } else if (c.includes('fee') || c.includes('tax')) {
            if (newMap.fee === -1) newMap.fee = idx;
          } else if (c.includes('swap') || c.includes('rollover')) {
            if (newMap.swap === -1) newMap.swap = idx;
          } else if (c.includes('profit') || c.includes('p/l') || c.includes('pnl')) {
            if (newMap.profit === -1) newMap.profit = idx;
          } else if (c.includes('sl') || c.includes('s/l') || c.includes('stop loss')) {
            if (newMap.sl === -1) newMap.sl = idx;
          } else if (c.includes('tp') || c.includes('t/p') || c.includes('take profit')) {
            if (newMap.tp === -1) newMap.tp = idx;
          }
        });

        colMap = newMap;
        return;
      }

      // Parse Deals Data Row
      if (currentSection !== 'DEALS') return;

      // Check if row has numeric identifier
      const dealIdx = colMap.deal >= 0 ? colMap.deal : 0;
      const rawDealCell = row[dealIdx] || row[0] || '';
      const dealMatch = rawDealCell.match(/\d{1,12}/);
      if (!dealMatch) return;

      dealsRead++;

      const dealId = dealMatch[0];

      // Type
      const typeIdx = colMap.type >= 0 ? colMap.type : 2;
      const typeStr = (row[typeIdx] || '').toLowerCase();

      // Check for Deposit / Balance / Credit / Withdrawal
      if (
        typeStr.includes('balance') ||
        typeStr.includes('deposit') ||
        typeStr.includes('credit') ||
        typeStr.includes('withdrawal')
      ) {
        const profitIdx = colMap.profit >= 0 ? colMap.profit : row.length - 1;
        const depVal = this.parseMtFloat(row[profitIdx]);
        if (depVal > 0 && deposit === 0) {
          deposit = depVal;
        }
        return;
      }

      // Check for buy/sell trade deal
      if (!typeStr.includes('buy') && !typeStr.includes('sell')) {
        parsingErrors++;
        return;
      }

      // Time
      const timeIdx = colMap.time >= 0 ? colMap.time : 1;
      const timeStr = row[timeIdx] || new Date().toISOString();
      const timestamp = this.parseDateToTimestamp(timeStr);

      // Symbol
      const symbolIdx = colMap.symbol >= 0 ? colMap.symbol : 3;
      let symbol = (row[symbolIdx] || 'GBPUSD').toUpperCase().replace(/[^A-Z0-9._-]/g, '');
      if (!symbol || symbol.length < 2) symbol = 'GBPUSD';

      // Direction (in / out / in/out)
      const dirIdx = colMap.direction >= 0 ? colMap.direction : -1;
      const dirStr = dirIdx >= 0 ? (row[dirIdx] || '').toLowerCase() : '';
      let direction: 'in' | 'out' | 'in/out' | 'unknown' = 'unknown';
      if (dirStr.includes('in/out')) direction = 'in/out';
      else if (dirStr.includes('in')) direction = 'in';
      else if (dirStr.includes('out')) direction = 'out';

      // Volume / Lots
      const volIdx = colMap.volume >= 0 ? colMap.volume : 4;
      const volume = this.parseMtFloat(row[volIdx]) || 0.1;

      // Price
      const priceIdx = colMap.price >= 0 ? colMap.price : 5;
      const price = this.parseMtFloat(row[priceIdx]);

      // Order ID & Position ID
      const orderIdx = colMap.order >= 0 ? colMap.order : -1;
      const posIdx = colMap.position >= 0 ? colMap.position : -1;

      const orderCell = orderIdx >= 0 ? row[orderIdx] || '' : '';
      const posCell = posIdx >= 0 ? row[posIdx] || '' : '';

      const orderMatch = orderCell.match(/\d{1,12}/);
      const posMatch = posCell.match(/\d{1,12}/);

      const orderId = orderMatch ? orderMatch[0] : '';
      let positionId = posMatch ? posMatch[0] : '';

      if (!positionId || positionId === '0') {
        positionId = orderId || dealId;
      }

      // Financials
      const commIdx = colMap.commission >= 0 ? colMap.commission : -1;
      const feeIdx = colMap.fee >= 0 ? colMap.fee : -1;
      const swapIdx = colMap.swap >= 0 ? colMap.swap : -1;
      const profIdx = colMap.profit >= 0 ? colMap.profit : row.length - 1;

      const commission = commIdx >= 0 ? this.parseMtFloat(row[commIdx]) : 0;
      const fee = feeIdx >= 0 ? this.parseMtFloat(row[feeIdx]) : 0;
      const swap = swapIdx >= 0 ? this.parseMtFloat(row[swapIdx]) : 0;
      const profit = profIdx >= 0 ? this.parseMtFloat(row[profIdx]) : 0;

      // SL / TP
      const slIdx = colMap.sl >= 0 ? colMap.sl : -1;
      const tpIdx = colMap.tp >= 0 ? colMap.tp : -1;
      const sl = slIdx >= 0 ? this.parseMtFloat(row[slIdx]) : 0;
      const tp = tpIdx >= 0 ? this.parseMtFloat(row[tpIdx]) : 0;

      dealsList.push({
        dealId,
        orderId,
        positionId,
        timeStr,
        timestamp,
        symbol,
        typeStr,
        direction,
        volume,
        price,
        commission,
        fee,
        swap,
        profit,
        sl,
        tp,
        comment: '',
      });
    });

    // Group deals by Position ID
    const dealsByPos = new Map<string, RawMt5Deal[]>();
    dealsList.forEach((d) => {
      if (!dealsByPos.has(d.positionId)) {
        dealsByPos.set(d.positionId, []);
      }
      dealsByPos.get(d.positionId)!.push(d);
    });

    const positionsReconstructed = dealsByPos.size;
    const reconstructedTrades: MTTrade[] = [];
    const importedKeys = new Set<string>();

    let completedTradesImported = 0;

    dealsByPos.forEach((deals, posId) => {
      // Sort deals chronologically
      deals.sort((a, b) => a.timestamp - b.timestamp);

      // Separate Entry (IN) and Exit (OUT) deals
      let inDeals = deals.filter((d) => d.direction === 'in');
      let outDeals = deals.filter((d) => d.direction === 'out' || d.direction === 'in/out');

      // Fallback if direction column was missing
      if (inDeals.length === 0 && outDeals.length === 0) {
        inDeals = [deals[0]];
        outDeals = deals.slice(1);
      } else if (inDeals.length === 0 && deals.length > 0) {
        inDeals = [deals[0]];
      }

      // Check if position has exit deal(s)
      if (outDeals.length === 0) {
        openPositionsIgnored++;
        return;
      }

      // Volume & Price Calculations
      const totalEntryVol = inDeals.reduce((sum, d) => sum + d.volume, 0);
      const totalExitVol = outDeals.reduce((sum, d) => sum + d.volume, 0);

      if (totalExitVol <= 0) {
        openPositionsIgnored++;
        return;
      }

      const openPrice =
        totalEntryVol > 0
          ? inDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / totalEntryVol
          : outDeals[0].price;

      const closePrice = outDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / totalExitVol;

      const symbol = inDeals[0]?.symbol || outDeals[0]?.symbol || 'GBPUSD';
      const mainTypeStr = inDeals[0]?.typeStr || outDeals[0]?.typeStr || 'buy';
      const isBuy = mainTypeStr.includes('buy');

      const openTime = inDeals[0]?.timeStr || deals[0].timeStr;
      const closeTime = outDeals[outDeals.length - 1]?.timeStr || deals[deals.length - 1].timeStr;
      const openTimestamp = inDeals[0]?.timestamp || deals[0].timestamp;
      const closeTimestamp = outDeals[outDeals.length - 1]?.timestamp || deals[deals.length - 1].timestamp;

      // Sum Financials across ALL deals (Entry + Exit / Partial closes) for this position
      const totalCommission = parseFloat(deals.reduce((sum, d) => sum + d.commission, 0).toFixed(2));
      const totalSwap = parseFloat(deals.reduce((sum, d) => sum + d.swap, 0).toFixed(2));
      const totalFee = parseFloat(deals.reduce((sum, d) => sum + d.fee, 0).toFixed(2));
      const grossProfit = parseFloat(deals.reduce((sum, d) => sum + d.profit, 0).toFixed(2));
      const netProfit = parseFloat((grossProfit + totalCommission + totalSwap + totalFee).toFixed(2));

      const sl = inDeals[0]?.sl || 0;
      const tp = inDeals[0]?.tp || 0;

      // Calculate Pips
      let pipVal = 0.0001;
      if (
        symbol.includes('JPY') ||
        (openPrice > 10 && openPrice < 500 && openPrice.toString().split('.')[1]?.length <= 3)
      ) {
        pipVal = 0.01;
      } else if (
        symbol.includes('XAU') ||
        symbol.includes('GOLD') ||
        symbol.includes('XAG') ||
        symbol.includes('SILVER')
      ) {
        pipVal = 0.1;
      } else if (
        symbol.includes('BTC') ||
        symbol.includes('ETH') ||
        symbol.includes('US30') ||
        symbol.includes('NAS') ||
        symbol.includes('SPX') ||
        symbol.includes('GER') ||
        openPrice > 500
      ) {
        pipVal = 1.0;
      }

      let pips = 0;
      if (openPrice > 0 && closePrice > 0) {
        pips = isBuy
          ? Math.round((closePrice - openPrice) / pipVal)
          : Math.round((openPrice - closePrice) / pipVal);
      }

      // R-Multiple Calculation
      let rMultiple = 0;
      if (sl > 0 && openPrice > 0) {
        const riskPrice = isBuy ? openPrice - sl : sl - openPrice;
        const rewardPrice = isBuy ? closePrice - openPrice : openPrice - closePrice;
        if (riskPrice > 0) {
          rMultiple = parseFloat((rewardPrice / riskPrice).toFixed(2));
        }
      } else if (pips !== 0) {
        rMultiple = parseFloat((pips / 20).toFixed(2));
      }

      // Deduplication Check
      const dedupeKey = `${posId}_${closeTimestamp}`;
      if (importedKeys.has(dedupeKey)) {
        duplicateTradesSkipped++;
      } else {
        importedKeys.add(dedupeKey);
        completedTradesImported++;

        reconstructedTrades.push({
          ticket: posId,
          openTime,
          closeTime,
          openTimestamp,
          closeTimestamp,
          symbol,
          type: isBuy ? 'buy' : 'sell',
          lots: parseFloat(totalExitVol.toFixed(2)),
          openPrice: parseFloat(openPrice.toFixed(5)),
          closePrice: parseFloat(closePrice.toFixed(5)),
          sl,
          tp,
          commission: totalCommission,
          swap: totalSwap,
          profit: grossProfit,
          netProfit,
          pips,
          rMultiple,
          balanceAfter: 0,
          equityAfter: 0,
        });
      }
    });

    return {
      trades: reconstructedTrades,
      summary: {
        dealsRead,
        positionsReconstructed,
        completedTradesImported,
        openPositionsIgnored,
        duplicateTradesSkipped,
        parsingErrors,
      },
      deposit,
    };
  }

  /**
   * Parser for standard MT4 / MT5 Closed Transactions tables
   */
  private parseClosedTransactionsTable(rows: string[][]): {
    trades: MTTrade[];
    summary: StatementImportSummary;
    deposit: number;
  } {
    let dealsRead = 0;
    let openPositionsIgnored = 0;
    let duplicateTradesSkipped = 0;
    let parsingErrors = 0;
    let deposit = 0;

    let colMap = {
      ticket: -1,
      openTime: -1,
      type: -1,
      lots: -1,
      symbol: -1,
      openPrice: -1,
      sl: -1,
      tp: -1,
      closeTime: -1,
      closePrice: -1,
      commission: -1,
      taxes: -1,
      swap: -1,
      profit: -1,
    };

    const trades: MTTrade[] = [];
    const importedKeys = new Set<string>();

    let currentSection: 'CLOSED' | 'OPEN' | 'ORDERS' | 'SUMMARY' = 'CLOSED';

    rows.forEach((row) => {
      if (!row || row.length < 2) return;

      const rowJoined = row.join(' ').toLowerCase();

      // Check section transitions
      if (
        rowJoined.includes('open positions') ||
        rowJoined.includes('open trades') ||
        rowJoined.includes('floating p/l')
      ) {
        currentSection = 'OPEN';
        return;
      }
      if (
        rowJoined.includes('working orders') ||
        rowJoined.includes('orders') ||
        rowJoined.includes('pending orders')
      ) {
        currentSection = 'ORDERS';
        return;
      }
      if (
        rowJoined.includes('summary') ||
        rowJoined.includes('details') ||
        rowJoined.includes('total net profit')
      ) {
        currentSection = 'SUMMARY';
        return;
      }
      if (
        rowJoined.includes('closed transactions') ||
        rowJoined.includes('closed trades') ||
        rowJoined.includes('positions')
      ) {
        currentSection = 'CLOSED';
      }

      if (currentSection === 'OPEN' || currentSection === 'ORDERS') {
        if (row.some((cell) => /\d+/.test(cell))) {
          openPositionsIgnored++;
        }
        return;
      }

      // Detect Table Header Row
      const isHeaderRow =
        (rowJoined.includes('ticket') ||
          rowJoined.includes('position') ||
          rowJoined.includes('order') ||
          rowJoined.includes('#')) &&
        (rowJoined.includes('type') || rowJoined.includes('cmd') || rowJoined.includes('action')) &&
        (rowJoined.includes('size') ||
          rowJoined.includes('volume') ||
          rowJoined.includes('lots') ||
          rowJoined.includes('symbol')) &&
        (rowJoined.includes('price') || rowJoined.includes('profit') || rowJoined.includes('p/l'));

      if (isHeaderRow) {
        const newMap = {
          ticket: -1,
          openTime: -1,
          type: -1,
          lots: -1,
          symbol: -1,
          openPrice: -1,
          sl: -1,
          tp: -1,
          closeTime: -1,
          closePrice: -1,
          commission: -1,
          taxes: -1,
          swap: -1,
          profit: -1,
        };

        const timeIndices: number[] = [];
        const priceIndices: number[] = [];

        row.forEach((cellText, idx) => {
          const c = cellText.toLowerCase().trim();
          if (!c) return;

          if (c.includes('ticket') || c.includes('position') || c === 'order' || c === '#') {
            if (newMap.ticket === -1) newMap.ticket = idx;
          } else if (c.includes('type') || c === 'cmd' || c === 'action') {
            if (newMap.type === -1) newMap.type = idx;
          } else if (c.includes('size') || c.includes('volume') || c.includes('lots') || c.includes('qty')) {
            if (newMap.lots === -1) newMap.lots = idx;
          } else if (c.includes('item') || c.includes('symbol') || c.includes('currency') || c === 'pair') {
            if (newMap.symbol === -1) newMap.symbol = idx;
          } else if (c.includes('s / l') || c.includes('s/l') || c === 'sl' || c.includes('stop loss')) {
            if (newMap.sl === -1) newMap.sl = idx;
          } else if (c.includes('t / p') || c.includes('t/p') || c === 'tp' || c.includes('take profit')) {
            if (newMap.tp === -1) newMap.tp = idx;
          } else if (c.includes('commission') || c.includes('comm')) {
            if (newMap.commission === -1) newMap.commission = idx;
          } else if (c.includes('taxes') || c.includes('tax')) {
            if (newMap.taxes === -1) newMap.taxes = idx;
          } else if (c.includes('swap') || c.includes('rollover')) {
            if (newMap.swap === -1) newMap.swap = idx;
          } else if (c.includes('profit') || c.includes('p/l') || c.includes('pnl')) {
            if (newMap.profit === -1) newMap.profit = idx;
          } else if (c.includes('open price') || c === 'open') {
            newMap.openPrice = idx;
          } else if (c.includes('close price') || c === 'close') {
            newMap.closePrice = idx;
          } else if (c.includes('open time') || c.includes('open date')) {
            newMap.openTime = idx;
          } else if (c.includes('close time') || c.includes('close date')) {
            newMap.closeTime = idx;
          } else if (c.includes('time') || c.includes('date')) {
            timeIndices.push(idx);
          } else if (c.includes('price')) {
            priceIndices.push(idx);
          }
        });

        if (newMap.openTime === -1 && timeIndices.length > 0) newMap.openTime = timeIndices[0];
        if (newMap.closeTime === -1 && timeIndices.length > 1) newMap.closeTime = timeIndices[1];
        if (newMap.closeTime === -1 && timeIndices.length > 0) newMap.closeTime = timeIndices[0];

        if (newMap.openPrice === -1 && priceIndices.length > 0) newMap.openPrice = priceIndices[0];
        if (newMap.closePrice === -1 && priceIndices.length > 1) newMap.closePrice = priceIndices[1];
        if (newMap.closePrice === -1 && priceIndices.length > 0) newMap.closePrice = priceIndices[0];

        colMap = newMap;
        return;
      }

      if (currentSection !== 'CLOSED') return;

      const ticketIdx = colMap.ticket >= 0 ? colMap.ticket : 0;
      const rawTicketCell = row[ticketIdx] || row[0] || '';
      const ticketMatch = rawTicketCell.match(/\d{1,12}/);
      if (!ticketMatch) return;

      dealsRead++;

      const ticket = ticketMatch[0];

      const typeIdx = colMap.type >= 0 ? colMap.type : 2;
      const typeStr = (row[typeIdx] || '').toLowerCase();

      if (
        typeStr.includes('balance') ||
        typeStr.includes('deposit') ||
        typeStr.includes('credit') ||
        typeStr.includes('withdrawal')
      ) {
        const profitIdx = colMap.profit >= 0 ? colMap.profit : row.length - 1;
        const depVal = this.parseMtFloat(row[profitIdx]);
        if (depVal > 0 && deposit === 0) {
          deposit = depVal;
        }
        return;
      }

      if (!typeStr.includes('buy') && !typeStr.includes('sell')) {
        parsingErrors++;
        return;
      }

      const lotsIdx = colMap.lots >= 0 ? colMap.lots : 3;
      const lots = this.parseMtFloat(row[lotsIdx]) || 0.1;

      const symIdx = colMap.symbol >= 0 ? colMap.symbol : 4;
      let symbol = (row[symIdx] || 'GBPUSD').toUpperCase().replace(/[^A-Z0-9._-]/g, '');
      if (!symbol || symbol.length < 2) symbol = 'GBPUSD';

      const openPriceIdx = colMap.openPrice >= 0 ? colMap.openPrice : 5;
      const closePriceIdx = colMap.closePrice >= 0 ? colMap.closePrice : 9;
      const slIdx = colMap.sl >= 0 ? colMap.sl : 6;
      const tpIdx = colMap.tp >= 0 ? colMap.tp : 7;

      const openPrice = this.parseMtFloat(row[openPriceIdx]);
      const closePrice = this.parseMtFloat(row[closePriceIdx]) || openPrice;
      const sl = this.parseMtFloat(row[slIdx]);
      const tp = this.parseMtFloat(row[tpIdx]);

      const openTimeIdx = colMap.openTime >= 0 ? colMap.openTime : 1;
      const closeTimeIdx = colMap.closeTime >= 0 ? colMap.closeTime : 8;

      let openTimeStr = row[openTimeIdx] || '';
      let closeTimeStr = row[closeTimeIdx] || openTimeStr;

      if (!closeTimeStr) closeTimeStr = openTimeStr;
      if (!openTimeStr) openTimeStr = closeTimeStr || new Date().toISOString();

      const commIdx = colMap.commission >= 0 ? colMap.commission : 10;
      const taxIdx = colMap.taxes >= 0 ? colMap.taxes : 11;
      const swapIdx = colMap.swap >= 0 ? colMap.swap : 12;
      const profIdx = colMap.profit >= 0 ? colMap.profit : row.length - 1;

      const commission = this.parseMtFloat(row[commIdx]);
      const taxes = this.parseMtFloat(row[taxIdx]);
      const swap = this.parseMtFloat(row[swapIdx]);
      const profit = this.parseMtFloat(row[profIdx]);

      const openTs = this.parseDateToTimestamp(openTimeStr);
      const closeTs = this.parseDateToTimestamp(closeTimeStr || openTimeStr);
      const netProfit = parseFloat((profit + commission + swap + taxes).toFixed(2));

      const isBuy = typeStr.includes('buy');

      let pipVal = 0.0001;
      if (
        symbol.includes('JPY') ||
        (openPrice > 10 && openPrice < 500 && openPrice.toString().split('.')[1]?.length <= 3)
      ) {
        pipVal = 0.01;
      } else if (
        symbol.includes('XAU') ||
        symbol.includes('GOLD') ||
        symbol.includes('XAG') ||
        symbol.includes('SILVER')
      ) {
        pipVal = 0.1;
      } else if (
        symbol.includes('BTC') ||
        symbol.includes('ETH') ||
        symbol.includes('US30') ||
        symbol.includes('NAS') ||
        symbol.includes('SPX') ||
        symbol.includes('GER') ||
        openPrice > 500
      ) {
        pipVal = 1.0;
      }

      let pips = 0;
      if (openPrice > 0 && closePrice > 0) {
        pips = isBuy
          ? Math.round((closePrice - openPrice) / pipVal)
          : Math.round((openPrice - closePrice) / pipVal);
      }

      let rMultiple = 0;
      if (sl > 0 && openPrice > 0) {
        const riskPrice = isBuy ? openPrice - sl : sl - openPrice;
        const rewardPrice = isBuy ? closePrice - openPrice : openPrice - closePrice;
        if (riskPrice > 0) {
          rMultiple = parseFloat((rewardPrice / riskPrice).toFixed(2));
        }
      } else if (pips !== 0) {
        rMultiple = parseFloat((pips / 20).toFixed(2));
      }

      const dedupeKey = `${ticket}_${closeTs}`;
      if (importedKeys.has(dedupeKey)) {
        duplicateTradesSkipped++;
      } else {
        importedKeys.add(dedupeKey);
        trades.push({
          ticket,
          openTime: openTimeStr,
          closeTime: closeTimeStr || openTimeStr,
          openTimestamp: openTs,
          closeTimestamp: closeTs,
          symbol,
          type: isBuy ? 'buy' : 'sell',
          lots,
          openPrice,
          closePrice,
          sl,
          tp,
          commission,
          swap,
          profit,
          netProfit,
          pips,
          rMultiple,
          balanceAfter: 0,
          equityAfter: 0,
        });
      }
    });

    const positionsReconstructed = trades.length;
    const completedTradesImported = trades.length;

    return {
      trades,
      summary: {
        dealsRead,
        positionsReconstructed,
        completedTradesImported,
        openPositionsIgnored,
        duplicateTradesSkipped,
        parsingErrors,
      },
      deposit,
    };
  }

  /**
   * Universal float parser supporting all MT number formats, Unicode symbols, and European decimals
   */
  private parseMtFloat(val: string | number | null | undefined): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;

    let str = String(val).trim();

    // Replace Unicode dashes and minuses with standard ASCII '-'
    str = str.replace(/[\u2212\u2013\u2014\u2015]/g, '-');
    str = str.replace(/&(minus|#8722);/gi, '-');

    // Convert parenthesized negative numbers e.g. (100.50) -> -100.50
    if (/^\((.*)\)$/.test(str)) {
      str = '-' + str.slice(1, -1);
    }

    // Strip HTML tags and non-numeric noise
    str = str.replace(/<[^>]*>/g, '');
    str = str.replace(/[$€£¥złR\u00a0\s']/gi, '');

    if (!str) return 0;

    // Handle thousand separators vs decimal commas
    if (str.includes(',') && str.includes('.')) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      if (lastDot > lastComma) {
        str = str.replace(/,/g, '');
      } else {
        str = str.replace(/\./g, '').replace(',', '.');
      }
    } else if (str.includes(',') && !str.includes('.')) {
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    }

    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Deterministic MT Date Parser
   */
  private parseDateToTimestamp(dateVal: any): number {
    if (!dateVal) return Date.now();

    if (typeof dateVal === 'number') {
      if (dateVal > 25000 && dateVal < 60000) {
        return Math.round((dateVal - 25569) * 86400 * 1000);
      }
      return dateVal;
    }

    if (dateVal instanceof Date) {
      return dateVal.getTime();
    }

    const str = String(dateVal).trim().replace(/<[^>]*>/g, '');
    if (!str) return Date.now();

    // Regex for YYYY.MM.DD or DD.MM.YYYY dates
    const dateMatch = str.match(
      /(\d{2,4})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})(?:\s+|T)?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/
    );

    if (dateMatch) {
      const p1 = parseInt(dateMatch[1], 10);
      const p2 = parseInt(dateMatch[2], 10);
      const p3 = parseInt(dateMatch[3], 10);
      const hh = parseInt(dateMatch[4] || '0', 10);
      const mm = parseInt(dateMatch[5] || '0', 10);
      const ss = parseInt(dateMatch[6] || '0', 10);

      let y = 2026;
      let m = 0;
      let d = 1;

      if (p1 >= 1000) {
        // YYYY.MM.DD
        y = p1;
        m = Math.max(0, p2 - 1);
        d = p3;
      } else if (p3 >= 1000) {
        // DD.MM.YYYY or MM.DD.YYYY
        y = p3;
        if (p1 > 12) {
          d = p1;
          m = Math.max(0, p2 - 1);
        } else if (p2 > 12) {
          m = Math.max(0, p1 - 1);
          d = p2;
        } else {
          // Default DD.MM.YYYY
          d = p1;
          m = Math.max(0, p2 - 1);
        }
      }

      return Date.UTC(y, m, d, hh, mm, ss);
    }

    const fallbackTs = Date.parse(str);
    return isNaN(fallbackTs) ? Date.now() : fallbackTs;
  }
}

export const statementParser = new StatementParser();
