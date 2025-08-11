import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { presets } from './presets.js';

const R = 287.058, g = 9.80665;
const airDensityFromTP = (tempC, pressureHpa) => (pressureHpa * 100) / (R * (tempC + 273.15));

// --- utils ---
const n = (s, fallback = 0) => {
    if (s === '' || s === null || s === undefined) return fallback;
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : fallback;
};

function simulate({ v0, angleDeg, h0, massKg, G1, diameterMm, rho, xMax, yMin = -30, dt = 0.002 }) {
    // ФИЗИЧЕСКИ КОРРЕКТНАЯ МОДЕЛЬ
    // 1. Переводим имперский БК (G1, в lb/in^2) в метрический (C, в kg/m^2)
    //    1 lb/in^2 = 703.07 kg/m^2
    const C_metric_bc = Math.max(0.001, G1) * 703.07;

    let x = 0, y = h0, th = angleDeg * Math.PI / 180;
    let vx = v0 * Math.cos(th), vy = v0 * Math.sin(th), t = 0, maxH = y;
    const data = [];
    while (y >= yMin && x <= xMax && t < 180) {
        const v = Math.hypot(vx, vy) || 1e-12;

        // 2. Расчёт силы сопротивления воздуха.
        //    Ускорение замедления a = (rho * v^2) / (2 * C).
        //    Оно обратно пропорционально метрическому БК, что физически верно.
        const drag_factor = -rho * v / (2 * C_metric_bc);

        const ax = drag_factor * vx;
        const ay = -g + drag_factor * vy;

        vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt; t += dt;
        if (y > maxH) maxH = y;
        // сохраняем скорость для расчёта энергии
        if (t % 0.01 < dt) data.push({ t, x, y, v });
    }
    return { data, range: x, maxH, flightTime: t };
}

const heightAt = (data, X) => {
    if (!data.length) return NaN;
    let i = 0;
    while (i + 1 < data.length && data[i + 1].x < X) i++;
    const a = data[i], b = data[i + 1] || a;
    if (!a || !b) return NaN;
    if (b.x === a.x) return a.y;
    const r = (X - a.x) / (b.x - a.x);
    return a.y + r * (b.y - a.y);
};

