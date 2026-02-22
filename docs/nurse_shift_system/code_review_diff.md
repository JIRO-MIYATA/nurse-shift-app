# コードレビュー差分レポート

比較対象：
- **現行版**：`AGT-No1/src/components/NurseShiftApp.jsx`（1523行）
- **レビュー版**：`Downloads/NurseShiftApp.jsx`（1372行、**151行削減**）

---

## 📊 サマリー

| カテゴリ | 件数 |
|---------|------|
| バグ修正 | 3件 |
| 設計改善（重要） | 5件 |
| コード品質改善 | 6件 |
| UI改善 | 3件 |
| 削除（不要コード除去） | 2件 |

---

## 🐛 バグ修正

### 1. `useEffect` の無限ループリスク修正
**現行版**（問題あり）
```js
// 依存配列に monthlyCache が含まれており、
// monthlyCache を更新するたびに useEffect が再発火するリスク
useEffect(() => {
  ...
}, [year, month, staffData.length, monthlyCache]); // ← monthlyCache が問題
```
**レビュー版**（修正済み）
```js
// useRef でキャッシュを参照することで、依存配列から monthlyCache を除去
const monthlyCacheRef = useRef(monthlyCache);
useEffect(() => { monthlyCacheRef.current = monthlyCache; }, [monthlyCache]);

useEffect(() => {
  const cache = monthlyCacheRef.current; // ref から安全に参照
  ...
}, [year, month]); // monthlyCache を依存配列から除外 ✅
```

---

### 2. `editCell` モーダルのクラッシュ防止（Optional Chaining 追加）
**現行版**（Uncaught Error が発生する可能性）
```jsx
<h3>{staffData[editCell.sIdx].name} - {month}/{editCell.dIdx + 1}</h3>
// staffData[editCell.sIdx] が undefined だとクラッシュ
```
**レビュー版**（安全）
```jsx
<h3>{staffData[editCell.sIdx]?.name} - {month}/{editCell.dIdx + 1}</h3>
// ?. でクラッシュを防止 ✅
```
同様に `disabled`, `cursor`, `opacity` の参照にも `?.` が追加されている。

---

### 3. Phase2（夜勤回数調整）で `softUnlock` を使うよう修正
**現行版**（問題あり）
```js
// hardLock されたセルも直接書き換えてしまう恐れがある
newSched[sIdx][d] = "DAY";
lockedCoods.delete(`${sIdx}-${d}`);
```
**レビュー版**（修正済み）
```js
// soft-locked のセルのみを対象に解除する
if (isSoftLocked(sIdx, d)) {
    softUnlock(sIdx, d);  // hardLock は絶対に上書きしない ✅
    if (d + 1 < daysInMonth && isSoftLocked(sIdx, d + 1)) {
        softUnlock(sIdx, d + 1);
    }
}
```

---

## 🏗️ 設計改善（重要度高）

### 4. ロックを `hardLock` / `softLock` の2種類に分離

**現行版**：ロックは1種類のみ（`lockedCoods` Set）
```js
const lock = (sIdx, dIdx, shift) => { ... }
const isLocked = (sIdx, dIdx) => lockedCoods.has(`${sIdx}-${dIdx}`);
```

**レビュー版**：ロックを明確に2種類に分離
```js
const hardLocked = new Set(); // requests / 日曜休 / 前月引継ぎ → 絶対に上書き不可
const softLocked = new Set(); // Phase1以降の自動割当 → 後の処理で解除可能

const isHardLocked = (sIdx, dIdx) => hardLocked.has(`${sIdx}-${dIdx}`);
const isSoftLocked = (sIdx, dIdx) => softLocked.has(`${sIdx}-${dIdx}`);
const isLocked = (sIdx, dIdx) => isHardLocked(...) || isSoftLocked(...);
```
> **意義**：Phase2,3,4での解除操作がhardLockされたセルを誤って上書きしないことが保証される。

---

