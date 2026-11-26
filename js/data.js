                                                                            

export const TAB1_ITEMS                       = [
    { stageId: 'e1', name: '光補償点', emoji: '⚖️', hint: '見かけの光合成速度が0（光合成量＝呼吸量）', x: 175, y: 115, boxLabel: '光合成グラフ①' },
    { stageId: 'e2', name: '光飽和点', emoji: '☀️', hint: 'それ以上光を強くしても速度が増えない点', x: 525, y: 115, boxLabel: '光合成グラフ②' },
    { stageId: 'e3', name: '一次遷移', emoji: '🌋', hint: '土壌のない裸地（溶岩流など）から始まる', x: 175, y: 265, boxLabel: '遷移①' },
    { stageId: 'e4', name: '二次遷移', emoji: '🌲', hint: '土壌や種子が残る跡地から速く進む', x: 525, y: 265, boxLabel: '遷移②' },
    { stageId: 'e5', name: '極相（陰樹林）', emoji: '🌳', hint: '遷移の最終段階（ギャップ更新も起こる）', x: 350, y: 415, boxLabel: '遷移の終着点' }
];

export const TAB2_ITEMS                       = [
    { stageId: 'c1', name: '森林限界（ハイマツ）', emoji: '🏔️', hint: '亜高山帯と高山帯の境（標高約2500m）', x: 175, y: 115, boxLabel: '垂直分布' },
    { stageId: 'c2', name: '細菌→ゾウリムシ→藻類', emoji: '🌊', hint: '汚水流入後の自然浄化で増える順番', x: 525, y: 115, boxLabel: '自然浄化' },
    { stageId: 'c3', name: 'アオコ（湖沼）', emoji: '🟢', hint: '湖沼の富栄養化で水面が緑色になる', x: 175, y: 265, boxLabel: '湖の富栄養化' },
    { stageId: 'c4', name: '赤潮（内湾・海）', emoji: '🔴', hint: '海の富栄養化で海面が赤褐色になる', x: 525, y: 265, boxLabel: '海の富栄養化' },
    { stageId: 'c5', name: '温暖化(赤外線) / オゾン(紫外線)', emoji: '🌍', hint: '温室効果ガスは赤外線、フロンは紫外線増加', x: 350, y: 415, boxLabel: '地球環境' }
];

export const CATEGORY_CONFIG                                                                                        = {
    'photo': {
        label: '📈 光合成曲線 ＆ 植生遷移で覚える',
        description: '光補償点・光飽和点と、裸地から極相までの遷移の流れをマスターしよう！',
        trayTitle: '📈 光合成・遷移カード'
    },
    'eco': {
        label: '🏔️ 垂直分布・自然浄化・環境問題',
        description: '日本の垂直分布、川の自然浄化、アオコ・赤潮、地球環境問題を区別しよう！',
        trayTitle: '🏔️ 生態系カード'
    }
};

export const DIFFICULTY_LABELS                                       = {
    easy: '🔰 かんたん',
    normal: '🧪 ふつう',
    oni: '👹 おに (60秒TA)'
};

export function getItemsForCategory(cat          )                       {
    return cat === 'photo' ? TAB1_ITEMS : TAB2_ITEMS;
}

export function getOniRankInfo(score        )           {
    if (score >= 20) return { rank: 'S', icon: '👑', title: '植生・光合成グラフ・生態系の神', className: 'rank-s' };
    if (score >= 14) return { rank: 'A', icon: '🔬', title: '熟練研究者', className: 'rank-a' };
    if (score >= 8) return { rank: 'B', icon: '🧪', title: '一人前ラボ員', className: 'rank-b' };
    return { rank: 'C', icon: '🌱', title: '見習い観察者', className: 'rank-c' };
}


//# sourceURL=data.ts