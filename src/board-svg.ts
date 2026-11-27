import type { Category } from './types.ts';

export const BOARD_VIEWBOX = { width: 700, height: 540 } as const;
export const STAGE_BOX_HEIGHT = 60;

export function getStageBoxWidth(name: string): number {
    return name.length >= 14 ? 236 : (name.length >= 12 ? 216 : 180);
}

export function getStageLabelFontSize(txt: string): number {
    return txt.length >= 15 ? 11 : (txt.length >= 12 ? 12 : 14);
}

export function renderBoardBackdropSvg(cat: Category): string {
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
