import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const R = 287.058, g = 9.80665;
const airDensityFromTP = (tempC, pressureHpa) => (pressureHpa*100)/(R*(tempC+273.15));

// ---- helpers ----
const n = (s, fallback = 0) => {
    if (s === '' || s === null || s === undefined) return fallback;
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : fallback;
};

function simulate({ v0, angleDeg, h0, massKg, G1, diameterMm, rho, xMax, yMin = -30, dt = 0.002 }) {
    const diameterM = Math.max(0.001, diameterMm / 1000);
    const A = Math.PI * (diameterM / 2) ** 2;
    const k = Math.max(1e-6, (Math.max(0.001, G1) * A) / Math.max(0.001, massKg));

    let x = 0, y = h0, th = angleDeg * Math.PI / 180;
    let vx = v0 * Math.cos(th), vy = v0 * Math.sin(th), t = 0, maxH = y;
    const data = [];

    while (y >= yMin && x <= xMax && t < 180) {
        const v = Math.hypot(vx, vy) || 1e-12;
        const ax = -0.5 * rho * k * v * vx;
        const ay = -g - 0.5 * rho * k * v * vy;
        vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt; t += dt;
        if (y > maxH) maxH = y;
        if (t % 0.01 < dt) data.push({ t, x, y });
    }

    return { data, range: x, maxH, flightTime: t };
}

const heightAt = (data, X) => {
    if (!data.length) return NaN;
    // найти два соседних узла вокруг X и интерполировать
    let i = 0;
    while (i + 1 < data.length && data[i + 1].x < X) i++;
    const a = data[i], b = data[i + 1] || a;
    if (!a || !b) return NaN;
    if (b.x === a.x) return a.y;
    const r = (X - a.x) / (b.x - a.x);
    return a.y + r * (b.y - a.y);
};

const sampleHeights = (data, ranges) => {
    const out = []; let i = 0;
    for (const R of ranges) {
        while (i + 1 < data.length && data[i + 1].x < R) i++;
        const a = data[i], b = data[i + 1] || a;
        if (!a || !b) { out.push({ distance: R, height: NaN }); continue; }
        const r = b.x !== a.x ? (R - a.x) / (b.x - a.x) : 0;
        out.push({ distance: R, height: a.y + r * (b.y - a.y) });
    }
    return out;
};

