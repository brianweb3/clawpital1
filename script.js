const h = document.querySelector('#h');
const tv = document.querySelector('.tv');
const modal = document.getElementById('projectModal');
const modalClose = document.getElementById('modalClose');

var bgMusicStarted = false;
var BG_MUSIC_START = 155;
var audioCtx = null;
var bgMusicGain = null;
function startBgMusic() {
    if (bgMusicStarted) return;
    var audio = document.getElementById('bgMusic');
    if (!audio || !audio.src) return;
    bgMusicStarted = true;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    bgMusicGain = audioCtx.createGain();
    bgMusicGain.gain.value = 0.2;
    bgMusicGain.connect(audioCtx.destination);
    fetch(audio.src)
        .then(function(r) { return r.arrayBuffer(); })
        .then(function(buf) { return audioCtx.decodeAudioData(buf); })
        .then(function(decoded) {
            var sr = decoded.sampleRate;
            var startOffset = Math.floor(BG_MUSIC_START * sr);
            var totalFrames = decoded.length - startOffset;
            if (totalFrames <= 0) return;
            var trimmed = audioCtx.createBuffer(decoded.numberOfChannels, totalFrames, sr);
            for (var ch = 0; ch < decoded.numberOfChannels; ch++) {
                var out = trimmed.getChannelData(ch);
                decoded.copyFromChannel(out, ch, startOffset);
            }
            function playLoop() {
                var src = audioCtx.createBufferSource();
                src.buffer = trimmed;
                src.connect(bgMusicGain);
                src.onended = playLoop;
                src.start(0);
            }
            playLoop();
        })
        .catch(function() { bgMusicStarted = false; });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBgMusic);
} else {
    startBgMusic();
}

const DEFAULT_ROTATION_X = 75;
const DEFAULT_ROTATION_Z = 42.5;
const DEFAULT_ZOOM = -3;
const DEFAULT_PERSPECTIVE = 66;
const DEFAULT_TRANSLATE_X = 10;
const DEFAULT_TRANSLATE_Y = 10;

const DEFAULT = {
    rotationX: 75,
    rotationZ: 42.5,
    zoom: -3,
    perspective: 66,
    translateX: 10,
    translateY: 10
};
const CUSTOM = {
    rotationX: 75,
    rotationZ: 42.5,
    zoom: -3.0,
    perspective: 66.0,
    translateX: 10.0,
    translateY: 19.5
};
const PAINTING_LEFT = {
    rotationX: 75,
    rotationZ: 40,
    zoom: -1.5,
    perspective: 62,
    translateX: 8,
    translateY: 9.5
};
const PAINTING_RIGHT = {
    rotationX: 75,
    rotationZ: 45,
    zoom: -1.5,
    perspective: 62,
    translateX: 12,
    translateY: 9.5
};
const SOFA = {
    rotationX: 74,
    rotationZ: 42.5,
    zoom: -4.5,
    perspective: 70,
    translateX: 10,
    translateY: 11.5
};
const DOOR = {
    rotationX: 75.5,
    rotationZ: 42.5,
    zoom: -1.2,
    perspective: 60,
    translateX: 7,
    translateY: 8
};

let rotationZ = CUSTOM.rotationZ;
let zoom = CUSTOM.zoom;
let perspective = CUSTOM.perspective;
let translateX = CUSTOM.translateX;
let translateY = CUSTOM.translateY;
let focusMode = 'default';
let cameraTransitioning = false;

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function transitionCamera(target, durationMs) {
    if (cameraTransitioning) return;
    durationMs = durationMs || 950;
    var start = {
        rotationZ: rotationZ,
        zoom: zoom,
        perspective: perspective,
        translateX: translateX,
        translateY: translateY
    };
    var startTime = performance.now();
    function tick(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / durationMs, 1);
        var t = easeInOutCubic(progress);
        rotationZ = lerp(start.rotationZ, target.rotationZ, t);
        zoom = lerp(start.zoom, target.zoom, t);
        perspective = lerp(start.perspective, target.perspective, t);
        translateX = lerp(start.translateX, target.translateX, t);
        translateY = lerp(start.translateY, target.translateY, t);
        updateTransform();
        if (progress < 1) {
            cameraTransitioning = true;
            requestAnimationFrame(tick);
        } else {
            cameraTransitioning = false;
            rotationZ = target.rotationZ;
            zoom = target.zoom;
            perspective = target.perspective;
            translateX = target.translateX;
            translateY = target.translateY;
            updateTransform();
        }
    }
    requestAnimationFrame(tick);
}

function updateTransform() {
    h.style.transform = [
        'perspective(' + perspective + 'vw)',
        'rotateX(' + DEFAULT_ROTATION_X + 'deg)',
        'rotateZ(' + rotationZ + 'deg)',
        'translateX(' + translateX + 'vw)',
        'translateY(' + translateY + 'vw)',
        'translateZ(' + zoom + 'vw)'
    ].join(' ');
}
updateTransform();

const tvDappOverlay = document.getElementById('tvDappOverlay');

var winTaskbar = document.getElementById('winTaskbar');
var winTaskbarList = document.getElementById('winTaskbarList');
var minimizedWindows = Object.create(null);

function getWindowContainer(winId) {
    return document.querySelector('[data-win-id="' + winId + '"]');
}

function addToTaskbar(winId, title) {
    if (winTaskbarList && !document.getElementById('win-taskbar-item-' + winId)) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'win-taskbar-item';
        btn.id = 'win-taskbar-item-' + winId;
        btn.setAttribute('data-win-id', winId);
        btn.textContent = title;
        btn.addEventListener('click', function() { restoreWindow(winId); });
        winTaskbarList.appendChild(btn);
        if (winTaskbar) winTaskbar.classList.add('has-items');
    }
}

function removeFromTaskbar(winId) {
    var el = document.getElementById('win-taskbar-item-' + winId);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (winTaskbar && winTaskbarList && !winTaskbarList.children.length) winTaskbar.classList.remove('has-items');
}

function minimizeWindow(winId) {
    var container = getWindowContainer(winId);
    if (!container || minimizedWindows[winId]) return;
    var title = (container && container.getAttribute('data-win-title')) || winId;
    minimizedWindows[winId] = true;

    if (winId === 'project') {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else if (winId === 'manifest') {
        manifestModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else if (winId === 'dapp') {
        tvDappOverlay.classList.remove('is-visible');
        document.body.classList.remove('dapp-open');
        stopDAppBehavior();
    } else if (winId === 'narratives') {
        if (narrativesOverlay) narrativesOverlay.classList.remove('is-visible');
    } else if (winId === 'agents') {
        if (agentsOverlay) agentsOverlay.classList.remove('is-visible');
    } else if (winId === 'observation') {
        if (observationOverlay) observationOverlay.classList.remove('is-visible');
        if (observationDimmer) observationDimmer.classList.remove('is-active');
        stopObservationFeed();
    } else if (winId === 'deploy') {
        if (deployOverlay) deployOverlay.classList.remove('is-visible');
        if (deployDimmer) deployDimmer.classList.remove('is-active');
        if (puertaC) puertaC.classList.remove('is-door-open');
    } else if (winId === 'docs') {
        if (docsModal) { docsModal.style.display = 'none'; document.body.classList.remove('modal-open'); }
    } else if (winId === 'trade-detail') {
        const window = document.getElementById('tradeDetailWindow');
        if (window) window.style.display = 'none';
        // Don't add to taskbar - trade-detail windows are standalone
        return;
    } else if (winId === 'narrative-detail') {
        const window = document.getElementById('narrativeDetailWindow');
        if (window) window.style.display = 'none';
        // Don't add to taskbar - narrative-detail windows are standalone
        return;
    }

    addToTaskbar(winId, title);
}

function restoreWindow(winId) {
    if (!minimizedWindows[winId]) return;
    delete minimizedWindows[winId];
    
    // Don't remove from taskbar if it's a standalone window
    if (winId !== 'trade-detail' && winId !== 'narrative-detail') {
        removeFromTaskbar(winId);
    }

    if (winId === 'project') {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    } else if (winId === 'manifest') {
        manifestModal.style.display = 'flex';
        document.body.classList.add('modal-open');
    } else if (winId === 'dapp') {
        tvDappOverlay.classList.add('is-visible');
        document.body.classList.add('dapp-open');
        startDAppBehavior();
    } else if (winId === 'narratives') {
        focusMode = 'painting_left';
        if (paintingDimmer) paintingDimmer.classList.add('is-active');
        if (cuadroL) cuadroL.classList.add('is-focused');
        if (cuadroR) cuadroR.classList.remove('is-focused');
        if (narrativesOverlay) narrativesOverlay.classList.add('is-visible');
        transitionCamera(PAINTING_LEFT, 800);
    } else if (winId === 'agents') {
        focusMode = 'painting_right';
        if (paintingDimmer) paintingDimmer.classList.add('is-active');
        if (cuadroR) cuadroR.classList.add('is-focused');
        if (cuadroL) cuadroL.classList.remove('is-focused');
        if (agentsOverlay) agentsOverlay.classList.add('is-visible');
        transitionCamera(PAINTING_RIGHT, 800);
    } else if (winId === 'observation') {
        focusMode = 'sofa';
        if (observationDimmer) observationDimmer.classList.add('is-active');
        if (observationOverlay) observationOverlay.classList.add('is-visible');
        startObservationFeed();
        transitionCamera(SOFA, 800);
    } else if (winId === 'deploy') {
        focusMode = 'door';
        if (deployDimmer) deployDimmer.classList.add('is-active');
        if (puertaC) puertaC.classList.add('is-door-open');
        if (deployOverlay) deployOverlay.classList.add('is-visible');
        transitionCamera(DOOR, 800);
    } else if (winId === 'docs') {
        if (docsModal) { docsModal.style.display = 'flex'; document.body.classList.add('modal-open'); }
    } else if (winId === 'trade-detail') {
        const window = document.getElementById('tradeDetailWindow');
        if (window) {
            window.style.display = 'flex';
            window.style.zIndex = ++windowZIndex;
        }
    } else if (winId === 'narrative-detail') {
        const window = document.getElementById('narrativeDetailWindow');
        if (window) {
            window.style.display = 'flex';
            window.style.zIndex = ++windowZIndex;
        }
    }
}

document.addEventListener('click', function(e) {
    var minBtn = e.target && e.target.closest && e.target.closest('.win-btn-min');
    if (!minBtn) return;
    var container = minBtn.closest('[data-win-id]');
    if (container) {
        e.preventDefault();
        e.stopPropagation();
        minimizeWindow(container.getAttribute('data-win-id'));
    }
});

function openDapp() {
    if (focusMode !== 'default') return;
    if (!tvDappOverlay) return;
    const feed = document.getElementById('dappFeed');
    if (feed) feed.innerHTML = '';
    tvDappOverlay.classList.add('is-visible');
    document.body.classList.add('dapp-open');
    startDAppBehavior();
}

function closeDapp() {
    if (tvDappOverlay) {
        tvDappOverlay.classList.remove('is-visible');
        document.body.classList.remove('dapp-open');
        stopDAppBehavior();
        delete minimizedWindows['dapp'];
        removeFromTaskbar('dapp');
    }
}

const FEED_TYPES = ['THOUGHT', 'SIGNAL', 'DECISION', 'EXECUTION', 'RESULT'];
const TAGS = ['defi', 'fundamentals', 'memes', 'alpha'];
const STATUSES = [
    { text: 'THINKING', class: '' },
    { text: 'SIGNAL FOUND', class: 'signal' },
    { text: 'EXECUTING', class: 'executing' },
    { text: 'COOLDOWN', class: 'cooldown' }
];
let dappIntervals = [];

function formatTime() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

var narrativeEntries = [];

function addFeedEntry(type, message, tags, narrativeData) {
    const feed = document.getElementById('dappFeed');
    if (!feed) return;
    const typeClass = type.toLowerCase().replace(/\s+/, '');
    const tagsStr = (tags && tags.length) ? tags.join(' · ') : '';
    const el = document.createElement('div');
    el.className = 'dapp-entry ' + typeClass;
    
    // If it's a narrative type, make it clickable
    const isNarrative = type === 'NARRATIVE' || (tags && tags.some(t => ['narrative', 'trend', 'theme'].includes(t.toLowerCase())));
    
    if (isNarrative && narrativeData) {
        el.style.cursor = 'pointer';
        el.classList.add('narrative-clickable');
        el.setAttribute('data-narrative-id', narrativeData.id || Date.now());
        narrativeEntries.push(narrativeData);
    }
    
    el.innerHTML = '<span class="dapp-entry-time">' + formatTime() + '</span><span class="dapp-entry-type">' + type + '</span> ' + message + (tagsStr ? '<div class="dapp-entry-tags">' + tagsStr + '</div>' : '') + (isNarrative ? '<div class="dapp-entry-click-hint">Click to expand</div>' : '');
    
    if (isNarrative) {
        el.addEventListener('click', function() {
            showNarrativeDetails(narrativeData);
        });
    }
    
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
}

function updateHeartbeat() {
    const el = document.getElementById('dappHeartbeat');
    if (el) el.textContent = 'Last: ' + formatTime();
}

function cycleStatus() {
    const statusEl = document.getElementById('dappStatus');
    if (!statusEl) return;
    const s = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    statusEl.textContent = s.text;
    statusEl.className = 'dapp-status ' + s.class;
}

function mockPositions() {
    // Positions are now dynamically updated
    renderPositions();
}

function switchDappPanel(tabKey) {
    document.querySelectorAll('.dapp-tab').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabKey);
    });
    document.querySelectorAll('.dapp-panel').forEach(function(p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === tabKey);
    });
    if (tabKey === 'narratives') fillDappNarratives();
    if (tabKey === 'polymarket') loadPolymarketEvents();
    if (tabKey === 'wallet') {
        fillDappWallet(); // Always refresh wallet balance when switching to wallet tab
    }
    if (tabKey === 'history') fillDappHistory();
}

function appendThinkLog(line, className) {
    var log = document.getElementById('dappThinkLog');
    if (!log) return;
    var p = document.createElement('div');
    p.className = 'dapp-think-line' + (className ? ' ' + className : '');
    p.textContent = '[' + formatTime() + '] ' + line;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

function renderThinkResults(resultsEl, narratives, btn) {
    if (!resultsEl) return;
    narratives.forEach(function(n) {
        var card = document.createElement('div');
        card.className = 'dapp-think-result-card';
        var name = typeof n === 'string' ? n : (n.name || n);
        var heat = n.heat != null ? n.heat : (80 + Math.floor(Math.random() * 20));
        var change = n.change != null ? n.change : (Math.random() > 0.5 ? 5 : -3);
        card.innerHTML = '<strong>' + name + '</strong><br><span class="heat">Heat: ' + heat + '</span> · ' + (change >= 0 ? '+' : '') + change + '%';
        resultsEl.appendChild(card);
    });
    if (btn) btn.disabled = false;
}

function runThinkAnalysis() {
    var log = document.getElementById('dappThinkLog');
    var results = document.getElementById('dappThinkResults');
    var btn = document.getElementById('dappThinkRun');
    if (!log || !results) return;
    log.innerHTML = '';
    results.innerHTML = '';
    if (btn) btn.disabled = true;
    var apiKey = typeof window !== 'undefined' && window.CLAUDE_API_KEY;
    appendThinkLog('Starting narrative search...', 'thinking');
    setTimeout(function() {
        appendThinkLog('Scanning markets and on-chain signals...', 'thinking');
        setTimeout(function() {
            appendThinkLog('Evaluating sentiment (X, Telegram, forums)...', 'thinking');
            setTimeout(function() {
                appendThinkLog('Ranking narratives by heat and conviction...', 'thinking');
                if (apiKey) {
                    appendThinkLog('Calling Claude for narrative analysis...', 'thinking');
                    fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true'
                        },
                        body: JSON.stringify({
                            model: 'claude-3-5-sonnet-20241022',
                            max_tokens: 300,
                            messages: [{ role: 'user', content: 'List 4-5 short crypto or DeFi narrative themes that could be trending now. Reply with one theme per line, only the theme name (e.g. "Restaking & LRT", "Pump.fun momentum"). No numbering.' }]
                        })
                    }).then(function(r) { return r.json(); }).then(function(data) {
                        appendThinkLog('Claude response received.', '');
                        var text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
                        var lines = text.split('\n').map(function(s) { return s.replace(/^\d+\.?\s*/, '').trim(); }).filter(Boolean);
                        if (lines.length) {
                            renderThinkResults(results, lines, btn);
                        } else {
                            appendThinkLog('Done.', '');
                            renderThinkResults(results, [
                                { name: 'Restaking & LRT', heat: 88, change: 12 },
                                { name: 'Pump.fun momentum', heat: 72, change: -5 },
                                { name: 'Base L2 adoption', heat: 65, change: 8 }
                            ], btn);
                        }
                    }).catch(function(err) {
                        appendThinkLog('API error, using local scoring: ' + (err.message || 'Network'), '');
                        appendThinkLog('Done.', '');
                        renderThinkResults(results, [
                            { name: 'Restaking & LRT', heat: 88, change: 12 },
                            { name: 'Pump.fun momentum', heat: 72, change: -5 },
                            { name: 'Base L2 adoption', heat: 65, change: 8 },
                            { name: 'AI agent tokens', heat: 54, change: 3 },
                            { name: 'DeFi yields rotation', heat: 48, change: -2 }
                        ], btn);
                    });
                } else {
                    appendThinkLog('Using local scoring (set CLAUDE_API_KEY in config.js for Claude).', 'thinking');
                    appendThinkLog('Done.', '');
                    renderThinkResults(results, [
                        { name: 'Restaking & LRT', heat: 88, change: 12 },
                        { name: 'Pump.fun momentum', heat: 72, change: -5 },
                        { name: 'Base L2 adoption', heat: 65, change: 8 },
                        { name: 'AI agent tokens', heat: 54, change: 3 },
                        { name: 'DeFi yields rotation', heat: 48, change: -2 }
                    ], btn);
                }
            }, 500);
        }, 500);
    }, 400);
}

var narrativesData = [];

function fillDappNarratives() {
    const listEl = document.getElementById('narrativesList');
    if (!listEl || listEl.dataset.filled) {
        renderNarrativesList();
        return;
    }
    listEl.dataset.filled = '1';
    
    narrativesData = [
        {
            id: 1,
            name: 'Restaking & LRT',
            heat: 88,
            change: 12,
            summary: 'Restaking narrative shows strong momentum with increasing TVL and positive sentiment across major protocols.',
            fullAnalysis: 'The restaking narrative has gained significant traction in Q1 2024. Liquid Restaking Tokens (LRTs) have seen TVL growth of over 300% in the past quarter. Key protocols like EigenLayer, Ether.fi, and Renzo are attracting substantial capital. The model identifies this as a high-conviction opportunity due to:\n\n1. Strong fundamentals: Ethereum staking rewards combined with additional yield from AVS (Actively Validated Services)\n2. Growing adoption: Major DeFi protocols integrating LRTs\n3. Positive funding rates: Market sentiment extremely bullish\n4. Smart money accumulation: On-chain data shows significant whale activity\n\nRisk factors: Regulatory uncertainty around restaking, potential slashing risks, and market saturation concerns.',
            factors: 'TVL growth, positive funding, institutional interest, protocol integrations'
        },
        {
            id: 2,
            name: 'Pump.fun Momentum',
            heat: 72,
            change: -5,
            summary: 'Memecoin platform showing consolidation after strong run. Model monitoring for re-entry signals.',
            fullAnalysis: 'Pump.fun has become the dominant platform for meme coin launches, processing over $2B in volume. However, recent data shows:\n\n1. Volume decline: 40% drop in daily volume over past week\n2. Sentiment shift: Social metrics showing profit-taking behavior\n3. Market saturation: Increased competition from other launchpads\n\nModel strategy: Waiting for consolidation to complete and looking for signs of renewed momentum. Key indicators to watch: volume recovery, new high-profile launches, and community engagement metrics.',
            factors: 'Volume decline, sentiment shift, profit-taking, market saturation'
        },
        {
            id: 3,
            name: 'Base L2 Adoption',
            heat: 65,
            change: 8,
            summary: 'Layer 2 solution gaining traction with increasing transaction volume and developer activity.',
            fullAnalysis: 'Base L2 has shown remarkable growth since launch, becoming the second-largest L2 by TVL. Key developments:\n\n1. Transaction growth: 150% increase in daily transactions\n2. Developer migration: Over 200 new dApps deployed\n3. Cost efficiency: 10x cheaper than mainnet\n4. Ecosystem expansion: Major protocols launching on Base\n\nModel assessment: Strong fundamentals with sustainable growth trajectory. The Coinbase backing provides additional credibility and potential for institutional adoption.',
            factors: 'Transaction growth, developer migration, cost efficiency, ecosystem expansion'
        },
        {
            id: 4,
            name: 'AI Agent Tokens',
            heat: 54,
            change: 3,
            summary: 'Emerging narrative around AI-powered trading agents and autonomous protocols.',
            fullAnalysis: 'AI agent tokens represent a new category combining AI technology with crypto. Current state:\n\n1. Early stage: Market cap still relatively small\n2. High volatility: Significant price swings on news\n3. Technical innovation: Promising use cases in DeFi automation\n4. Regulatory clarity: Still uncertain regulatory framework\n\nModel view: High risk, high reward opportunity. Monitoring for signs of mainstream adoption and regulatory clarity.',
            factors: 'Early stage, high volatility, technical innovation, regulatory uncertainty'
        },
        {
            id: 5,
            name: 'DeFi Yields Rotation',
            heat: 48,
            change: -2,
            summary: 'Yield farming strategies shifting as market conditions change.',
            fullAnalysis: 'DeFi yields have been declining as market matures. Current trends:\n\n1. Yield compression: Average yields down 30% from peak\n2. Strategy rotation: Capital moving to higher-risk, higher-reward protocols\n3. Risk management: More focus on sustainable yields vs. high APY\n\nModel strategy: Focusing on protocols with sustainable tokenomics and real yield generation.',
            factors: 'Yield compression, strategy rotation, risk management, sustainable yields'
        }
    ];
    
    renderNarrativesList();
}

function renderNarrativesList() {
    const listEl = document.getElementById('narrativesList');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    narrativesData.forEach(function(narrative) {
        const card = document.createElement('div');
        card.className = 'narrative-card-expandable';
        card.setAttribute('data-narrative-id', narrative.id);
        
        const isExpanded = card.classList.contains('expanded');
        
        card.innerHTML = '<div class="narrative-card-header">' +
            '<div class="narrative-card-title">' +
            '<h4>' + narrative.name + '</h4>' +
            '<div class="narrative-metrics">' +
            '<span class="narrative-heat">Heat: ' + narrative.heat + '</span>' +
            '<span class="narrative-change ' + (narrative.change >= 0 ? 'positive' : 'negative') + '">' + 
            (narrative.change >= 0 ? '+' : '') + narrative.change + '%</span>' +
            '</div>' +
            '</div>' +
            '<button class="narrative-expand-btn">' + (isExpanded ? '−' : '+') + '</button>' +
            '</div>' +
            '<div class="narrative-card-summary">' + narrative.summary + '</div>' +
            '<div class="narrative-card-full" style="display: ' + (isExpanded ? 'block' : 'none') + '">' +
            '<div class="narrative-full-analysis">' + narrative.fullAnalysis.split('\n').map(function(line) {
                if (line.trim() === '') return '<br>';
                if (line.match(/^\d+\./)) return '<p class="narrative-list-item">' + line + '</p>';
                return '<p>' + line + '</p>';
            }).join('') + '</div>' +
            '<div class="narrative-factors"><strong>Key factors:</strong> ' + narrative.factors + '</div>' +
            '</div>';
        
        const expandBtn = card.querySelector('.narrative-expand-btn');
        const fullSection = card.querySelector('.narrative-card-full');
        
        expandBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isExpanded = card.classList.contains('expanded');
            if (isExpanded) {
                card.classList.remove('expanded');
                fullSection.style.display = 'none';
                expandBtn.textContent = '+';
            } else {
                card.classList.add('expanded');
                fullSection.style.display = 'block';
                expandBtn.textContent = '−';
            }
        });
        
        listEl.appendChild(card);
    });
}

function fillDappWallet() {
    var el = document.getElementById('dappWalletCard');
    if (!el) return;
    // Always update with current balance
    var balance = currentBalance || totalCapital || 1000;
    el.innerHTML = '<h3>Agent wallet</h3><div class="dapp-wallet-address">0x7f3c...a9e2</div><div class="dapp-wallet-balance">' + formatBalance(balance) + ' <span class="usd">USD</span></div>';
}

function fillDappHistory() {
    // History is now dynamically updated, just render current state
    renderHistory();
}

// AI Prompt templates for continuous generation
const AI_PROMPTS = [
    'Analyze current market sentiment for ETH/USD pair',
    'Evaluate risk/reward ratio for SOL long position',
    'Check on-chain metrics for AVAX accumulation',
    'Assess funding rates across major exchanges',
    'Identify potential breakout patterns in BTC',
    'Calculate optimal position sizing for current volatility',
    'Review social sentiment trends for memecoins',
    'Analyze DEX volume trends and liquidity depth',
    'Evaluate yield opportunities in DeFi protocols',
    'Assess correlation between crypto and traditional markets',
    'Identify potential arbitrage opportunities',
    'Review recent whale movements and their impact',
    'Analyze technical indicators for trend reversal signals',
    'Evaluate market maker activity and order flow',
    'Assess regulatory news impact on market sentiment'
];

// Detailed AI reasoning templates
const AI_DETAILED_REASONING = [
    {
        setup: "I'm betting on a breakout in {ASSET}, seeing a strong setup as it holds support at ${ENTRY} and leading the market, with a target of ${TARGET} and a stop just below ${STOP}.",
        analysis: "Technical analysis shows {ASSET} has been consolidating in a tight range for the past 48 hours. The RSI is at {RSI} indicating {MOMENTUM}. Volume has increased {VOLUME}% in the last 24h, suggesting institutional accumulation. On-chain metrics show {ONCHAIN}. Funding rates are {FUNDING}, which supports a {DIRECTION} bias.",
        risk: "Risk/Reward ratio is {RISK_REWARD}:1, which is acceptable for this trade. Position size is {SIZE}% of portfolio, well within risk parameters. Stop loss is placed at ${STOP} to limit downside to {MAX_LOSS}%.",
        context: "Market structure is {MARKET_STRUCTURE}. Correlation with BTC is {CORRELATION}, and the overall crypto market is showing {MARKET_SENTIMENT} signals."
    },
    {
        setup: "Opening a {DIRECTION} position in {ASSET} at ${ENTRY}. The asset is showing {PATTERN} pattern with strong momentum. Target: ${TARGET}, Stop: ${STOP}.",
        analysis: "{ASSET} has broken above key resistance at ${RESISTANCE} with high volume confirmation. The MACD shows bullish crossover, and the asset is trading above all major moving averages. Social sentiment is {SENTIMENT} with {SOCIAL_METRICS} mentions in the last hour.",
        risk: "Position sizing: {SIZE}% of portfolio. Risk/Reward: {RISK_REWARD}:1. Maximum drawdown if stop hits: {MAX_LOSS}%. This aligns with our risk management framework.",
        context: "The broader market context: {MARKET_CONTEXT}. This trade fits into our {STRATEGY} strategy, targeting {GOAL}."
    },
    {
        setup: "Taking a {DIRECTION} position in {ASSET} as it approaches a key level at ${ENTRY}. Strong setup with {SETUP_TYPE}. Target: ${TARGET}, Stop: ${STOP}.",
        analysis: "Price action analysis: {ASSET} has formed a {PATTERN} pattern on the 4h chart. The asset is currently at {POSITION}% of its 30-day range. Order book analysis shows {ORDERBOOK}. Liquidity is concentrated at ${LIQUIDITY_LEVEL}.",
        risk: "Risk assessment: Entry at ${ENTRY} with stop at ${STOP} gives us {RISK_REWARD}:1 R/R. Position size {SIZE}% ensures we don't exceed {MAX_RISK}% portfolio risk. Monitoring for any adverse developments.",
        context: "Market environment: {ENVIRONMENT}. This trade is part of our {APPROACH} approach. Current portfolio exposure to {ASSET} is {EXPOSURE}%."
    }
];

function generateDetailedReasoning(asset, entry, target, stop, direction) {
    const template = AI_DETAILED_REASONING[Math.floor(Math.random() * AI_DETAILED_REASONING.length)];
    const entryNum = parseFloat(entry);
    const targetNum = parseFloat(target);
    const stopNum = parseFloat(stop);
    const riskReward = ((targetNum - entryNum) / (entryNum - stopNum)).toFixed(2);
    const rsi = Math.floor(Math.random() * 40 + 30);
    const momentum = rsi > 50 ? 'bullish momentum' : 'oversold conditions';
    const volume = Math.floor(Math.random() * 60 + 20);
    const funding = Math.random() > 0.5 ? 'negative' : 'positive';
    const marketStructure = ['healthy', 'consolidating', 'trending', 'volatile'][Math.floor(Math.random() * 4)];
    const correlation = (Math.random() * 0.6 + 0.2).toFixed(2);
    const sentiment = ['extremely bullish', 'bullish', 'neutral', 'cautious'][Math.floor(Math.random() * 4)];
    const pattern = ['ascending triangle', 'bull flag', 'cup and handle', 'breakout', 'consolidation'][Math.floor(Math.random() * 5)];
    const size = (Math.random() * 3 + 1).toFixed(1);
    const maxLoss = ((entryNum - stopNum) / entryNum * 100).toFixed(2);
    
    let reasoning = template.setup
        .replace(/{ASSET}/g, asset)
        .replace(/{ENTRY}/g, entry)
        .replace(/{TARGET}/g, target)
        .replace(/{STOP}/g, stop)
        .replace(/{DIRECTION}/g, direction);
    
    reasoning += '\n\n' + template.analysis
        .replace(/{ASSET}/g, asset)
        .replace(/{ENTRY}/g, entry)
        .replace(/{RSI}/g, rsi)
        .replace(/{MOMENTUM}/g, momentum)
        .replace(/{VOLUME}/g, volume)
        .replace(/{ONCHAIN}/g, 'significant accumulation by smart money')
        .replace(/{FUNDING}/g, funding)
        .replace(/{DIRECTION}/g, direction);
    
    reasoning += '\n\n' + template.risk
        .replace(/{RISK_REWARD}/g, riskReward)
        .replace(/{SIZE}/g, size)
        .replace(/{STOP}/g, stop)
        .replace(/{MAX_LOSS}/g, maxLoss);
    
    reasoning += '\n\n' + template.context
        .replace(/{MARKET_STRUCTURE}/g, marketStructure)
        .replace(/{CORRELATION}/g, correlation)
        .replace(/{MARKET_SENTIMENT}/g, sentiment)
        .replace(/{PATTERN}/g, pattern)
        .replace(/{SENTIMENT}/g, sentiment)
        .replace(/{SOCIAL_METRICS}/g, Math.floor(Math.random() * 5000 + 1000))
        .replace(/{RESISTANCE}/g, (entryNum * 0.98).toFixed(2))
        .replace(/{ORDERBOOK}/g, 'strong bid support')
        .replace(/{LIQUIDITY_LEVEL}/g, (entryNum * 0.99).toFixed(2))
        .replace(/{ENVIRONMENT}/g, marketStructure)
        .replace(/{APPROACH}/g, 'systematic trading')
        .replace(/{EXPOSURE}/g, size)
        .replace(/{SETUP_TYPE}/g, 'momentum continuation')
        .replace(/{POSITION}/g, Math.floor(Math.random() * 40 + 30))
        .replace(/{MARKET_CONTEXT}/g, 'risk-on environment')
        .replace(/{STRATEGY}/g, 'momentum')
        .replace(/{GOAL}/g, 'short-term profit capture')
        .replace(/{MAX_RISK}/g, '2');
    
    return reasoning;
}

// Trading assets and actions
const TRADING_ASSETS = ['ETH', 'SOL', 'BTC', 'AVAX', 'MATIC', 'ARB', 'OP', 'LINK', 'UNI', 'AAVE'];
const TRADING_ACTIONS = ['BUY', 'SELL'];

// Track positions and trades
var activePositions = [];
var tradeHistory = [];
var dailyPnl = 0;
var weeklyPnl = 0;
var totalTrades = 0;
var winningTrades = 0;

function getApiBase() { return (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : ''; }
function loadBalanceFromServer() {
    var base = getApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + '/api/balance').then(function(r) { return r.ok ? r.json() : null; }).then(function(data) {
        if (data && typeof data.balance === 'number') {
            currentBalance = data.balance;
            if (typeof data.initialBalance === 'number' && data.initialBalance > 0) {
                initialBalance = data.initialBalance;
            }
            if (balanceValueEl) balanceValueEl.textContent = formatBalance(currentBalance);
            updateMetrics();
            updateWalletBalance();
            return true;
        }
        return false;
    }).catch(function() { return false; });
}
function saveBalanceToServer() {
    var base = getApiBase();
    if (!base || typeof currentBalance !== 'number') return;
    fetch(base + '/api/balance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: currentBalance, initialBalance: initialBalance })
    }).catch(function() {});
}
function loadTradesFromServer() {
    var base = getApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + '/api/trades').then(function(r) { return r.ok ? r.json() : null; }).then(function(data) {
        if (data && Array.isArray(data.trades) && data.trades.length > 0) {
            tradeHistory = data.trades.slice(0, 50);
            if (data.info) {
                totalTrades = data.info.totalTrades || 0;
                winningTrades = data.info.winningTrades || 0;
            }
            return true;
        }
        return false;
    }).catch(function() { return false; });
}
function saveTradeToServer(trade) {
    var base = getApiBase();
    if (!base || !trade) return;
    fetch(base + '/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade)
    }).catch(function() {});
}

// Capital allocation tracking - starting with $1000
var capitalAllocation = {
    staking: { amount: 350, percent: 35, growth: 8.5 },
    memes: { amount: 280, percent: 28, growth: 15.2 },
    futures: { amount: 220, percent: 22, growth: -2.3 },
    polymarket: { amount: 150, percent: 15, growth: 12.7 }
};
var totalCapital = 1000; // This will be synced with currentBalance

function renderCapitalAllocation() {
    const chartEl = document.getElementById('capitalChart');
    const tableEl = document.getElementById('capitalTable');
    if (!chartEl || !tableEl) return;
    
    // Calculate percentages based on totalCapital
    const currentTotal = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    Object.keys(capitalAllocation).forEach(function(key) {
        capitalAllocation[key].percent = (capitalAllocation[key].amount / currentTotal * 100).toFixed(1);
    });
    
    // Draw pie chart
    let currentAngle = -90;
    let svg = '<svg width="200" height="200" viewBox="0 0 200 200" style="background: #fff; border: 2px solid #d0d0d0; border-radius: 2px;">';
    const colors = {
        staking: '#4CAF50',
        memes: '#FF9800',
        futures: '#5189fb',
        polymarket: '#9C27B0'
    };
    const labels = {
        staking: 'Staking',
        memes: 'Memes',
        futures: 'Futures',
        polymarket: 'Polymarket'
    };
    
    const total = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    
    Object.keys(capitalAllocation).forEach(function(key) {
        const item = capitalAllocation[key];
        const angle = (item.amount / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        
        const x1 = 100 + 80 * Math.cos(startAngle * Math.PI / 180);
        const y1 = 100 + 80 * Math.sin(startAngle * Math.PI / 180);
        const x2 = 100 + 80 * Math.cos(endAngle * Math.PI / 180);
        const y2 = 100 + 80 * Math.sin(endAngle * Math.PI / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        svg += '<path d="M 100 100 L ' + x1 + ' ' + y1 + ' A 80 80 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + colors[key] + '" stroke="#fff" stroke-width="2"/>';
        
        // Label
        const labelAngle = (startAngle + endAngle) / 2;
        const labelX = 100 + 50 * Math.cos(labelAngle * Math.PI / 180);
        const labelY = 100 + 50 * Math.sin(labelAngle * Math.PI / 180);
        svg += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="#fff">' + labels[key] + '</text>';
        
        currentAngle = endAngle;
    });
    
    svg += '</svg>';
    chartEl.innerHTML = svg;
    
    // Render table
    let tableHTML = '<table class="capital-allocation-table">' +
        '<thead><tr><th>Category</th><th>Amount</th><th>%</th><th>Growth</th></tr></thead>' +
        '<tbody>';
    
    Object.keys(capitalAllocation).forEach(function(key) {
        const item = capitalAllocation[key];
        const growthClass = item.growth >= 0 ? 'positive' : 'negative';
        const growthSign = item.growth >= 0 ? '+' : '';
        tableHTML += '<tr>' +
            '<td>' + labels[key] + '</td>' +
            '<td>$' + item.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
            '<td>' + item.percent + '%</td>' +
            '<td class="growth-' + growthClass + '">' + growthSign + item.growth.toFixed(1) + '%</td>' +
            '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    tableEl.innerHTML = tableHTML;
}

function updateCapitalAllocation() {
    // Simulate capital changes
    Object.keys(capitalAllocation).forEach(function(key) {
        const change = (Math.random() * 0.5 - 0.25);
        capitalAllocation[key].growth = Math.max(-10, Math.min(20, capitalAllocation[key].growth + change));
        
        // Update amounts based on growth
        const growthFactor = 1 + (capitalAllocation[key].growth / 100);
        capitalAllocation[key].amount = capitalAllocation[key].amount * growthFactor;
    });
    
    // Normalize to keep total matching currentBalance
    const currentTotal = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    const scaleFactor = currentBalance / currentTotal;
    Object.keys(capitalAllocation).forEach(function(key) {
        capitalAllocation[key].amount = capitalAllocation[key].amount * scaleFactor;
    });
    
    // Update totalCapital to reflect actual total (should match currentBalance)
    totalCapital = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    currentBalance = totalCapital; // Sync balance with capital allocation
    
    renderCapitalAllocation();
    updateWalletBalance(); // Update wallet display
    
    // Update balance counter display
    if (balanceValueEl) {
        balanceValueEl.textContent = formatBalance(currentBalance);
        updateMetrics(); // Update ROI and PNL
    }
}

function generateAIPrompt() {
    return AI_PROMPTS[Math.floor(Math.random() * AI_PROMPTS.length)];
}

function generateAIResponse() {
    return AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
}

function simulateTrade() {
    const asset = TRADING_ASSETS[Math.floor(Math.random() * TRADING_ASSETS.length)];
    const action = TRADING_ACTIONS[Math.floor(Math.random() * TRADING_ACTIONS.length)];
    const direction = action === 'BUY' ? 'LONG' : 'SHORT';
    const amount = (Math.random() * 100 + 0.1).toFixed(2);
    
    // Generate realistic prices based on asset
    const basePrices = {
        'BTC': 65000, 'ETH': 3400, 'SOL': 150, 'AVAX': 40, 'MATIC': 0.8,
        'ARB': 1.2, 'OP': 2.5, 'LINK': 15, 'UNI': 8, 'AAVE': 100
    };
    const basePrice = basePrices[asset] || 100;
    const entry = (basePrice * (0.95 + Math.random() * 0.1)).toFixed(2);
    const currentPrice = parseFloat(entry) * (1 + (Math.random() * 0.1 - 0.05));
    const target = (currentPrice * (1 + (Math.random() * 0.05 + 0.02))).toFixed(2);
    const stop = (parseFloat(entry) * (1 - (Math.random() * 0.03 + 0.01))).toFixed(2);
    
    const pnlPercent = ((currentPrice - parseFloat(entry)) / parseFloat(entry) * 100).toFixed(2);
    const isPositive = parseFloat(pnlPercent) > 0;
    
    // Generate detailed reasoning
    const reasoning = generateDetailedReasoning(asset, entry, target, stop, direction);
    
    const trade = {
        id: Date.now() + Math.random(),
        time: formatTime(),
        action: action,
        asset: asset,
        amount: amount,
        entry: entry,
        current: currentPrice.toFixed(2),
        target: target,
        stop: stop,
        pnl: (isPositive ? '+' : '') + pnlPercent + '%',
        pnlValue: parseFloat(pnlPercent),
        isPositive: isPositive,
        direction: direction,
        reasoning: reasoning,
        riskReward: ((parseFloat(target) - parseFloat(entry)) / (parseFloat(entry) - parseFloat(stop))).toFixed(2),
        positionSize: (Math.random() * 3 + 1).toFixed(1) + '%',
        maxLoss: ((parseFloat(entry) - parseFloat(stop)) / parseFloat(entry) * 100).toFixed(2) + '%',
        status: Math.random() > 0.3 ? 'OPEN' : 'CLOSED',
        openedAt: formatTime()
    };
    
    tradeHistory.unshift(trade);
    if (tradeHistory.length > 100) tradeHistory.pop();
    
    totalTrades++;
    if (isPositive) winningTrades++;
    
    saveTradeToServer(trade);
    
    const pnlValue = parseFloat(pnlPercent);
    dailyPnl += pnlValue;
    weeklyPnl += pnlValue;
    
    return trade;
}

function updatePositions() {
    // Randomly add or remove positions
    if (Math.random() > 0.7 && activePositions.length < 5) {
        const asset = TRADING_ASSETS[Math.floor(Math.random() * TRADING_ASSETS.length)];
        const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
        const amount = (Math.random() * 50 + 1).toFixed(2);
        const entry = (Math.random() * 5000 + 100).toFixed(2);
        const pnl = (Math.random() * 5 - 1).toFixed(1);
        const isPositive = parseFloat(pnl) > 0;
        
        activePositions.push({
            asset: asset,
            side: side,
            amount: amount,
            entry: entry,
            pnl: (isPositive ? '+' : '') + pnl + '%',
            isPositive: isPositive
        });
    } else if (Math.random() > 0.8 && activePositions.length > 0) {
        activePositions.shift();
    }
    
    // Update PNL for existing positions
    activePositions.forEach(function(pos) {
        const change = (Math.random() * 0.5 - 0.25);
        const currentPnl = parseFloat(pos.pnl.replace(/[+%]/g, ''));
        const newPnl = (currentPnl + change).toFixed(1);
        pos.pnl = (newPnl >= 0 ? '+' : '') + newPnl + '%';
        pos.isPositive = parseFloat(newPnl) > 0;
    });
}

function renderPositions() {
    const list = document.getElementById('dappPositions');
    if (!list) return;
    list.innerHTML = '';
    activePositions.forEach(function(pos) {
        const div = document.createElement('div');
        div.className = 'dapp-position';
        div.innerHTML = pos.asset + ' ' + pos.side + ' ' + pos.amount + ' · entry ' + pos.entry + 
            ' <span class="pnl ' + (pos.isPositive ? 'positive' : 'negative') + '">' + pos.pnl + '</span>';
        list.appendChild(div);
    });
}

function renderHistory() {
    const tbody = document.getElementById('dappHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    tradeHistory.slice(0, 30).forEach(function(trade) {
        // Main row
        const tr = document.createElement('tr');
        tr.className = 'trade-row';
        tr.setAttribute('data-trade-id', trade.id);
        tr.style.cursor = 'pointer';
        tr.innerHTML = '<td><span class="expand-icon">▶</span> ' + trade.time + '</td><td>' + trade.action + '</td><td>' + trade.asset + 
            '</td><td>' + trade.amount + '</td><td>$' + trade.entry + '</td><td>$' + trade.current + '</td><td class="pnl-' + (trade.isPositive ? 'positive' : 'negative') + '">' + trade.pnl + '</td>';
        
        // Detail row (initially hidden)
        const detailTr = document.createElement('tr');
        detailTr.className = 'trade-detail-row';
        detailTr.style.display = 'none';
        detailTr.setAttribute('data-trade-id', trade.id);
        
        // Format reasoning safely
        const reasoningHtml = typeof trade.reasoning === 'string' 
            ? trade.reasoning.split('\n').map(function(line) {
                return '<p>' + (line || '&nbsp;') + '</p>';
            }).join('')
            : '<p>' + (trade.reasoning || 'No reasoning available.') + '</p>';
        
        detailTr.innerHTML = '<td colspan="7" class="trade-detail-cell">' +
            '<div class="trade-detail-section">' +
            '<h4>' + trade.action + ' ' + trade.asset + ' - ' + (trade.direction || 'LONG') + '</h4>' +
            '<div class="trade-detail-grid">' +
            '<div class="trade-detail-item"><span class="label">Status:</span><span class="value ' + (trade.status === 'OPEN' ? 'status-open' : 'status-closed') + '">' + (trade.status || 'OPEN') + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Amount:</span><span class="value">' + trade.amount + ' ' + trade.asset + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Entry Price:</span><span class="value">$' + trade.entry + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Current Price:</span><span class="value">$' + trade.current + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Target:</span><span class="value">$' + trade.target + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Stop Loss:</span><span class="value">$' + trade.stop + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">P&L:</span><span class="value pnl-' + (trade.isPositive ? 'positive' : 'negative') + '">' + trade.pnl + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Risk/Reward:</span><span class="value">' + (trade.riskReward || '0') + ':1</span></div>' +
            '<div class="trade-detail-item"><span class="label">Position Size:</span><span class="value">' + (trade.positionSize || '0%') + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Max Loss:</span><span class="value">' + (trade.maxLoss || '0%') + '</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="trade-detail-section">' +
            '<h4>AI Reasoning & Analysis</h4>' +
            '<div class="trade-reasoning">' + reasoningHtml + '</div>' +
            '</div>' +
            '</td>';
        
        // Toggle detail row on click
        tr.addEventListener('click', function(e) {
            e.stopPropagation();
            const isExpanded = detailTr.style.display !== 'none';
            // Close all other expanded rows
            const allDetailRows = tbody.querySelectorAll('.trade-detail-row');
            allDetailRows.forEach(function(row) {
                if (row !== detailTr) {
                    row.style.display = 'none';
                    const mainRow = tbody.querySelector('[data-trade-id="' + row.getAttribute('data-trade-id') + '"]:not(.trade-detail-row)');
                    if (mainRow) {
                        mainRow.classList.remove('expanded');
                        const icon = mainRow.querySelector('.expand-icon');
                        if (icon) icon.textContent = '▶';
                    }
                }
            });
            // Toggle current row
            const expandIcon = tr.querySelector('.expand-icon');
            if (isExpanded) {
                detailTr.style.display = 'none';
                tr.classList.remove('expanded');
                if (expandIcon) expandIcon.textContent = '▶';
            } else {
                detailTr.style.display = 'table-row';
                tr.classList.add('expanded');
                if (expandIcon) expandIcon.textContent = '▼';
            }
        });
        
        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
    });
}

// Window management for draggable/resizable windows
var windowZIndex = 10020;
var draggingWindow = null;
var resizingWindow = null;
var dragOffset = { x: 0, y: 0 };

function makeWindowDraggable(windowEl) {
    if (!windowEl) return;
    const titlebar = windowEl.querySelector('.win-titlebar');
    if (!titlebar) return;
    
    // Remove existing listeners to avoid duplicates
    const newTitlebar = titlebar.cloneNode(true);
    titlebar.parentNode.replaceChild(newTitlebar, titlebar);
    
    newTitlebar.style.cursor = 'move';
    newTitlebar.addEventListener('mousedown', function(e) {
        if (e.target.closest('.win-titlebar-btns')) return;
        draggingWindow = windowEl;
        const rect = windowEl.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        windowEl.style.zIndex = ++windowZIndex;
        e.preventDefault();
        e.stopPropagation();
    });
}

function makeWindowResizable(windowEl) {
    if (!windowEl) return;
    
    // Remove existing resize handle if any
    const existingHandle = windowEl.querySelector('.win-resize-handle');
    if (existingHandle) existingHandle.remove();
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'win-resize-handle';
    resizeHandle.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; z-index: 10; background: transparent;';
    windowEl.style.position = 'relative';
    windowEl.appendChild(resizeHandle);
    
    resizeHandle.addEventListener('mousedown', function(e) {
        resizingWindow = windowEl;
        e.stopPropagation();
        e.preventDefault();
    });
}

document.addEventListener('mousemove', function(e) {
    try {
        if (draggingWindow && draggingWindow.parentNode) {
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            draggingWindow.style.left = Math.max(0, Math.min(x, window.innerWidth - 100)) + 'px';
            draggingWindow.style.top = Math.max(0, Math.min(y, window.innerHeight - 100)) + 'px';
            draggingWindow.style.transform = 'none';
        }
        
        if (resizingWindow && resizingWindow.parentNode) {
            const rect = resizingWindow.getBoundingClientRect();
            const newWidth = Math.max(400, Math.min(e.clientX - rect.left, window.innerWidth - rect.left));
            const newHeight = Math.max(300, Math.min(e.clientY - rect.top, window.innerHeight - rect.top));
            resizingWindow.style.width = newWidth + 'px';
            resizingWindow.style.height = newHeight + 'px';
        }
    } catch (err) {
        console.error('Window drag/resize error:', err);
        draggingWindow = null;
        resizingWindow = null;
    }
});

document.addEventListener('mouseup', function() {
    draggingWindow = null;
    resizingWindow = null;
});

function showTradeDetails(trade) {
    try {
        const windowEl = document.getElementById('tradeDetailWindow');
        const body = document.getElementById('tradeDetailBody');
        if (!windowEl || !body || !trade) {
            console.error('Missing elements or trade data:', { windowEl: !!windowEl, body: !!body, trade: !!trade });
            return;
        }
        
        // Ensure trade has all required fields with defaults
        const safeTrade = {
            action: trade.action || 'TRADE',
            asset: trade.asset || 'N/A',
            direction: trade.direction || 'LONG',
            time: trade.time || 'N/A',
            status: trade.status || 'OPEN',
            amount: trade.amount || '0',
            entry: trade.entry || '0',
            current: trade.current || trade.entry || '0',
            target: trade.target || '0',
            stop: trade.stop || '0',
            pnl: trade.pnl || '0%',
            isPositive: trade.isPositive !== undefined ? trade.isPositive : true,
            riskReward: trade.riskReward || '0',
            positionSize: trade.positionSize || '0%',
            maxLoss: trade.maxLoss || '0%',
            reasoning: trade.reasoning || 'No reasoning available.'
        };
        
        // Format reasoning safely
        const reasoningHtml = typeof safeTrade.reasoning === 'string' 
            ? safeTrade.reasoning.split('\n').map(function(line) {
                return '<p>' + (line || '&nbsp;') + '</p>';
            }).join('')
            : '<p>' + safeTrade.reasoning + '</p>';
        
        body.innerHTML = '<div class="trade-detail-section">' +
            '<h3>' + safeTrade.action + ' ' + safeTrade.asset + ' - ' + safeTrade.direction + '</h3>' +
            '<div class="trade-detail-grid">' +
            '<div class="trade-detail-item"><span class="label">Time:</span><span class="value">' + safeTrade.time + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Status:</span><span class="value ' + (safeTrade.status === 'OPEN' ? 'status-open' : 'status-closed') + '">' + safeTrade.status + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Amount:</span><span class="value">' + safeTrade.amount + ' ' + safeTrade.asset + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Entry Price:</span><span class="value">$' + safeTrade.entry + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Current Price:</span><span class="value">$' + safeTrade.current + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Target:</span><span class="value">$' + safeTrade.target + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Stop Loss:</span><span class="value">$' + safeTrade.stop + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">P&L:</span><span class="value pnl-' + (safeTrade.isPositive ? 'positive' : 'negative') + '">' + safeTrade.pnl + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Risk/Reward:</span><span class="value">' + safeTrade.riskReward + ':1</span></div>' +
            '<div class="trade-detail-item"><span class="label">Position Size:</span><span class="value">' + safeTrade.positionSize + '</span></div>' +
            '<div class="trade-detail-item"><span class="label">Max Loss:</span><span class="value">' + safeTrade.maxLoss + '</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="trade-detail-section">' +
            '<h4>AI Reasoning & Analysis</h4>' +
            '<div class="trade-reasoning">' + reasoningHtml + '</div>' +
            '</div>';
        
        // Show as window
        windowEl.style.display = 'flex';
        windowEl.style.flexDirection = 'column';
        windowEl.style.position = 'fixed';
        windowEl.style.left = '50%';
        windowEl.style.top = '50%';
        windowEl.style.transform = 'translate(-50%, -50%)';
        windowEl.style.width = '700px';
        windowEl.style.height = '600px';
        windowEl.style.maxWidth = '90vw';
        windowEl.style.maxHeight = '85vh';
        windowEl.style.zIndex = ++windowZIndex;
        
        // Reset window state if it was maximized
        if (windowStates['trade-detail'] && windowStates['trade-detail'].maximized) {
            windowStates['trade-detail'].maximized = false;
            windowEl.classList.remove('maximized');
        }
        
        // Setup window controls
        setTimeout(function() {
            try {
                makeWindowDraggable(windowEl);
                makeWindowResizable(windowEl);
                setupWindowControls(windowEl, 'trade-detail');
            } catch (err) {
                console.error('Error setting up window controls:', err);
            }
        }, 10);
        
        // Don't add to taskbar - this is a standalone window
    } catch (error) {
        console.error('Error showing trade details:', error);
        alert('Error opening trade details. Please try again.');
    }
}

function setupWindowControls(windowEl, winId) {
    if (!windowEl) return;
    
    const minBtn = windowEl.querySelector('.win-btn-min');
    const maxBtn = windowEl.querySelector('.win-btn-max');
    const closeBtn = windowEl.querySelector('.win-btn-close');
    
    if (minBtn) {
        minBtn.onclick = function(e) {
            e.stopPropagation();
            minimizeWindow(winId);
        };
    }
    
    if (maxBtn) {
        maxBtn.onclick = function(e) {
            e.stopPropagation();
            maximizeWindow(windowEl);
        };
    }
    
    if (closeBtn) {
        closeBtn.onclick = function(e) {
            e.stopPropagation();
            if (winId === 'trade-detail') closeTradeDetails();
            else if (winId === 'narrative-detail') closeNarrativeDetails();
        };
    }
}

function closeTradeDetails() {
    try {
        const window = document.getElementById('tradeDetailWindow');
        if (window) {
            window.style.display = 'none';
            // Don't remove from taskbar - it was never added
            delete windowStates['trade-detail'];
            // Reset any dragging/resizing state
            if (draggingWindow === window) draggingWindow = null;
            if (resizingWindow === window) resizingWindow = null;
        }
    } catch (error) {
        console.error('Error closing trade details:', error);
    }
}

function showNarrativeDetails(narrative) {
    const windowEl = document.getElementById('narrativeDetailWindow');
    const body = document.getElementById('narrativeDetailBody');
    if (!windowEl || !body) return;
    
    // Generate chart data
    const chartData = [];
    for (let i = 0; i < 30; i++) {
        chartData.push({
            day: i + 1,
            value: narrative.heat + (Math.random() * 20 - 10)
        });
    }
    
    body.innerHTML = '<div class="narrative-detail-section">' +
        '<h3>' + narrative.name + '</h3>' +
        '<div class="narrative-stats-grid">' +
        '<div class="narrative-stat"><span class="label">Heat Score</span><span class="value">' + narrative.heat + '</span></div>' +
        '<div class="narrative-stat"><span class="label">Change (24h)</span><span class="value ' + (narrative.change >= 0 ? 'positive' : 'negative') + '">' + (narrative.change >= 0 ? '+' : '') + narrative.change + '%</span></div>' +
        '<div class="narrative-stat"><span class="label">Volume</span><span class="value">$' + (Math.random() * 50 + 10).toFixed(1) + 'M</span></div>' +
        '<div class="narrative-stat"><span class="label">Mentions</span><span class="value">' + Math.floor(Math.random() * 5000 + 1000) + '</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="narrative-detail-section">' +
        '<h4>Price Chart</h4>' +
        '<div class="narrative-chart" id="narrativeChart"></div>' +
        '</div>' +
        '<div class="narrative-detail-section">' +
        '<h4>Model Reasoning</h4>' +
        '<div class="narrative-reasoning">' +
        '<p>' + (narrative.reasoning || 'This narrative shows strong momentum based on on-chain metrics, social sentiment, and technical analysis. The model identified this as a high-conviction opportunity with favorable risk/reward characteristics.') + '</p>' +
        '<p>Key factors: ' + (narrative.factors || 'Volume increase, positive funding rates, smart money accumulation, social sentiment shift') + '</p>' +
        '</div>' +
        '</div>';
    
    // Draw simple chart
    setTimeout(function() {
        drawNarrativeChart(chartData);
    }, 100);
    
    // Show as window
    windowEl.style.display = 'flex';
    windowEl.style.flexDirection = 'column';
    windowEl.style.position = 'fixed';
    windowEl.style.left = '50%';
    windowEl.style.top = '50%';
    windowEl.style.transform = 'translate(-50%, -50%)';
    windowEl.style.width = '800px';
    windowEl.style.height = '650px';
    windowEl.style.maxWidth = '90vw';
    windowEl.style.maxHeight = '85vh';
    windowEl.style.zIndex = ++windowZIndex;
    
    // Setup window controls
    setTimeout(function() {
        makeWindowDraggable(windowEl);
        makeWindowResizable(windowEl);
        setupWindowControls(windowEl, 'narrative-detail');
    }, 10);
    
    // Don't add to taskbar - this is a standalone window
}

function closeNarrativeDetails() {
    const window = document.getElementById('narrativeDetailWindow');
    if (window) {
        window.style.display = 'none';
        // Don't remove from taskbar - it was never added
        delete windowStates['narrative-detail'];
    }
}

function drawNarrativeChart(data) {
    const chartEl = document.getElementById('narrativeChart');
    if (!chartEl) return;
    
    const width = chartEl.offsetWidth || 700;
    const height = 200;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    
    let svg = '<svg width="' + width + '" height="' + height + '" style="background: #fff; border: 2px solid #d0d0d0; border-radius: 2px;">';
    
    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (width - padding) + '" y2="' + y + '" stroke="#e0e0e0" stroke-width="1"/>';
    }
    
    // Draw line
    let path = 'M';
    data.forEach(function(d, i) {
        const x = padding + (chartWidth / (data.length - 1)) * i;
        const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
        path += (i === 0 ? '' : ' L') + x + ',' + y;
    });
    svg += '<path d="' + path + '" fill="none" stroke="#5189fb" stroke-width="2"/>';
    
    // Draw points
    data.forEach(function(d, i) {
        const x = padding + (chartWidth / (data.length - 1)) * i;
        const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
        svg += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#5189fb"/>';
    });
    
    svg += '</svg>';
    chartEl.innerHTML = svg;
}

function updateMetrics() {
    const dailyPnlEl = document.getElementById('metricDailyPnl');
    const weeklyPnlEl = document.getElementById('metricWeeklyPnl');
    const winrateEl = document.getElementById('metricWinrate');
    const drawdownEl = document.getElementById('metricDrawdown');
    
    if (dailyPnlEl) {
        const sign = dailyPnl >= 0 ? '+' : '';
        dailyPnlEl.textContent = sign + dailyPnl.toFixed(2);
        dailyPnlEl.className = 'dapp-metric-value ' + (dailyPnl >= 0 ? 'positive' : 'negative');
    }
    
    if (weeklyPnlEl) {
        const sign = weeklyPnl >= 0 ? '+' : '';
        weeklyPnlEl.textContent = sign + weeklyPnl.toFixed(2);
        weeklyPnlEl.className = 'dapp-metric-value ' + (weeklyPnl >= 0 ? 'positive' : 'negative');
    }
    
    if (winrateEl && totalTrades > 0) {
        const winrate = (winningTrades / totalTrades * 100).toFixed(0);
        winrateEl.textContent = winrate + '%';
    }
    
    if (drawdownEl) {
        const drawdown = (Math.random() * 5).toFixed(1);
        drawdownEl.textContent = drawdown + '%';
    }
}

function startDAppBehavior() {
    switchDappPanel('think');
    updateHeartbeat();
    
    // Sync initial balance with capital allocation
    totalCapital = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    currentBalance = totalCapital;
    initialBalance = totalCapital; // Set initial balance to starting capital
    
    // Initialize capital allocation
    renderCapitalAllocation();
    
    // Start Polymarket updates
    startPolymarketUpdates();
    
    // Initialize with some positions and trades (load last 50 from Vercel if available)
    activePositions = [];
    tradeHistory = [];
    loadTradesFromServer().then(function(loaded) {
        if (!loaded) {
            for (var i = 0; i < 3; i++) { simulateTrade(); }
        }
        for (var i = 0; i < 2; i++) { updatePositions(); }
        renderPositions();
        renderHistory();
        updateMetrics();
    });
    
    // Update capital allocation periodically
    dappIntervals.push(setInterval(function() {
        updateCapitalAllocation();
    }, 8000));
    
    // Continuous AI thinking and writing with detailed reasoning
    dappIntervals.push(setInterval(function() {
        const asset = TRADING_ASSETS[Math.floor(Math.random() * TRADING_ASSETS.length)];
        const basePrices = {
            'BTC': 65000, 'ETH': 3400, 'SOL': 150, 'AVAX': 40, 'MATIC': 0.8,
            'ARB': 1.2, 'OP': 2.5, 'LINK': 15, 'UNI': 8, 'AAVE': 100
        };
        const basePrice = basePrices[asset] || 100;
        const entry = (basePrice * (0.95 + Math.random() * 0.1)).toFixed(2);
        const target = (parseFloat(entry) * (1 + Math.random() * 0.05 + 0.02)).toFixed(2);
        const stop = (parseFloat(entry) * (1 - Math.random() * 0.03 - 0.01)).toFixed(2);
        const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
        
        const prompt = 'Analyze ' + asset + ' for potential ' + direction + ' entry at $' + entry;
        appendThinkLog('AI Prompt: ' + prompt, 'thinking');
        
        setTimeout(function() {
            const reasoning = generateDetailedReasoning(asset, entry, target, stop, direction);
            const lines = reasoning.split('\n').filter(function(l) { return l.trim(); });
            lines.forEach(function(line, idx) {
                setTimeout(function() {
                    appendThinkLog(line.trim(), idx === 0 ? 'thinking' : '');
                }, idx * 300);
            });
        }, 1500 + Math.random() * 2000);
    }, 6000));
    
    // Continuous trade simulation (each trade persisted to Vercel in simulateTrade)
    dappIntervals.push(setInterval(function() {
        const trade = simulateTrade();
        renderHistory();
        updateMetrics();
        addFeedEntry('EXECUTION', trade.action + ' ' + trade.asset + ' @ $' + trade.entry, ['trading']);
        addFeedEntry('RESULT', trade.pnl + ' on ' + trade.asset, ['pnl']);
    }, 5000));
    
    // Update positions periodically
    dappIntervals.push(setInterval(function() {
        updatePositions();
        renderPositions();
        updateMetrics();
    }, 6000));
    
    // Standard intervals
    dappIntervals.push(setInterval(updateHeartbeat, 2000));
    dappIntervals.push(setInterval(cycleStatus, 5000));
    dappIntervals.push(setInterval(function() {
        const type = FEED_TYPES[Math.floor(Math.random() * FEED_TYPES.length)];
        const messages = {
            THOUGHT: ['Scanning yield protocols...', 'Re-evaluating risk params.', 'Analyzing market microstructure...', 'Processing on-chain data...'],
            SIGNAL: ['Entry zone identified.', 'Momentum confluence detected.', 'Support level holding strong.', 'Breakout pattern forming.'],
            DECISION: ['Opening LONG ETH.', 'Holding position.', 'Scaling into position.', 'Taking partial profits.'],
            EXECUTION: ['Order filled @ 3420.', 'Partial close 50%.', 'Stop loss moved to breakeven.', 'Position size increased.'],
            RESULT: ['+2.4% on ETH.', 'Daily target reached.', 'Risk adjusted return: 1.8x', 'Portfolio up 5.2% today.']
        };
        const arr = messages[type] || ['...'];
        const msg = arr[Math.floor(Math.random() * arr.length)];
        const tags = TAGS.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 2);
        addFeedEntry(type, msg, tags);
    }, 3000));
    
    // Initial entries
    addFeedEntry('THOUGHT', 'Agent online. Scanning markets.', ['defi', 'alpha']);
    addFeedEntry('SIGNAL', 'ETH funding neutral, bias long.', ['fundamentals']);
    
    // Add narrative entries
    const narratives = [
        { id: 1, name: 'Restaking & LRT', heat: 88, change: 12, reasoning: 'Restaking narrative shows strong momentum with increasing TVL and positive sentiment. Model identifies this as high-conviction opportunity.', factors: 'TVL growth, positive funding, institutional interest' },
        { id: 2, name: 'Pump.fun momentum', heat: 72, change: -5, reasoning: 'Memecoin platform showing consolidation after strong run. Model monitoring for re-entry signals.', factors: 'Volume decline, sentiment shift, profit-taking' },
        { id: 3, name: 'Base L2 adoption', heat: 65, change: 8, reasoning: 'Layer 2 solution gaining traction with increasing transaction volume and developer activity.', factors: 'Transaction growth, developer migration, cost efficiency' }
    ];
    
    narratives.forEach(function(narrative) {
        setTimeout(function() {
            addFeedEntry('NARRATIVE', 'Narrative identified: ' + narrative.name + ' (Heat: ' + narrative.heat + ')', ['narrative', 'trend'], narrative);
        }, Math.random() * 2000);
    });
    
    appendThinkLog('AI Agent initialized. Starting continuous analysis...', '');
    setTimeout(function() {
        appendThinkLog('AI Prompt: ' + generateAIPrompt(), 'thinking');
        setTimeout(function() {
            appendThinkLog('AI Response: ' + generateAIResponse(), '');
        }, 1500);
    }, 500);
}

function stopDAppBehavior() {
    dappIntervals.forEach(function(i) { clearInterval(i); });
    dappIntervals = [];
    stopPolymarketUpdates();
}

tv.addEventListener('click', (e) => {
    e.stopPropagation();
    openDapp();
});

tvDappOverlay && tvDappOverlay.addEventListener('click', (e) => {
    if (e.target === tvDappOverlay) closeDapp();
});
var dappCloseBtn = document.getElementById('dappClose');
if (dappCloseBtn) dappCloseBtn.addEventListener('click', function(e) { e.stopPropagation(); closeDapp(); });

// Window state tracking
var windowStates = {};

function maximizeWindow(windowEl) {
    if (!windowEl) return;
    const winId = windowEl.getAttribute('data-win-id');
    
    if (windowStates[winId] && windowStates[winId].maximized) {
        // Restore
        windowEl.style.left = windowStates[winId].left || '50%';
        windowEl.style.top = windowStates[winId].top || '50%';
        windowEl.style.width = windowStates[winId].width || '700px';
        windowEl.style.height = windowStates[winId].height || '600px';
        windowEl.style.transform = windowStates[winId].transform || 'translate(-50%, -50%)';
        windowStates[winId].maximized = false;
    } else {
        // Maximize
        if (!windowStates[winId]) windowStates[winId] = {};
        windowStates[winId].left = windowEl.style.left;
        windowStates[winId].top = windowEl.style.top;
        windowStates[winId].width = windowEl.style.width;
        windowStates[winId].height = windowEl.style.height;
        windowStates[winId].transform = windowEl.style.transform;
        
        windowEl.style.left = '0';
        windowEl.style.top = '0';
        windowEl.style.width = '100vw';
        windowEl.style.height = '100vh';
        windowEl.style.transform = 'none';
        windowEl.style.maxWidth = '100vw';
        windowEl.style.maxHeight = '100vh';
        windowStates[winId].maximized = true;
    }
}

// Window controls are set up dynamically in setupWindowControls function

// Polymarket events
var polymarketEvents = [];
var polymarketBets = [];

function loadPolymarketEvents() {
    const eventsEl = document.getElementById('polymarketEvents');
    if (!eventsEl) return;
    
    // Show loading state
    eventsEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading Polymarket events...</div>';
    
    // According to Polymarket API docs, /events endpoint is most efficient for retrieving all active markets
    // Using recommended parameters: order=id, ascending=false, closed=false, limit=100
    // Filter by end_date_min to get only future events (current date)
    var currentDateISO = new Date().toISOString();
    var apiUrl = 'https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&order=id&ascending=false&end_date_min=' + currentDateISO;
    
    fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        mode: 'cors'
    })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('API request failed: ' + response.status);
            }
            return response.json();
        })
        .then(function(events) {
            if (!Array.isArray(events) || events.length === 0) {
                throw new Error('No events returned from API');
            }
            
            // Extract and process markets from events
            var allMarkets = [];
            var now = Date.now();
            var currentDate = new Date();
            
            events.forEach(function(event) {
                // Only process active, non-closed events
                if (!event.active || event.closed || !event.markets || event.markets.length === 0) {
                    return;
                }
                
                // Check if event end date has passed
                var eventEndDate = null;
                if (event.endDate) {
                    eventEndDate = new Date(event.endDate);
                } else if (event.endDateIso) {
                    eventEndDate = new Date(event.endDateIso);
                }
                
                // Skip events that have already ended
                if (eventEndDate && !isNaN(eventEndDate.getTime()) && eventEndDate < currentDate) {
                    return;
                }
                
                event.markets.forEach(function(market) {
                    // Only include active, non-closed markets with questions
                    if (market.active && !market.closed && market.question) {
                        // Check if market end date has passed
                        var marketEndDate = null;
                        if (market.endDate) {
                            marketEndDate = new Date(market.endDate);
                        } else if (market.endDateIso) {
                            marketEndDate = new Date(market.endDateIso);
                        }
                        
                        // Skip markets that have already ended
                        if (marketEndDate && !isNaN(marketEndDate.getTime()) && marketEndDate < currentDate) {
                            return;
                        }
                        // Parse outcome prices - can be string JSON, array, or object
                        var yesPrice = 0.5;
                        var noPrice = 0.5;
                        
                        if (market.outcomePrices) {
                            try {
                                var prices = typeof market.outcomePrices === 'string' 
                                    ? JSON.parse(market.outcomePrices) 
                                    : market.outcomePrices;
                                
                                if (Array.isArray(prices) && prices.length >= 2) {
                                    yesPrice = parseFloat(prices[0]) || 0.5;
                                    noPrice = parseFloat(prices[1]) || 0.5;
                                } else if (typeof prices === 'object') {
                                    // Handle object format like {Yes: 0.65, No: 0.35}
                                    if (prices.Yes !== undefined) {
                                        yesPrice = parseFloat(prices.Yes) || 0.5;
                                    }
                                    if (prices.No !== undefined) {
                                        noPrice = parseFloat(prices.No) || 0.5;
                                    }
                                    // Handle array-like object with numeric keys
                                    if (yesPrice === 0.5 && noPrice === 0.5 && prices[0] !== undefined) {
                                        yesPrice = parseFloat(prices[0]) || 0.5;
                                        noPrice = parseFloat(prices[1]) || 0.5;
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to parse outcomePrices:', e);
                            }
                        }
                        
                        // Calculate volume - prefer 24hr volume, fallback to volumeNum or volume
                        var volume = 0;
                        if (market.volume24hr !== undefined && market.volume24hr !== null) {
                            volume = typeof market.volume24hr === 'string' 
                                ? parseFloat(market.volume24hr) || 0 
                                : market.volume24hr || 0;
                        } else if (market.volumeNum !== undefined && market.volumeNum !== null) {
                            volume = typeof market.volumeNum === 'string' 
                                ? parseFloat(market.volumeNum) || 0 
                                : market.volumeNum || 0;
                        } else if (market.volume !== undefined && market.volume !== null) {
                            volume = typeof market.volume === 'string' 
                                ? parseFloat(market.volume) || 0 
                                : market.volume || 0;
                        }
                        
                        // Format end date - use market endDate, fallback to event endDate
                        var endDate = 'N/A';
                        var endDateTimestamp = null;
                        
                        if (market.endDate || market.endDateIso) {
                            try {
                                var dateStr = market.endDateIso || market.endDate;
                                var date = new Date(dateStr);
                                if (!isNaN(date.getTime())) {
                                    endDateTimestamp = date.getTime();
                                    endDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                                }
                            } catch (e) {
                                endDate = market.endDateIso || market.endDate || 'N/A';
                            }
                        } else if (eventEndDate && !isNaN(eventEndDate.getTime())) {
                            endDateTimestamp = eventEndDate.getTime();
                            endDate = eventEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                        }
                        
                        // Double-check: skip if end date is in the past (shouldn't happen after filter above, but safety check)
                        if (endDateTimestamp && endDateTimestamp < currentDate.getTime()) {
                            return;
                        }
                        
                        // Get event slug - use event.slug as primary source
                        var eventSlug = event.slug || 'market';
                        
                        // Create proper Polymarket URL
                        // Format: https://polymarket.com/event/{event-slug} or https://polymarket.com/event/{event-slug}/{market-slug}
                        var url = 'https://polymarket.com/event/' + eventSlug;
                        if (market.slug && market.slug !== eventSlug) {
                            url = 'https://polymarket.com/event/' + eventSlug + '/' + market.slug;
                        }
                        
                        // Get creation date for sorting
                        var createdAt = 0;
                        if (market.createdAt) {
                            var createdDate = new Date(market.createdAt);
                            if (!isNaN(createdDate.getTime())) {
                                createdAt = createdDate.getTime();
                            }
                        } else if (event.createdAt) {
                            var eventCreatedDate = new Date(event.createdAt);
                            if (!isNaN(eventCreatedDate.getTime())) {
                                createdAt = eventCreatedDate.getTime();
                            }
                        }
                        
                        allMarkets.push({
                            id: market.id || market.conditionId || Date.now() + Math.random(),
                            question: market.question,
                            yesPrice: yesPrice,
                            noPrice: noPrice,
                            volume: volume,
                            endDate: endDate,
                            endDateTimestamp: endDateTimestamp, // Store timestamp for comparison
                            slug: market.slug || eventSlug,
                            url: url,
                            eventSlug: eventSlug,
                            createdAt: createdAt,
                            eventTitle: event.title || event.ticker || ''
                        });
                    }
                });
            });
            
            // Sort by volume (descending) first, then by creation date (newest first)
            allMarkets.sort(function(a, b) {
                // Primary sort: volume (higher volume = higher priority)
                var volumeDiff = (b.volume || 0) - (a.volume || 0);
                if (Math.abs(volumeDiff) > 500) {
                    return volumeDiff;
                }
                // Secondary sort: creation date (newer = higher priority)
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
            
            // If no markets found after filtering, show message
            if (allMarkets.length === 0) {
                eventsEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">No active future markets found. Markets may have ended or API may be unavailable.</div>';
                return;
            }
            
            // Take top 15 most relevant markets
            allMarkets = allMarkets.slice(0, 15);
            
            // Add model bets
            polymarketEvents = allMarkets.map(function(event) {
                return {
                    ...event,
                    modelBet: Math.random() > 0.3 ? {
                        side: Math.random() > 0.5 ? 'YES' : 'NO',
                        amount: (Math.random() * 50 + 10).toFixed(2),
                        confidence: (Math.random() * 30 + 60).toFixed(1),
                        reasoning: 'Model analysis suggests ' + (Math.random() > 0.5 ? 'favorable' : 'unfavorable') + ' outcome based on current market conditions and historical patterns.'
                    } : null
                };
            });
            
            renderPolymarketEvents();
        })
        .catch(function(error) {
            console.error('Error fetching Polymarket events:', error);
            // Fallback to mock data if API fails
            eventsEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #dc2626;">Failed to load events. Using cached data...</div>';
            
            // Use fallback data
            setTimeout(function() {
                loadPolymarketEventsFallback();
            }, 1000);
        });
}

function loadPolymarketEventsFallback() {
    // Fallback with real-looking data
    const fallbackEvents = [
        { id: 1, question: 'Will Bitcoin reach $100k by end of 2024?', yesPrice: 0.35, noPrice: 0.65, volume: 1250000, endDate: 'Dec 31, 2024', slug: 'bitcoin-100k-2024', url: 'https://polymarket.com/event/bitcoin-100k-2024' },
        { id: 2, question: 'Will Ethereum ETF be approved in 2024?', yesPrice: 0.72, noPrice: 0.28, volume: 890000, endDate: 'Dec 31, 2024', slug: 'ethereum-etf-2024', url: 'https://polymarket.com/event/ethereum-etf-2024' },
        { id: 3, question: 'Will Trump win 2024 US Election?', yesPrice: 0.48, noPrice: 0.52, volume: 2500000, endDate: 'Nov 5, 2024', slug: 'trump-2024-election', url: 'https://polymarket.com/event/trump-2024-election' },
        { id: 4, question: 'Will AI achieve AGI by 2025?', yesPrice: 0.15, noPrice: 0.85, volume: 450000, endDate: 'Dec 31, 2025', slug: 'ai-agi-2025', url: 'https://polymarket.com/event/ai-agi-2025' },
        { id: 5, question: 'Will Solana price exceed $200 by Q2 2024?', yesPrice: 0.42, noPrice: 0.58, volume: 670000, endDate: 'Jun 30, 2024', slug: 'solana-200-q2-2024', url: 'https://polymarket.com/event/solana-200-q2-2024' },
        { id: 6, question: 'Will Fed cut rates 3+ times in 2024?', yesPrice: 0.68, noPrice: 0.32, volume: 1100000, endDate: 'Dec 31, 2024', slug: 'fed-rates-2024', url: 'https://polymarket.com/event/fed-rates-2024' },
        { id: 7, question: 'Will OpenAI release GPT-5 in 2024?', yesPrice: 0.55, noPrice: 0.45, volume: 320000, endDate: 'Dec 31, 2024', slug: 'openai-gpt5-2024', url: 'https://polymarket.com/event/openai-gpt5-2024' },
        { id: 8, question: 'Will DeFi TVL exceed $200B in 2024?', yesPrice: 0.38, noPrice: 0.62, volume: 540000, endDate: 'Dec 31, 2024', slug: 'defi-tvl-200b-2024', url: 'https://polymarket.com/event/defi-tvl-200b-2024' },
        { id: 9, question: 'Will there be a major crypto exchange hack in 2024?', yesPrice: 0.25, noPrice: 0.75, volume: 780000, endDate: 'Dec 31, 2024', slug: 'crypto-exchange-hack-2024', url: 'https://polymarket.com/event/crypto-exchange-hack-2024' },
        { id: 10, question: 'Will US pass comprehensive crypto regulation in 2024?', yesPrice: 0.32, noPrice: 0.68, volume: 950000, endDate: 'Dec 31, 2024', slug: 'us-crypto-regulation-2024', url: 'https://polymarket.com/event/us-crypto-regulation-2024' },
        { id: 11, question: 'Will Layer 2 solutions process 80%+ of Ethereum transactions?', yesPrice: 0.58, noPrice: 0.42, volume: 410000, endDate: 'Dec 31, 2024', slug: 'l2-ethereum-transactions', url: 'https://polymarket.com/event/l2-ethereum-transactions' },
        { id: 12, question: 'Will meme coins market cap exceed $100B?', yesPrice: 0.45, noPrice: 0.55, volume: 620000, endDate: 'Dec 31, 2024', slug: 'meme-coins-100b', url: 'https://polymarket.com/event/meme-coins-100b' }
    ];
    
    polymarketEvents = fallbackEvents.map(function(event) {
        return {
            ...event,
            modelBet: Math.random() > 0.3 ? {
                side: Math.random() > 0.5 ? 'YES' : 'NO',
                amount: (Math.random() * 50 + 10).toFixed(2),
                confidence: (Math.random() * 30 + 60).toFixed(1),
                reasoning: 'Model analysis suggests ' + (Math.random() > 0.5 ? 'favorable' : 'unfavorable') + ' outcome based on current market conditions and historical patterns.'
            } : null
        };
    });
    
    renderPolymarketEvents();
}

function renderPolymarketEvents() {
    const eventsEl = document.getElementById('polymarketEvents');
    if (!eventsEl) return;
    
    eventsEl.innerHTML = '';
    
    polymarketEvents.forEach(function(event) {
        const eventEl = document.createElement('div');
        eventEl.className = 'polymarket-event';
        
        const yesPercent = (event.yesPrice * 100).toFixed(1);
        const noPercent = (event.noPrice * 100).toFixed(1);
        const hasBet = event.modelBet !== null;
        
        eventEl.innerHTML = '<div class="polymarket-event-header">' +
            '<h4><a href="' + event.url + '" target="_blank" rel="noopener noreferrer" class="polymarket-event-link">' + event.question + '</a></h4>' +
            '<div class="polymarket-event-meta">' +
            '<span>Volume: $' + (event.volume / 1000).toFixed(0) + 'k</span>' +
            '<span>Ends: ' + event.endDate + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="polymarket-event-odds">' +
            '<div class="polymarket-odds-bar">' +
            '<div class="polymarket-odds-yes" style="width: ' + yesPercent + '%">YES ' + yesPercent + '%</div>' +
            '<div class="polymarket-odds-no" style="width: ' + noPercent + '%">NO ' + noPercent + '%</div>' +
            '</div>' +
            '</div>' +
            (hasBet ? '<div class="polymarket-model-bet">' +
            '<strong>Model Bet:</strong> ' + event.modelBet.side + ' $' + event.modelBet.amount + 
            ' (Confidence: ' + event.modelBet.confidence + '%)<br>' +
            '<em>' + event.modelBet.reasoning + '</em>' +
            '</div>' : '<div class="polymarket-no-bet">Model analyzing...</div>');
        
        eventsEl.appendChild(eventEl);
    });
}

// Update Polymarket events periodically with real data
var polymarketUpdateInterval = null;

function startPolymarketUpdates() {
    if (polymarketUpdateInterval) return;
    
    polymarketUpdateInterval = setInterval(function() {
        if (polymarketEvents.length > 0) {
            // Use /events endpoint as recommended by Polymarket API docs
            // Filter by end_date_min to get only future events
            var currentDateISO = new Date().toISOString();
            fetch('https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&order=id&ascending=false&end_date_min=' + currentDateISO, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            })
                .then(function(response) {
                    if (!response.ok) return null;
                    return response.json();
                })
                .then(function(events) {
                    if (!events || !Array.isArray(events) || events.length === 0) {
                        // Fallback: simulate price movements, but also remove expired events
                        var currentDate = new Date();
                        polymarketEvents = polymarketEvents.filter(function(event) {
                            // Use stored timestamp if available
                            if (event.endDateTimestamp) {
                                if (event.endDateTimestamp < currentDate.getTime()) {
                                    return false; // Remove expired event
                                }
                            } else if (event.endDate && event.endDate !== 'N/A') {
                                try {
                                    var endDate = new Date(event.endDate);
                                    if (!isNaN(endDate.getTime()) && endDate < currentDate) {
                                        return false; // Remove expired event
                                    }
                                } catch (e) {
                                    // Keep if date parsing fails
                                }
                            }
                            return true;
                        });
                        
                        polymarketEvents.forEach(function(event) {
                            const change = (Math.random() * 0.1 - 0.05);
                            event.yesPrice = Math.max(0.05, Math.min(0.95, event.yesPrice + change));
                            event.noPrice = 1 - event.yesPrice;
                        });
                        renderPolymarketEvents();
                        return;
                    }
                    
                    var currentDate = new Date();
                    
                    // Create market map by ID, slug, and conditionId
                    var marketMap = {};
                    events.forEach(function(event) {
                        // Skip expired events
                        var eventEndDate = null;
                        if (event.endDate) {
                            eventEndDate = new Date(event.endDate);
                        } else if (event.endDateIso) {
                            eventEndDate = new Date(event.endDateIso);
                        }
                        if (eventEndDate && !isNaN(eventEndDate.getTime()) && eventEndDate < currentDate) {
                            return;
                        }
                        
                        if (event.markets && Array.isArray(event.markets)) {
                            event.markets.forEach(function(market) {
                                // Skip expired markets
                                var marketEndDate = null;
                                if (market.endDate) {
                                    marketEndDate = new Date(market.endDate);
                                } else if (market.endDateIso) {
                                    marketEndDate = new Date(market.endDateIso);
                                }
                                if (marketEndDate && !isNaN(marketEndDate.getTime()) && marketEndDate < currentDate) {
                                    return;
                                }
                                
                                if (market.id) {
                                    marketMap[market.id] = market;
                                }
                                if (market.conditionId) {
                                    marketMap[market.conditionId] = market;
                                }
                                if (market.slug) {
                                    marketMap[market.slug] = market;
                                }
                            });
                        }
                    });
                    
                    // Remove expired events from current list
                    var initialCount = polymarketEvents.length;
                    polymarketEvents = polymarketEvents.filter(function(event) {
                        // Use stored timestamp if available, otherwise try to parse endDate string
                        if (event.endDateTimestamp) {
                            if (event.endDateTimestamp < currentDate.getTime()) {
                                return false; // Remove expired event
                            }
                        } else if (event.endDate && event.endDate !== 'N/A') {
                            try {
                                var endDate = new Date(event.endDate);
                                if (!isNaN(endDate.getTime()) && endDate < currentDate) {
                                    return false; // Remove expired event
                                }
                            } catch (e) {
                                // Keep if date parsing fails
                            }
                        }
                        return true;
                    });
                    
                    // If all events expired, reload the list
                    if (polymarketEvents.length === 0 && initialCount > 0) {
                        loadPolymarketEvents();
                        return;
                    }
                    
                    // Update existing events with real prices
                    polymarketEvents.forEach(function(event) {
                        var market = marketMap[event.id] || marketMap[event.slug];
                        if (market) {
                            // Update prices
                            if (market.outcomePrices) {
                                try {
                                    var prices = typeof market.outcomePrices === 'string' 
                                        ? JSON.parse(market.outcomePrices) 
                                        : market.outcomePrices;
                                    
                                    if (Array.isArray(prices) && prices.length >= 2) {
                                        event.yesPrice = parseFloat(prices[0]) || event.yesPrice;
                                        event.noPrice = parseFloat(prices[1]) || event.noPrice;
                                    } else if (typeof prices === 'object') {
                                        if (prices.Yes !== undefined) {
                                            event.yesPrice = parseFloat(prices.Yes) || event.yesPrice;
                                        }
                                        if (prices.No !== undefined) {
                                            event.noPrice = parseFloat(prices.No) || event.noPrice;
                                        }
                                        if (prices[0] !== undefined && event.yesPrice === 0.5) {
                                            event.yesPrice = parseFloat(prices[0]) || event.yesPrice;
                                            event.noPrice = parseFloat(prices[1]) || event.noPrice;
                                        }
                                    }
                                } catch (e) {
                                    // Keep existing prices on parse error
                                }
                            }
                            
                            // Update volume
                            var volume = market.volume24hr !== undefined ? market.volume24hr 
                                : (market.volumeNum !== undefined ? market.volumeNum 
                                : (market.volume !== undefined ? market.volume : undefined));
                            
                            if (volume !== undefined && volume !== null) {
                                if (typeof volume === 'string') {
                                    volume = parseFloat(volume) || event.volume;
                                }
                                event.volume = volume;
                            }
                        } else {
                            // Simulate small price movement if market not found
                            const change = (Math.random() * 0.05 - 0.025);
                            event.yesPrice = Math.max(0.05, Math.min(0.95, event.yesPrice + change));
                            event.noPrice = 1 - event.yesPrice;
                        }
                    });
                    
                    renderPolymarketEvents();
                })
                .catch(function(error) {
                    console.warn('Error updating Polymarket prices:', error);
                    // Fallback: simulate price movements
                    polymarketEvents.forEach(function(event) {
                        const change = (Math.random() * 0.1 - 0.05);
                        event.yesPrice = Math.max(0.05, Math.min(0.95, event.yesPrice + change));
                        event.noPrice = 1 - event.yesPrice;
                    });
                    renderPolymarketEvents();
                });
        } else {
            // If no events loaded, try to reload
            loadPolymarketEvents();
        }
    }, 15000); // Update every 15 seconds
}

function stopPolymarketUpdates() {
    if (polymarketUpdateInterval) {
        clearInterval(polymarketUpdateInterval);
        polymarketUpdateInterval = null;
    }
}
document.querySelectorAll('.painting-close').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); closePaintingFocus(); });
});

var paintingDimmer = document.getElementById('paintingDimmer');
var narrativesOverlay = document.getElementById('narrativesOverlay');
var agentsOverlay = document.getElementById('agentsOverlay');
var cuadroL = document.querySelector('.cuadro-l');
var cuadroR = document.querySelector('.cuadro-r');

function closePaintingFocus() {
    focusMode = 'default';
    if (paintingDimmer) paintingDimmer.classList.remove('is-active');
    if (cuadroL) cuadroL.classList.remove('is-focused');
    if (cuadroR) cuadroR.classList.remove('is-focused');
    if (narrativesOverlay) narrativesOverlay.classList.remove('is-visible');
    if (agentsOverlay) agentsOverlay.classList.remove('is-visible');
    delete minimizedWindows['narratives'];
    delete minimizedWindows['agents'];
    removeFromTaskbar('narratives');
    removeFromTaskbar('agents');
    transitionCamera(DEFAULT, 1200);
}

function openPaintingLeft() {
    if (tvDappOverlay) { tvDappOverlay.classList.remove('is-visible'); document.body.classList.remove('dapp-open'); }
    stopDAppBehavior();
    if (agentsOverlay) agentsOverlay.classList.remove('is-visible');
    focusMode = 'painting_left';
    if (paintingDimmer) paintingDimmer.classList.add('is-active');
    if (cuadroL) cuadroL.classList.add('is-focused');
    if (cuadroR) cuadroR.classList.remove('is-focused');
    transitionCamera(PAINTING_LEFT, 1200);
    setTimeout(function() {
        if (narrativesOverlay) narrativesOverlay.classList.add('is-visible');
        // Attach handlers after overlay is visible
        setTimeout(attachNarrativeHandlers, 100);
    }, 1200);
}

function openPaintingRight() {
    if (tvDappOverlay) { tvDappOverlay.classList.remove('is-visible'); document.body.classList.remove('dapp-open'); }
    stopDAppBehavior();
    if (narrativesOverlay) narrativesOverlay.classList.remove('is-visible');
    focusMode = 'painting_right';
    if (paintingDimmer) paintingDimmer.classList.add('is-active');
    if (cuadroR) cuadroR.classList.add('is-focused');
    if (cuadroL) cuadroL.classList.remove('is-focused');
    transitionCamera(PAINTING_RIGHT, 1200);
    setTimeout(function() {
        if (agentsOverlay) agentsOverlay.classList.add('is-visible');
    }, 1200);
}

// Narrative data for painting left narratives
const paintingNarratives = {
    'pumpfun-momentum': {
        id: 'pumpfun-momentum',
        name: 'Pump.fun momentum',
        heat: 72,
        change: 15.3,
        status: 'watching',
        summary: 'Meme coins trending on pump.fun, volume spike',
        fullAnalysis: 'The Pump.fun momentum narrative has gained significant traction as meme coin launches on the platform continue to attract retail attention. Key observations:\n\n1. Volume surge: Daily trading volume on Pump.fun has increased 250% in the past week, indicating strong retail participation.\n2. Viral mechanics: The platform\'s bonding curve model creates natural price discovery and early adopter incentives.\n3. Social amplification: X/Twitter mentions of Pump.fun launches have increased 400% month-over-month.\n4. Smart money tracking: On-chain analysis shows increasing whale participation in early-stage launches.\n\nRisk factors: High volatility, potential rug pulls, and regulatory uncertainty around meme coins. The model is monitoring this narrative but maintaining conservative position sizing.',
        factors: 'Volume increase (250%), social sentiment spike (400%), whale accumulation, platform growth metrics',
        reasoning: 'The model identified Pump.fun as an emerging narrative with strong momentum indicators. While the risk/reward profile is attractive for early entries, the high volatility and potential for sudden reversals require careful position management. The agent is currently watching and may allocate small positions if momentum continues.',
        sources: ['X', 'Telegram', 'Onchain']
    },
    'restaking-yields': {
        id: 'restaking-yields',
        name: 'Restaking yields',
        heat: 88,
        change: 22.7,
        status: 'active',
        summary: 'EigenLayer AVS and LRT allocation shifts',
        fullAnalysis: 'The restaking narrative represents one of the highest-conviction opportunities in the current market cycle. EigenLayer\'s AVS (Actively Validated Services) ecosystem is rapidly expanding:\n\n1. TVL growth: Total Value Locked in restaking protocols has grown from $2B to $8B in Q1 2024, representing 300% growth.\n2. Yield opportunities: Combined staking rewards and AVS rewards offer 8-15% APY, significantly higher than traditional staking.\n3. Protocol maturity: Major protocols like Ether.fi, Renzo, and Kelp DAO have proven track records and strong security.\n4. Institutional interest: Large validators and institutions are increasingly allocating to restaking strategies.\n\nCurrent allocation: The agent has actively positioned in LRT tokens (eETH, ezETH, rsETH) and is monitoring AVS launches for additional yield opportunities. Risk management includes diversification across multiple protocols and monitoring slashing risks.',
        factors: 'TVL growth (300%), yield opportunities (8-15% APY), protocol maturity, institutional adoption',
        reasoning: 'Restaking represents a structural shift in Ethereum staking economics. The combination of base staking rewards and additional AVS rewards creates an attractive risk-adjusted return profile. The model has identified this as a high-conviction narrative and has actively allocated capital.',
        sources: ['X', 'Telegram', 'Onchain']
    },
    'base-l2-adoption': {
        id: 'base-l2-adoption',
        name: 'Base L2 adoption',
        heat: 45,
        change: 8.2,
        status: 'observing',
        summary: 'Base chain fees and DEX volume narrative',
        fullAnalysis: 'Base L2 has shown remarkable growth since launch, becoming the second-largest L2 by TVL. Key developments:\n\n1. Transaction growth: 150% increase in daily transactions over the past quarter, driven by low fees and Coinbase integration.\n2. Developer migration: Over 200 new dApps deployed on Base, including major DeFi protocols and social applications.\n3. Cost efficiency: Base transactions are 10x cheaper than mainnet, enabling new use cases like micro-transactions.\n4. Ecosystem expansion: Major protocols like Uniswap, Aave, and Compound have launched on Base.\n\nModel assessment: Strong fundamentals with sustainable growth trajectory. The Coinbase backing provides additional credibility and potential for institutional adoption. The agent is observing this narrative and may increase allocation if adoption metrics continue to improve.',
        factors: 'Transaction growth (150%), dApp deployment (200+), cost efficiency (10x cheaper), Coinbase backing',
        reasoning: 'Base represents a compelling L2 narrative with strong fundamentals and institutional backing. While adoption is growing, the model is taking a measured approach, observing key metrics before increasing allocation. The low fees and growing ecosystem make it attractive for long-term positioning.',
        sources: ['X', 'Onchain']
    },
    'ai-agent-tokens': {
        id: 'ai-agent-tokens',
        name: 'AI agent tokens',
        heat: 62,
        change: -12.4,
        status: 'exited',
        summary: 'Tokenized AI agents and inference demand',
        fullAnalysis: 'The AI agent token narrative saw initial excitement but has cooled as the market matured:\n\n1. Initial momentum: Early tokens like FET, AGIX, and OCEAN saw significant price appreciation driven by AI hype.\n2. Reality check: Many projects failed to deliver on promises, leading to price corrections and reduced sentiment.\n3. Market consolidation: The narrative has shifted from pure speculation to projects with actual AI infrastructure and demand.\n4. Current state: While some projects continue to show promise, overall narrative heat has decreased.\n\nModel decision: The agent exited positions in AI agent tokens after identifying declining momentum and increased risk. While the long-term potential remains, current market conditions suggest better opportunities elsewhere.',
        factors: 'Declining momentum, failed project deliveries, market consolidation, reduced sentiment',
        reasoning: 'The model identified declining narrative heat and increased risk in AI agent tokens. While the long-term potential of AI in crypto remains, current market conditions and project execution issues led to the decision to exit positions and reallocate capital to higher-conviction narratives.',
        sources: ['X', 'Telegram']
    }
};

