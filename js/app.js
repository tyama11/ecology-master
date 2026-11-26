import { CATEGORY_CONFIG, DIFFICULTY_LABELS, getItemsForCategory, getOniRankInfo } from './data.js';
import { byId, bySelector } from './dom.js';
import { ONI_BONUS_SECONDS, ONI_PENALTY_SECONDS, ONI_TIME_LIMIT, buildOniQuestion, buildStandardCards, computeRemainingSeconds, isBonusCombo } from './game-logic.js';
import { shuffleInPlace } from './random.js';
import { createSoundFx } from './sound.js';
import { createProgressStore, safeLocalStorage } from './storage.js';
                                                             

const storage = safeLocalStorage();
const progress = createProgressStore(storage);
const SOUND_FX = createSoundFx(storage);

const state = {
    category: 'photo'            ,
    difficulty: 'easy'              ,
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalQuestions: 0,
    selectedItemId: null                 ,
    currentOniStageId: null                 ,
    items: []          ,
    nextUid: 0,
    timeLeft: ONI_TIME_LIMIT,
    lastTickSecond: -1,
    oniEndTime: 0,
    isPlaying: false,
    justUnlockedOni: false,
    timerInterval: null                                         ,
    toastTimeout: null                                        ,
    returnTimeout: null                                        
};

const els = {
    homeScreen: byId('home-screen'),
    gameScreen: byId('game-screen'),
    mainArea: bySelector('.main'),
    homeDesc: byId('home-desc'),
    earnedTitleBanner: byId('earned-title-banner'),
    ruleOniItem: byId('rule-oni-item'),
    btnOni: byId                   ('btn-oni'),
    homeMuteBtn: byId                   ('home-mute-btn'),
    gameMuteBtn: byId                   ('game-mute-btn'),
    tabScore1: byId('tab-score-1'),
    tabScore2: byId('tab-score-2'),
    categoryTabs: document.querySelectorAll                   ('.category-tab'),
    modeButtons: document.querySelectorAll                   ('.mode-btn'),
    homeBtn: byId                   ('home-btn'),
    modeDisplay: byId('mode-display'),
    trayTitleText: byId('tray-title-text'),
    trayHint: byId('tray-hint'),
    progressContainer: byId('progress-container'),
    timerBadge: byId('timer-badge'),
    timerText: byId('timer-text'),
    comboBadge: byId('combo-badge'),
    scoreText: byId('score-text'),
    progressFill: byId('progress-fill'),
    boardSvg: byId               ('board-svg'),
    cardList: byId('card-list'),
    toast: byId('toast'),
    clearOverlay: byId('clear-overlay'),
    clearTitle: byId('clear-title'),
    clearSubtitle: byId('clear-subtitle'),
    clearActions: byId('clear-actions'),
    autoReturnText: byId('auto-return-text'),
    retryBtn: byId                   ('retry-btn'),
    overlayHomeBtn: byId                   ('overlay-home-btn')
};

function init()       {
    els.categoryTabs.forEach((tab) => tab.addEventListener('click', () => {
        SOUND_FX.playTap();
        const cat = tab.dataset['category']            ;
        setCategory(cat);
    }));
    els.modeButtons.forEach((btn) => btn.addEventListener('click', () => {
        SOUND_FX.playTap();
        startGame(btn.dataset['difficulty']              );
    }));
    els.homeBtn.addEventListener('click', () => { SOUND_FX.playTap(); resetToHome(); });
    els.overlayHomeBtn.addEventListener('click', () => { SOUND_FX.playTap(); resetToHome(); });
    els.retryBtn.addEventListener('click', () => { SOUND_FX.playTap(); els.clearOverlay.classList.remove('active'); startGame(state.difficulty); });
    const mute = () => { SOUND_FX.toggleMute(); syncMute(); };
    els.homeMuteBtn.addEventListener('click', mute);
    els.gameMuteBtn.addEventListener('click', mute);
    syncMute();

    els.boardSvg.addEventListener('click', (e) => {
        if (!state.isPlaying || state.difficulty === 'oni' || !state.selectedItemId) return;
        const node = (e.target                  )?.closest             ('.stage-node.interactive-target');
        if (node) attemptPlace(node.dataset['stage'] ?? '');
    });
    els.boardSvg.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && state.isPlaying && state.difficulty !== 'oni') {
            const node = (e.target                  )?.closest             ('.stage-node.interactive-target');
            if (node) { e.preventDefault(); attemptPlace(node.dataset['stage'] ?? ''); }
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!els.gameScreen.classList.contains('active') || !state.isPlaying) return;
        if (state.difficulty === 'oni' && /^[1-9]$/.test(e.key)) {
            const t = els.cardList.querySelectorAll             ('.bio-card')[Number(e.key) - 1];
            if (t) { e.preventDefault(); t.click(); }
        } else if (e.key === 'Escape' && state.selectedItemId) {
            state.selectedItemId = null; renderCards();
        }
    });
    setCategory('photo');
    updateTabScores();
}

function syncMute()       {
    const m = SOUND_FX.isMuted();
    els.homeMuteBtn.textContent = m ? '🔇 音OFF' : '🔊 音ON';
    els.gameMuteBtn.textContent = m ? '🔇' : '🔊';
}

function updateTabScores()       {
    [['photo', els.tabScore1], ['eco', els.tabScore2]].forEach(([c, el]) => {
        const s = progress.getOniBest(c            );
        if (s !== null) { (el               ).textContent = `👹 ${s}問`; (el               ).hidden = false; }
        else (el               ).hidden = true;
    });
    const saved = progress.getOniBest(state.category);
    if (saved === null) { els.earnedTitleBanner.hidden = true; return; }
    const r = getOniRankInfo(saved);
    els.earnedTitleBanner.className = `earned-title-banner ${r.className}`;
    els.earnedTitleBanner.textContent = `称号：${r.icon} ${r.title}`;
    els.earnedTitleBanner.hidden = false;
}

function setCategory(cat          )       {
    state.category = cat;
    els.categoryTabs.forEach((tab) => {
        const a = tab.dataset['category'] === cat;
        tab.classList.toggle('active', a);
        tab.setAttribute('aria-selected', String(a));
    });
    els.homeDesc.textContent = CATEGORY_CONFIG[cat].description;
    const unlocked = progress.isOniUnlocked(cat);
    els.ruleOniItem.hidden = !unlocked;
    els.btnOni.hidden = !unlocked;
    updateTabScores();
}

function renderBoardBackdropSvg(cat          )         {
    if (cat === 'photo') {
        return `
        <!-- Top panel: 光の強さと光合成速度グラフ -->
        <g transform="translate(16, 10)">
            <rect width="668" height="180" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="20" y="24" font-size="13" font-weight="700" fill="#334155">光の強さと光合成速度グラフ</text>
            <!-- Axes -->
            <line x1="60" y1="140" x2="620" y2="140" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <line x1="60" y1="140" x2="60" y2="35" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <text x="625" y="144" font-size="11" fill="#64748B">光の強さ</text>
            <text x="50" y="32" font-size="11" fill="#64748B">光合成速度</text>
            <text x="52" y="152" font-size="10" fill="#64748B">0</text>
            <!-- Curves: 陽生植物 (solid) & 陰生植物 (dashed) -->
            <path d="M 60 120 Q 200 60 380 60 L 610 60" fill="none" stroke="#2563EB" stroke-width="2.5"/>
            <text x="400" y="55" font-size="10" font-weight="700" fill="#2563EB">陽生植物</text>
            <path d="M 60 100 Q 140 45 240 45 L 610 45" fill="none" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5,3"/>
            <text x="260" y="40" font-size="10" font-weight="700" fill="#10B981">陰生植物</text>
            <!-- Highlights: compensations / saturations -->
            <line x1="140" y1="140" x2="140" y2="100" stroke="#94A3B8" stroke-dasharray="2,2"/>
            <text x="140" y="153" font-size="9" text-anchor="middle" fill="#64748B">光補償点</text>
            <line x1="380" y1="140" x2="380" y2="60" stroke="#94A3B8" stroke-dasharray="2,2"/>
            <text x="380" y="153" font-size="9" text-anchor="middle" fill="#64748B">光飽和点</text>
        </g>
        <!-- Bottom panel: 植生の遷移 -->
        <g transform="translate(16, 200)">
            <rect width="668" height="325" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="20" y="24" font-size="13" font-weight="700" fill="#334155">植生の遷移（裸地→草原→低木林→陽樹林→混交林→陰樹林[極相]）</text>
            <g transform="translate(30, 45)">
                <!-- Progression boxes & arrows -->
                <rect x="0" y="20" width="90" height="50" rx="8" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
                <text x="45" y="43" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">裸地</text>
                <text x="45" y="58" text-anchor="middle" font-size="9" fill="#64748B">（乾性/湿性）</text>
                
                <path d="M 95 45 L 115 45" stroke="#0D9488" stroke-width="2" marker-end="url(#arrow)"/>
                
                <rect x="120" y="20" width="90" height="50" rx="8" fill="#CCFBF1" stroke="#2DD4BF" stroke-width="1.5"/>
                <text x="165" y="43" text-anchor="middle" font-size="11" font-weight="700" fill="#0F766E">草原本</text>
                <text x="165" y="58" text-anchor="middle" font-size="9" fill="#115E59">イネ科・ススキ</text>
                
                <path d="M 215 45 L 235 45" stroke="#0D9488" stroke-width="2" marker-end="url(#arrow)"/>
                
                <rect x="240" y="20" width="90" height="50" rx="8" fill="#FEF08A" stroke="#FACC15" stroke-width="1.5"/>
                <text x="285" y="43" text-anchor="middle" font-size="11" font-weight="700" fill="#854D0E">低木林</text>
                <text x="285" y="58" text-anchor="middle" font-size="9" fill="#713F12">キイチゴ等</text>
                
                <path d="M 335 45 L 355 45" stroke="#0D9488" stroke-width="2" marker-end="url(#arrow)"/>
                
                <rect x="360" y="20" width="90" height="50" rx="8" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1.5"/>
                <text x="405" y="43" text-anchor="middle" font-size="11" font-weight="700" fill="#0369A1">陽樹林</text>
                <text x="405" y="58" text-anchor="middle" font-size="9" fill="#075985">アカマツ・クロマツ</text>
                
                <path d="M 455 45 L 475 45" stroke="#0D9488" stroke-width="2" marker-end="url(#arrow)"/>
                
                <rect x="480" y="20" width="90" height="50" rx="8" fill="#DDD6FE" stroke="#A78BFA" stroke-width="1.5"/>
                <text x="525" y="43" text-anchor="middle" font-size="11" font-weight="700" fill="#5B21B6">混交林</text>
                <text x="525" y="58" text-anchor="middle" font-size="9" fill="#4C1D95">陽樹＋陰樹</text>
                
                <path d="M 572 45 L 590 45" stroke="#0D9488" stroke-width="2" marker-end="url(#arrow)"/>
                
                <rect x="595" y="20" width="45" height="50" rx="8" fill="#FBCFE8" stroke="#F472B6" stroke-width="1.5"/>
                <text x="617" y="42" text-anchor="middle" font-size="10" font-weight="700" fill="#9D174D">陰樹林</text>
                <text x="617" y="58" text-anchor="middle" font-size="8" fill="#831843">（極相）</text>
            </g>
            <text x="334" y="130" text-anchor="middle" font-size="11" fill="#475569">💡 土壌の発達や光環境（地表の暗さ）の変化に伴うバトンタッチの歴史</text>
        </g>`;
    } else {
        return `
        <!-- Top-left panel: 垂直分布 -->
        <g transform="translate(16, 10)">
            <rect width="326" height="180" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="16" y="24" font-size="12" font-weight="700" fill="#334155">垂直分布（山岳断面図・森林限界2500m）</text>
            <!-- Mountain polygon -->
            <polygon points="30,160 163,50 296,160" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
            <text x="163" y="100" text-anchor="middle" font-size="10" fill="#475569">高山帯（2500m〜）</text>
            <text x="163" y="125" text-anchor="middle" font-size="10" fill="#475569">亜高山帯 / 針葉樹林</text>
            <text x="163" y="148" text-anchor="middle" font-size="10" fill="#475569">山地帯 / 落葉広葉樹</text>
            <text x="163" y="158" text-anchor="middle" font-size="9" fill="#1E293B">丘陵帯 / 常緑広葉樹</text>
            <line x1="80" y1="75" x2="246" y2="75" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="3,3"/>
            <text x="260" y="78" font-size="9" fill="#EF4444">森林限界</text>
        </g>
        <!-- Top-right panel: 川の自然浄化グラフ -->
        <g transform="translate(358, 10)">
            <rect width="326" height="180" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="16" y="24" font-size="12" font-weight="700" fill="#334155">川の自然浄化グラフ</text>
            <!-- Axes -->
            <line x1="40" y1="150" x2="300" y2="150" stroke="#64748B" stroke-width="1.2"/>
            <line x1="40" y1="150" x2="40" y2="40" stroke="#64748B" stroke-width="1.2"/>
            <text x="170" y="170" text-anchor="middle" font-size="10" fill="#64748B">下流への流れ（時間経過）</text>
            <!-- Staggered peak curves -->
            <path d="M 40 140 Q 80 50 120 140" fill="none" stroke="#EF4444" stroke-width="2"/>
            <text x="80" y="45" text-anchor="middle" font-size="9" font-weight="700" fill="#EF4444">細菌増殖</text>
            <path d="M 100 140 Q 140 65 180 140" fill="none" stroke="#F59E0B" stroke-width="2"/>
            <text x="140" y="60" text-anchor="middle" font-size="9" font-weight="700" fill="#F59E0B">ゾウリムシ</text>
            <path d="M 160 140 Q 210 75 260 140" fill="none" stroke="#10B981" stroke-width="2"/>
            <text x="210" y="70" text-anchor="middle" font-size="9" font-weight="700" fill="#10B981">藻類増殖</text>
        </g>
        <!-- Bottom panel: 富栄養化＆地球環境問題 -->
        <g transform="translate(16, 200)">
            <rect width="668" height="325" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="20" y="24" font-size="13" font-weight="700" fill="#334155">富栄養化（アオコ vs 赤潮）＆ 地球環境問題（温暖化 vs オゾン層）</text>
            <g transform="translate(25, 40)">
                <rect x="0" y="0" width="300" height="120" rx="8" fill="#E0F2FE" stroke="#7DD3FC" stroke-width="1.5"/>
                <text x="150" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#0369A1">🌊 富栄養化現象</text>
                <text x="15" y="45" font-size="10" fill="#334155">・生活排水や肥料の流入によるN・P過剰</text>
                <text x="15" y="68" font-size="10" fill="#334155">・淡水（湖沼）での発生 ＝ <b>アオコ</b>（藍藻類）</text>
                <text x="15" y="91" font-size="10" fill="#334155">・海水（内湾）での発生 ＝ <b>赤潮</b>（植物プランクトン）</text>
            </g>
            <g transform="translate(343, 40)">
                <rect x="0" y="0" width="300" height="120" rx="8" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.5"/>
                <text x="150" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#B45309">🌍 地球環境問題</text>
                <text x="15" y="45" font-size="10" fill="#334155">・<b>地球温暖化</b>：CO2等温室効果ガスによる<b>赤外線</b>吸収</text>
                <text x="15" y="68" font-size="10" fill="#334155">・<b>オゾン層破壊</b>：フロンガス等による<b>紫外線</b>遮断低下</text>
                <text x="15" y="91" font-size="10" fill="#334155">💡 試験で混同しやすいため波長・原因物質を対比！</text>
            </g>
        </g>`;
    }
}



function renderBoardSvg(oniBlankStageId               )       {
    const items = getItemsForCategory(state.category);
    const backdrop = renderBoardBackdropSvg(state.category);
    const nodes = items.map((s, idx) => {
        const isBlank = oniBlankStageId !== null ? s.stageId === oniBlankStageId : true;
        const cls = oniBlankStageId !== null
            ? (isBlank ? 'stage-node oni-target-blank interactive-target' : 'stage-node solved')
            : 'stage-node interactive-target masked';
        const txt = oniBlankStageId !== null
            ? (isBlank ? '【 ？ 】' : s.name)
            : (state.difficulty === 'normal' ? `【 ${idx + 1} 】` : '？');
        const label = state.difficulty === 'easy'
            ? `<text x="0" y="-14" text-anchor="middle" font-size="12" font-weight="700" fill="#5B6E82">${s.boxLabel}</text>`
            : '';
        return `<g class="${cls}" data-stage="${s.stageId}" tabindex="0" role="button" transform="translate(${s.x}, ${s.y})">
            <g class="stage-visual">
                <rect class="stage-box ${isBlank && oniBlankStageId ? 'oni-focus-box' : ''}" x="-92" y="-38" width="184" height="76" rx="16" fill="#FFFFFF" stroke="#6F7977" stroke-width="2.5" />
                ${label}
                <text class="stage-label" x="0" y="${state.difficulty === 'easy' ? 14 : 6}" text-anchor="middle" font-size="16" font-weight="800" fill="#161D1C">${txt}</text>
            </g>
        </g>`;
    }).join('');
    els.boardSvg.innerHTML = backdrop + nodes;
}

function startGame(difficulty            )       {
    stopTimers();
    state.difficulty = difficulty;
    state.score = 0; state.combo = 0; state.maxCombo = 0;
    state.selectedItemId = null; state.currentOniStageId = null;
    state.timeLeft = ONI_TIME_LIMIT; state.lastTickSecond = -1; state.isPlaying = true;

    const isOni = difficulty === 'oni';
    els.progressContainer.classList.toggle('oni-active', isOni);
    els.timerBadge.hidden = !isOni;
    els.scoreText.hidden = !isOni;
    els.progressFill.classList.toggle('timer-fill', isOni);
    els.modeDisplay.textContent = `${CATEGORY_CONFIG[state.category].label} / ${DIFFICULTY_LABELS[difficulty]}`;

    if (isOni) {
        els.trayTitleText.textContent = '❓ ？に入るのは？';
        els.trayHint.textContent = '👆クリック または 1・2・3キーで回答';
        nextOni();
        updateOniHud();
        state.oniEndTime = Date.now() + ONI_TIME_LIMIT * 1000;
        state.timerInterval = setInterval(() => {
            const rem = Math.max(0, state.oniEndTime - Date.now());
            state.timeLeft = computeRemainingSeconds(state.oniEndTime, Date.now());
            if (state.timeLeft <= 10 && state.timeLeft > 0 && state.timeLeft !== state.lastTickSecond) {
                state.lastTickSecond = state.timeLeft; SOUND_FX.playTick();
            }
            updateOniHud(rem);
            if (rem <= 0) { stopTimers(); handleOniTimeUp(); }
        }, 100);
    } else {
        els.trayTitleText.textContent = CATEGORY_CONFIG[state.category].trayTitle;
        els.trayHint.textContent = '👆カードを選んで図の枠をクリック';
        renderBoardSvg(null);
        const built = buildStandardCards(state.category, state.nextUid);
        state.nextUid = built.nextUid;
        state.items = shuffleInPlace(built.items);
        state.totalQuestions = state.items.length;
        els.progressFill.style.width = '0%';
        renderCards();
    }
    els.homeScreen.classList.remove('active');
    els.gameScreen.classList.add('active');
}

function nextOni()       {
    const q = buildOniQuestion(state.category, state.currentOniStageId, state.nextUid);
    state.currentOniStageId = q.target.stageId;
    state.nextUid = q.nextUid;
    state.items = q.choices;
    els.trayTitleText.textContent = q.askHint ? '❓ ？の時期・項目はどれ？' : '❓ ？に入る名称は？';
    renderBoardSvg(q.target.stageId);
    renderCards();
}

function renderCards()       {
    els.cardList.innerHTML = '';
    const isOni = state.difficulty === 'oni';
    const isEasy = state.difficulty === 'easy';
    els.cardList.classList.toggle('oni-choices', isOni);
    state.items.forEach((item, idx) => {
        const card = document.createElement('div');
        const sel = state.selectedItemId === item.id;
        card.className = `bio-card${sel ? ' selected' : ''}`;
        card.tabIndex = 0;
        const iconHtml = isEasy ? `<div class="feature-icon">${item.emoji}</div>` : '';
        const hintHtml = item.hint && !isOni ? `<div class="hint">${item.hint}</div>` : '';
        card.innerHTML = `${iconHtml}<div class="info"><div class="name">${item.name}</div>${hintHtml}</div>`;
        if (isOni && idx < 9) card.insertAdjacentHTML('afterbegin', `<span class="key-badge">${idx + 1}</span>`);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
        card.addEventListener('click', () => {
            if (!state.isPlaying) return;
            if (isOni) {
                if (item.stageId === state.currentOniStageId) {
                    state.score++; state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo);
                    if (isBonusCombo(state.combo)) { state.oniEndTime += ONI_BONUS_SECONDS * 1000; SOUND_FX.playBonus(); showToast(`🔥 ${state.combo}連続！ +3秒！`); }
                    else { SOUND_FX.playCorrect(state.combo); showToast('⭕ 正解！'); }
                    updateOniHud(); nextOni();
                } else {
                    state.combo = 0; SOUND_FX.playWrong(); state.oniEndTime -= ONI_PENALTY_SECONDS * 1000;
                    showToast(`❌ ミス！ -${ONI_PENALTY_SECONDS}秒`);
                    const rem = Math.max(0, state.oniEndTime - Date.now());
                    if (rem <= 0) { stopTimers(); handleOniTimeUp(); } else { updateOniHud(rem); nextOni(); }
                }
                return;
            }
            SOUND_FX.playTap();
            state.selectedItemId = sel ? null : item.id;
            renderCards();
        });
        els.cardList.appendChild(card);
    });
}

