import { Counter } from 'prom-client';

export const notificationsDeliveredCount = new Counter({
  name: 'notifications_delivered_total',
  help: 'Total number of notifications delivered',
  labelNames: ['channel']
});

export const notificationsFailedCount = new Counter({
  name: 'notifications_failed_total',
  help: 'Total number of notifications failed',
  labelNames: ['channel', 'reason']
});

export const duplicateDeliveryEventsSkipped = new Counter({
  name: 'notifications_duplicate_events_total',
  help: 'Total number of duplicate delivery events skipped'
});
