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
    const [pressureMmHg, setPressureMmHg] = useState('760');
    const [xMax, setXMax] = useState(500); // дефолт 500 м

    // PBR и энергия
    const [pbrSize, setPbrSize] = useState('20');      // диаметр убойной зоны, см
    const [minEnergyJ, setMinEnergyJ] = useState('1500'); // минимальная энергия, Дж

    const [selectedCaliber, setSelectedCaliber] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');
    const [massUnit, setMassUnit] = useState('gr'); // 'gr' for grains, 'g' for grams

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
                setMassUnit('gr'); // Пресеты в гранах
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
            setMassUnit('gr'); // Пресеты в гранах
            setDiameterMm(String(preset.diameterMm));
            setG1(String(preset.G1));
            setV0(String(preset.v0));
        }
    };


    // числа
    // 1 гран = 0.00006479891 кг, 1 грамм = 0.001 кг.
    const massKg = massUnit === 'g'
        ? n(massGr, 0) * 0.001 // граммы в кг
        : n(massGr, 0) * 0.00006479891; // граны в кг
    const diameter = n(diameterMm, 0);
    const g1 = n(G1, 0.001);
    const v0n = n(v0, 0);
    const h0n = n(h0, 0) / 100; // см -> м
    const tempN = n(tempC, 15);
    const pressHpa = n(pressureMmHg, 760) * (1013.25 / 760); // мм рт. ст. -> гПа
    const zeroRange = Math.max(1, n(zeroRangeStr, 50));
    const rho = useMemo(() => airDensityFromTP(tempN, pressHpa), [tempN, pressHpa]);


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

    // поправка в см для графика
    const dataCm = useMemo(
        () => data.map(d => ({ ...d, y_cm: Math.round(d.y * 100) })),
        [data]
    );

    // сетка 50 м
    const ranges = useMemo(
        () => Array.from({ length: Math.floor(Math.max(100, xMax) / 50) }, (_, i) => (i + 1) * 50),
        [xMax]
    );
    const samples = useMemo(() => sampleHeights(data, ranges), [data, ranges]);

    // подробные значения для таблицы: энергия
    const samplesDetailed = useMemo(() => {
        return ranges.map((R) => {
            const y0 = heightAt(data, R);
            const v = valueAt(data, R, 'v');
            const energy = 0.5 * massKg * (Number.isFinite(v) ? v : 0) ** 2;
            return { distance: R, height: y0, energy };
        });
    }, [data, ranges, massKg]);

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

    // --- Платежи Stars (универсальная функция) ---
    const openInvoiceFlow = async (apiEndpoint, amount, title, description) => {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            alert('Telegram WebApp не доступен');
            return;
        }

        setPaymentLoading(true);
        setPaymentStatus('Создание invoice...');

        try {
            const initData = tg.initData || '';
            const response = await fetch(
                `${apiEndpoint}?amount=${encodeURIComponent(amount)}` +
                `&initData=${encodeURIComponent(initData)}` +
                `&title=${encodeURIComponent(title)}` + // Передаем title
                `&description=${encodeURIComponent(description)}` // Передаем description
            );
            const data = await response.json();

            if (!data.ok || !data.link) {
                throw new Error(data.error || 'Не удалось создать ссылку для оплаты');
            }

            setPaymentStatus('Открытие платежа...');

            if (tg.openInvoice) {
                tg.openInvoice(data.link, (status) => {
                    console.log('Payment status:', status);
                    setPaymentLoading(false);

                    if (status === 'paid') {
                        setPaymentStatus(`${title} успешно! ⭐`);
                        // Обновляем данные пользователя после успешной оплаты, т.к. статус подписки мог измениться
                        const currentInitData = tg.initData || '';
                        if (currentInitData) {
                            fetchEnt('initData=' + encodeURIComponent(currentInitData));
                        }
                    } else if (status === 'cancelled') {
                        setPaymentStatus('Платеж отменен');
                    } else if (status === 'failed') {
                        setPaymentStatus('Платеж не удался');
                    } else {
                        setPaymentStatus(`Статус: ${status}`);
                    }
                });
            } else if (tg.openTelegramLink) {
                tg.openTelegramLink(data.link);
                setPaymentLoading(false);
                setPaymentStatus('Ссылка открыта');
            } else {
                window.open(data.link, '_blank');
                setPaymentLoading(false);
                setPaymentStatus('Ссылка открыта');
            }

        } catch (e) {
            console.error('Payment error:', e);
            setPaymentLoading(false);
            setPaymentStatus(`Ошибка: ${e.message || e}`);
        }
    };

    // Обновленная функция для донатов
    const openDonate = (amount) => {
        openInvoiceFlow('/api/createDonateLink', amount, `Донат ${amount} ⭐`, 'Спасибо за поддержку!');
    };

    // Обновленная функция для тестовой оплаты
    const handleTestPayment = () => {
        openInvoiceFlow('/api/createTestInvoice', 1, 'Тест 1 ⭐', 'Тестовая оплата');
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

                        {/* Добавляем тестовую кнопку перед основными */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                            <button 
                                onClick={handleTestPayment} // Теперь handleTestPayment вызывает openInvoiceFlow
                                disabled={paymentLoading}
                                style={{
                                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: paymentLoading ? 'not-allowed' : 'pointer',
                                    opacity: paymentLoading ? 0.6 : 1,
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    minWidth: '80px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                {paymentLoading ? '⏳' : '🧪 1⭐'}
                            </button>
                            {paymentStatus && (
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: paymentStatus.includes('успешно') ? '#4CAF50' : 
                                                   paymentStatus.includes('отменен') || paymentStatus.includes('не удался') ? '#f44336' : 
                                                   '#2196F3',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: '500'
                                }}>
                                    {paymentStatus}
                                </span>
                            )}
                        </div>
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
                        <label>Масса ({massUnit})
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" step="0.1" value={massGr} onChange={e => setMassGr(e.target.value)} style={{ flex: 1 }} />
                                <select value={massUnit} onChange={e => setMassUnit(e.target.value)} className="input-css" style={{ width: 90 }}>
                                    <option value="gr">гран</option>
                                    <option value="g">грамм</option>
                                </select>
                            </div>
                        </label>
                        <label>Диаметр пули (мм)
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
                        <label>Давление (мм рт. ст.)
                            <input type="number" step="0.1" value={pressureMmHg} onChange={e => setPressureMmHg(e.target.value)} />
                        </label>
                        <label style={{ gridColumn: '1/-1' }}>Макс. дистанция (м): {xMax}
                            <input type="range" min={100} max={3000} step={50} value={xMax} onChange={e => setXMax(parseInt(e.target.value, 10))} />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12, fontSize: 14 }}>
                        <div><div className="muted">Дальность</div><b>{range.toFixed(1)} м</b></div>
                        <div><div className="muted">Макс. поправка</div><b>{(maxH * 100).toFixed(0)} см</b></div>
                        <div><div className="muted">Время полета на {xMax} м</div><b>{flightTime.toFixed(2)} с</b></div>
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
                    </div>
                    <div style={{ overflow: 'auto', marginTop: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Дистанция, м</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Снижение, см</th>
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