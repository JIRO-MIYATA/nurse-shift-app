import React, { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import type { Staff, ScheduleMap, ScheduleCell, ShiftType } from '../types';
import { cn } from '../lib/utils';
import { Flag } from 'lucide-react';

interface ScheduleGridProps {
    staffList: Staff[];
    schedule: ScheduleMap;
    warnings: Record<string, boolean[]>;
    onCellUpdate: (staffId: string, date: string, newCell: Partial<ScheduleCell>) => void;
    onSwapConfig: (staffId1: string, date1: string, staffId2: string, date2: string) => void;
}

const ShiftColors: Record<ShiftType, string> = {
    'Day': 'bg-blue-100 text-blue-800 border-blue-200',
    'SemiNight': 'bg-purple-100 text-purple-800 border-purple-200',
    'Night': 'bg-indigo-900 text-white border-indigo-700',
    'Off': 'bg-gray-100 text-gray-500 border-gray-200 dashed-border',
};

const ShiftLabels: Record<ShiftType, string> = {
    'Day': '日',
    'SemiNight': '準',
    'Night': '深',
    'Off': '休',
};

interface DraggableCellProps {
    staffId: string;
    date: string;
    cell: ScheduleCell;
    isWarning: boolean;
    onToggleLeader: () => void;
}

const DraggableCell: React.FC<DraggableCellProps> = ({ staffId, date, cell, isWarning, onToggleLeader }) => {
    const id = `${staffId}|${date}`;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id,
        data: { staffId, date, cell }
    });
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: id,
        data: { staffId, date }
    });

    return (
        <div
            ref={setDroppableRef}
            className={cn(
                "relative w-full h-12 flex items-center justify-center border m-0.5 rounded cursor-grab select-none",
                ShiftColors[cell.shiftType],
                isWarning && "ring-2 ring-red-500 ring-offset-1 z-10",
                isDragging && "opacity-50",
                isOver && "ring-2 ring-green-500 z-10 scale-105 transition-transform"
            )}
            style={{ touchAction: 'none' }}
        >
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                className="w-full h-full flex items-center justify-center"
            >
                <span className="font-bold text-lg">{ShiftLabels[cell.shiftType]}</span>
            </div>

            {/* Leader Toggle Region (Top Right) */}
            <div
                className={cn(
                    "absolute top-0.5 right-0.5 p-0.5 rounded-full cursor-pointer hover:bg-black/10",
                    cell.isLeaderMarked ? "text-yellow-500" : "text-gray-300 opacity-0 hover:opacity-100"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleLeader();
                }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
            >
                <Flag size={12} fill={cell.isLeaderMarked ? "currentColor" : "none"} />
                {cell.isLeaderMarked && <span className="absolute -top-1 -right-1 text-[8px] font-bold text-black">L</span>}
            </div>

            {/* Warning Indicator */}
            {isWarning && (
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-red-500 rounded-full" title="Constraint Violation" />
            )}
        </div>
    );
};

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
    staffList,
    schedule,
    warnings,
    onCellUpdate,
    onSwapConfig
}) => {

    const [activeId, setActiveId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const [s1, d1] = (active.id as string).split('|');
            const [s2, d2] = (over.id as string).split('|');
            onSwapConfig(s1, d1, s2, d2);
        }
    };

    if (staffList.length === 0) return <div>No staff</div>;

    const staffIds = staffList.map(s => s.id);
    const firstStaffSchedule = schedule[staffIds[0]];
    if (!firstStaffSchedule) return <div>Loading...</div>;

    const dates = firstStaffSchedule.map(c => c.date);

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="sticky left-0 bg-white z-20 p-2 border">Staff ({staffList.length})</th>
                            {dates.map(d => {
                                const dateObj = new Date(d);
                                const dayStr = dateObj.getDate();
                                const weekDay = dateObj.getDay(); // 0=Sun
                                const isWeekend = weekDay === 0 || weekDay === 6;
                                return (
                                    <th key={d} className={cn("min-w-[50px] p-1 border text-xs", isWeekend && "bg-orange-50")}>
                                        {dayStr} <br />
                                        {['日', '月', '火', '水', '木', '金', '土'][weekDay]}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.map((staff) => (
                            <tr key={staff.id}>
                                <td className="sticky left-0 bg-white z-10 p-2 border text-sm font-medium whitespace-nowrap flex items-center gap-2 h-14">
                                    <span>{staff.name}</span>
                                    <span className={cn("text-xs px-1 rounded",
                                        staff.team === 'A' ? "bg-red-100 text-red-800" :
                                            staff.team === 'B' ? "bg-blue-100 text-blue-800" :
                                                "bg-green-100 text-green-800"
                                    )}>
                                        {staff.team}
                                    </span>
                                    {staff.isLeader && <Flag size={10} className="text-yellow-600" fill="currentColor" />}
                                </td>
                                {schedule[staff.id].map((cell, idx) => (
                                    <td key={cell.date} className="p-0 border w-[50px] h-14 bg-white">
                                        <DraggableCell
                                            staffId={staff.id}
                                            date={cell.date}
                                            cell={cell}
                                            isWarning={warnings[staff.id]?.[idx] || false}
                                            onToggleLeader={() => {
                                                onCellUpdate(staff.id, cell.date, { isLeaderMarked: !cell.isLeaderMarked });
                                            }}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <DragOverlay>
                {activeId ? (
                    <div className="w-12 h-12 bg-white opacity-80 border rounded shadow-xl flex items-center justify-center">
                        Dragging...
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
