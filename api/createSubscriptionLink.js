// /api/createSubscriptionLink.js
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
    try {
        if (!BOT_TOKEN) {
            return res.status(200).json({ ok: false, error: 'BOT_TOKEN is missing' });
        }

        const priceStars = parseInt(
            process.env.PRO_PRICE_STARS || process.env.SUBSCRIPTION_PRICE || '150',
            10
        ) || 150;

        // формируем запрос на createInvoiceLink в звёздах
        const body = {
            title: 'Баллистика PRO — подписка',
            description: 'Доступ ко всем функциям. Автопродление. Отмена — в истории платежей Telegram.',
            currency: 'XTR',                 // ВАЖНО: звёзды
            prices: [{ amount: priceStars }],// ВАЖНО: количество звёзд
            payload: `sub_${Date.now()}_${priceStars}`,
            // optional:
            // photo_url: 'https://.../logo.png',
            // need_shipping_address: false,
            // is_flexible: false,
        };

        const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });
        const tgJson = await tgResp.json();

        if (!tgJson.ok) {
            return res.status(200).json({
                ok: false,
                error: tgJson.description || 'createInvoiceLink failed',
                tg_error: tgJson
            });
        }

        return res.status(200).json({ ok: true, link: tgJson.result });
    } catch (e) {
        return res.status(200).json({ ok: false, error: String(e) });
    }
}