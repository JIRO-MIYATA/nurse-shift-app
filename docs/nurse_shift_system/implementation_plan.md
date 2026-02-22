# User Review Required

> [!NOTE]
> No critical user review required.

## Proposed Changes

### UI: Customize Header Colors
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Header Loop**:
    -   Highlight **Saturday** with Blue (`#3B82F6`).
    -   Highlight **Sunday/Holiday** with Red (`#EF4444`).
    -   Keep **Holidays** check working.
-   **Validation Border Fix**:
    -   Use `outline` and `outline-offset: -2px` instead of `border` to prevent layout shifts.
    -   Change warning color from Red to Black.

### UI: Fix Staff Numbering
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Display Logic**: Instead of showing `s.id` (which might skip if deleted), display `idx + 1` in the main table.
-   **Add Staff**: When adding new staff, we can still use an internal ID for keys, but the display "No" will be dynamic.

### UI: Add Vertical Lines to Staff Modal
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Staff Modal Table**: Add `border-right: 1px solid #555` to `td` and `th`.

### Logic: Prioritize Holiday Equalization
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Phase 4 (Day Limit Enforcing)**:
    -   When choosing whom to force to "OFF" (to reduce Day staff):
        -   Current Sort: `countA = newSched[a].filter(s => s === "DAY").length;`
        -   **New Sort**: `countA = newSched[a].filter(s => s !== "OFF").length;` (Total Work Days).
        -   This ensures we remove from those who have the *Highest Total Work* (Fewest Offs), effectively equalizing Offs.

## Verification Plan

### Manual Verification
1.  **Header**: Check Blue Sat, Red Sun/Hol.
25.  **Prev Link**: Move Monts (Feb -> Mar). Check Mar 1st is DEEP if Feb 28 was START.
2.  **Numbering**: Delete Staff 2. Check if Staff 3 becomes No.2.
3.  **Modal**: Check vertical lines.
4.  **Equalization**: Generate schedule. Check "休日" column in CSV or screen. Should be roughly equal (except W4/Rookie constraints).

### Feature: Import Staff Data Only
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Add Import Button**: Add a specific button "スタッフ条件読込" (Import Staff) next to the full import button.
-   **Logic**:
    -   Read JSON file.
    -   Extract only `staffData` (and possibly `previousMonthSchedule` if relevant to staff, but user asked for "conditions").
    -   **CRITICAL**: Preserve current `schedule` (shifts) if possible, or warn if staff count/IDs mismatch.
    -   Actually, if staff changes (add/remove), the schedule structure (array of arrays) might break.
    -   **Strategy**:
        -   Import `staffData`.
        -   Re-initialize `schedule`, `requests`, `prevMonthSchedule` *if* the staff count changes significantly or IDs don't match?
        -   Better: Just overwrite `staffData`.
        -   If `staffData` length changes, we must adjust `schedule` rows.
        -   If the user just wants to copy "Team/Leader/Rookie/History" settings for the *same* staff list, it's easy.
        -   Assumption: User wants to carry over staff definitions from last month to new month.
        -   Implementation:
            -   Load `staffData` from JSON.
            -   Update `staffData` state.
            -   **Constraint**: If `newStaffData.length !== currentSchedule.length`, we might need to reset schedule or try to map it.
            -   Simplest: Overwrite `staffData`. If length differs, `schedule` might look weird until "Generate" is clicked again.
            -   We will explicitly strictly overwrite `staffData` and `prevMonthSchedule` (maybe?) but KEEP `requests` and current `schedule` rows (or resize them).
            -   Actually, if we import staff, we probably want to *start fresh* with that staff list for the current month.
            -   But user said "Import conditions".
            -   Let's add a button that *only* keys off `staffData` from the JSON.

### Feature: Export Staff Data Only
#### [MODIFY] [NurseShiftApp.jsx](file:///c:/Users/miyat/OneDrive/Desktop/AGT-No1/src/components/NurseShiftApp.jsx)
-   **Add Export Button**: "条件保存" (Save Conditions) button next to Import Conditions.
-   **Logic**:
    -   Create JSON with only `{ staffData: currentStaffData }`.
    -   Download as `nurse_staff_data_YYYY_MM.json`.2.
