import { CATEGORY_CONFIG, DIFFICULTY_LABELS, getItemsForCategory, getOniRankInfo } from './data.ts';
import { byId, bySelector } from './dom.ts';
import { ONI_BONUS_SECONDS, ONI_PENALTY_SECONDS, ONI_TIME_LIMIT, buildOniQuestion, buildStandardCards, computeRemainingSeconds, isBonusCombo } from './game-logic.ts';
import { shuffleInPlace } from './random.ts';
import { createSoundFx } from './sound.ts';
import { createProgressStore, safeLocalStorage } from './storage.ts';
import type { Card, Category, Difficulty } from './types.ts';

const storage = safeLocalStorage();
const progress = createProgressStore(storage);
const SOUND_FX = createSoundFx(storage);

const state = {
    category: 'photo' as Category,
    difficulty: 'easy' as Difficulty,
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalQuestions: 0,
    selectedItemId: null as string | null,
    currentOniStageId: null as string | null,
    items: [] as Card[],
    nextUid: 0,
    timeLeft: ONI_TIME_LIMIT,
    lastTickSecond: -1,
    oniEndTime: 0,
    isPlaying: false,
    justUnlockedOni: false,
    timerInterval: null as ReturnType<typeof setInterval> | null,
    toastTimeout: null as ReturnType<typeof setTimeout> | null,
    returnTimeout: null as ReturnType<typeof setTimeout> | null
};

const els = {
    homeScreen: byId('home-screen'),
    gameScreen: byId('game-screen'),
    mainArea: bySelector('.main'),
    homeDesc: byId('home-desc'),
    earnedTitleBanner: byId('earned-title-banner'),
    ruleOniItem: byId('rule-oni-item'),
    btnOni: byId<HTMLButtonElement>('btn-oni'),
    homeMuteBtn: byId<HTMLButtonElement>('home-mute-btn'),
    gameMuteBtn: byId<HTMLButtonElement>('game-mute-btn'),
    tabScore1: byId('tab-score-1'),
    tabScore2: byId('tab-score-2'),
    categoryTabs: document.querySelectorAll<HTMLButtonElement>('.category-tab'),
    modeButtons: document.querySelectorAll<HTMLButtonElement>('.mode-btn'),
    homeBtn: byId<HTMLButtonElement>('home-btn'),
    modeDisplay: byId('mode-display'),
    trayTitleText: byId('tray-title-text'),
    trayHint: byId('tray-hint'),
    progressContainer: byId('progress-container'),
    timerBadge: byId('timer-badge'),
    timerText: byId('timer-text'),
    comboBadge: byId('combo-badge'),
    scoreText: byId('score-text'),
    progressFill: byId('progress-fill'),
    boardSvg: byId<SVGSVGElement>('board-svg'),
    cardList: byId('card-list'),
    toast: byId('toast'),
    clearOverlay: byId('clear-overlay'),
    clearTitle: byId('clear-title'),
    clearSubtitle: byId('clear-subtitle'),
    clearActions: byId('clear-actions'),
    autoReturnText: byId('auto-return-text'),
    retryBtn: byId<HTMLButtonElement>('retry-btn'),
    overlayHomeBtn: byId<HTMLButtonElement>('overlay-home-btn')
};

function init(): void {
    els.categoryTabs.forEach((tab) => tab.addEventListener('click', () => {
        SOUND_FX.playTap();
        const cat = tab.dataset['category'] as Category;
        setCategory(cat);
    }));
    els.modeButtons.forEach((btn) => btn.addEventListener('click', () => {
        SOUND_FX.playTap();
        startGame(btn.dataset['difficulty'] as Difficulty);
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
        const node = (e.target as Element | null)?.closest<SVGGElement>('.stage-node.interactive-target');
        if (node) attemptPlace(node.dataset['stage'] ?? '');
    });
    els.boardSvg.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && state.isPlaying && state.difficulty !== 'oni') {
            const node = (e.target as Element | null)?.closest<SVGGElement>('.stage-node.interactive-target');
            if (node) { e.preventDefault(); attemptPlace(node.dataset['stage'] ?? ''); }
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!els.gameScreen.classList.contains('active') || !state.isPlaying) return;
        if (state.difficulty === 'oni' && /^[1-9]$/.test(e.key)) {
            const t = els.cardList.querySelectorAll<HTMLElement>('.bio-card')[Number(e.key) - 1];
            if (t) { e.preventDefault(); t.click(); }
        } else if (e.key === 'Escape' && state.selectedItemId) {
            state.selectedItemId = null; renderCards();
        }
    });
    setCategory('photo');
    updateTabScores();
}

