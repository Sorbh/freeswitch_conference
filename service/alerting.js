import https from 'https';

// Map of userName -> { initialTimer, intervalTimer }
const activeAlerts = new Map();

/**
 * Look up the user's account in the DB and return true if the critical flag is set.
 * @param {string} userName
 * @returns {boolean}
 */
function checkCriticalUser(userName) {
    const email = userName.replace('sip:', '');
    const account = global.db.getAccountByEmail(email);
    return !!(account && account.critical);
}

/**
 * Send a single Telegram alert message via the Bot API using HTTPS (no external SDK).
 * @param {string} message
 * @returns {Promise<void>}
 */
async function sendTelegramAlert(message) {
    const token = global.config.TELEGRAM_BOT_TOKEN;
    const chatId = global.config.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('[alerting] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured — skipping alert.');
        return;
    }

    const body = JSON.stringify({
        chat_id: chatId,
        text: `🚨 URGENT ALERT! Please check SIP immediately — ${message}!`,
        disable_notification: false,
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    console.error(`[alerting] Telegram API returned ${res.statusCode}: ${data}`);
                    resolve(); // non-fatal — keep alerting
                }
            });
        });
        req.on('error', (err) => {
            console.error('[alerting] Failed to send Telegram alert:', err.message);
            resolve(); // non-fatal
        });
        req.write(body);
        req.end();
    });
}

/**
 * Start a 5-minute offline timer for a critical user.
 * If the user is still offline after 5 minutes, continuous Telegram alerts are sent every 60 seconds.
 * @param {string} userName
 */
function startCriticalAlert(userName) {
    if (activeAlerts.has(userName)) {
        console.log(`[alerting] Alert already active for ${userName} — ignoring duplicate start.`);
        return;
    }

    console.log(`[alerting] Starting 5-minute offline timer for critical user: ${userName}`);

    const initialTimer = setTimeout(async () => {
        console.log(`[alerting] Critical user ${userName} has been offline for 5 minutes — starting continuous alerts.`);

        // Send the first alert immediately
        await sendTelegramAlert(`Critical SIP user "${userName}" has been offline for more than 5 minutes`);

        // Then repeat every 60 seconds
        const intervalTimer = setInterval(async () => {
            console.log(`[alerting] Sending repeat Telegram alert for offline critical user: ${userName}`);
            await sendTelegramAlert(`Critical SIP user "${userName}" is still offline`);
        }, 60 * 1000);

        // Replace the stored entry with just the interval (initial timer already fired)
        const entry = activeAlerts.get(userName);
        if (entry) {
            entry.initialTimer = null;
            entry.intervalTimer = intervalTimer;
        }
    }, 5 * 60 * 1000);

    activeAlerts.set(userName, { initialTimer, intervalTimer: null });
}

/**
 * Stop any pending or running alert timers for a user.
 * @param {string} userName
 */
function stopCriticalAlert(userName) {
    const entry = activeAlerts.get(userName);
    if (!entry) {
        return; // nothing to stop
    }

    if (entry.initialTimer) {
        clearTimeout(entry.initialTimer);
    }
    if (entry.intervalTimer) {
        clearInterval(entry.intervalTimer);
    }

    activeAlerts.delete(userName);
    console.log(`[alerting] Cleared alert timers for user: ${userName}`);
}

export { startCriticalAlert, stopCriticalAlert, checkCriticalUser };
