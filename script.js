// ==========================================
// 🖼️ ПОСИЛАННЯ НА PNG ІКОНКИ (ВСТАВЛЯЙ СЮДИ)
// ==========================================
const URL_SHAHED = 'https://cdn-icons-png.flaticon.com/512/5556/5556499.png'; // БПЛА / Шахед
const URL_ROCKET = 'https://cdn-icons-png.flaticon.com/512/1048/1048966.png'; // Ракета
const URL_KAB    = 'https://cdn-icons-png.flaticon.com/512/2991/2991106.png'; // КАБ
const URL_PVO    = 'https://cdn-icons-png.flaticon.com/512/2592/2592201.png'; // ППО

// --- Web Audio API ---
let soundEnabled = true;
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

document.addEventListener('click', initAudio, { once: true });

function playInterceptSound() {
    if (!soundEnabled) return;
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
}

function playClickSound() {
    if (!soundEnabled) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
}

document.getElementById('soundToggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggle').innerText = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playClickSound();
});

// --- Карта та стан ---
let isSystemOffline = false;
const defaultCenter = [48.3794, 31.1656];
const map = L.map('map', { zoomControl: false }).setView(defaultCenter, 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

const activeMarkers = {};
const activeCircles = {};

function triggerInterceptAnimation(lat, lon) {
    playInterceptSound();

    const explosionIcon = L.divIcon({
        html: `
            <div class="intercept-explosion">
                <div class="explosion-ring"></div>
                <div class="intercept-label">🎯 СБИТ</div>
            </div>`,
        className: '',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });

    const explosionMarker = L.marker([lat, lon], { icon: explosionIcon }).addTo(map);

    setTimeout(() => {
        map.removeLayer(explosionMarker);
    }, 2600);
}

// Вибір PNG посилання за типом цілі
function getThreatIconUrl(rawType) {
    const t = String(rawType || '').toLowerCase();
    if (t.includes('ракета') || t.includes('rocket') || t.includes('missile')) return URL_ROCKET;
    if (t.includes('пво') || t.includes('pvo') || t.includes('перехват')) return URL_PVO;
    if (t.includes('каб') || t.includes('kab')) return URL_KAB;
    return URL_SHAHED;
}

// Створення маркера з PNG та поворотом за напрямком
function createUAVIcon(type, heading) {
    const iconUrl = getThreatIconUrl(type);
    const html = `
        <div class="png-marker">
            <img src="${iconUrl}" class="target-img" style="transform: rotate(${heading}deg);" alt="${type}">
        </div>`;

    return L.divIcon({
        html: html,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}

function updateCounters(counts) {
    document.getElementById('activeCount').innerText = counts.total;
    document.getElementById('shahedCount').innerText = counts.shahed;
    document.getElementById('rocketCount').innerText = counts.rocket;
    document.getElementById('kabCount').innerText = counts.kab;
    document.getElementById('pvoCount').innerText = counts.pvo;
}

function recalculateStats() {
    let total = 0, shahed = 0, rocket = 0, kab = 0, pvo = 0;
    Object.values(activeMarkers).forEach(marker => {
        total++;
        const lowerType = (marker.type || '').toLowerCase();
        if (lowerType.includes('ракета')) rocket++;
        else if (lowerType.includes('каб')) kab++;
        else if (lowerType.includes('пво')) pvo++;
        else shahed++;
    });
    updateCounters({ total, shahed, rocket, kab, pvo });
}

async function fetchUAVData() {
    if (isSystemOffline) return;

    const startTime = performance.now();
    try {
        const response = await fetch('/api/uavs');
        const endTime = performance.now();
        const ping = Math.round(endTime - startTime);
        document.getElementById('pingVal').innerText = ping + ' ms';

        if (!response.ok) throw new Error("Ошибка API");
        const result = await response.json();
        const uavs = result.data || [];
        const currentIds = new Set();

        uavs.forEach((uav, index) => {
            const id = String(uav.id || `uav_${index}`);
            currentIds.add(id);

            const newLat = parseFloat(uav.latitude);
            const newLon = parseFloat(uav.longitude);
            const heading = parseFloat(uav.heading || 0);
            const type = uav.type || 'БПЛА';
            const lowerType = type.toLowerCase();

            if (!isNaN(newLat) && !isNaN(newLon)) {
                if (activeMarkers[id]) {
                    activeMarkers[id].setLatLng([newLat, newLon]);
                    activeMarkers[id].setIcon(createUAVIcon(type, heading));
                    activeCircles[id].setLatLng([newLat, newLon]);

                    activeMarkers[id].currentLat = newLat;
                    activeMarkers[id].currentLon = newLon;
                    activeMarkers[id].heading = heading;
                } else {
                    const marker = L.marker([newLat, newLon], { icon: createUAVIcon(type, heading) }).addTo(map);

                    let circleColor = '#ef4444';
                    if (lowerType.includes('ракета')) circleColor = '#a855f7';
                    if (lowerType.includes('пво')) circleColor = '#3b82f6';
                    if (lowerType.includes('каб')) circleColor = '#f97316';

                    const circle = L.circle([newLat, newLon], {
                        radius: 5000, color: circleColor, fillColor: circleColor, fillOpacity: 0.15, weight: 1
                    }).addTo(map);

                    activeMarkers[id] = marker;
                    activeCircles[id] = circle;
                    activeMarkers[id].currentLat = newLat;
                    activeMarkers[id].currentLon = newLon;
                    activeMarkers[id].heading = heading;
                    activeMarkers[id].type = type;
                }
            }
        });

        Object.keys(activeMarkers).forEach(id => {
            if (!currentIds.has(id) && !id.startsWith('test_')) {
                triggerInterceptAnimation(activeMarkers[id].currentLat, activeMarkers[id].currentLon);
                map.removeLayer(activeMarkers[id]);
                map.removeLayer(activeCircles[id]);
                delete activeMarkers[id];
                delete activeCircles[id];
            }
        });

        recalculateStats();
        document.getElementById('networkState').innerText = 'Стабильно';
        document.getElementById('networkState').style.color = 'var(--accent-green)';
    } catch (err) {
        document.getElementById('networkState').innerText = 'Ошибка API';
        document.getElementById('networkState').style.color = 'var(--accent-red)';
    }
}

// Перемикання теми
document.getElementById('themeToggle').addEventListener('click', () => {
    playClickSound();
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggle').innerText = isDark ? '🌙' : '☀️';
});

// Центрування
document.getElementById('recenterBtn').addEventListener('click', () => {
    playClickSound();
    map.flyTo(defaultCenter, 6, { duration: 1.2 });
});

// Пошук
async function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    playClickSound();
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            map.flyTo([lat, lon], 11, { duration: 1.5 });
        } else {
            showNotice("Населенный пункт не найден");
        }
    } catch (e) {
        showNotice("Ошибка поиска");
    }
}

