# 看護師シフト管理システム 完全仕様書

> このマークダウンを読んだ AI が、まったく同じ動作のアプリを再現できることを目的とした仕様書です。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | 看護師シフト管理 🏥 |
| フレームワーク | React (Vite + TypeScript プロジェクト構成、実装は JSX) |
| 主要ファイル | `src/components/NurseShiftApp.jsx` |
| エントリポイント | `src/App.jsx` → `<NurseShiftApp />` を描画するだけ |
| スタイリング | CSS-in-JS（インラインスタイルオブジェクト `styles`）のみ。TailwindCSS 不使用 |
| 配色テーマ | ダークモード（背景 `#080C12`） |
| フォント | Inter, system-ui, sans-serif |

---

## 2. 定数・シフト種別

### 2.1 数値定数

```js
const T_DAY_WEEK = 11;      // 平日の日勤スタッフ上限
const T_DAY_HOL  = 7;       // 休日の日勤スタッフ上限
const T_NIGHT    = 4;       // 1日あたりの夜勤（準夜）人数
const MIN_NIGHTS = 2;       // 月の夜勤最低回数（fixNights 未設定の場合の下限）
const EXTRA_OFF  = 5;       // W4 スタッフに追加付与する休日数
const MAX_CONSECUTIVE_WORK = 5; // 最大連勤日数（6日目は必ず休み）
```

### 2.2 固定祝日（MM/DD 形式）

```js
const HOLIDAYS = [
  "01/01","01/02","01/03","02/11","02/23","03/20","03/21","04/29",
  "05/03","05/04","05/05","07/15","07/21","08/11","09/15","09/23",
  "10/14","11/03","11/23","12/23"
];
```

### 2.3 シフト種別 `SHIFT_TYPES`

| キー | 日本語ラベル | 英語ラベル | カラーコード |
|------|-------------|-----------|-------------|
| `DAY` | 日 | Day | `#3B82F6`（青） |
| `START` | 準 | Semi | `#F97316`（橙）|
| `DEEP` | 深 | Deep | `#A855F7`（紫）|
| `OFF` | 休 | Off | `#64748B`（灰）|

> `START`（準夜勤）→ 翌日 `DEEP`（深夜勤）→ その翌日 `OFF`（休み）が **必ずセット** で付与される。

---

## 3. スタッフデータ構造

### 3.1 スタッフオブジェクト（1名分）

```ts
type Staff = {
  id: number;          // 自動採番
  name: string;        // 表示名 例: "スタッフ 1"
  team: "A" | "B" | "C"; // チーム (各10名が基本)
  rookie: boolean;     // 新人フラグ
  w4: boolean;         // 週4勤務フラグ（EXTRA_OFF 日分の休日を追加）
  sunOff: boolean;     // 日曜固定休フラグ
  fixNights: number | null; // 月の夜勤固定回数（null = 自動割当）
  isLeader: boolean;   // リーダーフラグ（新人は常に false）
};
```

### 3.2 デフォルトスタッフ生成ルール `generateDefaultStaff()`

- 30名生成（`id` = 1〜30）
- チーム分け: 1〜10 → A、11〜20 → B、21〜30 → C
- No.9, 10, 19, 20, 29, 30 → `rookie = true`
- No.1 → `w4 = true`, `sunOff = true`, `fixNights = 2`, name に `"(Manager)"` 付加
- No.11 → `w4 = true`, `fixNights = 2`
- デフォルトの `isLeader` = `!rookie`（新人以外はリーダー）

---

## 4. Reactステート一覧

| ステート名 | 型 | 説明 |
|-----------|-----|------|
| `currentDate` | `Date` | 現在表示中の年月（日付部分は1日固定） |
| `staffData` | `Staff[]` | スタッフ一覧 |
| `schedule` | `string[][]` | `schedule[sIdx][dIdx]` = シフトキー（`"DAY"/"START"/"DEEP"/"OFF"`） |
| `requests` | `{[sIdx]: {[dIdx]: "OFF"\|"DAY"}}` | 希望勤務申請 |
| `prevMonthSchedule` | `string[][]` | 前月の最後10日間のシフト `prevMonthSchedule[sIdx][0..9]` |
| `isPrevMonthLinked` | `boolean` | 前月データが自動リンク済みかどうか |
| `leaderFlags` | `Set<string>` | リーダー指定のセル集合（`"sIdx-dIdx"` 形式の文字列） |
| `filterTeam` | `"ALL"\|"A"\|"B"\|"C"` | テーブル表示チームフィルター |
| `showStaffModal` | `boolean` | スタッフ編集モーダルの表示状態 |
| `showRequestModal` | `boolean` | 希望勤務モーダルの表示状態 |
| `showPrevMonthModal` | `boolean` | 前月設定モーダルの表示状態 |
| `monthlyCache` | `{[key: string]: CacheEntry}` | 月ごとのデータキャッシュ（`"YYYY-M"` キー） |
| `editCell` | `{sIdx, dIdx}\|null` | 編集中のセル（`dIdx = -1` は希望勤務モーダルのスタッフ選択を意味） |

