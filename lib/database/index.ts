export { getActiveProfileId, setActiveProfileId } from './connection';
export { initDatabase } from './schema';
export { getAllRows, getFirstRow, runQuery } from './raw-query';
export type { SqlParams } from './raw-query';
export {
  clearPrescriptionCache,
  getCachedPrescriptionByHash,
  setPrescriptionCache,
} from './prescription-cache';
export { createProfile, getProfileById, getProfiles, resolveProfile } from './profiles';
export {
  createMedicine,
  deleteMedicine,
  getMedicineById,
  getMedicines,
  updateMedicine,
  updateMedicineStock,
} from './medicines';
export {
  createSchedule,
  deactivateSchedule,
  getScheduleById,
  getSchedules,
  getSchedulesByMedicine,
  updateSchedule,
} from './schedules';
export {
  getAdherenceStreak,
  getDatesWithDosesInMonth,
  getDoseById,
  getDosesForDate,
  getDosesForDateRange,
  getPendingDosesWithoutNotification,
  getRecentHistory,
  getWeekAdherence,
  updateDoseNotificationId,
  updateDoseScheduleTime,
  updateDoseStatus,
} from './doses';
export type { DayAdherence } from './doses';
export {
  generateDosesForSchedule,
  realignIntervalSchedule,
  regenerateFutureDosesForSchedule,
} from './dose-generation';
export { getStockProjections } from './stock';
