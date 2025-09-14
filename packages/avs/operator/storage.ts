import { redis } from "./Redis";

type SaveArgs = {
  tickThreshold: number;
  strategyId: number;
  owner: string;
  positionId: string;
  posM: string;
};

/**
 * score=tickThreshold, member=positionId
 */
const Z_THRESHOLDS = "cfgs:thresholds";

/**
 * score=tickThreshold, member=positionId
 */
const Z_PENDING = "cfgs:pending";
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
  tx.zadd(Z_THRESHOLDS, tickThreshold, positionId);
  tx.sadd(kTick, positionId); // for easy removal by tick
  await tx.exec();
}

export async function removeConfig(positionId: string) {
  const kCfg = cfgKey(positionId);
  const tickStr = await redis.hget(kCfg, "tickThreshold");
  const tx = redis.multi();
  tx.zrem(Z_THRESHOLDS, positionId);
  if (tickStr) {
    tx.srem(tickSetKey(Number(tickStr)), positionId);
  }
  tx.del(kCfg);
  await tx.exec();
}

// todo: if a position was not processed for some reason,
// it should be marked as pending for future processing
// notification logic for user can be implemented here as well
export async function markPending(positionId: string) {
  const kCfg = cfgKey(positionId);
  const tickStr = await redis.hget(kCfg, "tickThreshold");
  if (!tickStr) return;
  const tick = Number(tickStr);
  await redis.zadd(Z_PENDING, tick, positionId);
}

export async function clearPending(positionId: string) {
  await redis.zrem(Z_PENDING, positionId);
}

/**
 *
 * @notice Return pending ids that are still eligible given current price move direction
 */
export async function getPendingEligible(
  currentTick: number,
  lastTick: number
): Promise<string[]> {
  if (currentTick === lastTick) return [];
  if (currentTick < lastTick) {
    // price moved down → any thresholds above currentTick are still eligible
    return await redis.zrangebyscore(Z_PENDING, `(${currentTick}`, "+inf");
  }
  // price moved up → any thresholds below currentTick are still eligible
  return await redis.zrangebyscore(Z_PENDING, "-inf", `(${currentTick}`);
}
