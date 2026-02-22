import { useState, useCallback } from 'react';
import type { Staff, ScheduleMap, ScheduleCell } from '../types';
import { initializeSchedule, generateSchedule } from '../utils/scheduler';

export function useSchedule(initialStaff: Staff[]) {
    const [staff, setStaff] = useState<Staff[]>(initialStaff);
    const [schedule, setSchedule] = useState<ScheduleMap>(() => {
        const today = new Date();
        return initializeSchedule(initialStaff, today.getFullYear(), today.getMonth());
    });

    const updateCell = useCallback((staffId: string, date: string, newCell: Partial<ScheduleCell>) => {
        setSchedule(prev => {
            const staffSchedule = prev[staffId];
            if (!staffSchedule) return prev;

            const newStaffSchedule = staffSchedule.map(cell =>
                cell.date === date ? { ...cell, ...newCell } : cell
            );

            return {
                ...prev,
                [staffId]: newStaffSchedule
            };
        });
    }, []);

    const regenerate = useCallback(() => {
        setSchedule(prev => generateSchedule(staff, prev));
    }, [staff]);

    const swapCells = useCallback((staffId1: string, date1: string, staffId2: string, date2: string) => {
        setSchedule(prev => {
            const s1 = prev[staffId1];
            const s2 = prev[staffId2];
            if (!s1 || !s2) return prev;

            const idx1 = s1.findIndex(c => c.date === date1);
            const idx2 = s2.findIndex(c => c.date === date2);
            if (idx1 === -1 || idx2 === -1) return prev;

            const cell1 = s1[idx1];
            const cell2 = s2[idx2];

            // Create new arrays
            const newS1 = [...s1];
            const newS2 = [...s2];

            // Swap shiftTypes (keep other metadata? User said "Swap Shift Type")
            // "Leaders L icon" is property of the CELL or the PERSON?
            // "L icon" in UI is `isLeaderMarked`.
            // If I move a Day shift from A to B, does the L follow?
            // L is usually a flag "This shift is a Leader Shift". 
            // But in `ScheduleCell`, `isLeaderMarked` exists.
            // Let's swap `shiftType` and `isLeaderMarked`.
            // Date stays same.

            newS1[idx1] = { ...cell1, shiftType: cell2.shiftType, isLeaderMarked: cell2.isLeaderMarked };
            newS2[idx2] = { ...cell2, shiftType: cell1.shiftType, isLeaderMarked: cell1.isLeaderMarked };

            // If s1 and s2 are same staff (same row swap)
            if (staffId1 === staffId2) {
                newS1[idx2] = { ...cell2, shiftType: cell1.shiftType, isLeaderMarked: cell1.isLeaderMarked };
                // Correct logic for same array:
                // We need to be careful not to mutate twice if ref is same.
                // But strict implementation:
                const singleArr = [...s1];
                singleArr[idx1] = { ...cell1, shiftType: cell2.shiftType, isLeaderMarked: cell2.isLeaderMarked };
                singleArr[idx2] = { ...cell2, shiftType: cell1.shiftType, isLeaderMarked: cell1.isLeaderMarked };
                return { ...prev, [staffId1]: singleArr };
            }

            return {
                ...prev,
                [staffId1]: newS1,
                [staffId2]: newS2
            };
        });
    }, []);

    return {
        staff,
        schedule,
        updateCell,
        swapCells, // Exported
        regenerate,
        setStaff
    };
}
