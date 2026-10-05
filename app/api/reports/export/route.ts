import ExcelJS from "exceljs";
import { failure, handleApiError, queryObject } from "@/lib/api/response";
import { getTradesForRange } from "@/lib/data/trades";
import { getReportBreakdown, getReportRange, reportQuerySchema } from "@/lib/reports";
import { calculateStats } from "@/lib/trading/calculations";

export const runtime = "nodejs";

const colors = { navy: "0B1A4A", blue: "112B80", paleBlue: "E9EDFF", white: "FFFFFF", green: "00A66F", red: "E65049" };

export async function GET(request: Request) {
  const query = queryObject(new URL(request.url).searchParams);
  if (!query) return failure("Duplicate query parameters are not allowed", 400);
  const parsed = reportQuerySchema.safeParse(query);
  if (!parsed.success) return failure("Choose a valid report period and date", 400);

  try {
    const { period, date } = parsed.data;
    const range = getReportRange(period, date);
    const trades = await getTradesForRange(range.start, range.endExclusive);
    if (!trades.length) return failure("There are no trades in this report period", 404);
    const stats = calculateStats(trades);
    const netProfitLoss = trades.reduce((sum, trade) => sum + trade.profitLoss, 0);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "My Journal";
    workbook.created = new Date();

    const summary = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
    summary.columns = [{ width: 28 }, { width: 24 }];
    summary.mergeCells("A1:B1");
    summary.getCell("A1").value = "MY JOURNAL — PERFORMANCE REPORT";
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: colors.white } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.navy } };
    summary.getCell("A1").alignment = { vertical: "middle" };
    summary.getRow(1).height = 32;
    summary.addRows([
      ["Period", period[0].toUpperCase() + period.slice(1)], ["Date range", `${range.start} to ${range.endInclusive}`],
      ["Total trades", stats.totalTrades], ["Wins", stats.wins], ["Losses", stats.losses], ["Break-even", stats.breakEvens],
      ["Win rate", stats.winRate / 100], ["Net R", stats.netR], ["Average R", stats.averageR], ["Net P&L", netProfitLoss],
      ["Profit factor", stats.profitFactor ?? "—"], ["Expectancy", stats.expectancy], ["Best trade (R)", stats.bestTrade], ["Worst trade (R)", stats.worstTrade],
    ]);
    summary.getColumn(1).font = { bold: true, color: { argb: colors.navy } };
    summary.getCell("B8").numFmt = "0.0%";
    summary.getCell("B11").numFmt = "$#,##0.00;[Red]-$#,##0.00";
    summary.eachRow((row, rowNumber) => { if (rowNumber > 1 && rowNumber % 2 === 0) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F7FC" } }; }); });

    const tradeSheet = workbook.addWorksheet("Trades", { views: [{ state: "frozen", ySplit: 1 }, { showGridLines: false }] });
    tradeSheet.columns = [
      { header: "Date", key: "date", width: 13 }, { header: "Instrument", key: "instrument", width: 12 }, { header: "Session", key: "session", width: 14 },
      { header: "Direction", key: "direction", width: 12 }, { header: "Setup", key: "setup", width: 24 }, { header: "Grade", key: "grade", width: 10 },
      { header: "Result", key: "result", width: 14 }, { header: "Entry", key: "entry", width: 12 }, { header: "Stop Loss", key: "stopLoss", width: 12 },
      { header: "Take Profit", key: "takeProfit", width: 13 }, { header: "Risk Amount", key: "risk", width: 14 }, { header: "Planned R:R", key: "plannedRR", width: 14 },
      { header: "Actual R", key: "actualR", width: 12 }, { header: "P&L", key: "profitLoss", width: 14 }, { header: "Profit Booked", key: "profitBooked", width: 16 },
      { header: "Followed Rules", key: "followedRules", width: 16 }, { header: "Emotion", key: "emotion", width: 14 }, { header: "Entry Reason", key: "entryReason", width: 36 },
      { header: "Went Well", key: "wentWell", width: 36 }, { header: "Went Wrong", key: "wentWrong", width: 36 }, { header: "Improvement", key: "improvement", width: 36 },
    ];
    for (const trade of [...trades].reverse()) tradeSheet.addRow({
      date: trade.date, instrument: trade.instrument, session: trade.session, direction: trade.direction, setup: trade.setup, grade: trade.setupGrade ?? "",
      result: trade.result, entry: trade.entry, stopLoss: trade.stopLoss, takeProfit: trade.takeProfit, risk: trade.riskAmount, plannedRR: trade.plannedRR,
      actualR: trade.actualR, profitLoss: trade.profitLoss, profitBooked: trade.profitBooked ?? 0, followedRules: trade.followedRules ? "Yes" : "No",
      emotion: trade.emotion, entryReason: trade.entryReason, wentWell: trade.wentWell, wentWrong: trade.wentWrong, improvement: trade.improvement,
    });
    styleHeader(tradeSheet.getRow(1));
    tradeSheet.autoFilter = { from: "A1", to: "U1" };
    [8, 9, 10, 12, 13].forEach(column => tradeSheet.getColumn(column).numFmt = "0.00");
    [11, 14, 15].forEach(column => tradeSheet.getColumn(column).numFmt = "$#,##0.00;[Red]-$#,##0.00");
    tradeSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell(13).font = { color: { argb: Number(row.getCell(13).value) >= 0 ? colors.green : colors.red } };
      row.getCell(14).font = { color: { argb: Number(row.getCell(14).value) >= 0 ? colors.green : colors.red } };
    });

    const breakdownSheet = workbook.addWorksheet("Setup Breakdown", { views: [{ state: "frozen", ySplit: 1 }, { showGridLines: false }] });
    breakdownSheet.columns = [
      { header: "Setup", key: "setup", width: 28 }, { header: "Trades", key: "trades", width: 12 }, { header: "Wins", key: "wins", width: 10 },
      { header: "Win Rate", key: "winRate", width: 14 }, { header: "Net R", key: "netR", width: 12 }, { header: "P&L", key: "profitLoss", width: 14 },
    ];
    getReportBreakdown(trades).forEach(row => breakdownSheet.addRow({ ...row, winRate: row.winRate / 100 }));
    styleHeader(breakdownSheet.getRow(1));
    breakdownSheet.getColumn(4).numFmt = "0.0%";
    breakdownSheet.getColumn(5).numFmt = "0.00";
    breakdownSheet.getColumn(6).numFmt = "$#,##0.00;[Red]-$#,##0.00";

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `trade-report-${period}-${range.start}-to-${range.endInclusive}.xlsx`;
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    return handleApiError(error, "export report");
  }
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 26;
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: colors.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.blue } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: colors.paleBlue } } };
  });
}
