export interface Profile {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
}

export type MedicineType = 'capsule' | 'tablet' | 'drop' | 'ml' | 'injection' | 'other';

export interface Medicine {
  id: number;
  profileId: number;
  name: string;
  type: MedicineType;
  stockQuantity: number;
  stockUnit: string;
  photoUri?: string;
  lowStockThreshold: number;
  createdAt: string;
}

export type FrequencyType = 'interval_hours' | 'specific_days' | 'fixed_cycle';

export interface FrequencyConfig {
  type: FrequencyType;
  intervalHours?: number;
  specificDays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  daysOn?: number;
  daysOff?: number;
  times: string[]; // ["08:00", "20:00"]
}

export interface Schedule {
  id: number;
  profileId: number;
  medicineId: number;
  medicineName?: string;
  dosage: string;
  frequencyConfig: FrequencyConfig;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'snoozed';

export interface Dose {
  id: number;
  profileId: number;
  scheduleId: number;
  medicineId: number;
  medicineName?: string;
  medicineType?: MedicineType;
  medicinePhotoUri?: string;
  dosage?: string;
  scheduledTime: string; // ISO datetime
  takenTime?: string;
  status: DoseStatus;
  skipReason?: string;
  notificationId?: string;
}
