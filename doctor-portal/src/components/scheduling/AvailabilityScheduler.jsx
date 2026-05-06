import React, { useMemo } from 'react';
import { Clock3, Lock } from 'lucide-react';

const normalizeStatus = (status) => {
  if (!status) return 'pending';
  const next = String(status).toLowerCase();
  if (next === 'confirmed' || next === 'scheduled') return 'confirmed';
  if (next === 'cancelled' || next === 'canceled') return 'cancelled';
  return next;
};

const parseTimingsString = (value) => {
  if (!value) return { minTime: '10:00', maxTime: '18:00' };

  try {
    const cleanedValue = String(value)
      .replace(/\([^)]*\)/g, '')
      .trim();
    const separator = cleanedValue.includes(' to ')
      ? ' to '
      : cleanedValue.includes(' - ')
        ? ' - '
        : null;

    if (!separator) return { minTime: '10:00', maxTime: '18:00' };

    const [startPart, endPart] = cleanedValue.split(separator);
    const parse = (timeStr) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (!match) return '10:00';

      let [, hours, minutes, period] = match;
      let nextHours = parseInt(hours, 10);
      if (period.toLowerCase() === 'pm' && nextHours < 12) nextHours += 12;
      if (period.toLowerCase() === 'am' && nextHours === 12) nextHours = 0;
      return `${String(nextHours).padStart(2, '0')}:${minutes}`;
    };

    return { minTime: parse(startPart), maxTime: parse(endPart) };
  } catch (_error) {
    return { minTime: '10:00', maxTime: '18:00' };
  }
};

