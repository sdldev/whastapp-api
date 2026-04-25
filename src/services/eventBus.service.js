const { EventEmitter } = require('events');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(0);

function publish(event, sessionId, data) {
  const payload = {
    event,
    sessionId,
    data,
    timestamp: new Date().toISOString()
  };
  eventBus.emit('event', payload);
  eventBus.emit(event, payload);
  if (sessionId) eventBus.emit(`session:${sessionId}`, payload);
  return payload;
}

function subscribe(listener) {
  eventBus.on('event', listener);
  return () => eventBus.off('event', listener);
}

module.exports = {
  publish,
  subscribe
};
