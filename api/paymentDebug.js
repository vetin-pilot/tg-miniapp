// /api/paymentDebug.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const update = req.body;
    console.log('=== Telegram Update ===');
    console.log(JSON.stringify(update, null, 2));

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
        // Подтверждаем pre_checkout_query
        if (update.pre_checkout_query) {
            await fetch(`${API}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: update.pre_checkout_query.id,
                    ok: true
                })
            });
            console.log('✅ pre_checkout_query подтвержден');
        }

        // Логируем факт успешного платежа
        if (update.message?.successful_payment) {
            console.log('💰 Платеж успешен!');
            console.log('Детали платежа:', update.message.successful_payment);
        }

        res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(200).json({ ok: true });
    }
}