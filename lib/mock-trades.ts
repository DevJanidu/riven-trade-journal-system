import type { Trade } from "@/types/trade";

const notes = {
  entryReason:
    "Price swept the prior session low, reclaimed the key level, and printed a clean displacement candle. I entered on the first controlled pullback.",
  wentWell:
    "I waited for confirmation, kept risk fixed, and let the trade reach the planned target without interfering.",
  wentWrong:
    "Entry was slightly early and exposed the position to more drawdown than necessary.",
  improvement:
    "Wait for the retest candle to close before entering and capture a screenshot before moving the stop.",
};

type Seed = Pick<Trade, "id" | "date" | "session" | "direction" | "entry" | "stopLoss" | "takeProfit" | "riskAmount" | "plannedRR" | "actualR" | "setup" | "emotion" | "followedRules">;

const seeds: Seed[] = [
  { id:"tz-1001", date:"2026-10-01", session:"London", direction:"Long", entry:3829.4, stopLoss:3823.2, takeProfit:3844.3, riskAmount:25, plannedRR:2.4, actualR:2.4, setup:"Liquidity Sweep", emotion:"Calm", followedRules:true },
  { id:"tz-1002", date:"2026-10-02", session:"New York", direction:"Short", entry:3851.8, stopLoss:3857.6, takeProfit:3841.4, riskAmount:25, plannedRR:1.8, actualR:-1, setup:"Reversal", emotion:"Confident", followedRules:true },
  { id:"tz-1003", date:"2026-10-03", session:"Asia", direction:"Long", entry:3838.1, stopLoss:3832.8, takeProfit:3847.6, riskAmount:25, plannedRR:1.8, actualR:1.8, setup:"Break & Retest", emotion:"Calm", followedRules:true },
  { id:"tz-1004", date:"2026-10-05", session:"New York", direction:"Long", entry:3942.5, stopLoss:3937.2, takeProfit:3955.2, riskAmount:25, plannedRR:2.4, actualR:3.1, setup:"Liquidity Sweep", emotion:"Calm", followedRules:true },
  { id:"tz-1005", date:"2026-10-06", session:"London", direction:"Short", entry:3965.2, stopLoss:3971.4, takeProfit:3952.8, riskAmount:30, plannedRR:2, actualR:-1, setup:"Reversal", emotion:"Fear", followedRules:true },
  { id:"tz-1006", date:"2026-10-07", session:"London", direction:"Long", entry:3951.3, stopLoss:3946.1, takeProfit:3961.7, riskAmount:25, plannedRR:2, actualR:1.2, setup:"Continuation", emotion:"Confident", followedRules:true },
  { id:"tz-1007", date:"2026-10-08", session:"New York", direction:"Short", entry:3980.6, stopLoss:3986.1, takeProfit:3969.6, riskAmount:25, plannedRR:2, actualR:-1, setup:"Break & Retest", emotion:"Impatient", followedRules:false },
  { id:"tz-1008", date:"2026-10-09", session:"Asia", direction:"Long", entry:3948.1, stopLoss:3942.7, takeProfit:3958.9, riskAmount:20, plannedRR:2, actualR:1.5, setup:"Break & Retest", emotion:"Calm", followedRules:true },
  { id:"tz-1009", date:"2026-10-12", session:"London", direction:"Long", entry:3972.4, stopLoss:3966.4, takeProfit:3984.4, riskAmount:25, plannedRR:2, actualR:-1, setup:"Liquidity Sweep", emotion:"FOMO", followedRules:false },
  { id:"tz-1010", date:"2026-10-13", session:"New York", direction:"Short", entry:4001.2, stopLoss:4008.2, takeProfit:3985.8, riskAmount:25, plannedRR:2.2, actualR:1.1, setup:"Reversal", emotion:"Calm", followedRules:true },
  { id:"tz-1011", date:"2026-10-14", session:"London", direction:"Long", entry:3992.7, stopLoss:3986.2, takeProfit:4005.7, riskAmount:25, plannedRR:2, actualR:2, setup:"Continuation", emotion:"Confident", followedRules:true },
  { id:"tz-1012", date:"2026-10-15", session:"New York", direction:"Long", entry:4010.5, stopLoss:4004.8, takeProfit:4021.9, riskAmount:30, plannedRR:2, actualR:-1, setup:"Other", emotion:"Impatient", followedRules:false },
  { id:"tz-1013", date:"2026-10-16", session:"London", direction:"Short", entry:3998.4, stopLoss:4004.4, takeProfit:3985.2, riskAmount:25, plannedRR:2.2, actualR:1.4, setup:"Liquidity Sweep", emotion:"Calm", followedRules:true },
  { id:"tz-1014", date:"2026-10-19", session:"Asia", direction:"Long", entry:3986.2, stopLoss:3980.8, takeProfit:3997, riskAmount:20, plannedRR:2, actualR:-1, setup:"Break & Retest", emotion:"Fear", followedRules:true },
  { id:"tz-1015", date:"2026-10-20", session:"New York", direction:"Short", entry:4022.8, stopLoss:4028.3, takeProfit:4011.8, riskAmount:25, plannedRR:2, actualR:1.7, setup:"Reversal", emotion:"Confident", followedRules:true },
  { id:"tz-1016", date:"2026-10-21", session:"London", direction:"Long", entry:4009.1, stopLoss:4003.6, takeProfit:4020.1, riskAmount:25, plannedRR:2, actualR:-1, setup:"Continuation", emotion:"Revenge", followedRules:false },
  { id:"tz-1017", date:"2026-10-22", session:"New York", direction:"Long", entry:4031.6, stopLoss:4025.8, takeProfit:4043.2, riskAmount:25, plannedRR:2, actualR:1.2, setup:"Liquidity Sweep", emotion:"Calm", followedRules:true },
  { id:"tz-1018", date:"2026-10-23", session:"London", direction:"Short", entry:4050.2, stopLoss:4056.7, takeProfit:4037.2, riskAmount:25, plannedRR:2, actualR:-1, setup:"Other", emotion:"FOMO", followedRules:false },
  { id:"tz-1019", date:"2026-10-26", session:"New York", direction:"Long", entry:4018.7, stopLoss:4012.7, takeProfit:4030.7, riskAmount:30, plannedRR:2, actualR:1, setup:"Break & Retest", emotion:"Calm", followedRules:true },
  { id:"tz-1020", date:"2026-10-29", session:"London", direction:"Short", entry:4042.3, stopLoss:4048.1, takeProfit:4030.7, riskAmount:25, plannedRR:2, actualR:1, setup:"Liquidity Sweep", emotion:"Confident", followedRules:true },
];

export const mockTrades: Trade[] = seeds.map((trade) => ({
  ...trade,
  instrument: "XAUUSD",
  profitLoss: trade.actualR * trade.riskAmount,
  result: trade.actualR > 0 ? "Win" : trade.actualR < 0 ? "Loss" : "Break Even",
  tradingViewUrl: "https://www.tradingview.com/chart/",
  beforeScreenshot: "/charts/before-trade.svg",
  afterScreenshot: "/charts/after-trade.svg",
  ...notes,
  createdAt: `${trade.date}T17:30:00.000Z`,
  updatedAt: `${trade.date}T18:45:00.000Z`,
}));
