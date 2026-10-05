import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tradeDrafts, trades } from "@/lib/db/schema";

export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
export const screenshotTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type Storage = { bucket: string; client: S3Client };
let storage: Storage | undefined;

function getStorage(): Storage {
  if (storage) return storage;
  const { AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;
  if (!AWS_ENDPOINT_URL_S3 || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
    throw new Error("Image storage is not configured. Set the AWS_* variables in .env.local.");
  }
  storage = {
    bucket: AWS_S3_BUCKET,
    client: new S3Client({
      endpoint: AWS_ENDPOINT_URL_S3,
      region: AWS_REGION,
      credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    }),
  };
  return storage;
}

export function isScreenshotKey(value: string): boolean {
  return /^(?:users\/[0-9a-f-]{36}\/)?trades\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(value);
}

export function screenshotBelongsToUser(value: string, userId: string): boolean {
  return value.startsWith(`users/${userId}/`) && isScreenshotKey(value);
}

export async function userCanAccessScreenshot(value: string, userId: string): Promise<boolean> {
  if (screenshotBelongsToUser(value, userId)) return true;
  if (!/^trades\//i.test(value) || !isScreenshotKey(value)) return false;
  const [trade] = await getDb().select({ id: trades.id }).from(trades).where(and(eq(trades.userId, userId), or(eq(trades.beforeScreenshot, value), eq(trades.afterScreenshot, value)))).limit(1);
  if (trade) return true;
  const [draft] = await getDb().select({ id: tradeDrafts.id }).from(tradeDrafts).where(and(eq(tradeDrafts.userId, userId), or(sql`${tradeDrafts.data}->>'beforeScreenshot' = ${value}`, sql`${tradeDrafts.data}->>'afterScreenshot' = ${value}`))).limit(1);
  return Boolean(draft);
}

export async function screenshotReferencesBelongToUser(values: Array<string | null | undefined>, userId: string) {
  const storedKeys = values.filter((value): value is string => Boolean(value && isScreenshotKey(value)));
  return (await Promise.all(storedKeys.map(value => userCanAccessScreenshot(value, userId)))).every(Boolean);
}

export async function storeScreenshot(key: string, body: Uint8Array, contentType: string) {
  const { client, bucket } = getStorage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function readScreenshot(key: string) {
  const { client, bucket } = getStorage();
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 });
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) throw Object.assign(new Error("Image not found"), { name: "NotFound" });
  if (!response.ok) throw new Error(`Storage read failed (${response.status})`);
  return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
}

export async function removeScreenshot(key: string) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
