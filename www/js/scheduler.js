/* ═══════════════════════════════════════════════════════════════════
   SCHEDULER — PlanPilot
   Greedy first-fit scheduling engine. Computes ephemeral calendar
   events from tasks — events are never stored, only returned.
   ═══════════════════════════════════════════════════════════════════ */

const Scheduler = (() => {
  'use strict';

  /* ── Helpers ── */

  /** Check if two time intervals overlap */
  function intervalsOverlap(a, b) {
    return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
  }

  /** Subtract a list of occupied intervals from a list of free intervals.
      Returns a new array of free intervals with occupied time removed. */
  function subtractIntervals(freeSlots, occupied) {
    let result = freeSlots.slice();
    for (const occ of occupied) {
      const occStart = occ.start.getTime();
      const occEnd = occ.end.getTime();
      const next = [];
      for (const slot of result) {
        const slotStart = slot.start.getTime();
        const slotEnd = slot.end.getTime();
        if (occEnd <= slotStart || occStart >= slotEnd) {
          // No overlap — keep slot as-is
          next.push(slot);
        } else {
          // Overlap — split around the occupied block
          if (slotStart < occStart) {
            next.push({ start: new Date(slotStart), end: new Date(occStart) });
          }
          if (slotEnd > occEnd) {
            next.push({ start: new Date(occEnd), end: new Date(slotEnd) });
          }
        }
      }
      result = next;
    }
    return result;
  }

  /** Build scheduling-hour intervals for a single day.
      Returns an array with one interval: { start: Date, end: Date } */
  function daySchedulingInterval(dayDate, schedulingHours) {
    const sh = schedulingHours || { startHour: 9, endHour: 17 };
    const start = new Date(dayDate);
    start.setHours(sh.startHour, 0, 0, 0);
    const end = new Date(dayDate);
    end.setHours(sh.endHour, 0, 0, 0);

    // For today: if current time is past startHour, trim start to now
    const now = new Date();
    const isToday = start.getFullYear() === now.getFullYear() &&
                    start.getMonth() === now.getMonth() &&
                    start.getDate() === now.getDate();

    if (isToday && now > start && now < end) {
      // Today, within scheduling hours but past startHour: trim start to now
      start.setTime(now.getTime());
      const mins = start.getMinutes();
      const rem = mins % 15;
      if (rem > 0) start.setMinutes(mins + (15 - rem), 0, 0);
      else start.setSeconds(0, 0);
    }

    // Guard: if end <= start (e.g., misconfigured), return empty
    if (end <= start) return [];
    return [{ start, end }];
  }

  /** Sort slots by energy preference. Returns a new sorted array (does not mutate). */
  function sortSlotsByEnergy(slots, energyLevel, peakStart, peakEnd) {
    if (energyLevel === 'any' || !energyLevel) return slots;

    return slots.slice().sort((a, b) => {
      const aHour = a.start.getHours();
      const bHour = b.start.getHours();
      const aInPeak = aHour >= peakStart && aHour < peakEnd;
      const bInPeak = bHour >= peakStart && bHour < peakEnd;

      if (energyLevel === 'high') {
        // Prefer peak hours
        if (aInPeak && !bInPeak) return -1;
        if (!aInPeak && bInPeak) return 1;
      } else if (energyLevel === 'low') {
        // Prefer non-peak hours
        if (!aInPeak && bInPeak) return -1;
        if (aInPeak && !bInPeak) return 1;
      }
      // Tie-break: chronological
      return a.start - b.start;
    });
  }

  /** Create an event object */
  function makeEvent(task, start, end, opts = {}) {
    const now = new Date();
    return {
      id: Utils.uid(),
      taskId: task.id,
      taskName: task.name,
      priority: task.priority,
      start: new Date(start),
      end: new Date(end),
      duration: Utils.diffMinutes(end, start),
      locked: !!opts.locked,
      visibility: opts.visibility || task.visibility || 'busy',
      isActive: start <= now && now < end,
      habitEvent: !!opts.habitEvent
    };
  }

  /* ── Main schedule function ── */

  /**
   * Schedule all tasks into ephemeral calendar events.
   * @param {Object[]} tasks - array of task objects
   * @param {Date} weekStart - first day of scheduling range
   * @param {number} numDays - number of days to schedule (default 7)
   * @returns {Object[]} array of event objects
   */
  function schedule(tasks, weekStart, numDays = 7) {
    if (!tasks || tasks.length === 0) return [];

    const settings = Store.getSettings();
    const peakStart = settings.peakStartHour ?? 9;
    const peakEnd = settings.peakEndHour ?? 12;
    const now = new Date();

    const rangeStart = Utils.startOfDay(weekStart);
    const rangeEnd = Utils.startOfDay(Utils.addDays(weekStart, numDays));

    // Build a lookup for dependency checking
    const taskById = {};
    for (const t of tasks) {
      taskById[t.id] = t;
    }

    // ── Step 1: Sort tasks ──
    const sorted = tasks.slice().sort(TaskModel.compareForScheduling);

    // ── Step 2 & 3: Filter out blocked and done tasks ──
    const schedulable = sorted.filter(t => {
      if (t.status === 'done') return false;
      if (t.dependsOn && t.dependsOn.length > 0) {
        const blocked = t.dependsOn.some(depId => {
          const dep = taskById[depId];
          return !dep || dep.status !== 'done';
        });
        if (blocked) return false;
      }
      return true;
    });

    // ── Step 4: Collect all locked events ──
    const allLockedEvents = [];
    const events = [];

    for (const task of tasks) {
      if (!task.lockedEvents) continue;
      for (const le of task.lockedEvents) {
        const start = new Date(le.start);
        const end = new Date(le.end);
        if (end <= rangeStart || start >= rangeEnd) continue;
        allLockedEvents.push({ start, end });
        events.push(makeEvent(task, start, end, { locked: true }));
      }
    }

    // ── Step 4b: Collect blocked events from ICS imports ──
    if (typeof ICSImport !== 'undefined' && ICSImport.getBlockedIntervals) {
      const blockedIntervals = ICSImport.getBlockedIntervals(rangeStart, rangeEnd);
      for (const bi of blockedIntervals) {
        allLockedEvents.push({ start: bi.start, end: bi.end });
      }
    }

    // Track all occupied intervals (locked + blocked + newly allocated)
    const occupied = allLockedEvents.slice();

    // ── Step 5: Handle pinned tasks ──
    // Tasks with pinnedTime are placed at their exact datetime, skip normal scheduling
    const pinnedTaskIds = new Set();
    for (const task of schedulable) {
      if (!task.pinnedTime) continue;
      // Parse pinnedTime reliably (format: "YYYY-MM-DDTHH:MM")
      const pinStart = Utils.parseDateInput(task.pinnedTime);
      if (!pinStart || isNaN(pinStart.getTime())) continue;
      // Only include if within scheduling range
      if (pinStart < rangeStart || pinStart >= rangeEnd) continue;
      const duration = task.remainingDuration || task.totalDuration || 30;
      const pinEnd = Utils.addMinutes(pinStart, duration);
      events.push(makeEvent(task, pinStart, pinEnd, { locked: true }));
      occupied.push({ start: pinStart, end: pinEnd });
      pinnedTaskIds.add(task.id);
    }

    // ── Separate habits from regular tasks ──
    const habits = schedulable.filter(t => t.isHabit && t.habitFrequency);
    const regularTasks = schedulable.filter(t => !(t.isHabit && t.habitFrequency));

    // ── Step 8: Schedule habits first (spread across week) ──
    for (const task of habits) {
      const freq = task.habitFrequency;
      const duration = task.totalDuration || 30;

      // Pick days spread evenly across the range
      const dayIndices = [];
      if (freq >= numDays) {
        // Every day
        for (let i = 0; i < numDays; i++) dayIndices.push(i);
      } else {
        // Spread evenly
        const spacing = numDays / freq;
        for (let i = 0; i < freq; i++) {
          dayIndices.push(Math.round(i * spacing));
        }
      }

      for (const dayIdx of dayIndices) {
        const day = Utils.startOfDay(Utils.addDays(weekStart, dayIdx));

        // Build free slots for this day
        const dayIntervals = daySchedulingInterval(day, task.schedulingHours);
        let freeSlots = subtractIntervals(dayIntervals, occupied);
        freeSlots = sortSlotsByEnergy(freeSlots, task.energyLevel, peakStart, peakEnd);

        // Try to fit one session of `duration` minutes
        for (const slot of freeSlots) {
          const slotMinutes = Utils.diffMinutes(slot.end, slot.start);
          if (slotMinutes >= duration) {
            const evStart = new Date(slot.start);
            const evEnd = Utils.addMinutes(evStart, duration);
            events.push(makeEvent(task, evStart, evEnd, { habitEvent: true }));
            occupied.push({ start: evStart, end: evEnd });
            break;
          }
        }
      }
    }

    // ── Step 6: Allocate regular tasks ──
    for (const task of regularTasks) {
      // Skip pinned tasks — already handled above
      if (pinnedTaskIds.has(task.id)) continue;

      // Subtract locked event duration from remaining (avoid double-scheduling)
      let lockedMinutes = 0;
      if (task.lockedEvents && task.lockedEvents.length > 0) {
        for (const le of task.lockedEvents) {
          const ls = new Date(le.start);
          const le2 = new Date(le.end);
          lockedMinutes += Utils.diffMinutes(le2, ls);
        }
      }
      let remaining = task.remainingDuration - lockedMinutes;
      if (remaining <= 0) continue;

      // In Simple mode, ignore startDate — always schedule from now
      const isSimpleMode = settings.uiMode === 'simple';
      const taskStartDate = (!isSimpleMode && task.startDate)
        ? Utils.startOfDay(Utils.parseDateInput(task.startDate))
        : null;
      const taskDueDate = task.dueDate ? Utils.endOfDay(Utils.parseDateInput(task.dueDate)) : null;

      // Build free slots across all days for this task
      let taskFreeSlots = [];
      for (let d = 0; d < numDays; d++) {
        const day = Utils.startOfDay(Utils.addDays(weekStart, d));
        const dayEnd = Utils.endOfDay(day);

        // Respect startDate (Advanced mode only)
        if (taskStartDate && day < Utils.startOfDay(taskStartDate)) continue;
        // Respect dueDate
        if (taskDueDate && day > Utils.startOfDay(taskDueDate)) continue;

        const dayIntervals = daySchedulingInterval(day, task.schedulingHours);
        const free = subtractIntervals(dayIntervals, occupied);
        // Filter out past time — only keep slots that are at least partially in the future
        const now = new Date();
        for (const slot of free) {
          if (slot.end.getTime() <= now.getTime()) continue; // entirely past
          if (slot.start.getTime() < now.getTime()) {
            slot.start = new Date(now); // trim start to now
          }
          taskFreeSlots.push(slot);
        }
      }

      // ── Step 7: Energy matching — sort slots ──
      taskFreeSlots = sortSlotsByEnergy(taskFreeSlots, task.energyLevel, peakStart, peakEnd);

      // Allocate
      if (!task.splitUp) {
        // Non-split: find one slot that fits the entire remaining duration
        for (const slot of taskFreeSlots) {
          const slotMinutes = Utils.diffMinutes(slot.end, slot.start);
          if (slotMinutes >= remaining) {
            const evStart = new Date(slot.start);
            const evEnd = Utils.addMinutes(evStart, remaining);
            events.push(makeEvent(task, evStart, evEnd));
            occupied.push({ start: evStart, end: evEnd });
            remaining = 0;
            break;
          }
        }
        // If couldn't fit in one slot, fall back to splitting
        if (remaining > 0) {
          for (const slot of taskFreeSlots) {
            if (remaining <= 0) break;
            const slotMinutes = Utils.diffMinutes(slot.end, slot.start);
            if (slotMinutes < (task.minSessionDuration || 15)) continue;

            const sessionLen = Math.min(
              remaining,
              slotMinutes,
              task.maxSessionDuration || 120
            );
            if (sessionLen < (task.minSessionDuration || 15)) continue;

            const evStart = new Date(slot.start);
            const evEnd = Utils.addMinutes(evStart, sessionLen);
            events.push(makeEvent(task, evStart, evEnd));
            occupied.push({ start: evStart, end: evEnd });
            remaining -= sessionLen;
          }
        }
      } else {
        // Split: create multiple sessions
        const minSession = task.minSessionDuration || 15;
        const maxSession = task.maxSessionDuration || 120;

        for (const slot of taskFreeSlots) {
          if (remaining <= 0) break;
          const slotMinutes = Utils.diffMinutes(slot.end, slot.start);
          if (slotMinutes < minSession) continue;

          // Could fit multiple sessions in a large slot; consume one at a time
          let cursor = new Date(slot.start);
          while (remaining > 0 && Utils.diffMinutes(slot.end, cursor) >= minSession) {
            const available = Utils.diffMinutes(slot.end, cursor);
            let sessionLen = Math.min(remaining, maxSession, available);
            if (sessionLen < minSession) break;

            const evStart = new Date(cursor);
            const evEnd = Utils.addMinutes(evStart, sessionLen);
            events.push(makeEvent(task, evStart, evEnd));
            occupied.push({ start: evStart, end: evEnd });
            remaining -= sessionLen;
            cursor = new Date(evEnd);
          }
        }
      }
    }

    // ── Step 9: Free/Busy determination (post-pass) ──
    // For each task, count how many total slots were available vs how many were used.
    // If there's slack (more available time than needed), mark events as 'free'.
    const taskEventMap = {};
    for (const ev of events) {
      if (ev.locked) continue;
      if (!taskEventMap[ev.taskId]) taskEventMap[ev.taskId] = [];
      taskEventMap[ev.taskId].push(ev);
    }

    for (const task of schedulable) {
      const taskEvents = taskEventMap[task.id];
      if (!taskEvents || taskEvents.length === 0) continue;

      const requiredMinutes = task.isHabit
        ? taskEvents.reduce((sum, ev) => sum + ev.duration, 0)
        : task.remainingDuration;
      if (requiredMinutes <= 0) continue;

      const taskDueDate = task.dueDate ? Utils.endOfDay(Utils.parseDateInput(task.dueDate)) : rangeEnd;

      // Count total available minutes for this task across the range
      let totalAvailable = 0;
      for (let d = 0; d < numDays; d++) {
        const day = Utils.startOfDay(Utils.addDays(weekStart, d));
        if (day > taskDueDate) break;
        const taskStartDate2 = task.startDate
          ? Utils.startOfDay(Utils.parseDateInput(task.startDate))
          : null;
        if (taskStartDate2 && day < Utils.startOfDay(taskStartDate2)) continue;

        const dayIntervals = daySchedulingInterval(day, task.schedulingHours);
        // Subtract only OTHER tasks' occupied time (not this task's own events)
        const othersOccupied = occupied.filter(o => {
          // Keep occupied blocks that don't belong to this task's events
          return !taskEvents.some(te => te.start.getTime() === o.start.getTime() && te.end.getTime() === o.end.getTime());
        });
        const free = subtractIntervals(dayIntervals, othersOccupied);
        for (const slot of free) {
          totalAvailable += Utils.diffMinutes(slot.end, slot.start);
        }
      }

      // If significantly more time available than needed → 'free'; otherwise 'busy'
      const visibility = totalAvailable > requiredMinutes * 1.5 ? 'free' : 'busy';
      for (const ev of taskEvents) {
        ev.visibility = visibility;
      }
    }

    // ── Step 10: Done-scheduling detection ──
    // Annotate events whose tasks are fully scheduled and all events are in the past
    for (const task of schedulable) {
      if (task.isHabit) continue;
      if (task.remainingDuration > 0) continue;

      const taskEvents = taskEventMap[task.id];
      if (!taskEvents || taskEvents.length === 0) continue;

      const allInPast = taskEvents.every(ev => ev.end <= now);
      if (allInPast) {
        for (const ev of taskEvents) {
          ev.doneScheduling = true;
        }
      }
    }

    // ── Final: update isActive for all events ──
    for (const ev of events) {
      ev.isActive = ev.start <= now && now < ev.end;
    }

    // Sort events chronologically for the consumer
    events.sort((a, b) => a.start - b.start);

    return events;
  }

  return { schedule };
})();
