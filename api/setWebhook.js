// /api/setWebhook.js
// Устанавливает webhook бота на /api/webhook. Можно передать ?url=... вручную.
// Использует WEBHOOK_SECRET, если задан, для защиты.

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET || '';

export default async function handler(req, res) {
    try {
        if (!BOT_TOKEN) {
            return res.status(200).json({ ok: false, error: 'BOT_TOKEN is missing' });
        }

        // URL можно передать явно через query (?url=...), иначе определим из заголовков
        let url = req.query.url || '';
        if (!url) {
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const proto = req.headers['x-forwarded-proto'] || 'https';
            if (host) url = `${proto}://${host}/api/webhook`;
        }
        if (!url) {
            return res.status(200).json({ ok: false, error: 'url is required' });
        }

        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                url,
                secret_token: SECRET || undefined,
                allowed_updates: ['message', 'edited_message', 'pre_checkout_query']
            })
        });
        const json = await resp.json();
        return res.status(200).json(json);
    } catch (e) {
        return res.status(200).json({ ok: false, error: String(e) });
    }
}
