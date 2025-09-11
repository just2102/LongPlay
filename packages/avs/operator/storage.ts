import { redis } from "./Redis";

type SaveArgs = {
  tickThreshold: number;
  strategyId: number;
  owner: string;
  positionId: string;
  posM: string;
};

const Z_THRESHOLDS = "cfgs:thresholds"; // score=tickThreshold, member=positionId
const cfgKey = (positionId: string) => `cfg:${positionId}`;
const tickSetKey = (tick: number) => `tick:${tick}`;

export async function saveConfig({
  positionId,
  tickThreshold,
  owner,
  posM,
}: SaveArgs) {
  const kCfg = cfgKey(positionId);
  const kTick = tickSetKey(tickThreshold);

  const now = Date.now().toString();
  const h: Record<string, string> = {
    positionId,
    tickThreshold: String(tickThreshold),
    ...(owner ? { owner } : {}),
    ...(posM ? { posM } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const tx = redis.multi();
  tx.hset(kCfg, h); // upsert config
  tx.zadd(Z_THRESHOLDS, tickThreshold, positionId); // index by threshold
  tx.sadd(kTick, positionId); // for easy removal by tick
  await tx.exec();
}

export async function removeConfig(positionId: string) {
  const kCfg = cfgKey(positionId);
  const tickStr = await redis.hget(kCfg, "tickThreshold"); // we stored it
  const tx = redis.multi();
  tx.zrem(Z_THRESHOLDS, positionId); // remove from global zset
  if (tickStr) {
    tx.srem(tickSetKey(Number(tickStr)), positionId);
  }
  tx.del(kCfg); // drop the hash last
  await tx.exec();
}
