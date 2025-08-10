import fetch, { Blob, FormData } from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { initData, userId, filename, csv } = req.body || {};
        if (!filename || !csv) return res.status(400).json({ ok: false, error: 'filename/csv required' });

        const BOT_TOKEN = process.env.BOT_TOKEN;
        if (!BOT_TOKEN) return res.status(500).json({ ok: false, error: 'BOT_TOKEN missing' });

        // извлекаем user_id
        let uid = userId ? String(userId) : null;
        if (!uid) {
            try {
                const p = new URLSearchParams(initData || '');
                const u = p.get('user'); if (u) uid = String(JSON.parse(u).id);
            } catch {}
        }
        if (!uid) return res.status(400).json({ ok: false, error: 'no user', error_code: 'NO_USER' });

        const api = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

        const form = new FormData();
        form.append('chat_id', uid);
        form.append('document', new Blob([csv], { type: 'text/csv' }), filename);
        form.append('caption', 'Файл из мини-приложения');

        const r = await fetch(api, { method: 'POST', body: form });
        const j = await r.json();

        if (!j.ok) {
            // типичные ошибки: "Forbidden: bot was blocked by the user" / "bot can't initiate conversation"
            const msg = (j.description || '').toLowerCase();
            if (msg.includes("can't initiate") || msg.includes('blocked') || j.error_code === 403) {
                return res.status(200).json({ ok: false, error_code: 'NEED_START', error: 'User must press Start' });
            }
            return res.status(400).json(j);
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}