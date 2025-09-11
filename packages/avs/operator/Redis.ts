import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  }
);

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (e) => console.error("[redis] error", e));