const AvailabilityScheduler = ({
  availabilityTimings,
  appointments = [],
  selectedDate,
  selectedTime,
  duration = 30,
  onDateChange,
  onTimeChange,
  onDurationChange,
  showDurationControl = false,
}) => {
  const availableDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const day = new Date();
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, []);

  const timeSlots = useMemo(() => {
    if (!availabilityTimings || !selectedDate) return [];

    const { minTime, maxTime } = parseTimingsString(availabilityTimings);
    const [startHour, startMinute] = minTime.split(':').map(Number);
    const [endHour, endMinute] = maxTime.split(':').map(Number);

    const slots = [];
    const baseDate = selectedDate;
    let cursor = new Date(`${baseDate}T00:00:00`);
    cursor.setHours(startHour, startMinute, 0, 0);
    const end = new Date(`${baseDate}T00:00:00`);
    end.setHours(endHour, endMinute, 0, 0);

    const requestedDuration = Number(duration) || 30;
    const bufferMinutes = 15;
    const stepMinutes = requestedDuration >= 60 ? requestedDuration : requestedDuration + bufferMinutes;
    const now = new Date();
    const latestStart = new Date(end.getTime() - requestedDuration * 60 * 1000);

    while (cursor <= latestStart) {
      const timeValue = cursor.toTimeString().slice(0, 5);
      const slotStart = new Date(cursor.getTime());
      const slotEnd = new Date(slotStart.getTime() + requestedDuration * 60 * 1000);
      const isToday = baseDate === new Date().toISOString().split('T')[0];
      const isPast = isToday && slotStart < new Date(now.getTime() + bufferMinutes * 60 * 1000);

      const isBooked = appointments.some((appointment) => {
        const status = normalizeStatus(appointment.status);
        if (status !== 'confirmed' && status !== 'scheduled') return false;

        const appointmentStart = new Date(appointment.startTime);
        const appointmentEnd = appointment.endTime
          ? new Date(appointment.endTime)
          : new Date(appointmentStart.getTime() + (appointment.duration || 30) * 60 * 1000);
        const blockedStart = new Date(appointmentStart.getTime() - bufferMinutes * 60 * 1000);
        const blockedEnd = new Date(appointmentEnd.getTime() + bufferMinutes * 60 * 1000);

        return slotStart < blockedEnd && slotEnd > blockedStart;
      });

      slots.push({
        time: timeValue,
        label: cursor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBooked,
        isPast,
      });

      cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
    }

    const availableSlots = slots.filter((slot) => !slot.isBooked && !slot.isPast);
    const recommendedTimes = new Set();

    if (availableSlots.length > 0) {
      const targetCount = Math.min(4, availableSlots.length);
      const usedIndexes = new Set();

      for (let index = 0; index < targetCount; index += 1) {
        const rawIndex = targetCount === 1
          ? 0
          : Math.round((index * (availableSlots.length - 1)) / (targetCount - 1));

        let candidateIndex = rawIndex;
        while (candidateIndex < availableSlots.length && usedIndexes.has(candidateIndex)) {
          candidateIndex += 1;
        }
        if (candidateIndex >= availableSlots.length) {
          candidateIndex = rawIndex;
          while (candidateIndex >= 0 && usedIndexes.has(candidateIndex)) {
            candidateIndex -= 1;
          }
        }

        if (candidateIndex >= 0 && candidateIndex < availableSlots.length) {
          usedIndexes.add(candidateIndex);
          recommendedTimes.add(availableSlots[candidateIndex].time);
        }
      }
    }

    return slots.map((slot) => ({
      ...slot,
      isRecommended: recommendedTimes.has(slot.time),
    }));
  }, [availabilityTimings, selectedDate, duration, appointments]);

  return (
    <div className="space-y-3 rounded-[1.4rem] border border-slate-100 bg-slate-50/70 p-3 md:p-3.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Doctor availability</div>
          <div className="mt-1 text-xs font-semibold text-slate-600">Pick a slot from the doctor&apos;s working hours. Booked times are locked.</div>
        </div>
        {availabilityTimings && (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-amber-700">
            <Clock3 size={11} />
            {availabilityTimings}
          </span>
        )}
      </div>

      {showDurationControl && (
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1">Duration</label>
          <select
            value={duration}
            onChange={(event) => onDurationChange?.(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-primary-300"
          >
            {[15, 30, 45, 60].map((value) => (
              <option key={value} value={value}>{value} mins</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1">Select Date</label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {availableDays.map((date, index) => {
            const dateKey = date.toISOString().split('T')[0];
            const isSelected = selectedDate === dateKey;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onDateChange?.(dateKey)}
                className={`flex-shrink-0 w-11 h-11 rounded-2xl border transition-all flex flex-col items-center justify-center gap-0.5 snap-start ${
                  isSelected
                    ? 'bg-primary-600 border-primary-600 text-white shadow-lg'
                    : 'bg-white border-slate-100 text-slate-500 hover:border-primary-200'
                }`}
              >
                <span className="text-[7px] font-black uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-[10px] font-black">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1">Select Available Time</label>
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 border border-slate-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Best
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 border border-slate-100">
              <span className="h-2 w-2 rounded-full bg-slate-300" /> Booked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-1.5">
          {timeSlots.map((slot, index) => (
            <button
              key={index}
              type="button"
              disabled={slot.isBooked}
              aria-disabled={slot.isBooked}
              title={slot.isBooked ? 'Booked slot' : `Select ${slot.label}`}
              onClick={() => onTimeChange?.(slot.time)}
              className={`relative py-1.5 rounded-xl text-[8px] font-black transition-all flex flex-col items-center gap-1 ${
                slot.isBooked
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed opacity-100'
                  : selectedTime === slot.time
                    ? 'bg-primary-600 text-white shadow-lg border-primary-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-primary-400'
              } ${slot.isRecommended && !slot.isBooked && selectedTime !== slot.time ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
            >
              {slot.isRecommended && !slot.isBooked && selectedTime !== slot.time && (
                <div className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[6px] px-1 py-0.5 rounded-full">BEST</div>
              )}
              <span>{slot.label}</span>
              {slot.isBooked ? (
                <span className="inline-flex items-center gap-1 text-[6px] font-black uppercase tracking-[0.16em] text-slate-400">
                  <Lock size={8} />
                  Booked
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityScheduler;