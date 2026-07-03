import type { Dose, DoseStatus } from '@/types';
import { useEffect, useState } from 'react';

type PickerType = 'date' | 'time' | 'scheduleDate' | 'scheduleTime' | null;

interface DoseFormState {
  status: DoseStatus;
  takenDate: Date;
  scheduledDate: Date;
  skipReason: string;
}

function isoToDate(iso: string | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function useDoseForm(initialDose?: Dose | null) {
  const [form, setForm] = useState<DoseFormState>({
    status: 'pending',
    takenDate: new Date(),
    scheduledDate: new Date(),
    skipReason: '',
  });

  const [activePicker, setActivePicker] = useState<PickerType>(null);

  useEffect(() => {
    if (!initialDose) return;
    setForm({
      status: initialDose.status,
      takenDate: isoToDate(initialDose.takenTime),
      scheduledDate: isoToDate(initialDose.scheduledTime),
      skipReason: initialDose.skipReason ?? '',
    });
  }, [initialDose]);

  const setStatus = (status: DoseStatus) => setForm(prev => ({ ...prev, status }));
  const setTakenDate = (takenDate: Date) => setForm(prev => ({ ...prev, takenDate }));
  const setScheduledDate = (scheduledDate: Date) => setForm(prev => ({ ...prev, scheduledDate }));
  const setSkipReason = (skipReason: string) => setForm(prev => ({ ...prev, skipReason }));

  const openPicker = (type: PickerType) => {
    setActivePicker(prev => (prev === type ? null : type));
  };

  const closePicker = () => setActivePicker(null);

  return {
    ...form,
    setStatus,
    setTakenDate,
    setScheduledDate,
    setSkipReason,
    picker: {
      active: activePicker,
      open: openPicker,
      close: closePicker,
      isOpen: (type: PickerType) => activePicker === type,
    },
  };
}
