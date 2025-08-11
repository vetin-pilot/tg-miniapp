// src/presets.js
// Популярные охотничьи калибры.
// ВАЖНО: Масса пули (massGr) указана в гранах (gr), а не в граммах.
// Баллистические коэффициенты (G1/G7) являются приблизительными.

export const presets = {
    // === Малокалиберные ===
    '.17 HMR': [
        { name: '17 gr Hornady V-MAX', massGr: 17, diameterMm: 4.37, v0: 777, G1: 0.125, G7: 0.062 },
        { name: '20 gr Hornady XTP', massGr: 20, diameterMm: 4.37, v0: 724, G1: 0.130, G7: 0.065 },
    ],
    '.22 LR': [
        { name: '36 gr CPHP', massGr: 36, diameterMm: 5.69, v0: 385, G1: 0.128, G7: 0.068 },
        { name: '40 gr LRN', massGr: 40, diameterMm: 5.69, v0: 370, G1: 0.138, G7: 0.072 },
        { name: '40 gr CCI Stinger CPHP', massGr: 32, diameterMm: 5.69, v0: 500, G1: 0.105, G7: 0.055 },
    ],
    // === Винтовочные (Varmint & Small Game) ===
    '.22-250 Remington': [
        { name: '50 gr V-Max', massGr: 50, diameterMm: 5.70, v0: 1122, G1: 0.242, G7: 0.123 },
        { name: '55 gr Sierra BlitzKing', massGr: 55, diameterMm: 5.70, v0: 1120, G1: 0.271, G7: 0.138 },
    ],
    '.243 Winchester': [
        { name: '58 gr V-MAX', massGr: 58, diameterMm: 6.17, v0: 1143, G1: 0.250, G7: 0.128 },
        { name: '95 gr Nosler Ballistic Tip', massGr: 95, diameterMm: 6.17, v0: 945, G1: 0.379, G7: 0.193 },
        { name: '100 gr Core-Lokt SP', massGr: 100, diameterMm: 6.17, v0: 896, G1: 0.356, G7: 0.180 },
    ],
    // === Основные винтовочные (Medium & Big Game) ===
    '.223 Remington / 5.56x45 NATO': [
        { name: '55 gr FMJ (M193)', massGr: 55, diameterMm: 5.70, v0: 990, G1: 0.243, G7: 0.125 },
        { name: '55 gr SP', massGr: 55, diameterMm: 5.70, v0: 980, G1: 0.235, G7: 0.120 },
        { name: '62 gr FMJ (M855)', massGr: 62, diameterMm: 5.70, v0: 948, G1: 0.304, G7: 0.151 },
        { name: '69 gr Sierra MatchKing', massGr: 69, diameterMm: 5.70, v0: 899, G1: 0.301, G7: 0.154 },
        { name: '75 gr Hornady BTHP', massGr: 75, diameterMm: 5.70, v0: 838, G1: 0.395, G7: 0.205 },
        { name: '77 gr Sierra MatchKing', massGr: 77, diameterMm: 5.70, v0: 823, G1: 0.372, G7: 0.190 },
    ],
    '6.5mm Creedmoor': [
        { name: '120 gr Hornady ELD-M', massGr: 120, diameterMm: 6.71, v0: 884, G1: 0.485, G7: 0.246 },
        { name: '129 gr Hornady SST', massGr: 129, diameterMm: 6.71, v0: 860, G1: 0.485, G7: 0.248 },
        { name: '140 gr Hornady ELD-M', massGr: 140, diameterMm: 6.71, v0: 823, G1: 0.646, G7: 0.326 },
        { name: '143 gr Hornady ELD-X', massGr: 143, diameterMm: 6.71, v0: 823, G1: 0.625, G7: 0.315 },
        { name: '147 gr Hornady ELD-M', massGr: 147, diameterMm: 6.71, v0: 820, G1: 0.697, G7: 0.351 },
    ],
    '.270 Winchester': [
        { name: '130 gr SP', massGr: 130, diameterMm: 7.04, v0: 933, G1: 0.435, G7: 0.220 },
        { name: '140 gr AccuBond', massGr: 140, diameterMm: 7.04, v0: 902, G1: 0.496, G7: 0.252 },
        { name: '150 gr Partition', massGr: 150, diameterMm: 7.04, v0: 869, G1: 0.456, G7: 0.239 },
        { name: '150 gr SP', massGr: 150, diameterMm: 7.04, v0: 860, G1: 0.387, G7: 0.198 },
    ],
    '7mm Remington Magnum': [
        { name: '150 gr Core-Lokt SP', massGr: 150, diameterMm: 7.21, v0: 948, G1: 0.428, G7: 0.215 },
        { name: '160 gr Nosler Partition', massGr: 160, diameterMm: 7.21, v0: 900, G1: 0.475, G7: 0.241 },
        { name: '162 gr Hornady ELD-X', massGr: 162, diameterMm: 7.21, v0: 901, G1: 0.631, G7: 0.315 },
        { name: '175 gr Core-Lokt SP', massGr: 175, diameterMm: 7.21, v0: 872, G1: 0.422, G7: 0.212 },
    ],
    '7.62x39mm': [
        { name: '122 gr FMJ', massGr: 122, diameterMm: 7.85, v0: 715, G1: 0.285, G7: 0.145 },
        { name: '123 gr FMJ', massGr: 123, diameterMm: 7.85, v0: 738, G1: 0.295, G7: 0.150 },
        { name: '123 gr SST', massGr: 123, diameterMm: 7.85, v0: 720, G1: 0.295, G7: 0.152 },
        { name: '125 gr SP', massGr: 125, diameterMm: 7.85, v0: 715, G1: 0.270, G7: 0.140 },
    ],
    '.30-30 Winchester': [
        { name: '150 gr Round Nose', massGr: 150, diameterMm: 7.82, v0: 728, G1: 0.186, G7: 0.095 },
        { name: '170 gr Flat Nose', massGr: 170, diameterMm: 7.82, v0: 671, G1: 0.254, G7: 0.130 },
    ],
    '.308 Winchester / 7.62x51 NATO': [
        { name: '147 gr FMJ (M80)', massGr: 147, diameterMm: 7.82, v0: 850, G1: 0.398, G7: 0.200 },
        { name: '150 gr SP', massGr: 150, diameterMm: 7.82, v0: 860, G1: 0.409, G7: 0.205 },
        { name: '165 gr SP', massGr: 165, diameterMm: 7.82, v0: 823, G1: 0.435, G7: 0.220 },
        { name: '168 gr Sierra MatchKing', massGr: 168, diameterMm: 7.82, v0: 808, G1: 0.462, G7: 0.224 },
        { name: '175 gr Sierra MatchKing', massGr: 175, diameterMm: 7.82, v0: 792, G1: 0.505, G7: 0.259 },
        { name: '180 gr SP', massGr: 180, diameterMm: 7.82, v0: 799, G1: 0.483, G7: 0.245 },
    ],
    '7.62x54R': [
        { name: '148 gr FMJ', massGr: 148, diameterMm: 7.82, v0: 850, G1: 0.360, G7: 0.185 },
        { name: '174 gr FMJ', massGr: 174, diameterMm: 7.82, v0: 785, G1: 0.490, G7: 0.250 },
        { name: '182 gr FMJ', massGr: 182, diameterMm: 7.82, v0: 770, G1: 0.510, G7: 0.260 },
        { name: '203 gr SP', massGr: 203, diameterMm: 7.82, v0: 670, G1: 0.450, G7: 0.225 },
    ],
    '.30-06 Springfield': [
        { name: '150 gr SP (M2)', massGr: 150, diameterMm: 7.82, v0: 890, G1: 0.409, G7: 0.205 },
        { name: '165 gr SP', massGr: 165, diameterMm: 7.82, v0: 853, G1: 0.435, G7: 0.220 },
        { name: '180 gr SP', massGr: 180, diameterMm: 7.82, v0: 823, G1: 0.483, G7: 0.245 },
        { name: '180 gr Nosler Partition', massGr: 180, diameterMm: 7.82, v0: 823, G1: 0.474, G7: 0.240 },
        { name: '220 gr RN', massGr: 220, diameterMm: 7.82, v0: 732, G1: 0.294, G7: 0.150 },
    ],
    '.300 Blackout': [
        { name: '110 gr V-MAX (Supersonic)', massGr: 110, diameterMm: 7.82, v0: 716, G1: 0.290, G7: 0.148 },
        { name: '125 gr FMJ (Supersonic)', massGr: 125, diameterMm: 7.82, v0: 670, G1: 0.320, G7: 0.163 },
        { name: '208 gr A-MAX (Subsonic)', massGr: 208, diameterMm: 7.82, v0: 312, G1: 0.648, G7: 0.325 },
    ],
    '.300 Winchester Magnum': [
        { name: '180 gr SP', massGr: 180, diameterMm: 7.82, v0: 902, G1: 0.483, G7: 0.243 },
        { name: '190 gr Sierra MatchKing', massGr: 190, diameterMm: 7.82, v0: 869, G1: 0.533, G7: 0.273 },
        { name: '200 gr ELD-X', massGr: 200, diameterMm: 7.82, v0: 856, G1: 0.626, G7: 0.315 },
        { name: '210 gr Berger VLD', massGr: 210, diameterMm: 7.82, v0: 853, G1: 0.631, G7: 0.323 },
    ],
    '.338 Lapua Magnum': [
        { name: '250 gr Scenar', massGr: 250, diameterMm: 8.59, v0: 900, G1: 0.675, G7: 0.337 },
        { name: '285 gr Hornady BTHP', massGr: 285, diameterMm: 8.59, v0: 844, G1: 0.789, G7: 0.395 },
        { name: '300 gr Scenar', massGr: 300, diameterMm: 8.59, v0: 825, G1: 0.785, G7: 0.386 },
        { name: '300 gr Berger Hybrid', massGr: 300, diameterMm: 8.59, v0: 828, G1: 0.818, G7: 0.419 },
    ],
    '.350 Legend': [
        { name: '170 gr SP', massGr: 170, diameterMm: 9.09, v0: 670, G1: 0.281, G7: 0.143 },
        { name: '180 gr Power-Point', massGr: 180, diameterMm: 9.09, v0: 640, G1: 0.224, G7: 0.115 },
    ],
    // === Крупнокалиберные & пистолетные/карабинные ===
    '.44 Magnum (Rifle)': [
        { name: '240 gr XTP', massGr: 240, diameterMm: 10.9, v0: 533, G1: 0.205, G7: 0.105 },
        { name: '300 gr XTP', massGr: 300, diameterMm: 10.9, v0: 472, G1: 0.245, G7: 0.125 },
    ],
    '.45-70 Government': [
        { name: '325 gr FTX LEVERevolution', massGr: 325, diameterMm: 11.63, v0: 610, G1: 0.230, G7: 0.118 },
        { name: '405 gr SP', massGr: 405, diameterMm: 11.63, v0: 490, G1: 0.281, G7: 0.143 },
    ],
    // === Гладкоствольные пулевые ===
    '12 Gauge Slug': [
        { name: '1 oz (437.5 gr) Rifled Slug', massGr: 437.5, diameterMm: 18.5, v0: 488, G1: 0.100, G7: 0.052 },
        { name: '300 gr Sabot Slug', massGr: 300, diameterMm: 12.7, v0: 610, G1: 0.205, G7: 0.105 },
        { name: '385 gr Sabot Slug', massGr: 385, diameterMm: 12.7, v0: 580, G1: 0.155, G7: 0.080 },
    ],
    '20 Gauge Slug': [
        { name: '5/8 oz (273 gr) Rifled Slug', massGr: 273.4, diameterMm: 15.6, v0: 480, G1: 0.085, G7: 0.044 },
        { name: '250 gr Sabot Slug', massGr: 250, diameterMm: 11.4, v0: 564, G1: 0.190, G7: 0.098 },
    ],
};