document.getElementById('searchBtn').addEventListener('click', handleSearch);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
});

function showNotice(text) {
    const banner = document.getElementById('notifBanner');
    document.getElementById('notifText').innerText = text;
    banner.classList.add('visible');
    setTimeout(() => {
        banner.classList.remove('visible');
    }, 4000);
}

// Адмінка
const adminModal = document.getElementById('adminModal');
document.getElementById('openAdminBtn').addEventListener('click', () => {
    playClickSound();
    adminModal.classList.add('active');
});

document.getElementById('closeAdminBtn').addEventListener('click', () => {
    playClickSound();
    adminModal.classList.remove('active');
});

document.getElementById('toggleOfflineBtn').addEventListener('click', () => {
    playClickSound();
    isSystemOffline = !isSystemOffline;
    const overlay = document.getElementById('maintenanceOverlay');
    if (isSystemOffline) {
        overlay.classList.add('active');
        document.getElementById('toggleOfflineBtn').innerText = '✅ Включить радар';
    } else {
        overlay.classList.remove('active');
        document.getElementById('toggleOfflineBtn').innerText = '🚫 Выключить радар (Оффлайн)';
    }
});

document.getElementById('clearAllTargetsBtn').addEventListener('click', () => {
    playClickSound();
    Object.keys(activeMarkers).forEach(id => {
        map.removeLayer(activeMarkers[id]);
        map.removeLayer(activeCircles[id]);
        delete activeMarkers[id];
        delete activeCircles[id];
    });
    recalculateStats();
    showNotice("Карта очищена");
});

window.spawnTestTarget = function(type) {
    playClickSound();
    const center = map.getCenter();
    const id = 'test_' + Date.now();
    const offsetLat = (Math.random() - 0.5) * 0.8;
    const offsetLon = (Math.random() - 0.5) * 0.8;
    const lat = center.lat + offsetLat;
    const lon = center.lng + offsetLon;
    const heading = Math.floor(Math.random() * 360);

    const marker = L.marker([lat, lon], { icon: createUAVIcon(type, heading) }).addTo(map);

    let circleColor = '#ef4444';
    const lowerType = type.toLowerCase();
    if (lowerType.includes('ракета')) circleColor = '#a855f7';
    if (lowerType.includes('пво')) circleColor = '#3b82f6';

    const circle = L.circle([lat, lon], {
        radius: 5000, color: circleColor, fillColor: circleColor, fillOpacity: 0.15, weight: 1
    }).addTo(map);

    activeMarkers[id] = marker;
    activeCircles[id] = circle;
    activeMarkers[id].currentLat = lat;
    activeMarkers[id].currentLon = lon;
    activeMarkers[id].heading = heading;
    activeMarkers[id].type = type;

    recalculateStats();
    showNotice(`Добавлена цель: ${type}`);
};

window.triggerTestIntercept = function() {
    playClickSound();
    const keys = Object.keys(activeMarkers);
    if (keys.length === 0) {
        showNotice("Нет активных целей для сбития");
        return;
    }
    const randomId = keys[Math.floor(Math.random() * keys.length)];
    const target = activeMarkers[randomId];

    triggerInterceptAnimation(target.currentLat, target.currentLon);
    map.removeLayer(target);
    map.removeLayer(activeCircles[randomId]);
    delete activeMarkers[randomId];
    delete activeCircles[randomId];

    recalculateStats();
};

document.getElementById('sendNoticeBtn').addEventListener('click', () => {
    const val = document.getElementById('adminNoticeInput').value.trim();
    if (val) {
        playClickSound();
        showNotice(val);
        document.getElementById('adminNoticeInput').value = '';
    }
});

setInterval(fetchUAVData, 3000);
fetchUAVData();