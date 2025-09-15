import { redis } from "./Redis";
import { UserConfig } from "./types";

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
  strategyId,
}: SaveArgs) {
  const kCfg = cfgKey(positionId);
  const kTick = tickSetKey(tickThreshold);

  const now = Date.now().toString();
  const h: Record<string, string> = {
    positionId,
    tickThreshold: String(tickThreshold),
    strategyId: String(strategyId ?? 0),
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
  tx.zrem(Z_PENDING, positionId);
  if (tickStr) {
    tx.srem(tickSetKey(Number(tickStr)), positionId);
  }
  tx.del(kCfg);
  await tx.exec();

  if (tickStr) {
    const kTick = tickSetKey(Number(tickStr));
    const count = await redis.scard(kTick);
    if (count === 0) {
      await redis.del(kTick);
    }
  }
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

function hydrateConfig(h: Record<string, string> | null): UserConfig | null {
  if (!h) return null;
  const positionIdStr = h.positionId ?? "0";
  const tickStr = h.tickThreshold ?? "0";
  const strategyStr = h.strategyId ?? "0";
  const owner = h.owner ?? "0x0000000000000000000000000000000000000000";
  const posM = h.posM ?? "0x0000000000000000000000000000000000000000";
  try {
    const cfg: UserConfig = {
      positionId: BigInt(positionIdStr),
      tickThreshold: BigInt(tickStr),
      strategyId: BigInt(strategyStr),
      owner,
      posM,
    };
    return cfg;
  } catch {
    return null;
  }
}

export async function getConfig(
  positionId: string
): Promise<UserConfig | null> {
  const h = (await redis.hgetall(cfgKey(positionId))) as unknown as Record<
    string,
    string
  > | null;
  return hydrateConfig(h);
}

export async function getConfigsByIds(ids: string[]): Promise<UserConfig[]> {
  const results: UserConfig[] = [];
  for (const id of ids) {
    const cfg = await getConfig(id);
    if (cfg) results.push(cfg);
  }
  return results;
}