// универсальная интерполяция по любому ключу (t, v и т.д.)
const valueAt = (data, X, key) => {
    if (!data.length) return NaN;
    let i = 0;
    while (i + 1 < data.length && data[i + 1].x < X) i++;
    const a = data[i], b = data[i + 1] || a;
    if (!a || !b) return NaN;
    if (b.x === a.x) return a[key];
    const r = (X - a.x) / (b.x - a.x);
    return a[key] + r * (b[key] - a[key]);
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

// Направление ветра «на X часов» -> градусы (12: лобовой, 3: справа поперечный, 6: в спину, 9: слева)
const clockToAngle = (hours) => {
    const map = { 12: 0, 1: 30, 2: 60, 3: 90, 4: 120, 5: 150, 6: 180, 7: 210, 8: 240, 9: 270, 10: 300, 11: 330 };
    const h = parseInt(String(hours).replace(/\D/g, ''), 10);
    return map[h] ?? 90;
};

// Упрощённый коэффициент «аэродинамического скачка» (вертикальная компонента от поперечного ветра)
// Δy ≈ AJ_K * Vcross * t. Подобрано консервативно так, чтобы давать ощутимую поправку, но не завышать.
const AJ_K = 0.01; // м вертикали на (м/с * сек)

export default function App() {
    // оставил стейт доступа, но он больше нигде не ограничивает функционал
    const [ent, setEnt] = useState({ trial_left_s: 0, sub_active: false });
    const [loadingEnt, setLoadingEnt] = useState(true);
    const [botUsername, setBotUsername] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('');

    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        const applyTheme = () => {
            const p = tg?.themeParams || {};
            const pick = (k, d) => (p[k] ? p[k] : d);
            document.documentElement.style.setProperty('--bg', pick('bg_color', '#0f0f0f'));
            document.documentElement.style.setProperty('--text', pick('text_color', '#ffffff'));
            document.documentElement.style.setProperty('--card', pick('secondary_bg_color', '#1c1c1c'));
            document.documentElement.style.setProperty('--border', pick('hint_color', 'rgba(255,255,255,.2)'));
            document.documentElement.style.setProperty('--button', pick('button_color', '#4F46E5'));
            document.documentElement.style.setProperty('--button-text', pick('button_text_color', '#ffffff'));
            document.documentElement.style.setProperty('--muted', pick('hint_color', 'rgba(255,255,255,.6)'));
        };
        applyTheme();

        // тянем конфиг (если задан на сервере)
        fetch('/api/config')
            .then(r => r.json())
            .then(j => {
                if (j?.BOT_USERNAME) setBotUsername(j.BOT_USERNAME);
            })
            .catch(() => {});

        const fetchEnt = (qs) =>
            fetch('/api/entitlement?' + qs)
                .then(r => r.json())
                .then(setEnt)
                .finally(() => setLoadingEnt(false));

        if (tg) {
            tg.ready();
            tg.expand();
            tg.onEvent('themeChanged', applyTheme);
            tg.BackButton.show();
            tg.BackButton.onClick(() => tg.close());
            tg.MainButton.setText('Закрыть');
            tg.MainButton.show();
            tg.onEvent('mainButtonClicked', () => tg.close());

            // Обработка событий платежей
            tg.onEvent('invoiceClosed', (eventData) => {
                console.log('Invoice closed:', eventData);
                setPaymentLoading(false);

                if (eventData.status === 'paid') {
                    setPaymentStatus('Платеж успешно завершен!');
                    setEnt(prev => ({ ...prev, sub_active: true }));
                    // Обновляем данные с сервера
                    const initData = tg.initData || '';
                    if (initData) {
                        fetchEnt('initData=' + encodeURIComponent(initData));
                    }
                } else if (eventData.status === 'cancelled') {
                    setPaymentStatus('Платеж отменен');
                } else if (eventData.status === 'failed') {
                    setPaymentStatus('Платеж не удался');
                }
            });

            const initData = tg.initData || '';
            const uid = tg.initDataUnsafe?.user?.id;
            if (initData) fetchEnt('initData=' + encodeURIComponent(initData));
            else if (uid) fetchEnt('user_id=' + encodeURIComponent(uid));
            else fetchEnt('dev=1');
        } else {
            fetchEnt('dev=1');
        }
    }, []);

    // --- контролы (строки, можно стирать нули) ---
    const [massGr, setMassGr] = useState('180'); // масса в гранах по умолчанию
    const [diameterMm, setDiameterMm] = useState('7.62');
    const [G1, setG1] = useState('0.366'); // баллистический коэффициент (G1)
    const [v0, setV0] = useState('823');
    const [zeroRangeStr, setZeroRangeStr] = useState('100'); // расстояние пристрелки
    const [h0, setH0] = useState('5'); // рост прицела, см
    const [tempC, setTempC] = useState('15');
    const [pressureHpa, setPressureHpa] = useState('1013.25');
    const [xMax, setXMax] = useState(1500); // дефолт 1500 м

    // ветер, PBR и энергия
    const [windSpeed, setWindSpeed] = useState('0');   // скорость ветра
    const [windUnit, setWindUnit] = useState('ms');    // ms | mph
    const [windAngle, setWindAngle] = useState('90');  // 90° = поперечный справа
    const [pbrSize, setPbrSize] = useState('20');      // диаметр убойной зоны, см
    const [minEnergyJ, setMinEnergyJ] = useState('1500'); // минимальная энергия, Дж

    const [selectedCaliber, setSelectedCaliber] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');

    const handleCaliberChange = (e) => {
        const caliber = e.target.value;
        setSelectedCaliber(caliber);

        if (!caliber) {
            setSelectedPreset('');
            // Вернуть дефолтные значения, если калибр не выбран
            setMassGr('11.7');
            setDiameterMm('7.62');
            setG1('0.366');
            setV0('823');
        } else {
            // выбрать первый патрон по-умолчанию
            const firstPreset = presets[caliber]?.[0];
            if (firstPreset) {
                setSelectedPreset(firstPreset.name);
                setMassGr(String(firstPreset.massGr));
                setDiameterMm(String(firstPreset.diameterMm));
                setG1(String(firstPreset.G1));
                setV0(String(firstPreset.v0));
            } else {
                setSelectedPreset('');
            }
        }
    };

    const handlePresetChange = (e) => {
        const presetName = e.target.value;
        setSelectedPreset(presetName);

        const caliberPresets = presets[selectedCaliber];
        if (!caliberPresets || !presetName) return;

        const preset = caliberPresets.find(p => p.name === presetName);
        if (preset) {
            setMassGr(String(preset.massGr));
            setDiameterMm(String(preset.diameterMm));
            setG1(String(preset.G1));
            setV0(String(preset.v0));
        }
    };

    // Обработчик тестовой оплаты
    const handleTestPayment = async () => {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            alert('Telegram WebApp не доступен');
            return;
        }

        setPaymentLoading(true);
        setPaymentStatus('Инициализация платежа...');

        try {
            // Отправляем запрос на создание invoice
            const response = await fetch('/api/create-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: 1, // 1 звезда
                    description: 'Тестовый платеж - 1 звезда',
                    user_id: tg.initDataUnsafe?.user?.id
                })
            });

            const invoiceData = await response.json();

            if (invoiceData.invoice_link) {
                // Открываем invoice через Telegram
                tg.openInvoice(invoiceData.invoice_link, (status) => {
                    console.log('Payment status:', status);
                    setPaymentLoading(false);

                    if (status === 'paid') {
                        setPaymentStatus('Платеж успешно завершен! ⭐');
                        setEnt(prev => ({ ...prev, sub_active: true }));
                    } else if (status === 'cancelled') {
                        setPaymentStatus('Платеж отменен');
                    } else if (status === 'failed') {
                        setPaymentStatus('Платеж не удался');
                    }
                });
            } else {
                throw new Error('Не удалось создать invoice');
            }
        } catch (error) {
            console.error('Payment error:', error);
            setPaymentLoading(false);
            setPaymentStatus('Ошибка при инициализации платежа');
        }
    };


    // числа
    // 1 гран = 0.00006479891 кг. Это ключевое исправление.
    const massKg = n(massGr, 0) * 0.00006479891;
    const diameter = n(diameterMm, 0);
    const g1 = n(G1, 0.001);
    const v0n = n(v0, 0);
    const h0n = n(h0, 0) / 100; // см -> м
    const tempN = n(tempC, 15);
    const pressN = n(pressureHpa, 1013.25);
    const zeroRange = Math.max(1, n(zeroRangeStr, 50));
    const rho = useMemo(() => airDensityFromTP(tempN, pressN), [tempN, pressN]);

    // Поперечная составляющая ветра (м/с) — влияет на снос и вертикаль (аэродинамический скачок)
    const crossMs = useMemo(() => {
        const windMs = windUnit === 'mph' ? n(windSpeed, 0) * 0.44704 : n(windSpeed, 0);
        const angleRad = n(windAngle, 90) * Math.PI / 180;
        return windMs * Math.sin(angleRad);
    }, [windSpeed, windUnit, windAngle]);

    // подбор угла под «расстояние пристрелки»
    const solveAngleForZero = (zeroR) => {
        let lo = -10, hi = 20;
        const f = (ang) => {
            const { data } = simulate({
                v0: v0n, angleDeg: ang, h0: h0n, massKg, G1: g1, diameterMm: diameter, rho,
                xMax: Math.max(xMax, zeroR + 50)
            });
            return heightAt(data, zeroR);
        };
        let flo = f(lo), fhi = f(hi), expand = 0;
        while ((isNaN(flo) || isNaN(fhi) || flo * fhi > 0) && expand < 4) {
            lo -= 10; hi += 10; flo = f(lo); fhi = f(hi); expand++;
        }
        if (isNaN(flo) || isNaN(fhi) || flo * fhi > 0) return 0;
        let best = 0;
        for (let it = 0; it < 30; it++) {
            const mid = (lo + hi) / 2;
            const fm = f(mid);
            best = mid;
            if (!Number.isFinite(fm)) break;
            if (Math.abs(fm) < 1e-4) break;
            if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
        }
        return best;
    };

    const angleDeg = useMemo(
        () => solveAngleForZero(zeroRange),
        [zeroRange, v0n, h0n, massKg, g1, diameter, rho, xMax]
    );

    const { data, range, maxH, flightTime } = useMemo(
        () => simulate({ v0: v0n, angleDeg, h0: h0n, massKg, G1: g1, diameterMm: diameter, rho, xMax }),
        [v0n, angleDeg, h0n, massKg, g1, diameter, rho, xMax]
    );

    // поправка в см для графика (с учётом вертикальной компоненты от поперечного ветра)
    const dataCm = useMemo(
        () => data.map(d => ({ ...d, y_cm: Math.round((d.y + AJ_K * crossMs * (d.t ?? 0)) * 100) })),
        [data, crossMs]
    );

    // сетка 50 м
    const ranges = useMemo(
        () => Array.from({ length: Math.floor(Math.max(100, xMax) / 50) }, (_, i) => (i + 1) * 50),
        [xMax]
    );
    const samples = useMemo(() => sampleHeights(data, ranges), [data, ranges]);

    // подробные значения для таблицы: снос ветром и энергия
    const samplesDetailed = useMemo(() => {
        const windMs = (windUnit === 'mph' ? n(windSpeed, 0) * 0.44704 : n(windSpeed, 0));
        const angleRad = n(windAngle, 90) * Math.PI / 180;
        const cross = windMs * Math.sin(angleRad); // поперечная составляющая
        return ranges.map((R) => {
            const y0 = heightAt(data, R);
            const t = valueAt(data, R, 't');
            const v = valueAt(data, R, 'v');
            const tSafe = Number.isFinite(t) ? t : 0;
            const y = y0 + AJ_K * cross * tSafe; // вертикаль с учётом ветра
            const drift_cm = (cross * tSafe) * 100;
            const energy = 0.5 * massKg * (Number.isFinite(v) ? v : 0) ** 2;
            return { distance: R, height: y, drift_cm, energy };
        });
    }, [data, ranges, windSpeed, windUnit, windAngle, massKg]);

    // дистанция, где энергия падает ниже порога
    const energyCutX = useMemo(() => {
        const thr = n(minEnergyJ, 0);
        if (thr <= 0) return null;
        for (const s of samplesDetailed) {
            if (!Number.isFinite(s.energy)) continue;
            if (s.energy < thr) return s.distance;
        }
        return null;
    }, [samplesDetailed, minEnergyJ]);

    // дальность прямого выстрела (PBR): траектория в пределах ±(pbrSize/2) см
    const pbrFar = useMemo(() => {
        const half = n(pbrSize, 20) / 2;
        for (const d of dataCm) {
            if (d.y_cm < -half) return d.x;
        }
        return xMax;
    }, [dataCm, pbrSize, xMax]);

    // удалено дублирующее вычисление pbrFar (см. единственное объявление ниже)

    const E0J = 0.5 * massKg * v0n * v0n;
    const E0FPE = E0J / 1.35582;

    // тики X каждые 50 м (начинаем с 50)
    const xTicks = useMemo(() => {
        const max = Math.max(100, xMax);
        const out = [];
        for (let x = 50; x <= max; x += 50) out.push(x);
        return out;
    }, [xMax]);

    // --- Донаты Stars ---
    const openDonate = async (amount) => {
        try {
            const tg = window.Telegram?.WebApp;
            const initData = tg?.initData || '';
            const r = await fetch(
                '/api/createDonateLink?amount=' + encodeURIComponent(amount) +
                '&initData=' + encodeURIComponent(initData)
            );
            const j = await r.json();
            if (!j?.ok || !j.link) return alert(j?.error || 'Не удалось создать ссылку на донат');

            if (tg?.openTelegramLink) tg.openTelegramLink(j.link);
            else window.open(j.link, '_blank');
        } catch (e) {
            alert('Ошибка при создании доната: ' + (e?.message || e));
        }
    };

    return (
        <div style={{ minHeight: '100vh', padding: 16 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', color: 'var(--text)' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    Траектория полёта — физическая модель{' '}
                    <span className="pill">Полный доступ • донат по желанию</span>
                </h1>

                <div className="card" style={{ marginTop: 24, padding: '16px 16px 12px' }}>
                    <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600, opacity: 0.9 }}>Пресеты патронов</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                        <div>
                            <label htmlFor="caliber-select" className="input-label" style={{ marginBottom: 4, display: 'block' }}>Калибр</label>
                            <select id="caliber-select" value={selectedCaliber} onChange={handleCaliberChange} className="input-css">
                                <option value="">-- Ручной ввод --</option>
                                {Object.keys(presets).map(caliber => (
                                    <option key={caliber} value={caliber}>{caliber}</option>
                                ))}
                            </select>
                        </div>

                        {/* Тестовая секция оплаты */}
                        <div style={{ 
                            background: 'var(--card)', 
                            border: '1px solid var(--border)', 
                            borderRadius: 8, 
                            padding: 16, 
                            marginBottom: 16 
                        }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Тестовая оплата</h3>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <button 
                                    onClick={handleTestPayment} 
                                    disabled={paymentLoading}
                                    style={{
                                        backgroundColor: '#FFD700',
                                        color: '#000',
                                        border: 'none',
                                        padding: '10px 16px',
                                        borderRadius: '6px',
                                        cursor: paymentLoading ? 'not-allowed' : 'pointer',
                                        opacity: paymentLoading ? 0.6 : 1,
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    {paymentLoading ? '⭐ Обработка...' : '⭐ Тест (1 звезда)'}
                                </button>
                                {paymentStatus && (
                                    <div style={{
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        backgroundColor: paymentStatus.includes('успешно') ? '#4CAF50' : 
                                                       paymentStatus.includes('отменен') || paymentStatus.includes('не удался') ? '#f44336' : 
                                                       '#2196F3',
                                        color: 'white',
                                        fontSize: '12px',
                                        fontWeight: '500'
                                    }}>
                                        {paymentStatus}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="preset-select" className="input-label" style={{ marginBottom: 4, display: 'block' }}>Патрон</label>
                            <select id="preset-select" value={selectedPreset} onChange={handlePresetChange} className="input-css" disabled={!selectedCaliber}>
                                <option value="">-- Выберите --</option>
                                {selectedCaliber && presets[selectedCaliber]?.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="muted" style={{ marginRight: 8 }}>
                        Если вам понравилось приложение, можете отблагодарить автора:
                    </div>
                    <button className="btn btn-primary" onClick={() => openDonate(150)}>150 ⭐</button>
                    <button className="btn btn-primary" onClick={() => openDonate(300)}>300 ⭐</button>
                    <button className="btn btn-primary" onClick={() => openDonate(500)}>500 ⭐</button>

                    <div style={{ flex: 1 }} />

                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <p><b>Инструкция:</b> для расчёта баллистики любого патрона введите 4 параметра пули: Масса (gr, граны), Диаметр (мм), Баллистический коэффициент (G1), Начальная скорость (м/с).</p>
                    <p><b>Поддержка:</b> @proteano</p>
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <div className="grid">
                        <label>Скорость ветра
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" step="0.1" value={windSpeed} onChange={e => setWindSpeed(e.target.value)} style={{ flex: 1 }} />
                                <select value={windUnit} onChange={e => setWindUnit(e.target.value)} className="input-css" style={{ width: 90 }}>
                                    <option value="ms">м/с</option>
                                    <option value="mph">mph</option>
                                </select>
                            </div>
                        </label>
                        <label>Направление ветра (по циферблату)
                            <select
                                className="input-css"
                                onChange={e => setWindAngle(clockToAngle(e.target.value))}
                                defaultValue="3"
                            >
                                <option value="12">12 часов (лобовой)</option>
                                <option value="1">1 час</option>
                                <option value="2">2 часа</option>
                                <option value="3">3 часа (справа)</option>
                                <option value="4">4 часа</option>
                                <option value="5">5 часов</option>
                                <option value="6">6 часов (в спину)</option>
                                <option value="7">7 часов</option>
                                <option value="8">8 часов</option>
                                <option value="9">9 часов (слева)</option>
                                <option value="10">10 часов</option>
                                <option value="11">11 часов</option>
                            </select>
                            <div className="muted" style={{ marginTop: 4 }}>Текущий угол: {Math.round(n(windAngle, 90))}°</div>
                        </label>
                        <label>Размер убойной зоны (PBR), см
                            <input type="number" step="1" value={pbrSize} onChange={e => setPbrSize(e.target.value)} />
                        </label>
                        <label>Мин. энергия для дичи, Дж
                            <input type="number" step="10" value={minEnergyJ} onChange={e => setMinEnergyJ(e.target.value)} />
                        </label>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                        Дальность прямого выстрела (для цели {pbrSize} см): до {Math.round(pbrFar || 0)} м.
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <div className="grid">
                        <label>Масса, гран (gr)
                            <input type="number" step="0.1" value={massGr} onChange={e => setMassGr(e.target.value)} />
                        </label>
                        <label>Диаметр (мм)
                            <input type="number" step="0.01" value={diameterMm} onChange={e => setDiameterMm(e.target.value)} />
                        </label>
                        <label>Баллистический коэффициент (G1)
                            <input type="number" step="0.001" value={G1} onChange={e => setG1(e.target.value)} />
                        </label>
                        <label>Начальная скорость (м/с)
                            <input type="number" step="1" value={v0} onChange={e => setV0(e.target.value)} />
                        </label>
                        <label>Расстояние пристрелки (м)
                            <input type="number" step="1" value={zeroRangeStr} onChange={e => setZeroRangeStr(e.target.value)} />
                        </label>
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
                        <div><div className="muted">Макс. поправка</div><b>{(maxH * 100).toFixed(0)} см</b></div>
                        <div><div className="muted">Время полёта</div><b>{flightTime.toFixed(2)} с</b></div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14 }} className="muted">
                        Начальная энергия: <b>{E0J.toFixed(1)}</b> Дж (<b>{E0FPE.toFixed(1)}</b> фт·фунт) • Угол (рассчитан): <b>{angleDeg.toFixed(2)}°</b>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16, height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dataCm}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" type="number" domain={[0, Math.max(100, xMax)]} ticks={xTicks} />
                            <YAxis
                                dataKey="y_cm"
                                type="number"
                                allowDecimals={false}
                                tickFormatter={(v) => `${v}`}
                                domain={[
                                    Math.min(...dataCm.map(d => d.y_cm), 0) - 50,
                                    Math.max(...dataCm.map(d => d.y_cm), 0) + 50
                                ]}
                                label={{ value: 'поправка (см)', angle: -90, position: 'insideLeft', fill: 'var(--text)' }}
                            />
                            <Tooltip
                                formatter={(v) => [`${(+v).toFixed(0)} см`, 'поправка']}
                                labelFormatter={(x) => `дистанция: ${(+x).toFixed(0)} м`}
                                contentStyle={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                            />
                            <ReferenceLine y={0} strokeDasharray="3 3" />
                            {energyCutX !== null && (
                                <ReferenceLine
                                    x={energyCutX}
                                    stroke="red"
                                    strokeDasharray="4 4"
                                    label={{ value: `${minEnergyJ} Дж`, fill: 'red', position: 'insideTop' }}
                                />
                            )}
                            <Line type="monotone" dataKey="y_cm" dot={false} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                </div>

                {/* Таблица поправок с шагом 50 м (всегда показана) */}
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <h3 style={{ margin: 0 }}>Таблица поправок (шаг 50 м)</h3>
                        <div className="muted" style={{ fontSize: 12 }}>вертикаль/снос в см, энергия в Дж</div>
                    </div>
                    <div style={{ overflow: 'auto', marginTop: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Дистанция, м</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Снижение, см</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Снос ветром, см</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Энергия, Дж</th>
                            </tr>
                            </thead>
                            <tbody>
                            {samplesDetailed.map((row) => {
                                const cm = Math.round((row.height || 0) * 100);
                                return (
                                    <tr key={row.distance} style={{ color: row.energy < n(minEnergyJ, 0) ? 'red' : 'inherit' }}>
                                        <td style={{ padding: '6px' }}>{Math.round(row.distance)}</td>
                                        <td style={{ padding: '6px' }}>{cm}</td>
                                        <td style={{ padding: '6px' }}>{row.drift_cm.toFixed(1)}</td>
                                        <td style={{ padding: '6px' }}>{Math.round(row.energy)}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}