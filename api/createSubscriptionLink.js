// /api/createSubscriptionLink.js
// Создаёт ссылку на оплату в Telegram Stars (XTR)

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
            console.error('ensureWebhook (subscription) error:', e?.message || e);
        }

        // цена в звёздах: берём из env (PRO_PRICE_STARS приоритетнее)
        // поддерживаем SUBSCRIPTION_PAICE (опечатка), чтобы не зависеть от корректного имени
        const priceStars =
            parseInt(
                process.env.PRO_PRICE_STARS ||
                process.env.SUBSCRIPTION_PRICE ||
                process.env.SUBSCRIPTION_PAICE || // опечатка из окружения
                '150',
                10
            ) || 150;

        const body = {
            title: 'Баллистика PRO — подписка',
            description:
                'Доступ ко всем функциям на 1 месяц. Автопродление. Отмена — в истории платежей Telegram.',
            payload: `sub_${Date.now()}_${priceStars}`, // произвольная метка
            currency: 'XTR', // ВАЖНО: звёзды
            prices: [
                {
                    label: 'Подписка на 1 месяц',
                    amount: priceStars, // число звёзд
                },
            ],
            // Дополнительно можно указать:
            // photo_url: 'https://.../logo.png',
            // need_name / need_email / need_phone_number: false,
        };

        const resp = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        const json = await resp.json();

        if (!json.ok) {
            // Отдаём понятную ошибку на фронт
            return res.status(200).json({
                ok: false,
                error: json.description || 'createInvoiceLink failed',
                tg_error: json,
            });
        }

        return res.status(200).json({ ok: true, link: json.result });
    } catch (e) {
        return res.status(200).json({ ok: false, error: String(e) });
    }
}