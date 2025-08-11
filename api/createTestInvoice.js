// /api/createTestInvoice.js
// Создание ссылки на тестовую оплату 1 звезды

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

        const body = {
            title: 'Тестовая оплата — 1 звезда',
            description: 'Тестовый платеж для проверки системы оплаты.',
            payload: `test_payment_${Date.now()}_1`,
            currency: 'XTR', // Stars
            prices: [
                { label: 'Тест 1 ⭐', amount: 1 }
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
// /api/createTestInvoice.js
// Создание ссылки на тестовый платеж 1 звезда в Telegram Stars (XTR)

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

        const body = {
            title: 'Test Payment - 1 Star',
            description: 'Test payment to verify the payment system functionality.',
            payload: `test_payment_${Date.now()}`,
            currency: 'XTR', // Stars
            prices: [
                { label: 'Test 1 Star', amount: 1 }
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