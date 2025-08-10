import fetch, { Blob, FormData } from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { initData, filename, csv } = req.body || {};
        if (!filename || !csv) return res.status(400).json({ ok: false, error: 'filename/csv required' });

        const BOT_TOKEN = process.env.BOT_TOKEN;
        if (!BOT_TOKEN) return res.status(500).json({ ok: false, error: 'BOT_TOKEN missing' });

        // извлекаем user_id из initData (или шлём в личку пользователю)
        let userId = null;
        try {
            const p = new URLSearchParams(initData || '');
            const u = p.get('user');
            if (u) userId = String(JSON.parse(u).id);
        } catch {}
        if (!userId) return res.status(400).json({ ok: false, error: 'no user in initData' });

        const api = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

        const form = new FormData();
        form.append('chat_id', userId);
        form.append('document', new Blob([csv], { type: 'text/csv' }), filename);
        form.append('caption', 'Файл из мини-приложения');

        const r = await fetch(api, { method: 'POST', body: form });
        const j = await r.json();
        if (!j.ok) return res.status(400).json(j);

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}