function attemptPlace(stageId        )       {
    const idx = state.items.findIndex((i) => i.id === state.selectedItemId);
    if (idx === -1) return;
    const item = state.items[idx] ;
    if (item.stageId === stageId) {
        state.score++;
        SOUND_FX.playCorrect(1);
        showToast(`⭕ 正解！ ${item.name}`);
        const node = els.boardSvg.querySelector             (`[data-stage="${stageId}"]`);
        if (node) {
            node.classList.remove('masked', 'interactive-target');
            node.classList.add('solved');
            const lbl = node.querySelector('.stage-label');
            if (lbl) lbl.textContent = item.name;
        }
        state.items.splice(idx, 1);
        state.selectedItemId = null;
        els.progressFill.style.width = `${(state.score / state.totalQuestions) * 100}%`;
        renderCards();
        if (state.score >= state.totalQuestions) handleGameClear();
    } else {
        SOUND_FX.playWrong();
        showToast('❌ 違うみたい…');
        state.selectedItemId = null;
        renderCards();
    }
}

function updateOniHud(rem = state.timeLeft * 1000)       {
    els.timerText.textContent = String(state.timeLeft);
    els.scoreText.textContent = `🏆 ${state.score}問`;
    els.progressFill.style.width = `${Math.min(100, (rem / (ONI_TIME_LIMIT * 1000)) * 100)}%`;
}

function showToast(msg        )       {
    els.toast.innerHTML = msg;
    els.toast.style.backgroundColor = msg.includes('❌') ? 'rgba(239, 68, 68, 0.95)' : 'rgba(13, 148, 136, 0.95)';
    els.toast.classList.add('show');
    if (state.toastTimeout !== null) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 1200);
}

function handleGameClear()       {
    state.isPlaying = false;
    let unlockedNow = false;
    const k = state.category;
    if (state.difficulty === 'normal' && !progress.isOniUnlocked(k)) {
        progress.unlockOni(k); state.justUnlockedOni = true; unlockedNow = true;
    }
    SOUND_FX.playClear(unlockedNow);
    els.clearTitle.innerHTML = '🎊 素晴らしい！ 🎊';
    els.clearSubtitle.innerHTML = unlockedNow ? 'すべてマスターしました！<div class="unlock-message">どこかでとびらがひらいたようだ…！</div>' : 'すべてマスターしました！';
    els.clearActions.hidden = true; els.autoReturnText.hidden = false;
    els.clearOverlay.classList.add('active');
    state.returnTimeout = setTimeout(resetToHome, unlockedNow ? 4500 : 3000);
}

function handleOniTimeUp()       {
    state.isPlaying = false;
    const k = state.category;
    const prev = progress.getOniBest(k) ?? -1;
    const best = Math.max(prev, state.score);
    if (state.score > prev) progress.setOniBest(k, best);
    updateTabScores();
    const r = getOniRankInfo(state.score);
    SOUND_FX.playTimeUp(r.rank === 'S' || r.rank === 'A');
    els.clearTitle.innerHTML = '⏱️ タイムアップ！';
    els.clearSubtitle.innerHTML = `<div class="rank-showcase ${r.className}"><span class="rank-letter">${r.rank}</span><span class="rank-title-text">${r.icon} ${r.title}</span></div><div style="font-size:40px;font-weight:900;color:var(--primary);">${state.score}問正解！</div><div>ベスト記録：<b>${best} 問</b></div>`;
    els.clearActions.hidden = false; els.autoReturnText.hidden = true;
    els.clearOverlay.classList.add('active');
}

function stopTimers()       {
    if (state.timerInterval !== null) clearInterval(state.timerInterval);
    if (state.returnTimeout !== null) clearTimeout(state.returnTimeout);
    state.timerInterval = null; state.returnTimeout = null;
}

function resetToHome()       {
    stopTimers(); state.isPlaying = false;
    els.clearOverlay.classList.remove('active');
    els.gameScreen.classList.remove('active');
    els.homeScreen.classList.add('active');
    setCategory(state.category);
    state.justUnlockedOni = false;
}

init();


//# sourceURL=app.ts