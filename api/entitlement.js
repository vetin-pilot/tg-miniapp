// /api/entitlement.js
import { getUser, setUser } from './_db.js';

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '5', 10);
const PERIOD = parseInt(process.env.SUBSCRIPTION_PERIOD_SEC || '2592000', 10); // 30 дней

function parseUserIdFromInitData(initData) {
    try {
        const p = new URLSearchParams(initData || '');
        const u = p.get('user');
        if (!u) return null;
        return String(JSON.parse(u).id);
    } catch { return null; }
}

export default async function handler(req, res) {
    try {
        const initData = req.query.initData || '';
        const userId = parseUserIdFromInitData(initData) || req.query.user_id || null;
        if (!userId) return res.status(200).json({ trial_left_s: 0, sub_active: false }); // dev/гость

        const now = Math.floor(Date.now() / 1000);

        let u = await getUser(userId);
        if (!u) {
            // создаём запись и стартуем триал
            const trial_started_at = now;
            const trial_expires_at = now + TRIAL_DAYS * 86400;
            u = { user_id: userId, trial_started_at, trial_expires_at, sub_last_paid_at: 0, sub_period_sec: PERIOD };
            await setUser(userId, u);
        }

        const trial_left_s = Math.max(0, (u.trial_expires_at || 0) - now);
        const sub_active = (u.sub_last_paid_at || 0) + (u.sub_period_sec || PERIOD) > now;

        return res.status(200).json({ trial_left_s, sub_active });
    } catch (e) {
        return res.status(200).json({ trial_left_s: 0, sub_active: false });
    }
}