function syncMute(): void {
    const m = SOUND_FX.isMuted();
    els.homeMuteBtn.textContent = m ? '🔇 音OFF' : '🔊 音ON';
    els.gameMuteBtn.textContent = m ? '🔇' : '🔊';
}

function updateTabScores(): void {
    [['photo', els.tabScore1], ['eco', els.tabScore2]].forEach(([c, el]) => {
        const s = progress.getOniBest(c as Category);
        if (s !== null) { (el as HTMLElement).textContent = `👹 ${s}問`; (el as HTMLElement).hidden = false; }
        else (el as HTMLElement).hidden = true;
    });
    const saved = progress.getOniBest(state.category);
    if (saved === null) { els.earnedTitleBanner.hidden = true; return; }
    const r = getOniRankInfo(saved);
    els.earnedTitleBanner.className = `earned-title-banner ${r.className}`;
    els.earnedTitleBanner.textContent = `称号：${r.icon} ${r.title}`;
    els.earnedTitleBanner.hidden = false;
}

function setCategory(cat: Category): void {
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

function renderBoardBackdropSvg(cat: Category): string {
    if (cat === 'photo') {
        return `
        <!-- Top panel: 光の強さと光合成速度グラフ (x=16, y=10, w=668, h=215) -->
        <g transform="translate(16, 10)">
            <rect width="668" height="215" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="16" y="22" font-size="13" font-weight="900" fill="#334155">📈 光の強さと光合成速度グラフ（陽生植物 vs 陰生植物）</text>
            <!-- Left graph -->
            <line x1="52" y1="154" x2="354" y2="154" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <line x1="52" y1="192" x2="52" y2="40" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <text x="358" y="158" font-size="10" fill="#64748B">光</text>
            <text x="42" y="36" font-size="10" fill="#64748B">速度</text>
            <text x="42" y="158" font-size="10" fill="#64748B">0</text>
            <path d="M 52 184 Q 115 162 279 66 L 349 66" fill="none" stroke="#2563EB" stroke-width="2.5"/>
            <text x="305" y="58" font-size="10" font-weight="700" fill="#2563EB">陽生植物</text>
            <path d="M 52 170 Q 88 154 184 98 L 349 98" fill="none" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5,3"/>
            <text x="215" y="90" font-size="10" font-weight="700" fill="#10B981">陰生植物</text>
            <!-- Callout ② -> e2(560, 88) => local (544, 78) -->
            <circle cx="279" cy="66" r="6" fill="#2563EB"/>
            <line x1="285" y1="66" x2="449" y2="78" stroke="#2563EB" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arrow)"/>
            <text x="279" y="54" text-anchor="middle" font-size="11" font-weight="800" fill="#2563EB">②</text>
            <!-- Callout ① -> e1(560, 168) => local (544, 158) -->
            <circle cx="129" cy="154" r="6" fill="#0D9488"/>
            <line x1="135" y1="154" x2="449" y2="158" stroke="#0D9488" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arrow)"/>
            <text x="129" y="142" text-anchor="middle" font-size="11" font-weight="800" fill="#0D9488">①</text>
        </g>
        <!-- Bottom panel: 植生の遷移 (x=16, y=235, w=668, h=295) -->
        <g transform="translate(16, 235)">
            <rect width="668" height="295" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="16" y="22" font-size="13" font-weight="900" fill="#334155">🌲 植生の遷移（裸地 → 草原 → 低木林 → 陽樹林 → 混交林 → 終着点）</text>
            <!-- 5 compact pills -->
            <rect x="18" y="47" width="64" height="42" rx="8" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
            <text x="50" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">裸地</text>
            <path d="M 84 68 L 96 68" stroke="#0D9488" stroke-width="1.5" marker-end="url(#arrow)"/>
            <rect x="98" y="47" width="64" height="42" rx="8" fill="#CCFBF1" stroke="#2DD4BF" stroke-width="1.5"/>
            <text x="130" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#0F766E">草原</text>
            <path d="M 164 68 L 176 68" stroke="#0D9488" stroke-width="1.5" marker-end="url(#arrow)"/>
            <rect x="178" y="47" width="68" height="42" rx="8" fill="#FEF08A" stroke="#FACC15" stroke-width="1.5"/>
            <text x="212" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#854D0E">低木林</text>
            <path d="M 248 68 L 260 68" stroke="#0D9488" stroke-width="1.5" marker-end="url(#arrow)"/>
            <rect x="262" y="47" width="68" height="42" rx="8" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1.5"/>
            <text x="296" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#0369A1">陽樹林</text>
            <path d="M 332 68 L 344 68" stroke="#0D9488" stroke-width="1.5" marker-end="url(#arrow)"/>
            <rect x="346" y="47" width="76" height="42" rx="8" fill="#DDD6FE" stroke="#A78BFA" stroke-width="1.5"/>
            <text x="384" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#5B21B6">混交林</text>
            <path d="M 426 68 L 448 68" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
            <!-- Bottom two sub-cards -->
            <rect x="18" y="127" width="304" height="154" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="170" y="157" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">土壌のない裸地（溶岩流など）から開始</text>
            <rect x="346" y="127" width="304" height="154" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="498" y="157" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">土壌・種子が残る跡地（山火事など）から開始</text>
        </g>`;
    } else {
        return `
        <!-- Top-left panel: 垂直分布 (x=16, y=10, w=326, h=236) -->
        <g transform="translate(16, 10)">
            <rect width="326" height="236" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="14" y="22" font-size="12" font-weight="900" fill="#334155">🏔️ 本州中部の垂直分布</text>
            <polygon points="30,134 163,38 296,134" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
            <line x1="90" y1="66" x2="236" y2="66" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="3,3"/>
            <text x="242" y="69" font-size="9" font-weight="700" fill="#EF4444">約2500m</text>
            <text x="163" y="60" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">高山帯</text>
            <text x="163" y="88" text-anchor="middle" font-size="9" fill="#475569">亜高山帯</text>
            <text x="163" y="108" text-anchor="middle" font-size="9" fill="#475569">山地帯</text>
            <text x="163" y="126" text-anchor="middle" font-size="9" fill="#1E293B">丘陵帯</text>
        </g>
        <!-- Top-right panel: 川の自然浄化グラフ (x=358, y=10, w=326, h=236) -->
        <g transform="translate(358, 10)">
            <rect width="326" height="236" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="14" y="22" font-size="12" font-weight="900" fill="#334155">🌊 川の自然浄化グラフ</text>
            <line x1="32" y1="126" x2="296" y2="126" stroke="#64748B" stroke-width="1.2"/>
            <line x1="32" y1="126" x2="32" y2="40" stroke="#64748B" stroke-width="1.2"/>
            <text x="164" y="140" text-anchor="middle" font-size="10" fill="#64748B">下流への流れ →</text>
            <path d="M 38 122 Q 78 46 118 122" fill="none" stroke="#EF4444" stroke-width="2"/>
            <text x="78" y="44" text-anchor="middle" font-size="10" font-weight="800" fill="#EF4444">①</text>
            <path d="M 98 122 Q 142 56 186 122" fill="none" stroke="#F59E0B" stroke-width="2"/>
            <text x="142" y="54" text-anchor="middle" font-size="10" font-weight="800" fill="#F59E0B">②</text>
            <path d="M 164 122 Q 214 66 264 122" fill="none" stroke="#10B981" stroke-width="2"/>
            <text x="214" y="64" text-anchor="middle" font-size="10" font-weight="800" fill="#10B981">③</text>
        </g>
        <!-- Bottom panel: 水界の富栄養化と地球環境問題 (x=16, y=256, w=668, h=274) -->
        <g transform="translate(16, 256)">
            <rect width="668" height="274" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
            <text x="16" y="22" font-size="13" font-weight="900" fill="#334155">🌍 水界の富栄養化と地球環境問題</text>
            <text x="169" y="52" text-anchor="middle" font-size="11" font-weight="700" fill="#0369A1">淡水（湖沼）でN・P過剰により発生</text>
            <text x="499" y="52" text-anchor="middle" font-size="11" font-weight="700" fill="#0369A1">海水（内湾）でN・P過剰により発生</text>
            <text x="334" y="170" text-anchor="middle" font-size="11" font-weight="700" fill="#B45309">温室効果ガスが吸収する波 ⇔ フロンで増加する波</text>
        </g>`;
    }
}

function renderBoardSvg(oniBlankStageId: string | null): void {
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
            ? `<text x="0" y="-10" text-anchor="middle" font-size="11" font-weight="700" fill="#5B6E82">${s.boxLabel}</text>`
            : '';
        const boxW = s.name.length >= 14 ? 236 : (s.name.length >= 12 ? 216 : 180);
        const halfW = boxW / 2;
        const labelFontSize = txt.length >= 15 ? 11 : (txt.length >= 12 ? 12 : 14);
        return `<g class="${cls}" data-stage="${s.stageId}" tabindex="0" role="button" transform="translate(${s.x}, ${s.y})">
            <g class="stage-visual">
                <rect class="stage-box ${isBlank && oniBlankStageId ? 'oni-focus-box' : ''}" x="${-halfW}" y="-30" width="${boxW}" height="60" rx="14" fill="#FFFFFF" stroke="#6F7977" stroke-width="2.5" />
                ${label}
                <text class="stage-label" x="0" y="${state.difficulty === 'easy' ? 12 : 5}" text-anchor="middle" font-size="${labelFontSize}" font-weight="800" fill="#161D1C">${txt}</text>
            </g>
        </g>`;
    }).join('');
    els.boardSvg.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>${backdrop}${nodes}`;
}

function startGame(difficulty: Difficulty): void {
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

function nextOni(): void {
    const q = buildOniQuestion(state.category, state.currentOniStageId, state.nextUid);
    state.currentOniStageId = q.target.stageId;
    state.nextUid = q.nextUid;
    state.items = q.choices;
    els.trayTitleText.textContent = q.askHint ? '❓ ？の時期・項目はどれ？' : '❓ ？に入る名称は？';
    renderBoardSvg(q.target.stageId);
    renderCards();
}

function renderCards(): void {
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

function attemptPlace(stageId: string): void {
    const idx = state.items.findIndex((i) => i.id === state.selectedItemId);
    if (idx === -1) return;
    const item = state.items[idx]!;
    if (item.stageId === stageId) {
        state.score++;
        SOUND_FX.playCorrect(1);
        showToast(`⭕ 正解！ ${item.name}`);
        const node = els.boardSvg.querySelector<SVGGElement>(`[data-stage="${stageId}"]`);
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

function updateOniHud(rem = state.timeLeft * 1000): void {
    els.timerText.textContent = String(state.timeLeft);
    els.scoreText.textContent = `🏆 ${state.score}問`;
    els.progressFill.style.width = `${Math.min(100, (rem / (ONI_TIME_LIMIT * 1000)) * 100)}%`;
}

function showToast(msg: string): void {
    els.toast.innerHTML = msg;
    els.toast.style.backgroundColor = msg.includes('❌') ? 'rgba(239, 68, 68, 0.95)' : 'rgba(13, 148, 136, 0.95)';
    els.toast.classList.add('show');
    if (state.toastTimeout !== null) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 1200);
}

function handleGameClear(): void {
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

function handleOniTimeUp(): void {
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

function stopTimers(): void {
    if (state.timerInterval !== null) clearInterval(state.timerInterval);
    if (state.returnTimeout !== null) clearTimeout(state.returnTimeout);
    state.timerInterval = null; state.returnTimeout = null;
}

function resetToHome(): void {
    stopTimers(); state.isPlaying = false;
    els.clearOverlay.classList.remove('active');
    els.gameScreen.classList.remove('active');
    els.homeScreen.classList.add('active');
    setCategory(state.category);
    state.justUnlockedOni = false;
}

init();
