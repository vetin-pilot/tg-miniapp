// /api/webhook.js
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PERIOD = parseInt(process.env.SUBSCRIPTION_PERIOD_SEC || '2592000', 10); // 30 дней
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''; // numeric user id (рекомендуется)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || process.env.ADMIN_USER || ''; // альтернатива: @username (для каналов гарантированно)
const SECRET = process.env.WEBHOOK_SECRET || '';

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(200).send('ok'); // Telegram ожидает 200
        }
        if (!BOT_TOKEN) {
            console.error('WEBHOOK: missing BOT_TOKEN');
            return res.status(200).json({ ok: true });
        }

        // Проверка секретного токена вебхука (если задан)
        if (SECRET) {
            const got = req.headers['x-telegram-bot-api-secret-token'];
            if (!got || got !== SECRET) {
                console.error('WEBHOOK: secret token mismatch, ignoring update');
                return res.status(200).json({ ok: true });
            }
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

        // 2) Успешный платёж — активируем подписку и уведомляем админа
        const successful = update.message?.successful_payment || update.edited_message?.successful_payment;
        if (successful) {
            const m = update.message || update.edited_message;
            const chat_id = m.chat.id;
            const user_id = String(m.from.id);
            const now = Math.floor(Date.now() / 1000);

            try {
                const { setUser } = await import('./_db.js'); // динамический импорт
                await setUser(user_id, { sub_last_paid_at: now, sub_period_sec: PERIOD });
            } catch (e) {
                console.error('setUser error:', e);
            }

            // Сообщение плательщику
            await fetch(`${API}/sendMessage`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ chat_id, text: 'Оплата получена ✅ Подписка PRO активна.' })
            });

            // Сообщение администратору (если задан ADMIN_CHAT_ID или ADMIN_USERNAME)
            try {
                if (ADMIN_CHAT_ID || ADMIN_USERNAME) {
                    const payer =
                        m.from.username ? '@' + m.from.username :
                        `${m.from.first_name || ''} ${m.from.last_name || ''}`.trim() || user_id;
                    const payload = successful.invoice_payload || '';
                    const total = successful.total_amount;
                    const currency = successful.currency;
                    const kind = payload?.startsWith('sub_')
                        ? 'Подписка'
                        : (payload?.startsWith('donate_') ? 'Донат' : 'Платёж');

                    const text = [
                        '💳 Получен платёж',
                        `Тип: ${kind}`,
                        `От: ${payer} (id ${user_id})`,
                        `Сумма: ${total} ${currency}`,
                        payload ? `Payload: ${payload}` : null,
                        successful.telegram_payment_charge_id ? `TG charge: ${successful.telegram_payment_charge_id}` : null
                    ].filter(Boolean).join('\n');

                    const adminChat = ADMIN_CHAT_ID
                        ? ADMIN_CHAT_ID
                        : (ADMIN_USERNAME.startsWith('@') ? ADMIN_USERNAME : '@' + ADMIN_USERNAME);

                    await fetch(`${API}/sendMessage`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ chat_id: adminChat, text })
                    });
                }
            } catch (e) {
                console.error('Admin notify error:', e);
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('WEBHOOK error:', e);
        return res.status(200).json({ ok: true }); // всегда 200, чтобы Telegram не ретраил бесконечно
    }
}