### 4.1 `monthlyCache` のエントリ構造

```ts
type CacheEntry = {
  requests: Record<number, Record<number, string>>;
  prevMonthSchedule: string[][];
  leaderFlags: Set<string>;
  schedule: string[][];
};
```

---

## 5. ヘルパー関数

```js
// その月の日数を返す
const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

// 指定日が休日（日曜 or 固定祝日）かどうか
// 土曜は休日扱いしない（日勤上限が変わるのは日曜・祝日のみ）
const checkIsHoliday = (year, month, day) => {
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  const formatted = `${String(month).padStart(2,"0")}/${String(day).padStart(2,"0")}`;
  if (dow === 0) return true; // 日曜
  if (HOLIDAYS.includes(formatted)) return true;
  return false;
};
```

---

## 6. スケジュール自動生成アルゴリズム `generateSchedule()`

`useCallback` で定義。依存配列 = `[staffData, requests, daysInMonth, year, month, prevMonthSchedule, monthlyCache]`

初期化時に全スタッフ・全日を `"DAY"` で埋める。リーダーフラグをリセット。

### Phase 0 — 事前制約のロック

以下を順に `lock(sIdx, dIdx, shift)` で固定する（一度ロックされたセルは以降のフェーズで上書き不可）。

1. **希望勤務（requests）** の適用：`requests[sIdx][dIdx]` が存在すれば該当シフトをロック
2. **日曜固定休（sunOff）** の適用：対象スタッフの日曜日全てを `"OFF"` にロック
3. **前月末日シフト引継ぎ**
   - `monthlyCache` 内の前月データを優先して参照、なければ `prevMonthSchedule` state を使用
   - 前月最終日が `"START"` → 当月1日目を `"DEEP"`、2日目を `"OFF"` にロック
   - 前月最終日が `"DEEP"` → 当月1日目を `"OFF"` にロック

### Phase 1 — 夜勤（準夜）割当

- 各日（dIdx = 0, 1, ..., daysInMonth-1）に対し `T_NIGHT=4` 名を選出
- **候補者条件**：その日・翌日・翌々日がいずれもロックされていないこと
- **選出アルゴリズム（最大100回リトライ）**：
  1. `currentNightCounts`（当月の準夜割当済み回数）+ `Math.random() * 2.5` の重み付きソートで候補プール作成
  2. チーム A, B, C から最低1名ずつ選出（重み低い順に選ぶ）
  3. 残枠を重み最小から埋め、合計4名にする
  4. **バリデーション**：
     - 新人（rookie）が2名以上になっていれば無効
     - リーダー（isLeader）が0名であれば無効
  5. 有効な場合のみ確定し、4名に `"START"` → 翌日 `"DEEP"` → 翌々日 `"OFF"` をロック
  6. `currentNightCounts[pid]++`

### Phase 2 — 夜勤回数の上限調整

- `fixNights` が設定されているスタッフのみ対象
- 当月の準夜割当数が `fixNights` を超えている場合、末尾から超過分の準夜をキャンセル
  - `"START"` を `"DAY"` に戻し、対応する `"DEEP"` も `"DAY"` に戻す
  - ロック座標を削除

### Phase 3 — W4スタッフへの追加休日付与

- `s.w4 === true` のスタッフに対し、`"DAY"` かつ非ロックのセルからランダムに `EXTRA_OFF=5` 日を `"OFF"` にロック

### Phase 4 — 日勤人数の上限制御

- 各日の日勤者（`"DAY"`）が上限を超えていれば、超過分を `"OFF"` に変更
  - 上限：平日 = `T_DAY_WEEK=11`、休日（日曜・祝日）= `T_DAY_HOL=7`
  - **降順ソート**：その時点の総労働日数が最も多いスタッフから優先的に休みにする
  - ただし **リーダーが残り1名になる場合はリーダーを除外**

### Phase 5 — 最大連勤制限（5日）

- 前月の最後のシフトから引き継いだ連勤数を初期値として設定
- 各スタッフの連勤日数を日付順にカウント
- `MAX_CONSECUTIVE_WORK=5` を超えた場合：
  1. 現在の日が `"DAY"` かつ非ロックなら `"OFF"` にしてカウントリセット
  2. 1が無理なら前日が `"DAY"` かつ非ロックなら前日を `"OFF"` に変更
  3. どちらも無理な場合は何もしない（バリデーション警告が表示される）

