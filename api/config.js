export default async function handler(req, res) {
    res.status(200).json({
        PRO_PRICE_STARS: process.env.PRO_PRICE_STARS || '150',
        SUBSCRIPTION_PERIOD_SEC: process.env.SUBSCRIPTION_PERIOD_SEC || '2592000'
    });
}