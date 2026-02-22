export type Team = 'A' | 'B' | 'C';
export type ShiftType = 'Day' | 'SemiNight' | 'Night' | 'Off';
export type SpecialType = 'A' | 'B' | null;

export interface Staff {
    id: string;
    name: string;
    team: Team;
    isLeader: boolean;
    isJunior: boolean; // 1-2 years experience
    specialType: SpecialType;
}

export interface ScheduleCell {
    date: string; // YYYY-MM-DD
    shiftType: ShiftType;
    isLeaderMarked: boolean;
    isWarning?: boolean; // For validation feedback
}

export interface DaySchedule {
    date: string;
    dayOfWeek: number; // 0=Sun, 1=Mon...
    isHoliday: boolean;
}

// Map<StaffId, ScheduleCell[]>
export type ScheduleMap = Record<string, ScheduleCell[]>;
