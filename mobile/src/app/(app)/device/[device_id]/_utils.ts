export function dayLabel(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
    });
}

export function addUtcDays(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function rssiLabel(rssi: number): { label: string; color: string } {
    if (rssi >= -50) return { label: 'Excellent', color: '#10b981' };
    if (rssi >= -60) return { label: 'Good', color: '#3b82f6' };
    if (rssi >= -70) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Weak', color: '#ef4444' };
}