### 5. `changeMonth` が `useCallback` に変更
**現行版**（通常の関数宣言）
```js
const changeMonth = (delta) => {
    const newCache = { ...monthlyCache };
    newCache[currentKey] = { ... };
    setMonthlyCache(newCache); // 毎回新オブジェクトを作成
    ...
};
```
**レビュー版**（useCallback + 関数型更新）
```js
const changeMonth = useCallback((delta) => {
    setMonthlyCache(prev => ({  // 関数型更新でより安全
        ...prev,
        [currentKey]: {
            leaderFlagsArr: Array.from(leaderFlags), // Set → 配列に変換して保存
            schedule: schedule.map(row => [...row]), // deep copy ✅
        }
    }));
    ...
}, [year, month, requests, prevMonthSchedule, leaderFlags, schedule]);
```

---

### 6. `monthlyCache` の `leaderFlags` を配列で保存（Set→Array変換）

**現行版**（問題あり）
```js
// Set のまま monthlyCache に保存しているが、
// JSON.stringify は Set を空オブジェクト {} に変換してしまう
newCache[currentKey] = {
    leaderFlags: new Set(leaderFlags),  // ← Set のまま格納
};
```
**レビュー版**（修正済み）
```js
// exportData, changeMonth いずれも配列に変換して保存
[currentKey]: {
    leaderFlagsArr: Array.from(leaderFlags),  // ← 配列で保存 ✅
}
// importData でも対応して復元
if (data.leaderFlagsArr) setLeaderFlags(new Set(data.leaderFlagsArr));
```

---

### 7. `isFirstMount / prevYearMonth` ref で StrictMode 二重発火を防止

**現行版**：`useEffect` が StrictMode 下で2回発火する問題あり

**レビュー版**：
```js
const isFirstMount = useRef(true);
const prevYearMonth = useRef({ year, month });

useEffect(() => {
    // 年月が変わっていない場合はスキップ（StrictMode 対策）
    const prev = prevYearMonth.current;
    if (!isFirstMount.current && prev.year === year && prev.month === month) return;
    isFirstMount.current = false;
    prevYearMonth.current = { year, month };
    ...
}, [year, month]); // ✅
```

---

### 8. `updateStaff` / `removeStaff` / `toggleLeader` に関数型更新を採用

**現行版**（スナップショット依存）
```js
const updateStaff = (index, field, val) => {
    const newData = [...staffData]; // 古い staffData に依存
    ...
};
```
**レビュー版**（関数型更新でより安全）
```js
const updateStaff = (index, field, val) => {
    setStaffData(prev => {         // prev = 最新の状態を保証
        const next = [...prev];
        next[index] = { ...next[index], [field]: val };
        return next;
    });
};
```

---

## ✨ コード品質・可読性改善

### 9. `PREV_MONTH_LOOKBACK = 10` 定数化

```js
// 現行版：マジックナンバー 10 があちこちに散在
Array(10).fill("OFF")
pSched.slice(daysInPrev - 10, daysInPrev)

// レビュー版：定数で統一管理
const PREV_MONTH_LOOKBACK = 10;
Array(PREV_MONTH_LOOKBACK).fill("OFF")
pSched.slice(daysInPrev - PREV_MONTH_LOOKBACK, daysInPrev)
```

---

### 10. `generateDefaultStaff` のリーダー設定を明確化

```js
// 現行版：非直感的
let isLeader = false;
...
isLeader = !rookie; // 後から上書き

// レビュー版：1箇所でシンプルに
let isLeader = true; // デフォルトはリーダー
...
if ([9,10,19,20,29,30].includes(i)) { rookie = true; isLeader = false; } // ✅
```

---

### 11. `handleCSVExport` の簡略化

```js
// 現行版：複数行の手続き的なロジック
const row = [s.id, s.name, s.team];
const attr = [];
if (s.w4) attr.push("W4");
...
row.push(attr.join(" "));

// レビュー版：1行で完結
const attr = [s.w4 && "W4", s.rookie && "Beginner", s.sunOff && "SunOff"].filter(Boolean).join(" ");
csv += [s.id, s.name, s.team, attr, ...shifts, counts.DAY, ...].join(",") + "\n";
```

---

### 12. `totalRequests` を変数に切り出し

```jsx
// 現行版：JSX の中に複雑な計算が埋め込まれている
希望勤務 {Object.values(requests).reduce((acc, r) => acc + Object.keys(r).length, 0) > 0 && ...}

// レビュー版：render前に計算済み変数として整理
const totalRequests = Object.values(requests).reduce((acc, r) => acc + Object.keys(r).length, 0);
...
希望勤務 {totalRequests > 0 && <span>...</span>}
```

