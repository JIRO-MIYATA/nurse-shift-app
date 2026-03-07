import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ==========================================
// Constants & Types
// ==========================================

const T_DAY_WEEK = 11;
const T_DAY_HOL = 7;
const T_NIGHT = 4;
const MIN_NIGHTS = 2;
const EXTRA_OFF = 5;
const MAX_CONSECUTIVE_WORK = 5;
const PREV_MONTH_LOOKBACK = 10;

// Fixed Holidays (MM/DD)
const HOLIDAYS = [
    "01/01", "01/02", "01/03", "02/11", "02/23", "03/20", "03/21", "04/29",
    "05/03", "05/04", "05/05", "07/15", "07/21", "08/11", "09/15", "09/23",
    "10/14", "11/03", "11/23", "12/23"
];

const SHIFT_TYPES = {
    DAY: { label: "日", en: "Day", color: "#3B82F6" },
    START: { label: "準", en: "Semi", color: "#F97316" },
    DEEP: { label: "深", en: "Deep", color: "#A855F7" },
    OFF: { label: "休", en: "Off", color: "#64748B" }
};

// ==========================================
// Styles
// ==========================================

const styles = {
    container: {
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: "#080C12",
        color: "#E2E8F0",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
    },
    header: {
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "#0F172A",
        borderBottom: "1px solid #1E293B",
        padding: "0.75rem 1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)",
    },
    navButton: {
        background: "transparent",
        border: "1px solid #334155",
        color: "#CBD5E1",
        padding: "0.25rem 0.75rem",
        borderRadius: "0.25rem",
        cursor: "pointer",
        margin: "0 0.5rem",
    },
    actionButton: {
        backgroundColor: "#334155",
        color: "#F1F5F9",
        border: "none",
        padding: "0.5rem 1rem",
        borderRadius: "0.375rem",
        cursor: "pointer",
        fontWeight: 500,
        marginLeft: "0.5rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
    },
    primaryButton: {
        backgroundColor: "#0EA5E9",
        color: "#FFFFFF",
    },
    dangerButton: {
        backgroundColor: "#EF4444",
        color: "#FFFFFF",
    },
    persistButton: {
        color: "#FFFFFF",
        border: "none",
        padding: "0.5rem 0",
        borderRadius: "0.375rem",
        cursor: "pointer",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "110px",
        fontSize: "0.85rem",
    },
    tableWrapper: {
        flex: 1,
        overflow: "auto",
        position: "relative",
    },
    table: {
        borderCollapse: "collapse",
        width: "100%",
        fontSize: "0.80rem",
    },
    th: {
        backgroundColor: "#1E293B",
        color: "#94A3B8",
        padding: "0.3rem",
        textAlign: "center",
        border: "1px solid #334155",
        whiteSpace: "nowrap",
        fontWeight: 600,
    },
    td: {
        border: "1px solid #334155",
        textAlign: "center",
        padding: "0",
        height: "2.0rem",
        minWidth: "2.0rem",
        cursor: "pointer",
        transition: "background-color 0.1s",
    },
    stickyCol: {
        position: "sticky",
        backgroundColor: "#0F172A",
        zIndex: 10,
        left: 0,
    },
    shiftCell: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        boxSizing: "border-box",
    },
    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
    },
    modalContent: {
        backgroundColor: "#1E293B",
        padding: "1.5rem",
        borderRadius: "0.5rem",
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflow: "auto",
        border: "1px solid #334155",
    },
    badge: {
        display: "inline-block",
        padding: "0.1rem 0.3rem",
        borderRadius: "0.2rem",
        fontSize: "0.7rem",
        marginRight: "0.2rem",
        backgroundColor: "#475569",
        color: "#fff",
    },
    legendBar: {
        display: "flex",
        gap: "1rem",
        backgroundColor: "#0F172A",
        padding: "0.5rem 1rem",
        borderBottom: "1px solid #1E293B",
        fontSize: "0.8rem",
        color: "#94A3B8",
        flexWrap: "wrap",
    },
};