---

## 7. バリデーション `validation`（useMemo）

依存配列 = `[schedule, daysInMonth, staffData, requests, year, month, leaderFlags]`

返り値の型：
```ts
type Validation = {
  cellWarnings: Record<string, boolean>;       // セル警告（"sIdx-dIdx"）
  colWarnings: Record<string, string>;         // 列警告（"dIdx-TYPE" → CSSカラー文字列）
  requestFailures: Record<string, boolean>;    // 希望勤務違反（"sIdx-dIdx"）
  consecutiveWarnings: Record<number, boolean>;// 連勤超過スタッフ（sIdx）
};
```

### 7.1 列警告（colWarnings）の判定ロジック

**日勤（DAY）列**：
- 🔴 赤 → 日勤者数 > 上限（`T_DAY_WEEK` or `T_DAY_HOL`）
- 🟠 橙 → 日勤者数 < 上限 - 2（不足気味）
- 🟢 緑 → それ以外（正常）

**準夜（START）列**：
- 🔴 赤 → 準夜者数 ≠ `T_NIGHT`（4名以外）
- 🟠 橙 → 準夜者数 = 4 かつ新人が2名以上
- 🟣 マゼンタ → 準夜者数 = 4 かつリーダー 0名
- 🟢 緑 → 正常

**深夜（DEEP）列**：
- 上記 START と同じ判定ロジック

### 7.2 セル警告（cellWarnings）の発生条件

1. 希望勤務が通っていない（`requestFailures` と同期）
2. 同一日の準夜または深夜に新人が2名以上いるとき、対象新人スタッフのセル
3. 連勤が `MAX_CONSECUTIVE_WORK` を超えたセル

---

## 8. UIレイアウト

### 8.1 全体構造

```
<div style={styles.container}>          // 画面全体（ダーク背景）
  <header style={styles.header}>        // スティッキーヘッダー
  <div style={styles.legendBar}>        // 凡例バー
  <div (tabs)>                          // チームフィルタータブ
  <div style={styles.tableWrapper}>     // スクロール可能テーブル領域
    <table>
      <thead> ... </thead>               // 日付ヘッダー
      <tbody> ... </tbody>               // スタッフ行
      <tfoot> ... </tfoot>               // 集計フッター
    </table>
  </div>
  <div (debug panel)>                   // ※デバッグパネル（一時的）
  {showPrevMonthModal && ...}           // 前月勤務設定モーダル
  {showStaffModal && ...}               // スタッフ管理モーダル
  {showRequestModal && ...}             // 希望勤務モーダル
  {editCell && editCell.dIdx !== -1 && ...} // セル編集モーダル
</div>
```

### 8.2 ヘッダー（header）

**左側：**
- タイトル「看護師シフト管理 🏥」
- データ保存ボタン（青 `#0EA5E9`、`exportData()` 呼び出し）
- データ読込ラベル（青、`importData()` 呼び出し、hidden input）
- スタッフ保存ボタン（緑青 `#14B8A6`、`exportStaffData()`）
- スタッフ読込ラベル（緑青、`importStaffData()`）

**中央：**
- `‹` ボタン → `changeMonth(-1)`
- 「YYYY年 M月」テキスト
- `›` ボタン → `changeMonth(+1)`

**右側：**
- スタッフ編集ボタン → `setShowStaffModal(true)`
- 希望勤務ボタン（登録件数のバッジ付き） → `setShowRequestModal(true)`
- ✨ 作成ボタン（青） → `generateSchedule()`
- ⬇ CSV ボタン → `handleCSVExport()`

### 8.3 凡例バー（legendBar）

- 各シフト種別のカラーブロック + ラベルを表示
- 右端に「日勤上限: 11(平日) / 7(休日)」「夜勤人数: 4」「連勤上限: 5」を表示

### 8.4 チームフィルタータブ

- ボタン: `ALL`, `A`, `B`, `C`
- 選択されたチームで `filterTeam` を更新
- 選択中は青背景 `#3B82F6`

### 8.5 メインテーブル

**ヘッダー行**：
- 固定列3列（No / 名前 / チーム）+ 各日付列 + 集計4列（日勤・準夜・深夜・休日）
- 日付ヘッダーの背景色：日曜・祝日 = 赤 `#EF4444`、土曜 = 青 `#3B82F6`、平日 = `#1E293B`
- 今日の日付は文字色を `#FCD34D`（黄色）で表示