---

### 13. セル編集モーダルの `setSchedule` に関数型更新を適用

```js
// 現行版（クロージャ由来のバグリスク）
const newSched = [...schedule];
newSched[editCell.sIdx][editCell.dIdx] = k;
setSchedule(newSched);

// レビュー版（安全な関数型更新）
setSchedule(prev => {
    const next = prev.map(row => [...row]); // Deep copy ✅
    next[editCell.sIdx][editCell.dIdx] = k;
    return next;
});
```

---

### 14. `isLeader` の判定ロジック統合（バリデーション内）

```js
// 現行版：leaderFlags のみを参照
const isLeader = leaderFlags.has(`${sIdx}-${d}`);

// レビュー版：属性リーダー OR 動的リーダーフラグを OR 結合
const isLeader = s.isLeader || leaderFlags.has(`${sIdx}-${d}`);
// → 夜勤バリデーションのリーダーチェックがより正確になる ✅
```

---

## 🖥️ UI 改善

### 15. 凡例バーに「前月連携状態」インジケーターを追加

**レビュー版のみ**：
```jsx
<span style={{ color: isPrevMonthLinked ? "#10B981" : "#F97316" }}>
    前月: {isPrevMonthLinked ? "✓ 連携済" : "⚠ 手動"}
</span>
{!isPrevMonthLinked && (
    <button onClick={() => setShowPrevMonthModal(true)}>前月設定</button>
)}
```
> **効果**：前月データが自動リンクされているかどうかが一目でわかり、手動設定ボタンも適切なタイミングで表示される。

---

### 16. 前月モーダルに説明文を追加

```jsx
// レビュー版のみ
<p style={{ color: "#94A3B8", fontSize: "0.85rem" }}>
    前月のデータが見つかりません。最終日付近の勤務を手動で入力してください。
</p>
```

---

### 17. 希望勤務モーダルに操作説明を追加

```jsx
// レビュー版のみ
<p style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
    クリックで切替: 未設定 → 休み → 日勤 → 未設定
</p>
```

---

## 🗑️ 削除された不要コード

### 18. デバッグパネルの削除

**現行版**（本番コードに残っている）：
```jsx
{/* Debug Panel (Temporary) */}
<div style={{ backgroundColor: "#334155", padding: "1rem", margin: "1rem" }}>
    <h4>Debug Info 2</h4>
    <div>Month: {month}</div>
    ...
</div>
```
**レビュー版**：完全に削除済み ✅

---

### 19. Phase0 の前月参照ロジックを一本化

**現行版**（複雑な二重参照）：
```js
// 1. まず monthlyCache から直接参照
// 2. 失敗したら prevMonthSchedule state にフォールバック
// → 2箇所のロジックが分散して混乱しやすい
```
**レビュー版**（シンプルに一本化）：
```js
// prevMonthSchedule state のみを参照
// (changeMonth 時に state 自体がキャッシュから正しく復元されることが保証されているため)
const prevSched = prevMonthSchedule[sIdx];
const lastDay = prevSched && prevSched.length > 0 ? prevSched[prevSched.length - 1] : null;
```

---

## 推奨アクション

| 優先度 | 改善項目 | 理由 |
|--------|---------|------|
| 🔴 高 | `useEffect` の `monthlyCache` 依存配列問題 | 無限ループバグの可能性 |
| 🔴 高 | `hardLock/softLock` の分離 | Phase2の誤上書き防止 |
| 🔴 高 | `leaderFlags` を Array で保存 | JSONシリアライズ時にSetが消失するバグ |
| 🟠 中 | `useRef` による StrictMode 対策 | 開発時の二重発火防止 |
| 🟠 中 | 関数型更新パターンの採用 | state更新の安全性向上 |
| 🟡 低 | デバッグパネルの削除 | 本番コードのクリーンアップ |
| 🟡 低 | UI説明文・インジケーターの追加 | UX向上 |

> レビュー版への全面差し替えを強く推奨します。バグ修正が含まれており、現行版との動作的な差異はほぼなく、安全性・可読性が大幅に向上しています。

---

*作成日: 2026-02-22*