// ==========================================
// Helpers
// ==========================================

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const checkIsHoliday = (year, month, day) => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const formatted = `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    if (dayOfWeek === 0) return true;
    if (HOLIDAYS.includes(formatted)) return true;
    return false;
};

const generateDefaultStaff = () => {
    const staff = [];
    for (let i = 1; i <= 30; i++) {
        let team = "A";
        if (i > 10) team = "B";
        if (i > 20) team = "C";

        let rookie = false;
        let w4 = false;
        let sunOff = false;
        let fixNights = null;
        let isLeader = true;
        let name = `スタッフ ${i}`;

        if (i === 1) { w4 = true; sunOff = true; fixNights = 2; name += " (Manager)"; }
        else if (i === 11) { w4 = true; fixNights = 2; }

        if ([9, 10, 19, 20, 29, 30].includes(i)) { rookie = true; isLeader = false; }

        staff.push({ id: i, name, team, rookie, w4, sunOff, fixNights, isLeader });
    }
    return staff;
};

// ==========================================
// Main Component
// ==========================================

export default function NurseShiftApp() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [staffData, setStaffData] = useState(generateDefaultStaff());
    const [schedule, setSchedule] = useState([]);
    // requests: { sIdx: { dIdx: "OFF"|"DAY" } }
    const [requests, setRequests] = useState({});
    const [prevMonthSchedule, setPrevMonthSchedule] = useState([]);
    const [isPrevMonthLinked, setIsPrevMonthLinked] = useState(false);
    // leaderFlags: Set of "sIdx-dIdx" strings for dynamic per-day leader marking
    const [leaderFlags, setLeaderFlags] = useState(new Set());
    const [filterTeam, setFilterTeam] = useState("ALL");
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showReadPrevMonthModal, setShowReadPrevMonthModal] = useState(false);
    // monthlyCache: "YYYY-MM" -> { requests, prevMonthSchedule, leaderFlagsArr, schedule }
    const [monthlyCache, setMonthlyCache] = useState({});
    const [editCell, setEditCell] = useState(null);
    // appError: { message, type } | null  (type: "error"|"success")
    const [appError, setAppError] = useState(null);

    const showError = useCallback((message, type = "error") => {
        setAppError({ message, type });
        setTimeout(() => setAppError(null), 4000);
    }, []);

    // Use a ref for monthlyCache in effects to avoid stale closure / loop issues
    const monthlyCacheRef = useRef(monthlyCache);
    useEffect(() => { monthlyCacheRef.current = monthlyCache; }, [monthlyCache]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(year, month);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // ==========================================
    // Initialize / Restore month state
    // ==========================================
    // Runs only when year/month changes (not on every cache update)
    const isFirstMount = useRef(true);
    const prevYearMonth = useRef({ year, month });

    useEffect(() => {
        // Skip if year/month hasn't actually changed (prevents double-run on mount with strict mode)
        const prev = prevYearMonth.current;
        if (!isFirstMount.current && prev.year === year && prev.month === month) return;
        isFirstMount.current = false;
        prevYearMonth.current = { year, month };

        const key = `${year}-${month}`;
        const cache = monthlyCacheRef.current;
        const cached = cache[key];

        // Restore schedule / leaderFlags / requests from cache if available
        let nextSchedule = staffData.map(() => Array(daysInMonth).fill("DAY"));
        let nextLeaderFlags = new Set();
        let nextRequests = {};

        if (cached) {
            if (cached.schedule && cached.schedule.length === staffData.length) {
                nextSchedule = cached.schedule.map(row => [...row]);
            }
            if (cached.leaderFlagsArr) nextLeaderFlags = new Set(cached.leaderFlagsArr);
            if (cached.requests) nextRequests = cached.requests;
        }

        // Determine prevMonthSchedule: prefer cache, then default to OFF
        const prevDate = new Date(year, month - 2, 1);
        const prevKey = `${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`;
        const prevData = cache[prevKey];

        let nextPrevSchedule = staffData.map(() => Array(PREV_MONTH_LOOKBACK).fill("OFF"));
        let nextIsLinked = false;

        if (prevData && prevData.schedule) {
            const daysInPrev = getDaysInMonth(prevDate.getFullYear(), prevDate.getMonth() + 1);
            nextPrevSchedule = staffData.map((_, sIdx) => {
                const pSched = prevData.schedule[sIdx] || Array(daysInPrev).fill("OFF");
                return pSched.slice(daysInPrev - PREV_MONTH_LOOKBACK, daysInPrev);
            });
            nextIsLinked = true;
        } else if (cached && cached.prevMonthSchedule) {
            nextPrevSchedule = cached.prevMonthSchedule;
            nextIsLinked = false;
        }

        setSchedule(nextSchedule);
        setLeaderFlags(nextLeaderFlags);
        setRequests(nextRequests);
        setPrevMonthSchedule(nextPrevSchedule);
        setIsPrevMonthLinked(nextIsLinked);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month]);

    // ==========================================
    // Schedule Generation
    // ==========================================
    const generateSchedule = useCallback(() => {
        try {
            // Deep copy: each row is a new array
            const newSched = staffData.map(() => Array(daysInMonth).fill("DAY"));
            // Two separate lock sets: hard (request/prev-month) vs soft (phase1)
            const hardLocked = new Set();
            const softLocked = new Set();

            const isHardLocked = (sIdx, dIdx) => hardLocked.has(`${sIdx}-${dIdx}`);
            const isSoftLocked = (sIdx, dIdx) => softLocked.has(`${sIdx}-${dIdx}`);
            const isLocked = (sIdx, dIdx) => isHardLocked(sIdx, dIdx) || isSoftLocked(sIdx, dIdx);

            const hardLock = (sIdx, dIdx, shift) => {
                if (dIdx >= 0 && dIdx < daysInMonth) {
                    newSched[sIdx][dIdx] = shift;
                    hardLocked.add(`${sIdx}-${dIdx}`);
                }
            };
            const softLock = (sIdx, dIdx, shift) => {
                if (dIdx >= 0 && dIdx < daysInMonth && !isHardLocked(sIdx, dIdx)) {
                    newSched[sIdx][dIdx] = shift;
                    softLocked.add(`${sIdx}-${dIdx}`);
                }
            };
            const softUnlock = (sIdx, dIdx) => {
                softLocked.delete(`${sIdx}-${dIdx}`);
                if (!isHardLocked(sIdx, dIdx)) {
                    newSched[sIdx][dIdx] = "DAY";
                }
            };

            setLeaderFlags(new Set());

            // [PHASE 0] Hard Constraints
            staffData.forEach((s, sIdx) => {
                // Shift requests
                if (requests[sIdx]) {
                    Object.entries(requests[sIdx]).forEach(([d, type]) => {
                        hardLock(sIdx, parseInt(d), type);
                    });
                }
                // Sunday off
                if (s.sunOff) {
                    daysArray.forEach((d, dIdx) => {
                        const date = new Date(year, month - 1, d);
                        if (date.getDay() === 0) hardLock(sIdx, dIdx, "OFF");
                    });
                }

                // Prev month carry-over (Semi->Deep, Deep->Off)
                const prevSched = prevMonthSchedule[sIdx];
                const lastDay = prevSched && prevSched.length > 0
                    ? prevSched[prevSched.length - 1]
                    : null;

                if (lastDay === "START") {
                    hardLock(sIdx, 0, "DEEP");
                    hardLock(sIdx, 1, "OFF");
                } else if (lastDay === "DEEP") {
                    hardLock(sIdx, 0, "OFF");
                }
            });

            // [PHASE 1] Night Shifts
            const currentNightCounts = new Array(staffData.length).fill(0);

            for (let dIdx = 0; dIdx < daysInMonth; dIdx++) {
                const candidates = [];

                staffData.forEach((s, sIdx) => {
                    if (isLocked(sIdx, dIdx)) return;
                    if (dIdx + 1 < daysInMonth && isLocked(sIdx, dIdx + 1)) return;
                    if (dIdx + 2 < daysInMonth && isLocked(sIdx, dIdx + 2)) return;
                    candidates.push(sIdx);
                });

                let validSelection = false;
                let attempt = 0;

                while (!validSelection && attempt < 100) {
                    attempt++;
                    const pool = [...candidates].sort((a, b) => {
                        const weightA = currentNightCounts[a] + Math.random() * 2.5;
                        const weightB = currentNightCounts[b] + Math.random() * 2.5;
                        return weightA - weightB;
                    });

                    const currentSelection = [];
                    const pick = (pIdx) => {
                        currentSelection.push(pool[pIdx]);
                        pool.splice(pIdx, 1);
                    };

                    for (const t of ["A", "B", "C"]) {
                        const idx = pool.findIndex(pid => staffData[pid].team === t);
                        if (idx !== -1) pick(idx);
                    }
                    while (currentSelection.length < T_NIGHT && pool.length > 0) {
                        pick(0);
                    }

                    if (currentSelection.length === T_NIGHT) {
                        const rookies = currentSelection.filter(pid => staffData[pid].rookie).length;
                        const leaders = currentSelection.filter(pid => staffData[pid].isLeader).length;

                        if (rookies <= 1 && leaders >= 1) {
                            validSelection = true;
                            currentSelection.forEach(pid => {
                                softLock(pid, dIdx, "START");
                                if (dIdx + 1 < daysInMonth) softLock(pid, dIdx + 1, "DEEP");
                                if (dIdx + 2 < daysInMonth) softLock(pid, dIdx + 2, "OFF");
                                currentNightCounts[pid]++;
                            });
                        }
                    } else {
                        break;
                    }
                }
            }

            // [PHASE 2] Fixed Night Count Adjustment
            // Only removes soft-locked START shifts; never touches hard-locked cells
            staffData.forEach((s, sIdx) => {
                if (s.fixNights === null) return;

                const nightDays = [];
                for (let d = 0; d < daysInMonth; d++) {
                    if (newSched[sIdx][d] === "START") nightDays.push(d);
                }

                const nightCount = nightDays.length;
                const target = s.fixNights;

                if (nightCount > target) {
                    // Remove softest (soft-locked) nights from the end
                    let removed = 0;
                    for (let i = nightDays.length - 1; i >= 0 && removed < nightCount - target; i--) {
                        const d = nightDays[i];
                        if (isSoftLocked(sIdx, d)) {
                            softUnlock(sIdx, d);
                            if (d + 1 < daysInMonth && isSoftLocked(sIdx, d + 1)) {
                                softUnlock(sIdx, d + 1);
                            }
                            // Note: the OFF at d+2 stays as OFF (which is fine / safe)
                            removed++;
                        }
                    }
                }
            });

            // [PHASE 3] W4 Staff Extra Off
            staffData.forEach((s, sIdx) => {
                if (!s.w4) return;
                let addedOffs = 0;
                const availableDays = daysArray
                    .map((_, i) => i)
                    .filter(d => newSched[sIdx][d] === "DAY" && !isLocked(sIdx, d))
                    .sort(() => Math.random() - 0.5);

                for (const d of availableDays) {
                    if (addedOffs >= EXTRA_OFF) break;
                    softLock(sIdx, d, "OFF");
                    addedOffs++;
                }
            });

            // [PHASE 4] Day Limit Enforcement
            for (let dIdx = 0; dIdx < daysInMonth; dIdx++) {
                const isHoli = checkIsHoliday(year, month, dIdx + 1);
                const maxDay = isHoli ? T_DAY_HOL : T_DAY_WEEK;

                const dayStaff = staffData.map((_, sIdx) => sIdx).filter(sIdx => newSched[sIdx][dIdx] === "DAY");

                if (dayStaff.length > maxDay) {
                    const toRemoveCount = dayStaff.length - maxDay;

                    // Removable = soft-locked DAY cells only
                    const candidates = dayStaff
                        .filter(sIdx => isSoftLocked(sIdx, dIdx) || !isLocked(sIdx, dIdx))
                        .sort((a, b) => {
                            const countA = newSched[a].filter(s => s !== "OFF").length + Math.random();
                            const countB = newSched[b].filter(s => s !== "OFF").length + Math.random();
                            return countB - countA;
                        });

                    let removed = 0;
                    for (const targetIdx of candidates) {
                        if (removed >= toRemoveCount) break;

                        // Leader constraint: keep at least 1 leader on day shift
                        if (staffData[targetIdx].isLeader) {
                            const remainingLeaders = dayStaff.filter(
                                sIdx => sIdx !== targetIdx && newSched[sIdx][dIdx] === "DAY" && staffData[sIdx].isLeader
                            ).length;
                            if (remainingLeaders < 1) continue;
                        }

                        softLock(targetIdx, dIdx, "OFF");
                        removed++;
                    }
                }
            }

            // [PHASE 5] Consecutive Work Limit
            staffData.forEach((s, sIdx) => {
                let consecutive = 0;

                // Seed consecutive count from previous month tail
                const prev = prevMonthSchedule[sIdx];
                if (prev) {
                    for (let i = prev.length - 1; i >= 0; i--) {
                        if (prev[i] === "OFF") break;
                        consecutive++;
                    }
                }

                for (let d = 0; d < daysInMonth; d++) {
                    if (newSched[sIdx][d] === "OFF") {
                        consecutive = 0;
                    } else {
                        consecutive++;
                        if (consecutive > MAX_CONSECUTIVE_WORK) {
                            // Try to turn current day OFF
                            if (newSched[sIdx][d] === "DAY" && !isHardLocked(sIdx, d)) {
                                softLock(sIdx, d, "OFF");
                                consecutive = 0;
                            }
                            // Fallback: turn previous DAY to OFF
                            else if (d > 0 && newSched[sIdx][d - 1] === "DAY" && !isHardLocked(sIdx, d - 1)) {
                                softLock(sIdx, d - 1, "OFF");
                                consecutive = 1;
                            }
                            // Cannot resolve — validation will flag it
                        }
                    }
                }
            });

            setSchedule(newSched);
        } catch (err) {
            console.error("スケジュール生成エラー:", err);
            showError("スケジュールの生成中にエラーが発生しました: " + err.message);
        }
    }, [staffData, requests, daysInMonth, year, month, prevMonthSchedule, daysArray, showError]);

    // ==========================================
    // Validation
    // ==========================================
    const validation = useMemo(() => {
        const empty = { cellWarnings: {}, colWarnings: {}, requestFailures: {}, consecutiveWarnings: {} };
        try {
            const v = {
                cellWarnings: {},
                colWarnings: {},
                requestFailures: {},
                consecutiveWarnings: {}
            };

            for (let d = 0; d < daysInMonth; d++) {
                const isHoli = checkIsHoliday(year, month, d + 1);
                const limitDay = isHoli ? T_DAY_HOL : T_DAY_WEEK;

                let cDay = 0, cStart = 0, cDeep = 0;
                let rookiesStart = 0, rookiesDeep = 0;
                let leadersDay = 0, leadersStart = 0, leadersDeep = 0;

                staffData.forEach((s, sIdx) => {
                    const shift = schedule[sIdx]?.[d];
                    // Leader = staff attribute OR dynamic per-day flag
                    const isLeader = s.isLeader || leaderFlags.has(`${sIdx}-${d}`);

                    if (shift === "DAY") { cDay++; if (isLeader) leadersDay++; }
                    if (shift === "START") { cStart++; if (s.rookie) rookiesStart++; if (isLeader) leadersStart++; }
                    if (shift === "DEEP") { cDeep++; if (s.rookie) rookiesDeep++; if (isLeader) leadersDeep++; }

                    // Request fulfillment check
                    const reqType = requests[sIdx]?.[d];
                    if (reqType) {
                        const failed = (reqType === "OFF" && shift !== "OFF") ||
                            (reqType === "DAY" && shift !== "DAY");
                        if (failed) {
                            v.requestFailures[`${sIdx}-${d}`] = true;
                            v.cellWarnings[`${sIdx}-${d}`] = true;
                        }
                    }
                });

                // Column status
                v.colWarnings[`${d}-DAY`] = cDay > limitDay ? "red" : cDay < limitDay - 2 ? "orange" : "#10B981";
                v.colWarnings[`${d}-START`] = cStart !== T_NIGHT ? "red" : rookiesStart >= 2 ? "orange" : leadersStart === 0 ? "magenta" : "#10B981";
                v.colWarnings[`${d}-DEEP`] = cDeep !== T_NIGHT ? "red" : rookiesDeep >= 2 ? "orange" : leadersDeep === 0 ? "magenta" : "#10B981";

                // Rookie overlap cell warnings
                if (rookiesStart >= 2) {
                    staffData.forEach((s, sIdx) => {
                        if (schedule[sIdx]?.[d] === "START" && s.rookie) v.cellWarnings[`${sIdx}-${d}`] = true;
                    });
                }
                if (rookiesDeep >= 2) {
                    staffData.forEach((s, sIdx) => {
                        if (schedule[sIdx]?.[d] === "DEEP" && s.rookie) v.cellWarnings[`${sIdx}-${d}`] = true;
                    });
                }
            }

            // Consecutive work validation
            staffData.forEach((s, sIdx) => {
                let consecutive = 0;
                for (let d = 0; d < daysInMonth; d++) {
                    if (schedule[sIdx]?.[d] === "OFF") {
                        consecutive = 0;
                    } else {
                        consecutive++;
                        if (consecutive > MAX_CONSECUTIVE_WORK) {
                            v.cellWarnings[`${sIdx}-${d}`] = true;
                            v.consecutiveWarnings[sIdx] = true;
                        }
                    }
                }
            });

            return v;
        } catch (err) {
            console.error("バリデーションエラー:", err);
            return empty;
        }
    }, [schedule, daysInMonth, staffData, requests, year, month, leaderFlags]);

    // ==========================================
    // Month Navigation
    // ==========================================
    const changeMonth = useCallback((delta) => {
        const currentKey = `${year}-${month}`;

        // Save current state before navigating
        setMonthlyCache(prev => ({
            ...prev,
            [currentKey]: {
                requests: { ...requests },
                prevMonthSchedule: prevMonthSchedule.map(row => [...row]),
                leaderFlagsArr: Array.from(leaderFlags),
                schedule: schedule.map(row => [...row]),
            }
        }));

        setCurrentDate(new Date(year, month - 1 + delta, 1));
    }, [year, month, requests, prevMonthSchedule, leaderFlags, schedule]);

    // ==========================================
    // CSV Export
    // ==========================================
    const handleCSVExport = () => {
        try {
            let csv = "\uFEFF";
            csv += "No,Name,Team,Attr," + daysArray.join(",") + ",DayTotal,SemiTotal,DeepTotal,OffTotal\n";

            staffData.forEach((s, sIdx) => {
                const attr = [s.w4 && "W4", s.rookie && "Beginner", s.sunOff && "SunOff"].filter(Boolean).join(" ");
                const counts = { DAY: 0, START: 0, DEEP: 0, OFF: 0 };
                const shifts = (schedule[sIdx] || []).map((sh, dIdx) => {
                    let label = SHIFT_TYPES[sh]?.label || "";
                    if (leaderFlags.has(`${sIdx}-${dIdx}`)) label += "(L)";
                    if (counts[sh] !== undefined) counts[sh]++;
                    return label;
                });
                csv += [s.id, s.name, s.team, attr, ...shifts, counts.DAY, counts.START, counts.DEEP, counts.OFF].join(",") + "\n";
            });

            // Footer totals
            ["DAY", "START", "DEEP", "OFF"].forEach(type => {
                const sums = daysArray.map((_, d) =>
                    staffData.filter((_, sIdx) => schedule[sIdx]?.[d] === type).length
                ).join(",");
                csv += `,,${SHIFT_TYPES[type].label}計,,${sums}\n`;
            });

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `shift_${year}_${month}.csv`;
            link.click();
            showError("CSVをエクスポートしました", "success");
        } catch (err) {
            console.error("CSVエクスポートエラー:", err);
            showError("CSVのエクスポートに失敗しました: " + err.message);
        }
    };

    // ==========================================
    // Data Export / Import
    // ==========================================
    const exportData = () => {
        try {
            const data = {
                staffData,
                requests,
                prevMonthSchedule,
                leaderFlagsArr: Array.from(leaderFlags),
                schedule,
                monthlyCache: Object.fromEntries(
                    Object.entries(monthlyCache).map(([k, v]) => [
                        k,
                        { ...v, leaderFlagsArr: v.leaderFlagsArr || [] }
                    ])
                ),
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `nurse_shift_data_${year}_${month}.json`;
            a.click();
            showError("データを保存しました", "success");
        } catch (err) {
            console.error("データ保存エラー:", err);
            showError("データの保存に失敗しました: " + err.message);
        }
    };

    const exportStaffData = () => {
        try {
            const blob = new Blob([JSON.stringify({ staffData }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `nurse_staff_only_${year}_${month}.json`;
            a.click();
            showError("スタッフデータを保存しました", "success");
        } catch (err) {
            console.error("スタッフ保存エラー:", err);
            showError("スタッフデータの保存に失敗しました: " + err.message);
        }
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const raw = event.target?.result;
                if (!raw) throw new Error("ファイルの内容が読み取れませんでした");
                const data = JSON.parse(raw);
                if (!data || typeof data !== "object") throw new Error("JSONフォーマットが無効です");
                if (data.staffData) setStaffData(data.staffData);
                if (data.requests) setRequests(data.requests);
                if (data.prevMonthSchedule) setPrevMonthSchedule(data.prevMonthSchedule);
                if (data.schedule) setSchedule(data.schedule);
                if (data.leaderFlagsArr) setLeaderFlags(new Set(data.leaderFlagsArr));
                if (data.monthlyCache) {
                    // Restore leaderFlags as Set in each cached month
                    const restored = Object.fromEntries(
                        Object.entries(data.monthlyCache).map(([k, v]) => [
                            k,
                            { ...v, leaderFlags: new Set(v.leaderFlagsArr || []) }
                        ])
                    );
                    setMonthlyCache(restored);
                }
                showError("データを読み込みました", "success");
            } catch (err) {
                console.error("データ読込エラー:", err);
                showError("ファイルの読み込みに失敗しました: " + err.message);
            }
        };
        reader.onerror = () => showError("ファイルの読み取り中にエラーが発生しました");
        reader.readAsText(file);
        e.target.value = "";
    };

    const importStaffData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const raw = event.target?.result;
                if (!raw) throw new Error("ファイルの内容が読み取れませんでした");
                const data = JSON.parse(raw);
                if (!data || typeof data !== "object") throw new Error("JSONフォーマットが無効です");
                if (!data.staffData || !Array.isArray(data.staffData)) {
                    throw new Error("スタッフデータが見つかりませんでした");
                }

                const newStaff = data.staffData;
                setStaffData(newStaff);

                const resize = (arr, filler) => {
                    if (arr.length < newStaff.length) {
                        return [...arr, ...Array(newStaff.length - arr.length).fill(null).map(() => filler)];
                    }
                    return arr.slice(0, newStaff.length);
                };

                setSchedule(prev => resize(prev, Array(daysInMonth).fill("DAY")));
                setPrevMonthSchedule(prev => resize(prev, Array(PREV_MONTH_LOOKBACK).fill("OFF")));
                showError(`スタッフ条件を読み込みました (${newStaff.length}名)`, "success");
            } catch (err) {
                console.error("スタッフ読込エラー:", err);
                showError("ファイルの読み込みに失敗しました: " + err.message);
            }
        };
        reader.onerror = () => showError("ファイルの読み取り中にエラーが発生しました");
        reader.readAsText(file);
        e.target.value = "";
    };

    // ==========================================
    // Staff CRUD
    // ==========================================
    const updateStaff = (index, field, val) => {
        setStaffData(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: val };
            return next;
        });
    };

    const addStaff = () => {
        const newId = (staffData[staffData.length - 1]?.id || 0) + 1;
        const counts = { A: 0, B: 0, C: 0 };
        staffData.forEach(s => counts[s.team]++);
        const team = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
        setStaffData(prev => [...prev, {
            id: newId, name: `スタッフ ${newId}`, team,
            rookie: false, w4: false, sunOff: false, fixNights: null, isLeader: false
        }]);
    };

    const removeStaff = (index) => {
        setStaffData(prev => prev.filter((_, i) => i !== index));
        setSchedule(prev => prev.filter((_, i) => i !== index));
        setLeaderFlags(new Set());
    };

    const toggleLeader = (sIdx, dIdx) => {
        if (staffData[sIdx].rookie) return;
        const key = `${sIdx}-${dIdx}`;
        setLeaderFlags(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // ==========================================
    // Render Helpers
    // ==========================================
    const renderCell = (sIdx, dIdx) => {
        const shiftKey = schedule[sIdx]?.[dIdx];
        const shift = SHIFT_TYPES[shiftKey];
        const reqType = requests[sIdx]?.[dIdx];
        const isWarn = validation.cellWarnings[`${sIdx}-${dIdx}`];
        const isReqFail = validation.requestFailures[`${sIdx}-${dIdx}`];
        const isLeader = leaderFlags.has(`${sIdx}-${dIdx}`);

        return (
            <div
                onClick={() => setEditCell({ sIdx, dIdx })}
                style={{
                    ...styles.shiftCell,
                    backgroundColor: shift?.color || "#555",
                    color: "#fff",
                    position: "relative",
                    outline: isReqFail ? "2px solid yellow" : isWarn ? "2px solid black" : "2px solid transparent",
                    outlineOffset: "-2px",
                    opacity: reqType && !isReqFail ? 0.8 : 1
                }}
            >
                {isLeader && <span style={{ position: "absolute", top: 0, left: 2, fontSize: "0.6rem", zIndex: 6 }}>👑</span>}
                {shift?.label}
                {reqType && (
                    <span style={{ position: "absolute", top: 0, right: 0, fontSize: "0.6rem", zIndex: 6 }}>
                        {reqType === "DAY" ? "日" : "休"}
                    </span>
                )}
            </div>
        );
    };

    const totalRequests = Object.values(requests).reduce((acc, r) => acc + Object.keys(r).length, 0);

    // ==========================================
    // Render
    // ==========================================
    return (
        <div style={styles.container}>
            {/* Error / Success Banner */}
            {appError && (
                <div style={{
                    position: "fixed",
                    top: "1rem",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 200,
                    backgroundColor: appError.type === "success" ? "#065F46" : "#7F1D1D",
                    border: `1px solid ${appError.type === "success" ? "#10B981" : "#EF4444"}`,
                    color: "#fff",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    maxWidth: "500px",
                    fontSize: "0.9rem",
                    animation: "fadeInDown 0.2s ease",
                }}>
                    <span>{appError.type === "success" ? "✅" : "❌"}</span>
                    <span style={{ flex: 1 }}>{appError.message}</span>
                    <button
                        onClick={() => setAppError(null)}
                        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem", padding: 0 }}
                    >✕</button>
                </div>
            )}
            {/* Header */}
            <header style={styles.header}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>看護師シフト管理 🏥</h1>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={exportData} style={{ ...styles.persistButton, backgroundColor: "#0EA5E9" }}>
                            データ保存
                        </button>
                        <label style={{ ...styles.persistButton, backgroundColor: "#0EA5E9", cursor: "pointer" }}>
                            データ読込
                            <input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
                        </label>
                        <button onClick={exportStaffData} style={{ ...styles.persistButton, backgroundColor: "#14B8A6" }}>
                            スタッフ保存
                        </button>
                        <label style={{ ...styles.persistButton, backgroundColor: "#14B8A6", cursor: "pointer" }}>
                            スタッフ読込
                            <input type="file" accept=".json" onChange={importStaffData} style={{ display: "none" }} />
                        </label>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <button style={styles.navButton} onClick={() => changeMonth(-1)}>‹</button>
                    <span style={{ fontWeight: 700, margin: "0 1rem" }}>{year}年 {month}月</span>
                    <button style={styles.navButton} onClick={() => changeMonth(1)}>›</button>
                </div>

                <div>
                    <button style={styles.actionButton} onClick={() => setShowStaffModal(true)}>スタッフ編集</button>
                    <button style={styles.actionButton} onClick={() => setShowRequestModal(true)}>
                        希望勤務 {totalRequests > 0 && <span style={styles.badge}>{totalRequests}</span>}
                    </button>
                    <button style={{ ...styles.actionButton, ...styles.primaryButton }} onClick={generateSchedule}>
                        ✨ 作成
                    </button>
                    <button style={styles.actionButton} onClick={handleCSVExport}>⬇ CSV</button>
                </div>
            </header>

            {/* Legend */}
            <div style={styles.legendBar}>
                {Object.entries(SHIFT_TYPES).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", marginRight: "1rem" }}>
                        <div style={{ width: 12, height: 12, backgroundColor: v.color, marginRight: 4, borderRadius: 2 }}></div>
                        <span>{v.label}</span>
                    </div>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
                    <span>日勤上限: {T_DAY_WEEK}(平日) / {T_DAY_HOL}(休日)</span>
                    <span>夜勤人数: {T_NIGHT}</span>
                    <span>連勤上限: {MAX_CONSECUTIVE_WORK}</span>
                    <span
                        onClick={() => setShowReadPrevMonthModal(true)}
                        style={{
                            color: isPrevMonthLinked ? "#10B981" : "#F97316",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textUnderlineOffset: "4px"
                        }}
                        title="クリックして前月データを確認"
                    >
                        前月: {isPrevMonthLinked ? "✓ 連携済" : "⚠ 未連携"}
                    </span>
                </div>
            </div>

            {/* Team Tabs */}
            <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #1E293B", backgroundColor: "#0F172A" }}>
                {["ALL", "A", "B", "C"].map(t => (
                    <button
                        key={t}
                        onClick={() => setFilterTeam(t)}
                        style={{
                            backgroundColor: filterTeam === t ? "#3B82F6" : "transparent",
                            color: filterTeam === t ? "#fff" : "#94A3B8",
                            border: "none", padding: "0.25rem 0.75rem", borderRadius: "1rem",
                            marginRight: "0.5rem", cursor: "pointer"
                        }}
                    >
                        チーム {t}
                    </button>
                ))}
            </div>

            {/* Main Table */}
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, ...styles.stickyCol, minWidth: 40 }}>No</th>
                            <th style={{ ...styles.th, ...styles.stickyCol, left: 40, minWidth: 120 }}>名前</th>
                            <th style={{ ...styles.th, ...styles.stickyCol, left: 160, minWidth: 50 }}>チーム</th>
                            {daysArray.map(d => {
                                const date = new Date(year, month - 1, d);
                                const day = date.getDay();
                                const isHoli = checkIsHoliday(year, month, d);
                                const bgColor = (isHoli || day === 0) ? "#EF4444" : day === 6 ? "#3B82F6" : styles.th.backgroundColor;
                                return (
                                    <th key={d} style={{ ...styles.th, backgroundColor: bgColor, color: "white" }}>
                                        {d}
                                    </th>
                                );
                            })}
                            <th style={styles.th}>日勤</th>
                            <th style={styles.th}>準夜</th>
                            <th style={styles.th}>深夜</th>
                            <th style={styles.th}>休日</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffData.map((s, idx) => {
                            if (filterTeam !== "ALL" && s.team !== filterTeam) return null;
                            const counts = { DAY: 0, START: 0, DEEP: 0, OFF: 0 };
                            schedule[idx]?.forEach(k => { if (counts[k] !== undefined) counts[k]++; });

                            return (
                                <tr key={s.id}>
                                    <td style={{ ...styles.td, ...styles.stickyCol, color: (s.w4 || s.sunOff) ? "#FBBF24" : "#94A3B8" }}>
                                        {s.fixNights !== null && "★"}{idx + 1}
                                    </td>
                                    <td style={{ ...styles.td, ...styles.stickyCol, left: 40, textAlign: "left", paddingLeft: 8 }}>
                                        {s.rookie && "🔰"} {s.w4 && <span style={styles.badge}>W4</span>} {s.name}
                                    </td>
                                    <td style={{ ...styles.td, ...styles.stickyCol, left: 160 }}>
                                        <span style={{ color: s.team === "A" ? "#F87171" : s.team === "B" ? "#4ADE80" : "#60A5FA", fontWeight: "bold" }}>
                                            {s.team}
                                        </span>
                                    </td>
                                    {daysArray.map((d, i) => {
                                        const date = new Date(year, month - 1, d);
                                        const day = date.getDay();
                                        const isHoli = checkIsHoliday(year, month, d);
                                        const cellBg = (isHoli || day === 0)
                                            ? "rgba(239, 68, 68, 0.1)"
                                            : day === 6
                                                ? "rgba(59, 130, 246, 0.1)"
                                                : "transparent";

                                        return (
                                            <td key={d} style={{ ...styles.td, backgroundColor: cellBg }}>
                                                {renderCell(idx, i)}
                                            </td>
                                        );
                                    })}
                                    <td style={styles.td}>{counts.DAY}</td>
                                    <td style={{ ...styles.td, color: s.fixNights !== null ? "#38BDF8" : "inherit", fontWeight: s.fixNights !== null ? "bold" : "normal" }}>{counts.START}</td>
                                    <td style={{ ...styles.td, color: s.fixNights !== null ? "#38BDF8" : "inherit", fontWeight: s.fixNights !== null ? "bold" : "normal" }}>{counts.DEEP}</td>
                                    <td style={styles.td}>{counts.OFF}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        {["DAY", "START", "DEEP"].map(type => (
                            <tr key={type}>
                                <td colSpan={3} style={{ ...styles.th, textAlign: "right" }}>
                                    {SHIFT_TYPES[type].label}計
                                </td>
                                {daysArray.map((d, i) => {
                                    const date = new Date(year, month - 1, d);
                                    const day = date.getDay();
                                    const isHoli = checkIsHoliday(year, month, d);
                                    const cellBg = (isHoli || day === 0) ? "rgba(239, 68, 68, 0.1)" : day === 6 ? "rgba(59, 130, 246, 0.1)" : "transparent";
                                    return (
                                        <td key={d} style={{ ...styles.td, fontWeight: "bold", color: validation.colWarnings[`${i}-${type}`], backgroundColor: cellBg }}>
                                            {staffData.filter((_, idx) =>
                                                schedule[idx]?.[i] === type &&
                                                (filterTeam === "ALL" || staffData[idx].team === filterTeam)
                                            ).length}
                                        </td>
                                    );
                                })}
                                <td colSpan={4}></td>
                            </tr>
                        ))}
                    </tfoot>
                </table>
            </div>

            {/* Read-only Prev Month Modal */}
            {showReadPrevMonthModal && (
                <div style={styles.modalOverlay} onClick={() => setShowReadPrevMonthModal(false)}>
                    <div style={{ ...styles.modalContent, width: "800px" }} onClick={e => e.stopPropagation()}>
                        <h3>前月勤務実績の確認 (過去{PREV_MONTH_LOOKBACK}日間)</h3>
                        <p style={{ color: "#94A3B8", fontSize: "0.85rem" }}>
                            自動連携されている前月末の勤務実績です。このデータに基づき夜勤や連勤のルールが適用されます。
                        </p>
                        <div style={{ overflowX: "auto" }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>名前</th>
                                        {[...Array(PREV_MONTH_LOOKBACK)].map((_, i) => (
                                            <th key={i} style={styles.th}>前{PREV_MONTH_LOOKBACK - i}日</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffData.map((s, sIdx) => (
                                        <tr key={sIdx}>
                                            <td style={styles.td}>{s.name}</td>
                                            {prevMonthSchedule[sIdx]?.map((shift, dIdx) => (
                                                <td key={dIdx} style={styles.td}>
                                                    <div
                                                        style={{
                                                            padding: "0.25rem 0.5rem",
                                                            backgroundColor:
                                                                shift === "OFF" ? "#64748B" :
                                                                    shift === "DEEP" ? "#A855F7" :
                                                                        shift === "START" ? "#F97316" : "#3B82F6",
                                                            color: "white", borderRadius: "4px",
                                                            minWidth: "40px", display: "inline-block"
                                                        }}
                                                    >
                                                        {SHIFT_TYPES[shift]?.label || "日"}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: "1rem", textAlign: "right" }}>
                            <button
                                style={{ ...styles.actionButton, ...styles.primaryButton }}
                                onClick={() => setShowReadPrevMonthModal(false)}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Staff Modal */}
            {showStaffModal && (
                <div style={styles.modalOverlay} onClick={() => setShowStaffModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>スタッフ管理</h3>
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                                    {["名前", "チーム", "リーダー", "新人", "W4", "日曜休", "夜勤固定", "削除"].map(h => (
                                        <th key={h} style={{ borderRight: "1px solid #555", padding: "0.5rem" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {staffData.map((s, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem" }}>
                                            <input
                                                value={s.name}
                                                onChange={e => updateStaff(idx, "name", e.target.value)}
                                                style={{ background: "transparent", border: "none", color: "white", width: "100%" }}
                                            />
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem" }}>
                                            <select
                                                value={s.team}
                                                onChange={e => updateStaff(idx, "team", e.target.value)}
                                                style={{ background: "#334155", color: "white", border: "none", width: "100%" }}
                                            >
                                                <option>A</option><option>B</option><option>C</option>
                                            </select>
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem", textAlign: "center" }}>
                                            <input type="checkbox" checked={s.isLeader || false} onChange={e => updateStaff(idx, "isLeader", e.target.checked)} />
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem", textAlign: "center" }}>
                                            <input type="checkbox" checked={s.rookie} onChange={e => updateStaff(idx, "rookie", e.target.checked)} />
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem", textAlign: "center" }}>
                                            <input type="checkbox" checked={s.w4} onChange={e => updateStaff(idx, "w4", e.target.checked)} />
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem", textAlign: "center" }}>
                                            <input type="checkbox" checked={s.sunOff} onChange={e => updateStaff(idx, "sunOff", e.target.checked)} />
                                        </td>
                                        <td style={{ borderRight: "1px solid #555", padding: "0.5rem" }}>
                                            <select
                                                value={s.fixNights ?? "auto"}
                                                onChange={e => updateStaff(idx, "fixNights", e.target.value === "auto" ? null : Number(e.target.value))}
                                                style={{ background: "#334155", color: "white", border: "none", width: "100%" }}
                                            >
                                                <option value="auto">自動</option>
                                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                            <button
                                                onClick={() => removeStaff(idx)}
                                                style={{ color: "red", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
                                            >
                                                X
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <button style={styles.actionButton} onClick={addStaff}>+ 追加</button>
                            <button
                                style={{ ...styles.actionButton, ...styles.primaryButton }}
                                onClick={() => setShowStaffModal(false)}
                            >
                                保存 & 閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Requests Modal */}
            {showRequestModal && (
                <div style={styles.modalOverlay} onClick={() => setShowRequestModal(false)}>
                    <div style={{ ...styles.modalContent, width: "800px", display: "flex", gap: "1rem" }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: "200px", borderRight: "1px solid #333", maxHeight: "60vh", overflow: "auto" }}>
                            {staffData.map((s, idx) => {
                                const reqCount = Object.keys(requests[idx] || {}).length;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setEditCell({ sIdx: idx, dIdx: -1 })}
                                        style={{
                                            padding: "0.5rem",
                                            cursor: "pointer",
                                            backgroundColor: editCell?.sIdx === idx ? "#334155" : "transparent"
                                        }}
                                    >
                                        {s.name} {reqCount > 0 && <span style={styles.badge}>{reqCount}</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ flex: 1 }}>
                            {editCell && editCell.dIdx === -1 ? (
                                <>
                                    <h3>{staffData[editCell.sIdx].name} の希望勤務</h3>
                                    <p style={{ fontSize: "0.8rem", color: "#94A3B8" }}>クリックで切替: 未設定 → 休み → 日勤 → 未設定</p>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
                                        {["日", "月", "火", "水", "木", "金", "土"].map(d => (
                                            <div key={d} style={{ textAlign: "center", color: "#94A3B8" }}>{d}</div>
                                        ))}
                                        {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                                            <div key={`empty-${i}`}></div>
                                        ))}
                                        {daysArray.map((d, i) => {
                                            const reqType = requests[editCell.sIdx]?.[i];
                                            return (
                                                <button
                                                    key={d}
                                                    onClick={() => {
                                                        const current = requests[editCell.sIdx] || {};
                                                        const newReqs = { ...current };
                                                        if (!reqType) newReqs[i] = "OFF";
                                                        else if (reqType === "OFF") newReqs[i] = "DAY";
                                                        else delete newReqs[i];
                                                        setRequests({ ...requests, [editCell.sIdx]: newReqs });
                                                    }}
                                                    style={{
                                                        padding: "0.5rem",
                                                        backgroundColor: reqType === "OFF" ? "#F97316" : reqType === "DAY" ? "#3B82F6" : "#334155",
                                                        color: "#fff",
                                                        border: "none",
                                                        borderRadius: "4px",
                                                        cursor: "pointer",
                                                        fontWeight: "bold"
                                                    }}
                                                >
                                                    {d}
                                                    {reqType && <span style={{ fontSize: "0.6rem", display: "block" }}>{reqType === "DAY" ? "日" : "休"}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        style={{ marginTop: "1rem", ...styles.actionButton, ...styles.dangerButton }}
                                        onClick={() => {
                                            const newR = { ...requests };
                                            delete newR[editCell.sIdx];
                                            setRequests(newR);
                                        }}
                                    >
                                        全てクリア
                                    </button>
                                </>
                            ) : (
                                <div style={{ color: "#94A3B8" }}>スタッフを選択してください</div>
                            )}
                            <div style={{ marginTop: "1rem", textAlign: "right" }}>
                                <button
                                    style={{ ...styles.actionButton, ...styles.primaryButton }}
                                    onClick={() => setShowRequestModal(false)}
                                >
                                    確定
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Cell Modal */}
            {editCell && editCell.dIdx !== -1 && (
                <div style={styles.modalOverlay} onClick={() => setEditCell(null)}>
                    <div style={{ ...styles.modalContent, width: "300px" }} onClick={e => e.stopPropagation()}>
                        <h3>{staffData[editCell.sIdx]?.name} - {month}/{editCell.dIdx + 1}</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
                            {Object.entries(SHIFT_TYPES).map(([k, v]) => (
                                <button
                                    key={k}
                                    onClick={() => {
                                        setSchedule(prev => {
                                            const next = prev.map(row => [...row]);
                                            next[editCell.sIdx][editCell.dIdx] = k;
                                            return next;
                                        });
                                        setEditCell(null);
                                    }}
                                    style={{
                                        backgroundColor: v.color,
                                        color: "white",
                                        padding: "1rem",
                                        border: "none",
                                        borderRadius: "0.5rem",
                                        cursor: "pointer",
                                        fontWeight: "bold"
                                    }}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        {/* Dynamic Leader Toggle */}
                        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #334155" }}>
                            <button
                                onClick={() => {
                                    toggleLeader(editCell.sIdx, editCell.dIdx);
                                    setEditCell(null);
                                }}
                                disabled={staffData[editCell.sIdx]?.rookie || schedule[editCell.sIdx]?.[editCell.dIdx] === "OFF"}
                                style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    backgroundColor: leaderFlags.has(`${editCell.sIdx}-${editCell.dIdx}`) ? "#F59E0B" : "#334155",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "0.5rem",
                                    cursor: staffData[editCell.sIdx]?.rookie ? "not-allowed" : "pointer",
                                    opacity: (staffData[editCell.sIdx]?.rookie || schedule[editCell.sIdx]?.[editCell.dIdx] === "OFF") ? 0.5 : 1,
                                    fontWeight: "bold",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.5rem"
                                }}
                            >
                                <span>👑</span>
                                {leaderFlags.has(`${editCell.sIdx}-${editCell.dIdx}`) ? "リーダー解除" : "リーダー任命"}
                            </button>
                            {staffData[editCell.sIdx]?.rookie && (
                                <div style={{ fontSize: "0.7rem", color: "#94A3B8", textAlign: "center", marginTop: 4 }}>
                                    ※新人はリーダー不可
                                </div>
                            )}
                        </div>

                        {/* Request Toggle */}
                        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #334155" }}>
                            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#94A3B8" }}>希望設定</h4>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                {[
                                    { label: "なし", type: null, bg: "#334155" },
                                    { label: "休み", type: "OFF", bg: "#F97316" },
                                    { label: "日勤", type: "DAY", bg: "#3B82F6" },
                                ].map(({ label, type, bg }) => (
                                    <button
                                        key={label}
                                        onClick={() => {
                                            setRequests(prev => {
                                                const newReqs = { ...(prev[editCell.sIdx] || {}) };
                                                if (type === null) delete newReqs[editCell.dIdx];
                                                else newReqs[editCell.dIdx] = type;
                                                return { ...prev, [editCell.sIdx]: newReqs };
                                            });
                                            setEditCell(null);
                                        }}
                                        style={{ flex: 1, padding: "0.5rem", backgroundColor: bg, color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
