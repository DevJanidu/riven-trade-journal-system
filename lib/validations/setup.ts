import { z } from "zod";

export const setupNameSchema = z.string().trim().min(1, "Setup name is required").max(80, "Keep setup names under 80 characters");
export const setupIdSchema = z.string().uuid("Setup ID must be a UUID");
export const setupRulesSchema = z.array(z.string().trim().min(1).max(200)).max(30);
export const setupAvoidRulesSchema = z.array(z.string().trim().min(1).max(200)).max(30);
export const createSetupSchema = z.object({ name: setupNameSchema, rules: setupRulesSchema.default([]), avoidRules: setupAvoidRulesSchema.default([]) }).strict();
