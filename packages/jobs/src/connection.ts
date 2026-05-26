import IORedis from "ioredis";
import { getConfig } from "@landscrape/config";

let sharedConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    const { redisUrl } = getConfig();
    sharedConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}
