let startTime = Date.now();
let requestCount = 0;

export function trackRequest() {
  requestCount++;
}

export function getMetrics(req, res) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptime,
    uptimeHuman: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    requests: requestCount,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + "MB"
    },
    node: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || "development"
  });
}
