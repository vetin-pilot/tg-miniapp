// /api/config.js
export default function handler(req, res) {
    try {
        const price = parseInt(
            process.env.PRO_PRICE_STARS || process.env.SUBSCRIPTION_PRICE || '150',
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