**スタッフ行**：
- `filterTeam` に一致しないスタッフはレンダリングをスキップ（`return null`）
- No列：`fixNights !== null` の場合「★」プレフィックス
- 名前列：`rookie` なら「🔰」、`w4` なら青バッジ「W4」表示
- チーム列：A = 赤、B = 緑、C = 青
- シフトセル：`renderCell(sIdx, dIdx)` で描画
- 行末に日勤数・準夜数・深夜数・休日数を表示

**フッター行（3行）**：
- 日勤計 / 準夜計 / 深夜計 それぞれの日別合計
- `validation.colWarnings` の色でテキスト色を変更

### 8.6 シフトセル描画 `renderCell(sIdx, dIdx)`

```jsx
<div
  onClick={() => setEditCell({ sIdx, dIdx })}
  style={{
    ...styles.shiftCell,
    backgroundColor: shift?.color,
    color: "#fff",
    position: "relative",
    outline: isReqFail ? "2px solid yellow"
           : isWarn    ? "2px solid black"
           :              "2px solid transparent",
    outlineOffset: "-2px",
    opacity: isReq && !isReqFail ? 0.8 : 1,
  }}
>
  {isLeader && <span style={{ position:"absolute", top:0, left:2, fontSize:"0.6rem", zIndex:6 }}>👑</span>}
  {shift?.label}
  {isReq && <span style={{ position:"absolute", top:0, right:0, fontSize:"0.6rem", zIndex:6 }}>
    {reqType === "DAY" ? "日" : reqType === "OFF" ? "休" : "★"}
  </span>}
</div>
```

---

## 9. モーダル仕様

### 9.1 スタッフ管理モーダル（showStaffModal）

- テーブル形式でスタッフを一覧表示・編集可能
- 編集できるフィールド: `name`（input）, `team`（select A/B/C）, `isLeader`（checkbox）, `rookie`（checkbox）, `w4`（checkbox）, `sunOff`（checkbox）, `fixNights`（select: 自動/1〜6）
- 削除ボタン（X）→ `removeStaff(index)` 呼び出し
- 「+ 追加」ボタン → `addStaff()`：最も人数が少ないチームに自動所属
- 「保存 & 閉じる」でモーダルを閉じる

### 9.2 希望勤務モーダル（showRequestModal）

- 左ペイン: スタッフ一覧（クリックで選択）
- 右ペイン: 選択スタッフのカレンダー表示
  - クリックで希望タイプをサイクル: 未設定 → `"OFF"` → `"DAY"` → 未設定
  - `OFF` = オレンジ, `DAY` = 青, 未設定 = `#334155`
- 「全てクリア」ボタン → 対象スタッフの希望をリセット

### 9.3 前月勤務設定モーダル（showPrevMonthModal）

- スタッフ行 × 前10日列のテーブル
- 各セルのボタンをクリックすると `DAY → START → DEEP → OFF → DAY` とサイクル
- 前月データがキャッシュから自動リンクされている場合はこのモーダルを直接使う必要は通常ない

### 9.4 セル編集モーダル（editCell.dIdx !== -1）

- タイトル：「スタッフ名 - M/日」
- シフト変更ボタン（2×2グリッド）: 日/準/深/休、クリックそのシフトに変更
- リーダー任命/解除ボタン：
  - `rookie` または現在 `OFF` の場合は無効（opacity 0.5、cursor not-allowed）
  - リーダー中は黄色 `#F59E0B`、それ以外は `#334155`
- 希望設定セクション（3ボタン）: なし / 休み / 日勤

---

## 10. データ永続化

### 10.1 月切り替えキャッシュ `changeMonth(delta)`

1. 現在月のデータ（`requests`, `prevMonthSchedule`, `leaderFlags`, `schedule`）を `monthlyCache["YYYY-M"]` に保存
2. `setCurrentDate` で年月を変更
3. `useEffect` が発火し、新年月のデータをキャッシュから復元 or デフォルト初期化

### 10.2 JSONエクスポート/インポート

**全データ保存** `exportData()`:
- ファイル名: `nurse_shift_data_{YYYY}_{M}.json`
- 含むデータ: `staffData`, `requests`, `prevMonthSchedule`, `leaderFlagsStr`（Set → 配列変換）, `schedule`, `monthlyCache`

**スタッフデータのみ保存** `exportStaffData()`:
- ファイル名: `nurse_staff_only_{YYYY}_{M}.json`
- 含むデータ: `staffData` のみ

**インポート** `importData(e)`:
- JSON ファイルを読み込み全データを復元
- `leaderFlagsStr` → `new Set()` に変換

