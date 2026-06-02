import { getDb } from '../config/database.js';

export function calculateSessionCost(startTime, endTime, pricing) {
  if (!pricing) {
    return { totalHours: 0, gameCost: 0, breakdown: [] };
  }

  // Parse times consistently using Cairo timezone
  // The startTime and endTime are stored as Cairo local time strings
  // We need to parse them as Cairo time, not UTC
  const start = parseCairoTime(startTime);
  const end = parseCairoTime(endTime || new Date());

  const dayStartTime = pricing.day_start_time || '08:00';
  const dayEndTime = pricing.day_end_time || '20:00';
  const weekendDays = pricing.weekend_days ? pricing.weekend_days.split(',').map(Number) : [5, 6]; // Sat, Sun

  let totalCost = 0;
  let totalHours = 0;
  const breakdown = [];

  // Calculate in 15-minute intervals for precision
  const intervalMs = 15 * 60 * 1000; // 15 minutes
  let currentTime = new Date(start);

  while (currentTime < end) {
    const intervalEnd = new Date(Math.min(currentTime.getTime() + intervalMs, end.getTime()));
    const hoursInInterval = (intervalEnd - currentTime) / (1000 * 60 * 60);

    // Use Cairo timezone for day of week and hour calculations
    const cairoTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const dayOfWeek = cairoTime.getDay();
    const hour = cairoTime.getHours();
    const minute = cairoTime.getMinutes();
    const timeValue = hour + minute / 60;

    const [dayStartHour, dayStartMin] = dayStartTime.split(':').map(Number);
    const [dayEndHour, dayEndMin] = dayEndTime.split(':').map(Number);
    const dayStartValue = dayStartHour + dayStartMin / 60;
    const dayEndValue = dayEndHour + dayEndMin / 60;

    const isDayTime = timeValue >= dayStartValue && timeValue < dayEndValue;
    const isWeekend = weekendDays.includes(dayOfWeek);

    // Get base rate
    let rate = isWeekend ? pricing.weekend_rate : pricing.weekday_rate;

    // Apply time multiplier
    const multiplier = isDayTime ? pricing.day_multiplier : pricing.night_multiplier;
    rate *= multiplier;

    const intervalCost = rate * hoursInInterval;
    totalCost += intervalCost;
    totalHours += hoursInInterval;

    currentTime = intervalEnd;
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    gameCost: Math.round(totalCost * 100) / 100,
    breakdown
  };
}

// Helper function to parse Cairo local time strings
function parseCairoTime(timeStr) {
  if (!timeStr) return new Date();
  
  // If it's already a Date object, return it
  if (timeStr instanceof Date) return timeStr;
  
  // Convert Cairo time string to Date object
  // Format could be "2026-03-17 10:30:00" or "3/17/2026, 10:30:00 AM"
  try {
    // Try parsing as Cairo time by creating a date and adjusting for timezone
    const date = new Date(timeStr);
    // If the date is invalid, try alternative parsing
    if (isNaN(date.getTime())) {
      // Handle locale string format like "3/17/2026, 10:30:00 AM"
      const parts = timeStr.split(', ');
      if (parts.length === 2) {
        const [datePart, timePart] = parts;
        const [month, day, year] = datePart.split('/').map(Number);
        const [time, modifier] = timePart.split(' ');
        let [hours, minutes, seconds] = time.split(':').map(Number);
        
        // Handle 12-hour format
        if (modifier === 'PM' && hours !== 12) {
          hours += 12;
        } else if (modifier === 'AM' && hours === 12) {
          hours = 0;
        }
        
        return new Date(year, month - 1, day, hours, minutes, seconds || 0);
      }
    }
    return date;
  } catch (e) {
    console.error('Error parsing time:', timeStr, e);
    return new Date();
  }
}

export function getCurrentRate(pricing) {
  if (!pricing) return 0;

  // Use Cairo timezone for consistent rate calculation
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeValue = hour + minute / 60;

  const dayStartTime = pricing.day_start_time || '08:00';
  const dayEndTime = pricing.day_end_time || '20:00';
  const weekendDays = pricing.weekend_days ? pricing.weekend_days.split(',').map(Number) : [5, 6];

  const [dayStartHour, dayStartMin] = dayStartTime.split(':').map(Number);
  const [dayEndHour, dayEndMin] = dayEndTime.split(':').map(Number);
  const dayStartValue = dayStartHour + dayStartMin / 60;
  const dayEndValue = dayEndHour + dayEndMin / 60;

  const isDayTime = timeValue >= dayStartValue && timeValue < dayEndValue;
  const isWeekend = weekendDays.includes(dayOfWeek);

  let rate = isWeekend ? pricing.weekend_rate : pricing.weekday_rate;
  const multiplier = isDayTime ? pricing.day_multiplier : pricing.night_multiplier;

  return Math.round(rate * multiplier * 100) / 100;
}
