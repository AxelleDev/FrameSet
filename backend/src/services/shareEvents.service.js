// projectId -> Set<res> of open SSE responses.
const subscribersByProject = new Map();

// Caps runaway fan-out from one very popular link; beyond this, extra viewers
// simply don't get live updates (the page still works, just not live).
const MAX_SUBSCRIBERS_PER_PROJECT = 100;

// Proxies (Railway's included) reap idle connections; a periodic comment line
// keeps them open. One shared timer for all subscribers, started lazily and
// stopped when nobody is listening (also lets Jest exit cleanly).
const HEARTBEAT_MS = 25000;
let heartbeatTimer = null;

const totalSubscribers = () => {
  let count = 0;
  subscribersByProject.forEach((set) => {
    count += set.size;
  });
  return count;
};

const stopHeartbeatIfIdle = () => {
  if (heartbeatTimer && totalSubscribers() === 0) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const startHeartbeat = () => {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    subscribersByProject.forEach((set) => {
      set.forEach((res) => {
        try {
          res.write(': ping\n\n');
        } catch {
          /* the close handler removes broken subscribers */
        }
      });
    });
  }, HEARTBEAT_MS);
  // Never keep the process alive just for heartbeats.
  if (heartbeatTimer.unref) heartbeatTimer.unref();
};

/**
 * Registers an open SSE response for a project. Returns false when the
 * per-project cap is reached (caller ends the stream gracefully).
 * The caller is responsible for calling unsubscribe on connection close.
 */
const subscribe = (projectId, res) => {
  let set = subscribersByProject.get(projectId);
  if (!set) {
    set = new Set();
    subscribersByProject.set(projectId, set);
  }
  if (set.size >= MAX_SUBSCRIBERS_PER_PROJECT) return false;
  set.add(res);
  startHeartbeat();
  return true;
};

const unsubscribe = (projectId, res) => {
  const set = subscribersByProject.get(projectId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribersByProject.delete(projectId);
  stopHeartbeatIfIdle();
};

/**
 * Tells every open shared page of this project to refetch. Fire-and-forget:
 * a broken pipe never breaks the mutation that triggered the notify.
 */
const notifyProjectChanged = (projectId) => {
  const set = subscribersByProject.get(projectId);
  if (!set) return;
  set.forEach((res) => {
    try {
      res.write('event: changed\ndata: {}\n\n');
    } catch {
      /* the close handler removes broken subscribers */
    }
  });
};

// Test hook: drops every subscriber and stops the heartbeat.
const resetForTests = () => {
  subscribersByProject.clear();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  notifyProjectChanged,
  resetForTests,
  MAX_SUBSCRIBERS_PER_PROJECT,
  HEARTBEAT_MS,
};