const toCSV = (h, rows) =>
    h.join(',') + '\n' +
    rows.map(r => h.map(k => {
        const s = String(r[k] ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n') + '\n';

const dl = (name, csv) => {
    const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
};

// ---- вычисление угла по "расстоянию пристрелки" ----
function solveAngleForZero({ zeroRange, v0, h0, massKg, G1, diameterMm, rho, xMax }) {
    // Бинарный поиск угла: ищем angle, при котором высота на zeroRange равна 0.
    // Диапазон углов: от -10° до +20° (можно расширить при необходимости)
    let lo = -10, hi = 20, best = 0, found = false;

    const f = (angle) => {
        const { data } = simulate({ v0, angleDeg: angle, h0, massKg, G1, diameterMm, rho, xMax: Math.max(xMax, zeroRange + 50) });
        return heightAt(data, zeroRange); // высота на дистанции пристрелки
    };

    // Убедимся, что есть смена знака (иначе расширим границы)
    let flo = f(lo), fhi = f(hi);
    let expand = 0;
    while ((isNaN(flo) || isNaN(fhi) || flo * fhi > 0) && expand < 4) {
        lo -= 10; hi += 10;
        flo = f(lo); fhi = f(hi);
        expand++;
    }

    if (isNaN(flo) || isNaN(fhi) || flo * fhi > 0) {
        // не удалось найти корень — вернём 0° как фолбэк
        return { angleDeg: 0, ok: false };
    }

    for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        best = mid;
        if (Math.abs(fm) < 1e-4) { found = true; break; }
        if (flo * fm <= 0) { hi = mid; fhi = fm; }
        else { lo = mid; flo = fm; }
    }
    return { angleDeg: best, ok: found };
}

export default function App() {
    const [ent, setEnt] = useState({ trial_left_s: 0, sub_active: false });
    const [loadingEnt, setLoadingEnt] = useState(true);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        const applyTheme = () => {
            const p = tg?.themeParams || {}; const pick = (k, d) => (p[k] ? p[k] : d);
            document.documentElement.style.setProperty('--bg', pick('bg_color', '#0f0f0f'));
            document.documentElement.style.setProperty('--text', pick('text_color', '#ffffff'));
            document.documentElement.style.setProperty('--card', pick('secondary_bg_color', '#1c1c1c'));
            document.documentElement.style.setProperty('--border', pick('hint_color', 'rgba(255,255,255,.2)'));
            document.documentElement.style.setProperty('--button', pick('button_color', '#4F46E5'));
            document.documentElement.style.setProperty('--button-text', pick('button_text_color', '#ffffff'));
            document.documentElement.style.setProperty('--muted', pick('hint_color', 'rgba(255,255,255,.6)'));
        };
        applyTheme();

        const fetchEnt = (qs) => fetch('/api/entitlement?' + qs)
            .then(r => r.json()).then(setEnt).finally(() => setLoadingEnt(false));

        if (tg) {
            tg.ready(); tg.expand(); tg.onEvent('themeChanged', applyTheme);
            tg.BackButton.show(); tg.BackButton.onClick(() => tg.close());
            tg.MainButton.setText('Закрыть'); tg.MainButton.show(); tg.onEvent('mainButtonClicked', () => tg.close());
            const initData = tg.initData || '';
            const uid = tg.initDataUnsafe?.user?.id;
            if (initData) fetchEnt('initData=' + encodeURIComponent(initData));
            else if (uid) fetchEnt('user_id=' + encodeURIComponent(uid));
            else fetchEnt('dev=1');
        } else {
            fetchEnt('dev=1');
        }
    }, []);

    const trialLeft = useMemo(() => {
        const s = ent.trial_left_s | 0;
        const d = Math.max(0, Math.floor(s / 86400)), h = Math.max(0, Math.floor((s % 86400) / 3600));
        return `${d} д ${h} ч`;
    }, [ent.trial_left_s]);
    const canUse = ent.sub_active || ent.trial_left_s > 0;

    // ---- контролы как СТРОКИ (можно стирать нули) ----
    const [massGr, setMassGr] = useState('11.5');
    const [diameterMm, setDiameterMm] = useState('7.85');
    const [G1, setG1] = useState('0.493');
    const [v0, setV0] = useState('790');
    const [zeroRangeStr, setZeroRangeStr] = useState('50'); // ← расстояние пристрелки (м)
    const [h0, setH0] = useState('0'); // физический "рост прицела" оставим на 0 (можно сделать отдельно позже)
    const [tempC, setTempC] = useState('15');
    const [pressureHpa, setPressureHpa] = useState('1013.25');
    const [xMax, setXMax] = useState(2000);

    // числа для физики
    const massKg = n(massGr, 0) / 1000;
    const diameter = n(diameterMm, 0);
    const g1 = n(G1, 0.001);
    const v0n = n(v0, 0);
    const h0n = n(h0, 0);
    const tempN = n(tempC, 15);
    const pressN = n(pressureHpa, 1013.25);
    const zeroRange = Math.max(1, n(zeroRangeStr, 50));

    const rho = useMemo(() => airDensityFromTP(tempN, pressN), [tempN, pressN]);

    // находим угол, при котором высота на zeroRange = 0
    const angleDeg = useMemo(() => {
        const { angleDeg } = solveAngleForZero({
            zeroRange, v0: v0n, h0: h0n, massKg, G1: g1, diameterMm: diameter, rho, xMax
        });
        return angleDeg;
    }, [zeroRange, v0n, h0n, massKg, g1, diameter, rho, xMax]);

    // финальный прогон траектории с найденным углом
    const { data, range, maxH, flightTime } = useMemo(
        () => simulate({ v0: v0n, angleDeg, h0: h0n, massKg, G1: g1, diameterMm: diameter, rho, xMax }),
        [v0n, angleDeg, h0n, massKg, g1, diameter, rho, xMax]
    );

    const dataCm = useMemo(() => data.map(d => ({ ...d, y_cm: d.y * 100 })), [data]);
    const ranges = useMemo(() => Array.from({ length: Math.floor(Math.max(100, xMax) / 50) }, (_, i) => (i + 1) * 50), [xMax]);
    const samples = useMemo(() => sampleHeights(data, ranges), [data, ranges]);

    const E0J = 0.5 * massKg * v0n * v0n, E0FPE = E0J / 1.35582;

    // ---- отправка CSV в чат ----
    const sendCsvToChat = async (filename, csv) => {
        const tg = window.Telegram?.WebApp;
        const initData = tg?.initData || '';
        const r = await fetch('/api/sendCsv', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ initData, filename, csv })
        });
        const j = await r.json();
        if (!j.ok) alert(j.error || 'Не удалось отправить файл в чат');
        else alert('Файл отправлен в чат с ботом ✅');
    };

    const exportHeights = () => {
        if (!canUse) return alert('Нужна подписка. Осталось пробного времени: ' + trialLeft);
        const rows = samples.map(s => ({
            distance_m: +s.distance.toFixed(2),
            height_m: +(s.height).toFixed(4),
            height_cm: +(s.height * 100).toFixed(0)
        }));
        const csv = toCSV(['distance_m', 'height_m', 'height_cm'], rows);
        dl('heights_50m.csv', csv);
        sendCsvToChat('heights_50m.csv', csv);
    };

    const exportTrajectory = () => {
        if (!canUse) return alert('Нужна подписка. Осталось пробного времени: ' + trialLeft);
        const rows = data.map(p => ({
            t_s: +p.t.toFixed(3),
            x_m: +p.x.toFixed(3),
            y_m: +p.y.toFixed(3),
            y_cm: +(p.y * 100).toFixed(0)
        }));
        const csv = toCSV(['t_s', 'x_m', 'y_m', 'y_cm'], rows);
        dl('trajectory.csv', csv);
        sendCsvToChat('trajectory.csv', csv);
    };

    const buySubscription = async () => {
        const tg = window.Telegram?.WebApp; const initData = tg?.initData || '';
        const r = await fetch('/api/createSubscriptionLink?initData=' + encodeURIComponent(initData));
        const j = await r.json();
        if (!j.ok) return alert(j.error || 'Не удалось создать подписку');
        if (tg?.openInvoice) tg.openInvoice(j.link); else window.open(j.link, '_blank');
    };

    return (
        <div style={{ minHeight: '100vh', padding: 16 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', color: 'var(--text)' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    Траектория полёта — физическая модель{' '}
                    <span className="pill">
            {loadingEnt ? 'Проверяем доступ…' : (ent.sub_active ? 'Подписка активна' : (ent.trial_left_s > 0 ? ('Trial ' + trialLeft) : 'Нужна подписка'))}
          </span>
                </h1>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {!ent.sub_active && <button className="btn btn-primary" onClick={buySubscription}>Оформить подписку (300 ⭐ / мес)</button>}
                    <button className="btn" onClick={exportHeights}>CSV: высоты (50 м)</button>
                    <button className="btn" onClick={exportTrajectory}>CSV: траектория</button>
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <p><b>Подписка:</b> 5 дней бесплатно, затем 300 ⭐ / мес. Автопродление. Отмена — в истории платежей Telegram.</p>
                    <p><b>Поддержка:</b> @proteano</p>
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <div className="grid">
                        <label>Масса (г)
                            <input type="number" step="0.1" value={massGr} onChange={e => setMassGr(e.target.value)} />
                        </label>
                        <label>Диаметр (мм)
                            <input type="number" step="0.01" value={diameterMm} onChange={e => setDiameterMm(e.target.value)} />
                        </label>
                        <label>Коэфф. (G1)
                            <input type="number" step="0.001" value={G1} onChange={e => setG1(e.target.value)} />
                        </label>
                        <label>Начальная скорость (м/с)
                            <input type="number" step="1" value={v0} onChange={e => setV0(e.target.value)} />
                        </label>

                        <label>Расстояние пристрелки (м)
                            <input type="number" step="1" value={zeroRangeStr} onChange={e => setZeroRangeStr(e.target.value)} />
                        </label>

                        {/* оставим высоту запуска как скрытый физический параметр; пользователь им не управляет */}
                        {/* <label>Высота запуска (м)
              <input type="number" step="0.1" value={h0} onChange={e => setH0(e.target.value)} />
            </label> */}

                        <label>Температура (°C)
                            <input type="number" step="0.1" value={tempC} onChange={e => setTempC(e.target.value)} />
                        </label>
                        <label>Давление (гПа)
                            <input type="number" step="0.1" value={pressureHpa} onChange={e => setPressureHpa(e.target.value)} />
                        </label>

                        <label style={{ gridColumn: '1/-1' }}>Макс. дистанция (м): {xMax}
                            <input type="range" min={100} max={5000} step={50} value={xMax} onChange={e => setXMax(parseInt(e.target.value, 10))} />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12, fontSize: 14 }}>
                        <div><div className="muted">Дальность</div><b>{range.toFixed(1)} м</b></div>
                        <div><div className="muted">Макс. высота</div><b>{(maxH * 100).toFixed(0)} см</b></div>
                        <div><div className="muted">Время полёта</div><b>{flightTime.toFixed(2)} с</b></div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14 }} className="muted">
                        Начальная энергия: <b>{E0J.toFixed(1)}</b> Дж (<b>{E0FPE.toFixed(1)}</b> фт·фунт)
                        {' • '}Угол (рассчитан): <b>{angleDeg.toFixed(2)}°</b>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16, height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dataCm}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" type="number" domain={[0, Math.max(100, xMax)]} />
                            <YAxis
                                dataKey="y_cm"
                                type="number"
                                domain={[Math.min(...dataCm.map(d => d.y_cm), 0) - 50, Math.max(...dataCm.map(d => d.y_cm), 0) + 50]}
                            />
                            <Tooltip
                                formatter={(v) => [`${(+v).toFixed(0)} см`, 'высота']}
                                labelFormatter={(x) => `дистанция: ${(+x).toFixed(1)} м`}
                                contentStyle={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                            />
                            <ReferenceLine y={0} strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="y_cm" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}