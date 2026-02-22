# Implementation Plan - Smart Shift Management Tool

複雑な制約（チーム制・スタッフ属性・夜勤配列）をクリアするシフト表を自動生成し、かつブラウザ上で直感的な手動調整（ドラッグ＆ドロップ）を可能にする管理ツールを開発します。

## User Review Required

No critical breaking changes anticipated, but key algorithm assumptions need verification during usage:
- "3-day set (Semi-Night -> Night -> Off)" logic is strict?
- "Max 5 consecutive days" logic handles existing schedules?

## Proposed Changes

### Frontend (React + Vite)

#### [NEW] [src/types/index.ts](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/types/index.ts)
- Define TypeScript interfaces for:
    - `Staff`: { id, name, team (A/B/C), isLeader, isJunior, specialType (A/B) }
    - `ShiftType`: 'Day' | 'SemiNight' | 'Night' | 'Off'
    - `ScheduleCell`: { date, shiftType, isLeaderMarked }
    - `Schedule`: Map<StaffId, ScheduleCell[]>

#### [NEW] [src/utils/scheduler.ts](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/utils/scheduler.ts)
- Implement `generateSchedule(staffList, constraints)` function.
- **Algorithm Constraints**:
    - **Absolute**:
        - SemiNight -> Night -> Off (3-day pattern).
        - Max 5 consecutive work days.
        - Staff attributes (Junior pairing check, Leader presence).
    - **Team Balance**:
        - Limit per team per shift type.

#### [NEW] [src/components/ScheduleGrid.tsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/ScheduleGrid.ts)
- Main grid view.
- Drag & Drop support using `dnd-kit` or similar light library.
- "L" mark toggle on click/drag.
- Visual feedback for validation errors (red background).

#### [NEW] [src/components/StaffConfig.tsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/StaffConfig.ts)
- Simple form to edit staff attributes.

#### [NEW] [src/App.tsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/App.tsx)
- Main layout.
- "Generate" button.
- "Export CSV" button.

## Verification Plan

### Automated Tests
- Unit tests for `scheduler.ts` to verify:
    - 3-day pattern adherance.
    - Max 5 days constraint.
    - Team balance logic.
- Component tests for Grid rendering.

### Manual Verification
- **Drag & Drop**: Verify shifts move correctly and totals update instantly.
- **Validation**: Create invalid state (e.g. 6 consecutive days) and verify red alert.
- **Export**: Download CSV and verify format.
