export type ScheduleTone = 'colored' | 'neutral';

export type TimetableLayout = 'v1' | 'sectioned';

export type OnStationPress = (stationId: string, source: 'schedule_boarding' | 'schedule_transfer') => void;

export type ScheduleSection = 'timetable' | 'boarding';
