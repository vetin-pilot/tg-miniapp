// /api/config.js
export default async function handler(req, res) {
    try {
        // Автопостановка вебхука при первом заходе в приложение
        try {
            const { ensureWebhook } = await import('./_tg.js');
            await ensureWebhook(req);
        } catch (e) {
            console.error('ensureWebhook (config) error:', e?.message || e);
        }

        const price = parseInt(
            process.env.PRO_PRICE_STARS ||
            process.env.SUBSCRIPTION_PRICE ||
            process.env.SUBSCRIPTION_PAICE || // поддержим опечатку из окружения
            '150',
            10
        );
        const period = parseInt(
            process.env.SUBSCRIPTION_PERIOD_SEC || '2592000', // 30 дней
            10
        );

        res.status(200).json({
            ok: true,
            PRO_PRICE_STARS: Number.isFinite(price) ? price : 150,
            SUBSCRIPTION_PERIOD_SEC: Number.isFinite(period) ? period : 2592000,
            BOT_USERNAME: process.env.BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || ''
        });
    } catch (e) {
        res.status(200).json({
            ok: true,
            PRO_PRICE_STARS: 150,
            SUBSCRIPTION_PERIOD_SEC: 2592000,
            BOT_USERNAME: ''
        });
    }
}