**スタッフのみインポート** `importStaffData(e)`:
- `staffData` のみ更新
- スタッフ数が変わった場合、`schedule` と `prevMonthSchedule` の配列長を動的調整（`resize` ヘルパー使用）

### 10.3 CSVエクスポート `handleCSVExport()`

- ファイル名: `shift_{YYYY}_{M}.csv`
- BOM付き UTF-8
- 列構成: `No, Name, Team, Attr, 1日, 2日, ..., 日計, 準夜計, 深夜計, 休計`
- リーダーは該当シフトラベルに `"(L)"` 付加
- フッターに日勤/準夜/深夜/休の日別合計行を追加

---

## 11. スタイル定数 `styles`

| キー | 主要なスタイル値 |
|------|----------------|
| `container` | `backgroundColor: "#080C12"`, `color: "#E2E8F0"`, `minHeight: "100vh"`, `display: flex`, `flexDirection: column` |
| `header` | `position: sticky`, `top: 0`, `zIndex: 50`, `backgroundColor: "#0F172A"`, `borderBottom: "1px solid #1E293B"` |
| `navButton` | `background: transparent`, `border: "1px solid #334155"`, `color: "#CBD5E1"` |
| `actionButton` | `backgroundColor: "#334155"`, `color: "#F1F5F9"`, `padding: "0.5rem 1rem"`, `borderRadius: "0.375rem"` |
| `primaryButton` | `backgroundColor: "#0EA5E9"`, `color: "#FFFFFF"` |
| `dangerButton` | `backgroundColor: "#EF4444"`, `color: "#FFFFFF"` |
| `persistButton` | `width: 110px`（固定幅で均一化）, `fontSize: "0.85rem"` |
| `th` | `backgroundColor: "#1E293B"`, `color: "#94A3B8"`, `border: "1px solid #334155"` |
| `td` | `border: "1px solid #334155"`, `height: "2.0rem"`, `minWidth: "2.0rem"`, `padding: 0` |
| `stickyCol` | `position: sticky`, `backgroundColor: "#0F172A"`, `zIndex: 10`, `left: 0` |
| `shiftCell` | `width: 100%`, `height: 100%`, `display: flex`, `alignItems: center`, `justifyContent: center`, `boxSizing: border-box` |
| `modalOverlay` | `position: fixed`, `backgroundColor: rgba(0,0,0,0.7)`, `zIndex: 100` |
| `modalContent` | `backgroundColor: "#1E293B"`, `borderRadius: "0.5rem"`, `maxWidth: 90vw`, `maxHeight: 90vh`, `overflow: auto` |

---

## 12. テーブルの固定列

左端3列は水平スクロール時も固定表示される sticky 実装：

| 列 | `left` 値 | 内容 |
|----|----------|------|
| No | `0` | スタッフ番号 |
| 名前 | `40px` | スタッフ名 |
| チーム | `160px` | チーム（A/B/C） |

---

## 13. 注意事項・既知の実装詳細

1. **デバッグパネル**：現在のコードにはデバッグ情報を表示するパネルが本番UIに残っている（`style={{ backgroundColor: "#334155", padding: "1rem", margin: "1rem" }}`）。本番では削除することを推奨。

2. **前月モーダルのトリガー**：`showPrevMonthModal` の setter は定義されているが、現在のUIにその表示ボタンが存在しない状態（前月キャッシュから自動リンクするため通常不要）。

3. **休日判定の仕様**：土曜日は「祝日」にカウントされないが、テーブルのヘッダー色は青（`#3B82F6`）で視覚的に区別される。日曜日は祝日扱いとなり日勤上限が `T_DAY_HOL=7` になる。

4. **リーダー管理の二重構造**：
   - `staffData[sIdx].isLeader` = 属性としてのリーダー（夜勤Phase1のバリデーションに使用）
   - `leaderFlags` Set = その日のシフトでリーダーを担当しているかの動的フラグ（👑アイコン表示）
   - 夜勤割当のリーダーチェックは `staffData[sIdx].isLeader` を使用、セル表示は `leaderFlags` を使用

5. **`useEffect` の依存配列**：`[year, month, staffData.length, monthlyCache]` で発火。`staffData.length` の変化（スタッフ追加削除）でも発火するため、スタッフ変更時に月が再初期化される。

---

## 14. 再現に必要なディレクトリ構成

```
project-root/
├── src/
│   ├── App.jsx                    // NurseShiftApp をレンダリングするだけ
│   └── components/
│       └── NurseShiftApp.jsx      // メインコンポーネント（全ロジック内包）
├── index.html
├── package.json
└── vite.config.ts (or .js)
```

### package.json の主要依存

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

---

*最終更新: 2026-02-22*
