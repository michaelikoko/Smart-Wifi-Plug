import type { WeeklyBarDatum } from '@/components/app-ui';
import type { EnergyConsumedResponse } from '../../../api/telemetry-api';

export const ANALYTICS_HISTORY_DAYS = 62;

export function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return isoDate(date);
}

export function monthKey(dateStr: string): string {
    return dateStr.slice(0, 7);
}

export function currentMonthKey(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKeyValue: string, delta: number): string {
    const [year, month] = monthKeyValue.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyBounds(monthKeyValue: string): { start: string; end: string } {
    const [year, month] = monthKeyValue.split('-').map(Number);
    const start = `${monthKeyValue}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const naturalEnd = `${monthKeyValue}-${String(lastDay).padStart(2, '0')}`;
    const end = monthKeyValue === currentMonthKey() ? isoDate(new Date()) : naturalEnd;
    return { start, end };
}

export function formatMonthLabel(monthKeyValue: string): string {
    return new Date(`${monthKeyValue}-02T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

export function sumRows(rows: EnergyConsumedResponse[]) {
    const kwh = rows.reduce((sum, row) => sum + row.kwh_consumed, 0);
    const hasCost = rows.some((row) => row.estimated_cost != null);
    const cost = hasCost ? rows.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0) : null;
    return { kwh, cost };
}

export function sumRange(rows: EnergyConsumedResponse[], startInclusive: string, endInclusive: string) {
    const inRange = rows.filter((row) => row.date >= startInclusive && row.date <= endInclusive);
    const kwh = inRange.reduce((sum, row) => sum + row.kwh_consumed, 0);
    const hasCost = inRange.some((row) => row.estimated_cost != null);
    const cost = hasCost ? inRange.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0) : null;
    return { kwh, cost };
}

export function sumMonth(rows: EnergyConsumedResponse[], monthsAgo: number) {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - monthsAgo);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const inMonth = rows.filter((row) => monthKey(row.date) === key);
    const kwh = inMonth.reduce((sum, row) => sum + row.kwh_consumed, 0);
    const hasCost = inMonth.some((row) => row.estimated_cost != null);
    const cost = hasCost ? inMonth.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0) : null;
    return { kwh, cost };
}

export function bucketMonthIntoWeeks(rows: EnergyConsumedResponse[], monthKeyValue: string): WeeklyBarDatum[] {
    if (rows.length === 0) return [];

    const { start, end } = monthKeyBounds(monthKeyValue);
    const monthStart = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const buckets: WeeklyBarDatum[] = [];
    let bucketStart = new Date(monthStart);
    let weekNumber = 1;

    while (bucketStart <= endDate) {
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
        const startStr = isoDate(bucketStart);
        const endStr = isoDate(bucketEnd) < end ? isoDate(bucketEnd) : end;
        const { kwh, cost } = sumRange(rows, startStr, endStr);

        buckets.push({
            day: `W${weekNumber}`,
            date: endStr,
            kwh,
            costKobo: cost,
            label: `W${weekNumber}`,
        });

        bucketStart.setUTCDate(bucketStart.getUTCDate() + 7);
        weekNumber += 1;
    }

    return buckets;
}

export function bucketMonthIntoDays(rows: EnergyConsumedResponse[], monthKeyValue: string): WeeklyBarDatum[] {
    if (rows.length === 0) return [];

    const { start, end } = monthKeyBounds(monthKeyValue);
    const rowsByDate = new Map(rows.map((row) => [row.date, row]));
    const days: WeeklyBarDatum[] = [];
    let cursor = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);

    while (cursor <= endDate) {
        const dateStr = isoDate(cursor);
        const row = rowsByDate.get(dateStr);
        days.push({
            day: cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
            date: dateStr,
            kwh: row?.kwh_consumed ?? 0,
            costKobo: row?.estimated_cost ?? null,
            label: String(cursor.getUTCDate()),
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
}