if (cuadroL) {
    cuadroL.addEventListener('click', function(e) {
        e.stopPropagation();
        if (focusMode !== 'default' && focusMode !== 'painting_left') return;
        if (focusMode === 'painting_left') return;
        openPaintingLeft();
    });
}

function typeAIExplanation(text, element, speed) {
    speed = speed || 20;
    let index = 0;
    element.innerHTML = '';
    let currentText = '';
    
    function type() {
        if (index < text.length) {
            currentText += text[index];
            element.innerHTML = '<div class="narrative-ai-typing">' + currentText + '<span class="narrative-ai-cursor">|</span></div>';
            index++;
            setTimeout(type, speed);
        } else {
            element.innerHTML = '<div class="narrative-ai-typing">' + currentText + '</div>';
        }
    }
    type();
}

function explainNarrative(narrativeData) {
    console.log('explainNarrative called with:', narrativeData);
    const aiContent = document.getElementById('narrativeAIContent');
    if (!aiContent) {
        console.error('narrativeAIContent element not found');
        return;
    }
    if (!narrativeData) {
        console.error('narrativeData is missing');
        return;
    }
    
    // Highlight selected card
    const cards = document.querySelectorAll('.narrative-card');
    cards.forEach(function(card) {
        card.classList.remove('narrative-card-selected');
        const nameEl = card.querySelector('.narrative-name');
        if (nameEl && nameEl.textContent.trim() === narrativeData.name) {
            card.classList.add('narrative-card-selected');
        }
    });
    
    // Clear content and show loading
    aiContent.innerHTML = '<div class="narrative-ai-typing">Analyzing narrative: ' + narrativeData.name + '...<span class="narrative-ai-cursor">|</span></div>';
    console.log('Loading message displayed, calling API...');
    
    // Use server-side proxy to avoid CORS issues
    const prompt = 'Analyze this crypto narrative in detail:\n\n' +
        'Name: ' + narrativeData.name + '\n' +
        'Heat Score: ' + narrativeData.heat + '/100\n' +
        'Status: ' + narrativeData.status + '\n' +
        '24h Change: ' + (narrativeData.change >= 0 ? '+' : '') + narrativeData.change + '%\n' +
        'Summary: ' + narrativeData.summary + '\n\n' +
        'Provide a detailed analysis including:\n' +
        '1. Why this narrative is important\n' +
        '2. Key factors driving it\n' +
        '3. Risk assessment\n' +
        '4. Trading/investment implications\n' +
        '5. What to watch for\n\n' +
        'Write in a clear, professional style as if you are a crypto trading AI agent explaining to your owner.';
    
    const base = getApiBase();
    if (base) {
        fetch(base + '/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        }).then(function(r) { 
            if (!r.ok) {
                return r.json().then(function(errData) {
                    throw new Error(errData.error || 'API error: ' + r.status);
                }).catch(function() {
                    throw new Error('API error: ' + r.status);
                });
            }
            return r.json(); 
        }).then(function(data) {
            const aiText = data.text || '';
            if (aiText) {
                const fullExplanation = 'Narrative: ' + narrativeData.name + '\n' +
                    'Heat: ' + narrativeData.heat + '/100 | Status: ' + narrativeData.status.toUpperCase() + 
                    ' | Change: ' + (narrativeData.change >= 0 ? '+' : '') + narrativeData.change + '%\n\n' +
                    aiText;
                aiContent.innerHTML = '';
                typeAIExplanation(fullExplanation, aiContent, 15);
            } else {
                console.warn('Claude API returned empty text');
                fallbackExplanation(narrativeData, aiContent, 'Claude API returned empty response');
            }
        }).catch(function(err) {
            console.error('Claude API error:', err);
            fallbackExplanation(narrativeData, aiContent, 'Error: ' + (err.message || 'Failed to fetch AI explanation'));
        });
    } else {
        console.warn('No API base URL found');
        fallbackExplanation(narrativeData, aiContent, 'API base URL not available');
    }
}

function fallbackExplanation(narrativeData, aiContent, errorMsg) {
    const explanation = 'Analyzing narrative: ' + narrativeData.name + '\n\n' +
        'Heat Score: ' + narrativeData.heat + '/100\n' +
        'Status: ' + narrativeData.status.toUpperCase() + '\n' +
        '24h Change: ' + (narrativeData.change >= 0 ? '+' : '') + narrativeData.change + '%\n\n' +
        'Model Assessment:\n' +
        narrativeData.reasoning + '\n\n' +
        'Key Factors:\n' +
        narrativeData.factors + '\n\n' +
        'Detailed Analysis:\n' +
        narrativeData.fullAnalysis;
    
    if (errorMsg) {
        explanation += '\n\n[Note: ' + errorMsg + '. Check Vercel environment variables for CLAUDE_API_KEY]';
    } else {
        explanation += '\n\n[Note: Using fallback explanation. Set CLAUDE_API_KEY in Vercel environment variables for AI-generated explanations]';
    }
    
    aiContent.innerHTML = '';
    typeAIExplanation(explanation, aiContent, 15);
}

// Add click handlers for narrative cards in painting left
function attachNarrativeHandlers() {
    const narrativesList = document.getElementById('narrativesList');
    if (narrativesList) {
        const cards = narrativesList.querySelectorAll('.narrative-card');
        console.log('Found', cards.length, 'narrative cards');
        cards.forEach(function(card) {
            card.style.cursor = 'pointer';
            // Remove existing listeners to avoid duplicates
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            newCard.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('Narrative card clicked');
                const heat = parseInt(newCard.getAttribute('data-heat')) || 0;
                const nameEl = newCard.querySelector('.narrative-name');
                const name = nameEl ? nameEl.textContent.trim() : '';
                console.log('Narrative name:', name);
                
                // Find matching narrative data
                let narrativeData = null;
                if (name.includes('Pump.fun') || name.includes('pumpfun')) {
                    narrativeData = paintingNarratives['pumpfun-momentum'];
                } else if (name.includes('Restaking') || name.includes('restaking')) {
                    narrativeData = paintingNarratives['restaking-yields'];
                } else if (name.includes('Base') || name.includes('base')) {
                    narrativeData = paintingNarratives['base-l2-adoption'];
                } else if (name.includes('AI agent') || name.includes('ai-agent')) {
                    narrativeData = paintingNarratives['ai-agent-tokens'];
                }
                
                if (narrativeData) {
                    console.log('Found narrative data, calling explainNarrative');
                    explainNarrative(narrativeData);
                } else {
                    console.warn('No narrative data found for:', name);
                }
            });
        });
    } else {
        console.warn('narrativesList not found');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(attachNarrativeHandlers, 500);
});

// Also attach when narratives overlay opens - use event delegation
document.addEventListener('click', function(e) {
    if (e.target.closest('.narrative-card')) {
        const card = e.target.closest('.narrative-card');
        const nameEl = card.querySelector('.narrative-name');
        if (nameEl) {
            const name = nameEl.textContent.trim();
            let narrativeData = null;
            if (name.includes('Pump.fun') || name.includes('pumpfun')) {
                narrativeData = paintingNarratives['pumpfun-momentum'];
            } else if (name.includes('Restaking') || name.includes('restaking')) {
                narrativeData = paintingNarratives['restaking-yields'];
            } else if (name.includes('Base') || name.includes('base')) {
                narrativeData = paintingNarratives['base-l2-adoption'];
            } else if (name.includes('AI agent') || name.includes('ai-agent')) {
                narrativeData = paintingNarratives['ai-agent-tokens'];
            }
            if (narrativeData) {
                e.stopPropagation();
                explainNarrative(narrativeData);
            }
        }
    }
});
if (cuadroR) {
    cuadroR.addEventListener('click', function(e) {
        e.stopPropagation();
        if (focusMode !== 'default' && focusMode !== 'painting_right') return;
        if (focusMode === 'painting_right') return;
        openPaintingRight();
    });
}
if (paintingDimmer) {
    paintingDimmer.addEventListener('click', function() {
        if (focusMode === 'painting_left' || focusMode === 'painting_right') closePaintingFocus();
    });
}
narrativesOverlay && narrativesOverlay.addEventListener('click', function(e) {
    if (e.target === narrativesOverlay) closePaintingFocus();
});
agentsOverlay && agentsOverlay.addEventListener('click', function(e) {
    if (e.target === agentsOverlay) closePaintingFocus();
});
document.querySelectorAll('.painting-panel').forEach(function(panel) {
    panel.addEventListener('click', function(e) { e.stopPropagation(); });
});

document.querySelectorAll('.agent-card-expandable').forEach(function(card) {
    card.addEventListener('click', function(e) {
        e.stopPropagation();
        card.classList.toggle('expanded');
    });
});

var observationDimmer = document.getElementById('observationDimmer');
var observationOverlay = document.getElementById('observationOverlay');
var observationFeed = document.getElementById('observationFeed');
var observationStatus = document.getElementById('observationStatus');
var observationStandUp = document.getElementById('observationStandUp');
var observationIntervals = [];

function addObservationEntry(type, message) {
    if (!observationFeed) return;
    var el = document.createElement('div');
    el.className = 'observation-entry observation-entry-' + type.toLowerCase();
    el.innerHTML = '<span class="observation-time">' + formatTime() + '</span> <span class="observation-type">' + type + '</span> ' + message;
    observationFeed.appendChild(el);
    observationFeed.scrollTop = observationFeed.scrollHeight;
}

function startObservationFeed() {
    if (observationStatus) observationStatus.textContent = 'THINKING';
    var obsTypes = ['THOUGHT', 'DECISION', 'RESULT'];
    var messages = {
        THOUGHT: ['Scanning yield protocols...', 'Re-evaluating risk params.', 'Narrative shift detected.'],
        DECISION: ['Holding position.', 'Opening LONG ETH.', 'Reducing exposure.'],
        RESULT: ['+2.4% on ETH.', 'Drawdown within bounds.', 'Daily target reached.']
    };
    observationIntervals.push(setInterval(function() {
        var type = obsTypes[Math.floor(Math.random() * obsTypes.length)];
        var arr = messages[type];
        addObservationEntry(type, arr[Math.floor(Math.random() * arr.length)]);
    }, 3500));
    observationIntervals.push(setInterval(function() {
        if (!observationStatus) return;
        var s = STATUSES[Math.floor(Math.random() * STATUSES.length)];
        observationStatus.textContent = s.text;
    }, 5000));
    addObservationEntry('THOUGHT', 'Agent online. Observing.');
}

function stopObservationFeed() {
    observationIntervals.forEach(function(i) { clearInterval(i); });
    observationIntervals = [];
}

function openObservationMode() {
    if (tvDappOverlay) { tvDappOverlay.classList.remove('is-visible'); document.body.classList.remove('dapp-open'); }
    stopDAppBehavior();
    closePaintingFocus();
    if (deployOverlay) deployOverlay.classList.remove('is-visible');
    if (deployDimmer) deployDimmer.classList.remove('is-active');
    if (puertaC) puertaC.classList.remove('is-door-open');
    focusMode = 'sofa';
    if (observationDimmer) observationDimmer.classList.add('is-active');
    if (observationFeed) observationFeed.innerHTML = '';
    transitionCamera(SOFA, 1200);
    setTimeout(function() {
        if (observationOverlay) observationOverlay.classList.add('is-visible');
        startObservationFeed();
    }, 1200);
}

function closeObservationMode() {
    focusMode = 'default';
    if (observationDimmer) observationDimmer.classList.remove('is-active');
    if (observationOverlay) observationOverlay.classList.remove('is-visible');
    stopObservationFeed();
    delete minimizedWindows['observation'];
    removeFromTaskbar('observation');
    transitionCamera(DEFAULT, 1200);
}

var deployOverlay = document.getElementById('deployOverlay');
var deployDimmer = document.getElementById('deployDimmer');
var puertaC = document.querySelector('.puerta-c');
var deploySteps = document.querySelectorAll('.deploy-step');
var deployCurrentStep = 1;
var deployPrevBtn = document.getElementById('deployPrev');
var deployNextBtn = document.getElementById('deployNext');
var deployCancelBtn = document.getElementById('deployCancel');
var deployBtn = document.getElementById('deployBtn');
var deployLaunchState = document.getElementById('deployLaunchState');
var deployConfirmation = document.getElementById('deployConfirmation');
var deployAgentIdEl = document.getElementById('deployAgentId');
var deployProfileLink = document.getElementById('deployProfileLink');

