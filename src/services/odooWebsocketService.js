const { EventEmitter } = require('events');
const WebSocket = require('ws');

const DEFAULT_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function extractSessionId(cookieValue) {
  if (!cookieValue) return null;

  const match = String(cookieValue).match(/(?:^|[;,]\s*)session_id=([^;,\s]+)/i);
  if (match) return match[1];

  const trimmedValue = String(cookieValue).trim();
  return trimmedValue && !trimmedValue.includes('=') ? trimmedValue : null;
}

function buildWebSocketUrl(baseUrl, workerVersion) {
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol === 'https:') {
    parsedUrl.protocol = 'wss:';
  } else if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'ws:';
  } else {
    throw new Error(`Protocolo de Odoo no soportado: ${parsedUrl.protocol}`);
  }

  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, '')}/websocket`;
  parsedUrl.search = '';
  parsedUrl.hash = '';
  parsedUrl.searchParams.set('version', workerVersion);
  return parsedUrl.toString();
}

async function fetchSessionInfo(baseUrl, sessionId) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/web/session/get_session_info`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_id=${sessionId}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() }),
  });

  if (!response.ok) {
    throw new Error(`Odoo rechazó la consulta de sesión (${response.status})`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.data?.message || body.error.message || 'Sesión de Odoo inválida');
  }

  return body.result || {};
}

function getBusNotifications(message) {
  if (Array.isArray(message)) return message;
  if (Array.isArray(message?.result)) return message.result;
  if (Array.isArray(message?.notifications)) return message.notifications;
  return message && typeof message === 'object' ? [message] : [];
}

class OdooWebsocketService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.WebSocketImpl = options.WebSocketImpl || WebSocket;
    this.fetchSessionInfo = options.fetchSessionInfo || fetchSessionInfo;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.lastNotificationId = 0;
    this.connectionKey = null;
    this.connectionOptions = null;
    this.pendingStartOptions = null;
    this.generation = 0;
    this.stopped = true;
    this.initializing = false;
  }

  async start({
    baseUrl,
    sessionId: sessionCookie,
    websocketWorkerVersion,
    currentUserId,
    currentPartnerId,
  }) {
    const sessionId = extractSessionId(sessionCookie);
    if (!baseUrl || !sessionId) {
      this.stop();
      return false;
    }

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const nextConnectionKey = `${normalizedBaseUrl}|${sessionId}`;
    if (
      this.connectionKey === nextConnectionKey &&
      (this.initializing ||
        this.socket?.readyState === this.WebSocketImpl.OPEN ||
        this.socket?.readyState === this.WebSocketImpl.CONNECTING)
    ) {
      return true;
    }

    this.stop();
    this.stopped = false;
    this.connectionKey = nextConnectionKey;
    this.initializing = true;
    this.pendingStartOptions = {
      baseUrl: normalizedBaseUrl,
      sessionId: sessionCookie,
      websocketWorkerVersion,
      currentUserId,
      currentPartnerId,
    };
    const currentGeneration = this.generation;

    try {
      let workerVersion = websocketWorkerVersion;
      let sessionInfo = null;
      if (!workerVersion) {
        sessionInfo = await this.fetchSessionInfo(normalizedBaseUrl, sessionId);
        workerVersion = sessionInfo.websocket_worker_version;
      }

      if (this.stopped || currentGeneration !== this.generation) return false;
      if (!workerVersion) throw new Error('Odoo no devolvió websocket_worker_version');

      this.initializing = false;
      this.connectionOptions = {
        baseUrl: normalizedBaseUrl,
        sessionId,
        workerVersion,
        currentUserId: currentUserId ?? sessionInfo?.uid,
        currentPartnerId: currentPartnerId ?? sessionInfo?.partner_id,
      };
      this.pendingStartOptions = null;
      this.connect(currentGeneration);
      return true;
    } catch (error) {
      if (this.stopped || currentGeneration !== this.generation) return false;
      this.initializing = false;
      this.emit('connection-error', error);
      this.scheduleReconnect(currentGeneration);
      return false;
    }
  }

  connect(generation = this.generation) {
    if (this.stopped || generation !== this.generation || !this.connectionOptions) return;
    if (
      this.socket?.readyState === this.WebSocketImpl.OPEN ||
      this.socket?.readyState === this.WebSocketImpl.CONNECTING
    ) return;

    const { baseUrl, sessionId, workerVersion, currentUserId, currentPartnerId } = this.connectionOptions;
    const websocketUrl = buildWebSocketUrl(baseUrl, workerVersion);
    const socket = new this.WebSocketImpl(websocketUrl, {
      headers: {
        Cookie: `session_id=${sessionId}`,
        Origin: new URL(baseUrl).origin,
      },
    });
    this.socket = socket;

    socket.on('open', () => {
      if (this.stopped || generation !== this.generation || socket !== this.socket) {
        socket.close();
        return;
      }

      this.reconnectAttempts = 0;
      const subscription = {
        event_name: 'subscribe',
        data: { channels: [], last: this.lastNotificationId },
      };
      socket.send(JSON.stringify(subscription));
      this.emit('connected', {
        websocketUrl,
        currentUserId,
        currentPartnerId,
        subscription,
      });
    });

    socket.on('message', (rawMessage) => this.handleMessage(rawMessage));

    socket.on('error', (error) => {
      if (!this.stopped && generation === this.generation) {
        this.emit('connection-error', error);
      }
    });

    socket.on('close', () => {
      if (socket === this.socket) this.socket = null;
      if (!this.stopped && generation === this.generation) {
        this.emit('disconnected');
        this.scheduleReconnect(generation);
      }
    });
  }

  handleMessage(rawMessage) {
    const rawMessageText = rawMessage.toString();
    this.emit('raw-message', rawMessageText);

    let message;
    try {
      message = JSON.parse(rawMessageText);
    } catch (error) {
      this.emit('message-error', error);
      return;
    }

    getBusNotifications(message).forEach((notification) => {
      const busNotificationId = Number(notification?.id);
      if (Number.isFinite(busNotificationId)) {
        this.lastNotificationId = Math.max(this.lastNotificationId, busNotificationId);
      }

      if (notification?.message?.type !== 'user_activity.notification') return;

      const payload = notification.message.payload;
      if (!payload || typeof payload !== 'object') return;

      const formattedNotification = {
        busNotificationId: notification.id,
        notificationId: payload.id,
        payload,
      };

      this.emit('formatted-notification', formattedNotification);
      this.emit('notification', formattedNotification);
    });
  }

  scheduleReconnect(generation) {
    if (this.stopped || generation !== this.generation || this.reconnectTimer) return;

    const delay = Math.min(
      DEFAULT_RECONNECT_DELAY * (2 ** this.reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectionOptions) {
        this.connect(generation);
      } else if (this.pendingStartOptions) {
        const pendingStartOptions = this.pendingStartOptions;
        this.connectionKey = null;
        this.start(pendingStartOptions);
      }
    }, delay);
  }

  stop() {
    this.stopped = true;
    this.generation += 1;
    this.connectionKey = null;
    this.connectionOptions = null;
    this.pendingStartOptions = null;
    this.reconnectAttempts = 0;
    this.lastNotificationId = 0;
    this.initializing = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const socket = this.socket;
    this.socket = null;
    if (socket && (
      socket.readyState === this.WebSocketImpl.OPEN ||
      socket.readyState === this.WebSocketImpl.CONNECTING
    )) {
      socket.close();
    }
  }
}

module.exports = {
  OdooWebsocketService,
  buildWebSocketUrl,
  extractSessionId,
  fetchSessionInfo,
  getBusNotifications,
};
