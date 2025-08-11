// /api/_tg.js
// Вспомогательные функции для работы с Telegram Bot API и автоконфигурации webhook

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const SECRET = process.env.API_SECRET || process.env.WEBHOOK_SECRET || '';

// простая "память" в процессе для троттлинга setWebhook
let lastWebhookSetAt = 0;
let lastWebhookUrl = '';

export async function apiCall(method, payload) {
    if (!API) throw new Error('BOT_TOKEN missing');
    const r = await fetch(`${API}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const j = await r.json();
    return j;
}

// Ставит вебхук на /api/webhook для текущего хоста, если ещё не совпадает
export async function ensureWebhook(req) {
    try {
        if (!API) return;

        // определяем базовый URL из запроса
        const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
        const proto = req?.headers?.['x-forwarded-proto'] || 'https';
        if (!host) return;

        const desiredUrl = `${proto}://${host}/api/webhook`;

        // троттлим вызовы, если уже ставили недавно на тот же URL
        const now = Date.now();
        if (desiredUrl === lastWebhookUrl && (now - lastWebhookSetAt) < 60_000) {
            return;
        }

        // проверяем текущий вебхук
        const info = await apiCall('getWebhookInfo', {});
        const currentUrl = info?.result?.url || '';

        if (currentUrl !== desiredUrl) {
            const body = {
                url: desiredUrl,
                allowed_updates: ['message', 'edited_message', 'pre_checkout_query']
            };
            if (SECRET) body.secret_token = SECRET;

            const setRes = await apiCall('setWebhook', body);
            if (!setRes.ok) {
                console.error('setWebhook failed:', setRes);
            } else {
                lastWebhookSetAt = now;
                lastWebhookUrl = desiredUrl;
            }
        } else {
            lastWebhookSetAt = now;
            lastWebhookUrl = desiredUrl;
        }
    } catch (e) {
        console.error('ensureWebhook error:', e?.message || e);
    }
}
