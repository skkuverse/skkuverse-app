/**
 * EVIDENCE: the time column fits a bold tabular "00:00" and the count column the English "Buses", each with a
 * few points spare; the crowding column fits a four-glyph t1 label and shrinks a longer one.
 */
export const TIMETABLE_COLUMNS = { time: 50, route: 56, count: 32, notesInset: 10, crowding: 44 } as const;

// WHY: off while the server has no crowding for any run, so every row would read "no data"; turn it on once it does.
export const SHOW_CROWDING = false;

// WHY: the route map draws its drop-offs with the same ring, so a drop-off looks alike in both sections.
export const STOP_DOT = { size: 7, border: 1.5 } as const;
