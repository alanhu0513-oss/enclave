/* ─── Enclave Job Queue ───
 * BullMQ + Redis for async job processing.
 * Handles deep scans, crawl cycles, ML inference, takedown follow-ups.
 * Gracefully degrades to in-memory if Redis unavailable.
 */

const { Queue, Worker } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const { bus, Events } = require('./event-bus');

const REDIS_URL = process.env.REDIS_URL || '';
let connection = null;
let queues = {};
let workers = {};
let useMemoryQueue = !REDIS_URL;

/* ─── In-Memory Fallback Queue ─── */
class MemoryQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.processing = false;
    this.handler = null;
  }

  async add(jobName, data, opts = {}) {
    const job = {
      id: `${this.name}:${uuidv4()}`,
      name: jobName,
      data,
      opts,
      attempts: 0,
      maxAttempts: opts.attempts || 3,
      status: 'waiting',
      createdAt: Date.now(),
    };
    this.jobs.push(job);
    this._process();
    return job;
  }

  process(handler) {
    this.handler = handler;
    this._process();
  }

  async _process() {
    if (this.processing || !this.handler) return;
    this.processing = true;
    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (job.status !== 'waiting') continue;
      job.status = 'active';
      job.attempts++;
      try {
        await this.handler(job);
        job.status = 'completed';
      } catch (e) {
        if (job.attempts < job.maxAttempts) {
          job.status = 'waiting';
          this.jobs.push(job);
        } else {
          job.status = 'failed';
          console.error(`[QUEUE:${this.name}] Job ${job.id} failed after ${job.attempts} attempts:`, e.message);
        }
      }
    }
    this.processing = false;
  }

  getJobCounts() {
    return {
      waiting: this.jobs.filter(j => j.status === 'waiting').length,
      active: this.jobs.filter(j => j.status === 'active').length,
      completed: this.jobs.filter(j => j.status === 'completed').length,
      failed: this.jobs.filter(j => j.status === 'failed').length,
    };
  }
}

/* ─── Redis Connection ─── */
function getRedisConnection() {
  if (connection) return connection;
  if (!REDIS_URL) return null;

  try {
    const IORedis = require('ioredis');
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[QUEUE] Redis connection failed, falling back to memory queue');
          useMemoryQueue = true;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    connection.on('error', (e) => {
      if (!useMemoryQueue) {
        console.warn('[QUEUE] Redis error:', e.message);
      }
    });

    connection.on('ready', () => {
      console.log('[QUEUE] Connected to Redis');
      useMemoryQueue = false;
    });

    return connection;
  } catch (e) {
    console.warn('[QUEUE] Redis not available, using memory queue:', e.message);
    useMemoryQueue = true;
    return null;
  }
}

/* ─── Queue Factory ─── */
function getQueue(name) {
  if (queues[name]) return queues[name];

  const conn = getRedisConnection();
  if (conn && !useMemoryQueue) {
    queues[name] = new Queue(name, {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  } else {
    queues[name] = new MemoryQueue(name);
  }

  return queues[name];
}

/* ─── Worker Factory ─── */
function createWorker(name, handler, opts = {}) {
  const conn = getRedisConnection();
  if (conn && !useMemoryQueue) {
    workers[name] = new Worker(name, handler, {
      connection: conn,
      concurrency: opts.concurrency || 2,
      limiter: opts.limiter,
    });

    workers[name].on('failed', (job, err) => {
      console.error(`[QUEUE:${name}] Job ${job.id} failed:`, err.message);
    });

    workers[name].on('completed', (job) => {
      console.log(`[QUEUE:${name}] Job ${job.id} completed`);
    });
  } else {
    const memQueue = getQueue(name);
    memQueue.process(handler);
  }
}

/* ─── Pre-defined Queues ─── */
const QUEUES = {
  DEEP_SCAN: 'deep-scan',
  CRAWL_CYCLE: 'crawl-cycle',
  MONITOR_CYCLE: 'monitor-cycle',
  ML_INFERENCE: 'ml-inference',
  TAKEDOWN_FOLLOWUP: 'takedown-followup',
  WEBHOOK_DELIVER: 'webhook-deliver',
  EMAIL_SEND: 'email-send',
};

/* ─── Job Types ─── */
const JobTypes = {
  DEEP_SCAN: 'deep-scan-user',
  CRAWL_CYCLE: 'crawl-cycle-user',
  MONITOR_CYCLE: 'monitor-cycle-user',
  ML_DETECT_IMAGE: 'ml-detect-image',
  ML_DETECT_AUDIO: 'ml-detect-audio',
  TAKEDOWN_FOLLOWUP: 'takedown-followup-check',
  WEBHOOK_DELIVER: 'webhook-deliver',
  EMAIL_SEND: 'email-send',
};

/* ─── Queue Status ─── */
async function getQueueStatus() {
  const status = {};
  for (const [key, name] of Object.entries(QUEUES)) {
    const q = getQueue(name);
    if (q.getJobCounts) {
      status[key] = await q.getJobCounts();
    } else {
      status[key] = q.getJobCounts ? q.getJobCounts() : {};
    }
  }
  return status;
}

/* ─── Graceful Shutdown ─── */
async function closeQueues() {
  for (const [name, worker] of Object.entries(workers)) {
    try { await worker.close(); } catch (_) {}
  }
  for (const [name, queue] of Object.entries(queues)) {
    try { await queue.close(); } catch (_) {}
  }
  if (connection) {
    try { await connection.quit(); } catch (_) {}
  }
}

module.exports = {
  getQueue,
  createWorker,
  QUEUES,
  JobTypes,
  getQueueStatus,
  closeQueues,
  get isMemoryQueue() { return useMemoryQueue; },
};
