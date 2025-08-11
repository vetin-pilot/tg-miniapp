// /api/createDonateLink.js
// Создание ссылки на разовый донат в Telegram Stars (XTR)

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
            console.error('ensureWebhook (donate) error:', e?.message || e);
        }

        // amount — количество звёзд (150/300/500)
        const qAmount = parseInt(req.query.amount || '0', 10);
        const allowed = [150, 300, 500];
        const amount = allowed.includes(qAmount) ? qAmount : 150;

        const body = {
            title: 'Баллистика PRO — донат',
            description: 'Спасибо за поддержку разработки! Это разовый донат в звёздах.',
            payload: `donate_${Date.now()}_${amount}`,
            currency: 'XTR', // Stars
            prices: [
                { label: `Донат ${amount} ⭐`, amount }
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