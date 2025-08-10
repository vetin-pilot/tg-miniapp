// /api/webhook.js
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PERIOD = parseInt(process.env.SUBSCRIPTION_PERIOD_SEC || '2592000', 10); // 30 дней

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(200).send('ok'); // Telegram ожидает 200
        }
        if (!BOT_TOKEN) {
            console.error('WEBHOOK: missing BOT_TOKEN');
            return res.status(200).json({ ok: true });
        }

        const update = req.body;
        console.log('WEBHOOK UPDATE:', JSON.stringify(update));

        // 1) ОБЯЗАТЕЛЬНО: ответить на pre_checkout_query — иначе «спиннер»
        if (update.pre_checkout_query) {
            const id = update.pre_checkout_query.id;
            await fetch(`${API}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ pre_checkout_query_id: id, ok: true })
            });
            console.log('answered pre_checkout_query OK');
            return res.status(200).json({ ok: true });
        }

        // 2) Успешный платёж — активируем подписку
        if (update.message?.successful_payment) {
            const m = update.message;
            const chat_id = m.chat.id;
            const user_id = String(m.from.id);
            const now = Math.floor(Date.now() / 1000);

            try {
                const { setUser } = await import('./_db.js'); // динамический импорт
                await setUser(user_id, { sub_last_paid_at: now, sub_period_sec: PERIOD });
            } catch (e) {
                console.error('setUser error:', e);
            }

            await fetch(`${API}/sendMessage`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ chat_id, text: 'Оплата получена ✅ Подписка PRO активна.' })
            });

            return res.status(200).json({ ok: true });
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('WEBHOOK error:', e);
        return res.status(200).json({ ok: true }); // всегда 200, чтобы Telegram не ретраил бесконечно
    }
}