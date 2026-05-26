// ESL connection to FreeSWITCH. Manages connect/reconnect and dispatches events
// (CHANNEL_ANSWER, CHANNEL_HANGUP, CUSTOM, MESSAGE) to registered handlers.
import esl from 'modesl';

let eslConnection = null;
let reconnectTimer = null;

const connectionHandlers = new Map();
const memberIdMap = new Map();

const eventHandlers = {
    custom: [],
    answer: [],
    hangup: [],
    message: [],
    log: [],
};

export function getConnection() { return eslConnection; }
export function getConnectionHandlers() { return connectionHandlers; }
export function getMemberIdMap() { return memberIdMap; }

export function onCustomEvent(fn) { eventHandlers.custom.push(fn); }
export function onAnswerEvent(fn) { eventHandlers.answer.push(fn); }
export function onHangupEvent(fn) { eventHandlers.hangup.push(fn); }
export function onMessageEvent(fn) { eventHandlers.message.push(fn); }
export function onLogEvent(fn) { eventHandlers.log.push(fn); }

export async function connect() {
    return new Promise((resolve, reject) => {
        const { FREESWITCH_ESL_HOST, FREESWITCH_ESL_PORT, FREESWITCH_ESL_PASSWORD } = global.config;

        eslConnection = new esl.Connection(
            FREESWITCH_ESL_HOST,
            FREESWITCH_ESL_PORT,
            FREESWITCH_ESL_PASSWORD,
            () => {
                console.log('ESL connected to FreeSWITCH');

                eslConnection.subscribe('CHANNEL_ANSWER CHANNEL_HANGUP_COMPLETE');
                eslConnection.subscribe('CUSTOM sofia::register sofia::unregister sofia::expire sofia::keepalive conference::maintenance');
                eslConnection.subscribe('RECV_MESSAGE MESSAGE NOTIFY_IN RECV_INFO');

                eslConnection.on('esl::event::CUSTOM::*', (event) => {
                    for (const fn of eventHandlers.custom) fn(event);
                });
                eslConnection.on('esl::event::CHANNEL_ANSWER::*', (event) => {
                    for (const fn of eventHandlers.answer) fn(event);
                });
                eslConnection.on('esl::event::CHANNEL_HANGUP_COMPLETE::*', (event) => {
                    for (const fn of eventHandlers.hangup) fn(event);
                });
                eslConnection.on('esl::event::RECV_MESSAGE::*', (event) => {
                    for (const fn of eventHandlers.message) fn(event);
                });
                eslConnection.on('esl::event::MESSAGE::*', (event) => {
                    for (const fn of eventHandlers.message) fn(event);
                });
                eslConnection.on('esl::event::NOTIFY_IN::*', (event) => {
                    for (const fn of eventHandlers.message) fn(event);
                });
                eslConnection.on('esl::event::RECV_INFO::*', (event) => {
                    for (const fn of eventHandlers.message) fn(event);
                });

                eslConnection.sendRecv('log notice', () => {
                    console.log('ESL log subscription enabled (level: notice)');
                });
                eslConnection.on('esl::event::logdata', (event) => {
                    for (const fn of eventHandlers.log) fn(event);
                });

                console.log('ESL event subscriptions registered');

                // Kill all orphaned calls immediately on connect
                eslConnection.api('hupall MANAGER_REQUEST', () => {
                    console.log('[ESL] CLEANUP — hupall complete (cleared orphaned calls)');
                });

                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }

                resolve();
            }
        );

        eslConnection.on('error', (err) => {
            console.error('ESL connection error:', err.message);
            _scheduleReconnect();
            reject(err);
        });

        eslConnection.on('esl::end', () => {
            console.log('ESL connection closed');
            _scheduleReconnect();
        });
    });
}

export function isConnected() {
    try { return eslConnection != null && eslConnection.connected(); }
    catch { return false; }
}

const disconnectHandlers = [];
const reconnectHandlers = [];
export function onEslDisconnect(fn) { disconnectHandlers.push(fn); }
export function onEslReconnect(fn) { reconnectHandlers.push(fn); }

function _handleEslDisconnect() {
    for (const fn of disconnectHandlers) {
        try { fn(); } catch (e) { console.error('ESL disconnect handler error:', e.message); }
    }
}

function _handleEslReconnect() {
    for (const fn of reconnectHandlers) {
        try { fn(); } catch (e) { console.error('ESL reconnect handler error:', e.message); }
    }
}

function _scheduleReconnect() {
    if (reconnectTimer) return;
    console.log('ESL reconnecting in 2 seconds...');
    _handleEslDisconnect();
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            await connect();
            _handleEslReconnect();
        } catch (err) {
            console.error('ESL reconnect failed:', err.message);
        }
    }, 2000);
}
