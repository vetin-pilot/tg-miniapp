// /api/createTestInvoice.js
// Создание ссылки на тестовый платеж (унифицировано)

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
    try {
        if (!BOT_TOKEN) {
            return res.status(200).json({ ok: false, error: 'BOT_TOKEN is missing' });
        }

        // Автопостановка вебхука для текущего домена
        try {
            const { ensureWebhook } = await import('./_tg.js');
            await ensureWebhook(req);
        } catch (e) {
            console.error('ensureWebhook (test) error:', e?.message || e);
        }

        // Получаем параметры из query string, как и в createDonateLink
        const qAmount = parseInt(req.query.amount || '0', 10);
        const amount = qAmount > 0 ? qAmount : 1; // Fallback to 1 star for test
        const initData = req.query.initData || '';

        // Используем title и description из запроса, с дефолтными значениями
        const reqTitle = decodeURIComponent(req.query.title || 'Test Payment');
        const reqDescription = decodeURIComponent(req.query.description || 'Test payment for system verification.');

        // Формируем безопасный и уникальный payload
        const cleanTimestamp = Math.floor(Date.now() / 1000).toString();
        const payloadValue = `test_${amount}_${cleanTimestamp}`;

        const body = {
            title: reqTitle,
            description: reqDescription,
            payload: payloadValue,
            currency: 'XTR', // Stars
            prices: [
                { label: reqTitle, amount }
            ],
        };

        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await resp.json();

        if (!json.ok) {
            return res.status(200).json({
                ok: false,
                error: json.description || 'createInvoiceLink failed',
                tg_error: json
            });
        }

        return res.status(200).json({ ok: true, link: json.result });
    } catch (e) {
        return res.status(200).json({ ok: false, error: String(e) });
    }
}