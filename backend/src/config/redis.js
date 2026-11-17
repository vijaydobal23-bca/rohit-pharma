const Redis = require('ioredis');

const host = (process.env.REDIS_HOST || '').replace(/["']/g, '').trim();
const port = parseInt(process.env.REDIS_PORT || '17272', 10);
const password = (process.env.REDIS_PASSWORD || process.env.REDIS_PASS || '').trim();

const isConfigured = Boolean(host && password);

let redisClient = null;
let isConnected = false;

if (isConfigured) {
  try {
    redisClient = new Redis({
      host,
      port,
      password,
      connectTimeout: 8000,
      enableOfflineQueue: false, // Don't hang requests if Redis is offline
      retryStrategy(times) {
        if (times > 10) {
          console.warn('⚠️ [Redis] Exceeded max reconnection attempts. Cache disabled temporarily.');
          return null; // Stop retrying after 10 attempts
        }
        return Math.min(times * 200, 3000);
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('✓ [Redis] Connected successfully to Redis Cloud cache (' + host + ':' + port + ')');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn('⚠️ [Redis Cache Notice]:', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  } catch (error) {
    console.warn('⚠️ [Redis Initialization Error]:', error.message);
    redisClient = null;
    isConnected = false;
  }
} else {
  console.log('ℹ️ [Redis] Credentials not found in environment, cache fallback mode active.');
}

/**
 * Cache Get Helper (Graceful - returns null if cache miss or Redis offline)
 */
const getCache = async (key) => {
  if (!redisClient || !isConnected) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (err) {
    console.warn(`[Redis Get Warning for ${key}]:`, err.message);
    return null;
  }
};

/**
 * Cache Set Helper (with optional TTL in seconds, default 5 mins)
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  if (!redisClient || !isConnected) return false;
  try {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(key, stringVal, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, stringVal);
    }
    return true;
  } catch (err) {
    console.warn(`[Redis Set Warning for ${key}]:`, err.message);
    return false;
  }
};

/**
 * Cache Delete Single Key
 */
const delCache = async (key) => {
  if (!redisClient || !isConnected) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.warn(`[Redis Del Warning for ${key}]:`, err.message);
    return false;
  }
};

/**
 * Cache Invalidation by Pattern (e.g. 'medicines:*', 'dashboard:*')
 */
const delCachePattern = async (pattern) => {
  if (!redisClient || !isConnected) return false;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys && keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`🧹 [Redis] Invalidated ${keys.length} cached keys matching "${pattern}"`);
    }
    return true;
  } catch (err) {
    console.warn(`[Redis Pattern Invalidation Warning for ${pattern}]:`, err.message);
    return false;
  }
};

module.exports = {
  redisClient,
  isConfigured,
  isConnected: () => isConnected,
  getCache,
  setCache,
  delCache,
  delCachePattern,
};