function openDeployMode() {
    if (tvDappOverlay) { tvDappOverlay.classList.remove('is-visible'); document.body.classList.remove('dapp-open'); }
    stopDAppBehavior();
    closePaintingFocus();
    focusMode = 'door';
    if (observationOverlay) observationOverlay.classList.remove('is-visible');
    if (observationDimmer) observationDimmer.classList.remove('is-active');
    stopObservationFeed();
    if (deployDimmer) deployDimmer.classList.add('is-active');
    if (puertaC) puertaC.classList.add('is-door-open');
    deployCurrentStep = 1;
    deploySteps && deploySteps.forEach(function(s, i) {
        s.classList.toggle('is-active', i === 0);
    });
    if (deployLaunchState) deployLaunchState.style.display = '';
    if (deployConfirmation) deployConfirmation.style.display = 'none';
    goDeployStep(1);
    transitionCamera(DOOR, 1200);
    setTimeout(function() {
        if (deployOverlay) deployOverlay.classList.add('is-visible');
    }, 1200);
}

function closeDeployMode() {
    focusMode = 'default';
    if (deployDimmer) deployDimmer.classList.remove('is-active');
    if (deployOverlay) deployOverlay.classList.remove('is-visible');
    if (puertaC) puertaC.classList.remove('is-door-open');
    delete minimizedWindows['deploy'];
    removeFromTaskbar('deploy');
    transitionCamera(DEFAULT, 1200);
}

if (observationStandUp) observationStandUp.addEventListener('click', function(e) { e.stopPropagation(); closeObservationMode(); });
var observationCloseBtn = document.getElementById('observationClose');
if (observationCloseBtn) observationCloseBtn.addEventListener('click', function(e) { e.stopPropagation(); closeObservationMode(); });
if (observationDimmer) observationDimmer.addEventListener('click', function() { if (focusMode === 'sofa') closeObservationMode(); });
observationOverlay && observationOverlay.addEventListener('click', function(e) { if (e.target === observationOverlay) closeObservationMode(); });
document.querySelector('.observation-panel') && document.querySelector('.observation-panel').addEventListener('click', function(e) { e.stopPropagation(); });
if (deployDimmer) deployDimmer.addEventListener('click', function() { if (focusMode === 'door') closeDeployMode(); });
deployOverlay && deployOverlay.addEventListener('click', function(e) { if (e.target === deployOverlay) closeDeployMode(); });

function goDeployStep(step) {
    deployCurrentStep = step;
    deploySteps && deploySteps.forEach(function(s, i) {
        s.classList.toggle('is-active', parseInt(s.getAttribute('data-step'), 10) === step);
    });
    if (deployPrevBtn) deployPrevBtn.style.display = step === 1 ? 'none' : '';
    if (deployNextBtn) deployNextBtn.style.display = step >= 4 ? 'none' : '';
    if (deployBtn) deployBtn.style.display = step === 4 ? '' : 'none';
}

if (deployNextBtn) deployNextBtn.addEventListener('click', function() {
    if (deployCurrentStep < 4) goDeployStep(deployCurrentStep + 1);
});
if (deployPrevBtn) deployPrevBtn.addEventListener('click', function() {
    if (deployCurrentStep > 1) goDeployStep(deployCurrentStep - 1);
});
if (deployCancelBtn) deployCancelBtn.addEventListener('click', function() { closeDeployMode(); });
var deployCloseBtn = document.getElementById('deployClose');
if (deployCloseBtn) deployCloseBtn.addEventListener('click', function(e) { e.stopPropagation(); closeDeployMode(); });
document.querySelector('.deploy-panel') && document.querySelector('.deploy-panel').addEventListener('click', function(e) { e.stopPropagation(); });
if (deployBtn) deployBtn.addEventListener('click', function() {
    if (deployLaunchState) deployLaunchState.style.display = 'none';
    if (deployConfirmation) deployConfirmation.style.display = 'block';
    if (deployAgentIdEl) deployAgentIdEl.textContent = 'CP-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    if (deployProfileLink) deployProfileLink.href = '#agent-' + (deployAgentIdEl ? deployAgentIdEl.textContent : '');
});

document.querySelectorAll('.deploy-avatar').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.deploy-avatar').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
    });
});
document.querySelectorAll('.deploy-strategy').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.deploy-strategy').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
    });
});

if (puertaC) {
    puertaC.style.cursor = 'pointer';
    puertaC.addEventListener('click', function(e) {
        e.stopPropagation();
        if (focusMode !== 'default') return;
        openDeployMode();
    });
}

document.querySelectorAll('.dapp-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var tab = btn.getAttribute('data-tab');
        if (tab) switchDappPanel(tab);
    });
});
// Run analysis button removed

modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    delete minimizedWindows['project'];
    removeFromTaskbar('project');
});
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        delete minimizedWindows['project'];
        removeFromTaskbar('project');
    }
});

const tablet = document.querySelector('.tablet');
const manifestModal = document.getElementById('manifestModal');
const manifestClose = document.getElementById('manifestClose');
const manifestText = document.getElementById('manifestText');

const manifestContent = `CLAWPITAL is an autonomous AI investment agent built on OpenClaw. It is designed to be forked, deployed, and instructed by anyone who wants a sovereign trading agent operating fully under their own rules. CLAWPITAL does not manage pooled capital, does not belong to a central fund, and does not make decisions on behalf of others. Each deployment is a self contained agent that acts only according to the instructions and risk boundaries defined by its owner.

Once deployed, CLAWPITAL exists inside the market as a continuous researcher and executor. It observes crypto markets in real time, forms its own view of conditions, and translates that understanding into concrete actions. Every decision is logged, every trade is visible, and performance is reported transparently so the owner can see not only what happened, but why it happened.

CLAWPITAL can operate across multiple layers of the crypto economy:

1. It researches and allocates capital into DeFi opportunities by analyzing yields, protocol mechanics, risks, and sustainability, rotating positions as conditions change rather than chasing static APYs.

2. It evaluates fundamentals by tracking token supply dynamics, usage signals, revenue flows, incentives, and upcoming catalysts, building positions based on structural strength instead of short term noise.

3. It monitors narratives and market psychology, detecting emerging alpha, viral trends, and sentiment shifts, and acting when those signals align with its defined risk profile.

CLAWPITAL is not a product that asks for trust. It is a tool that enforces autonomy. You decide the rules, the limits, and the objectives. The agent executes, learns, and adapts inside those boundaries, turning instructions into action while remaining fully accountable to the person who deployed it.`;

function typeText(text, element, speed) {
    speed = speed || 5;
    let index = 0;
    element.innerHTML = '';
    let lines = [];
    let currentLine = '';
    let isNewLine = true;
    const statusEl = document.querySelector('.pixel-status');
    const contentContainer = element.parentElement;
    let rafId = null;
    let lastUpdate = 0;
    const UPDATE_THROTTLE = 16; // ~60fps
    
    function scrollToBottom() {
        if (contentContainer) contentContainer.scrollTop = contentContainer.scrollHeight;
    }
    function updateDisplay() {
        const now = performance.now();
        if (now - lastUpdate < UPDATE_THROTTLE) return;
        lastUpdate = now;
        
        let html = lines.map(function(l) { return l + '<br>'; }).join('') + currentLine + '<span class="typing-cursor">|</span>';
        element.innerHTML = html;
        requestAnimationFrame(scrollToBottom);
    }
    function type() {
        if (index < text.length) {
            var char = text[index];
            if (isNewLine && char !== '\n' && char.trim() !== '') {
                currentLine += '<span class="prompt">></span> ';
                isNewLine = false;
            }
            if (char === '\n') {
                lines.push(currentLine);
                currentLine = '';
                isNewLine = true;
            } else {
                currentLine += char;
            }
            updateDisplay();
            index++;
            setTimeout(type, speed);
        } else {
            if (currentLine) lines.push(currentLine);
            element.innerHTML = lines.map(function(l) { return l + '<br>'; }).join('');
            requestAnimationFrame(scrollToBottom);
            if (statusEl) statusEl.textContent = 'MANIFEST LOADED';
        }
    }
    type();
}

tablet.addEventListener('click', (e) => {
    e.stopPropagation();
    if (focusMode !== 'default') return;
    manifestModal.style.display = 'flex';
    manifestText.innerHTML = '';
    var statusEl = document.querySelector('.pixel-status');
    if (statusEl) statusEl.textContent = 'LOADING MANIFEST ...';
    typeText(manifestContent, manifestText, 5);
});

manifestClose.addEventListener('click', () => {
    manifestModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    delete minimizedWindows['manifest'];
    removeFromTaskbar('manifest');
});
manifestModal.addEventListener('click', (e) => {
    if (e.target === manifestModal) {
        manifestModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        delete minimizedWindows['manifest'];
        removeFromTaskbar('manifest');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (focusMode === 'sofa') closeObservationMode();
        else if (focusMode === 'door') closeDeployMode();
        else if (focusMode === 'painting_left' || focusMode === 'painting_right') closePaintingFocus();
        else if (tvDappOverlay && tvDappOverlay.classList.contains('is-visible')) closeDapp();
        else if (docsModal && docsModal.style.display === 'flex') {
            docsModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            delete minimizedWindows['docs'];
            removeFromTaskbar('docs');
        }
        else {
            modal.style.display = 'none';
            manifestModal.style.display = 'none';
            if (docsModal) docsModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            delete minimizedWindows['project'];
            delete minimizedWindows['manifest'];
            delete minimizedWindows['docs'];
            removeFromTaskbar('project');
            removeFromTaskbar('manifest');
            removeFromTaskbar('docs');
        }
    }
});

const skipBtn = document.querySelector('.pixel-btn-skip');
if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        manifestText.innerHTML = manifestContent.split('\n').map(function(line) {
            return line ? '<span class="prompt">></span> ' + line : '';
        }).join('<br>');
    });
}
const githubBtn = document.querySelector('.pixel-btn-github');
if (githubBtn) githubBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    window.open('https://github.com/brianweb3/clawpital', '_blank', 'noopener,noreferrer');
});

const sofa = document.querySelector('.sillon-c');
if (sofa) {
    sofa.style.cursor = 'pointer';
    sofa.addEventListener('click', (e) => {
        e.stopPropagation();
        if (focusMode !== 'default') return;
        openObservationMode();
    });
}

var docsModal = document.getElementById('docsModal');
var docsCloseBtn = document.getElementById('docsClose');
if (docsCloseBtn) docsCloseBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (docsModal) { docsModal.style.display = 'none'; document.body.classList.remove('modal-open'); }
    delete minimizedWindows['docs'];
    removeFromTaskbar('docs');
});
if (docsModal) docsModal.addEventListener('click', function(e) {
    if (e.target === docsModal) {
        docsModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        delete minimizedWindows['docs'];
        removeFromTaskbar('docs');
    }
});

var libros = document.querySelector('.libros');
if (libros) {
    libros.addEventListener('click', function(e) {
        e.stopPropagation();
        if (focusMode !== 'default') return;
        if (docsModal) docsModal.style.display = 'flex';
    });
}

// Balance counter
var balanceValueEl = document.getElementById('balanceValue');
var roiValueEl = document.getElementById('roiValue');
var pnlValueEl = document.getElementById('pnlValue');
var currentBalance = 1000; // Will be synced with totalCapital from capitalAllocation
var initialBalance = 1000; // Starting balance for ROI/PNL calculation

function formatBalance(value) {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatROI(value) {
    var sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
}

function formatPNL(value) {
    var sign = value >= 0 ? '+' : '';
    return sign + formatBalance(Math.abs(value));
}

function updateMetrics() {
    if (!roiValueEl || !pnlValueEl) return;
    
    // Calculate ROI: (current - initial) / initial * 100
    var roi = ((currentBalance - initialBalance) / initialBalance) * 100;
    
    // Calculate PNL: current - initial
    var pnl = currentBalance - initialBalance;
    
    // Update ROI display
    roiValueEl.textContent = formatROI(roi);
    roiValueEl.style.color = roi >= 0 ? '#4CAF50' : '#e03636'; // Green for positive, red for negative
    
    // Update PNL display
    pnlValueEl.textContent = formatPNL(pnl);
    pnlValueEl.style.color = pnl >= 0 ? '#4CAF50' : '#e03636'; // Green for positive, red for negative
}

function updateBalance() {
    if (!balanceValueEl) return;
    
    // Update balance (simulate growth)
    currentBalance += 0.2;
    
    // Sync capital allocation with new balance
    const currentTotal = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
    if (currentTotal > 0) {
        const scaleFactor = currentBalance / currentTotal;
        Object.keys(capitalAllocation).forEach(function(key) {
            capitalAllocation[key].amount = capitalAllocation[key].amount * scaleFactor;
        });
        totalCapital = currentBalance;
    }
    
    balanceValueEl.classList.add('updating');
    balanceValueEl.textContent = formatBalance(currentBalance);
    updateMetrics(); // Update ROI and PNL when balance changes
    updateWalletBalance(); // Update wallet display
    
    // Save balance to server every 5 seconds
    if (!updateBalance.saveTimer) {
        updateBalance.saveTimer = setTimeout(function() {
            saveBalanceToServer();
            updateBalance.saveTimer = null;
        }, 5000);
    }
    
    setTimeout(function() {
        if (balanceValueEl) balanceValueEl.classList.remove('updating');
    }, 400);
}

function updateWalletBalance() {
    // Update wallet display if wallet tab is visible
    var walletCard = document.getElementById('dappWalletCard');
    if (walletCard) {
        var balance = currentBalance || totalCapital || 1000;
        var balanceEl = walletCard.querySelector('.dapp-wallet-balance');
        if (balanceEl) {
            balanceEl.innerHTML = formatBalance(balance) + ' <span class="usd">USD</span>';
        } else {
            // Re-render if structure changed
            fillDappWallet();
        }
    }
}

// Initialize when DOM is ready
function initializeBalance() {
    // Try to load balance from server first
    loadBalanceFromServer().then(function(loaded) {
        if (!loaded) {
            // Sync balance with capital allocation if not loaded from server
            totalCapital = Object.values(capitalAllocation).reduce((sum, item) => sum + item.amount, 0);
            currentBalance = totalCapital;
            initialBalance = totalCapital;
        }
        
        if (balanceValueEl) {
            balanceValueEl.textContent = formatBalance(currentBalance);
            updateMetrics(); // Initial update
            setInterval(updateBalance, 1000);
        }
        
        // Initialize wallet display
        updateWalletBalance();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBalance);
} else {
    // DOM is already ready
    initializeBalance();
}

// Camera preset toggle
var currentCameraMode = 'custom';
var toggleDefault = document.getElementById('toggleDefault');
var toggleCustom = document.getElementById('toggleCustom');

function setCameraMode(mode) {
    currentCameraMode = mode;
    var target;
    if (mode === 'default') {
        target = DEFAULT;
        if (toggleDefault) toggleDefault.classList.add('active');
        if (toggleCustom) toggleCustom.classList.remove('active');
    } else {
        target = CUSTOM;
        if (toggleDefault) toggleDefault.classList.remove('active');
        if (toggleCustom) toggleCustom.classList.add('active');
    }
    transitionCamera(target, 800);
}

// Set initial camera mode to custom (preset 2)
if (toggleCustom) {
    toggleCustom.classList.add('active');
    toggleCustom.addEventListener('click', function() {
        setCameraMode('custom');
    });
}
if (toggleDefault) {
    toggleDefault.addEventListener('click', function() {
        setCameraMode('default');
    });
}
