import { z } from "zod";
import { directions, emotions, sessions } from "@/types/trade";
import { tradeDateSchema } from "./trade";

const shortNumber = z.string().max(32);
const note = z.string().max(10000);

export const draftSchema = z.object({
  date: z.union([tradeDateSchema, z.literal("")]),
  session: z.enum(sessions),
  direction: z.enum(directions),
  entry: shortNumber,
  stopLoss: shortNumber,
  takeProfit: shortNumber,
  riskAmount: shortNumber,
  profitLoss: shortNumber,
  profitBooked: shortNumber,
  breakEvenAfterProfit: z.boolean(),
  setup: z.string().max(80),
  setupChecklist: z.array(z.string().max(200)).max(50),
  setupAvoidChecklist: z.array(z.string().max(200)).max(50),
  psychologyReady: z.boolean(),
  psychologyAnswer: z.string().max(500),
  tradingViewUrl: z.string().max(2048),
  beforeScreenshot: z.string().max(2048).nullable(),
  afterScreenshot: z.string().max(2048).nullable(),
  entryReason: note,
  wentWell: note,
  wentWrong: note,
  improvement: note,
  followedRules: z.boolean(),
  emotion: z.enum(emotions),
}).strict();

export type DraftInput = z.infer<typeof draftSchema>;
export type TradeDraft = { id: string; date: string; data: DraftInput; createdAt: string; updatedAt: string };
