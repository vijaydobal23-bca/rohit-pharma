const { getCache, setCache } = require('../config/redis');

/**
 * Universal Redis Caching Middleware for Express GET routes
 * @param {number} ttlSeconds - Time-To-Live in seconds (default 120s = 2 mins)
 * @param {string} prefix - Key namespace prefix (e.g. 'meds', 'dash', 'cats', 'suppliers')
 */
const cacheMiddleware = (ttlSeconds = 120, prefix = 'cache') => {
  return async (req, res, next) => {
    // Only cache idempotent GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Compose cache key incorporating namespace, route, role, and query parameters
    const userRole = req.user?.role || 'public';
    const queryKeys = Object.keys(req.query || {}).sort();
    const sortedQuery = queryKeys.reduce((acc, k) => {
      acc[k] = req.query[k];
      return acc;
    }, {});
    const queryString = JSON.stringify(sortedQuery);
    const cacheKey = `${prefix}:${req.baseUrl || ''}${req.path}:${userRole}:${queryString}`;

    try {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache-Status', 'HIT');
        return res.status(200).json(cachedData);
      }
    } catch {
      // Gracefully continue to controller if cache read fails
    }

    res.setHeader('X-Cache-Status', 'MISS');

    // Intercept res.json to cache successful responses
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body && body.success !== false) {
        // Set asynchronously in background without delaying HTTP response
        setCache(cacheKey, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
};
