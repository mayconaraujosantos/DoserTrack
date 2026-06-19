# Skill: Reports, Exports & PDFs

## Overview

Guide for generating reports, exporting data, and creating PDFs in Doser.

## When to Use This Skill

- Generating adherence reports
- Exporting dose history to PDF
- Creating prescription summaries
- Sharing data with healthcare providers
- Testing report generation

## Report Service

### PDF Generation

```typescript
// lib/report.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { Medicine, DoseHistory, Schedule } from '@/types';

interface ReportOptions {
  startDate: Date;
  endDate: Date;
  includeMedicines: boolean;
  includeSchedules: boolean;
  includeHistory: boolean;
  includeAdherence: boolean;
}

class ReportManager {
  async generateMedicationReport(
    profileId: string,
    options: Partial<ReportOptions> = {}
  ): Promise<string> {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        includeMedicines = true,
        includeSchedules = true,
        includeHistory = true,
        includeAdherence = true,
      } = options;

      // Fetch data
      const profile = await profileManager.getProfile(profileId);
      const medicines = includeMedicines
        ? await medicineManager.getMedicinesByProfile(profileId)
        : [];
      const schedules = includeSchedules
        ? await scheduleManager.getSchedulesByProfile(profileId)
        : [];
      const history = includeHistory
        ? await historyManager.getHistoryByPeriod(profileId, startDate, endDate)
        : [];

      // Calculate statistics
      const adherence = includeAdherence ? await historyManager.getAdherence(profileId, 30) : 0;

      // Generate HTML
      const html = this.generateHTML({
        profile,
        medicines,
        schedules,
        history,
        adherence,
        startDate,
        endDate,
      });

      return html;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  private generateHTML(data: any): string {
    const { profile, medicines, schedules, history, adherence, startDate, endDate } = data;

    const medicinesHTML = medicines
      .map(
        (m: Medicine) => `
        <div class="medicine">
          <h4>${m.name}</h4>
          <p><strong>Strength:</strong> ${m.strength} ${m.unit}</p>
          <p><strong>Form:</strong> ${m.form}</p>
          <p><strong>Frequency:</strong> ${m.frequency}</p>
          ${m.prescribedBy ? `<p><strong>Prescribed by:</strong> ${m.prescribedBy}</p>` : ''}
        </div>
      `
      )
      .join('');

    const historyHTML = history
      .slice(-30) // Last 30 entries
      .map(
        (h: DoseHistory) => `
        <tr>
          <td>${format(new Date(h.scheduledTime), 'MMM dd, yyyy')}</td>
          <td>${medicines.find((m: Medicine) => m.id === h.medicineId)?.name}</td>
          <td>${h.skipped ? 'Skipped' : 'Taken'}</td>
          <td>${h.notes || ''}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          .header {
            border-bottom: 2px solid #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section h2 {
            background-color: #f0f0f0;
            padding: 10px;
            border-left: 4px solid #333;
            margin-top: 0;
          }
          .medicine {
            background-color: #fafafa;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .medicine h4 {
            margin: 0 0 10px 0;
          }
          .medicine p {
            margin: 5px 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          table th {
            background-color: #333;
            color: white;
            padding: 10px;
            text-align: left;
          }
          table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          table tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
          }
          .stat {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Medication Report</h1>
          <p><strong>Profile:</strong> ${profile?.name || 'N/A'}</p>
          <p><strong>Generated:</strong> ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          <p><strong>Period:</strong> ${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}</p>
        </div>

        ${
          adherence > 0
            ? `
          <div class="section">
            <h2>Summary</h2>
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${adherence}%</div>
                <div class="stat-label">Adherence Rate</div>
              </div>
              <div class="stat">
                <div class="stat-value">${medicines.length}</div>
                <div class="stat-label">Active Medicines</div>
              </div>
            </div>
          </div>
        `
            : ''
        }

        ${
          medicines.length > 0
            ? `
          <div class="section">
            <h2>Current Medications</h2>
            ${medicinesHTML}
          </div>
        `
            : ''
        }

        ${
          history.length > 0
            ? `
          <div class="section">
            <h2>Dose History</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Medicine</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${historyHTML}
              </tbody>
            </table>
          </div>
        `
            : ''
        }

        <div class="section" style="margin-top: 40px; font-size: 12px; color: #999;">
          <p>This report was generated by Doser - Your Personal Medication Manager</p>
        </div>
      </body>
      </html>
    `;
  }

  async exportToPDF(
    profileId: string,
    options?: Partial<ReportOptions>
  ): Promise<{ uri: string; filename: string }> {
    try {
      const html = await this.generateMedicationReport(profileId, options);

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const filename = `Doser-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      return { uri, filename };
    } catch (error) {
      console.error('Failed to export PDF:', error);
      throw error;
    }
  }

  async sharePDF(profileId: string, options?: Partial<ReportOptions>): Promise<boolean> {
    try {
      const { uri, filename } = await this.exportToPDF(profileId, options);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        console.warn('Sharing not available on this device');
        return false;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Share Medication Report',
      });

      return true;
    } catch (error) {
      console.error('Failed to share PDF:', error);
      return false;
    }
  }
}

export const reportManager = new ReportManager();
```

### CSV Export

```typescript
// lib/export.ts
export async function exportToCSV(
  profileId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  try {
    const medicines = await medicineManager.getMedicinesByProfile(profileId);
    const history = await historyManager.getHistoryByPeriod(profileId, startDate, endDate);

    let csv = 'Date,Medicine,Status,Notes\n';

    history.forEach(h => {
      const medicine = medicines.find(m => m.id === h.medicineId);
      const date = format(new Date(h.scheduledTime), 'yyyy-MM-dd HH:mm');
      const status = h.skipped ? 'Skipped' : 'Taken';
      const notes = h.notes?.replace(/,/g, ';') || '';

      csv += `"${date}","${medicine?.name}","${status}","${notes}"\n`;
    });

    return csv;
  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw error;
  }
}

export async function shareCSV(
  profileId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  try {
    const csv = await exportToCSV(profileId, startDate, endDate);
    const filename = `Doser-History-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return false;

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
    });

    return true;
  } catch (error) {
    console.error('Failed to share CSV:', error);
    return false;
  }
}
```

## UI Components

### Export Dialog

```typescript
// components/ui/ExportDialog.tsx
import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { reportManager } from '@/lib/report';

interface ExportDialogProps {
  profileId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function ExportDialog({ profileId, onSuccess, onError }: ExportDialogProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const success = await reportManager.sharePDF(profileId, {
        startDate,
        endDate,
      });

      if (success) {
        onSuccess?.();
      } else {
        onError?.('Failed to share PDF');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
        Export Report
      </Text>

      <View style={{ marginBottom: 12 }}>
        <DatePickerInput label="Start Date" value={startDate} onChange={setStartDate} />
      </View>

      <View style={{ marginBottom: 16 }}>
        <DatePickerInput label="End Date" value={endDate} onChange={setEndDate} />
      </View>

      {exporting ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button title="Export to PDF" onPress={handleExportPDF} />
      )}
    </View>
  );
}
```

### Adherence Display

```typescript
// components/ui/AdherenceWidget.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface AdherenceWidgetProps {
  adherence: number;
}

export function AdherenceWidget({ adherence }: AdherenceWidgetProps) {
  const getColor = (value: number) => {
    if (value >= 90) return '#4CAF50'; // Green
    if (value >= 70) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: getColor(adherence),
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 40, fontWeight: 'bold', color: 'white' }}>
          {adherence}%
        </Text>
        <Text style={{ fontSize: 12, color: 'white' }}>
          Adherence
        </Text>
      </View>
    </View>
  );
}
```

## Analytics

### Adherence Calculations

```typescript
// lib/analytics.ts
export interface AdherenceStats {
  overall: number; // 0-100%
  byMedicine: Record<string, number>;
  byWeek: number[];
  trend: 'improving' | 'stable' | 'declining';
}

export async function calculateAdherenceStats(
  profileId: string,
  days: number = 90
): Promise<AdherenceStats> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const history = await historyManager.getHistoryByPeriod(profileId, startDate, endDate);

    const medicines = await medicineManager.getMedicinesByProfile(profileId);

    // Overall adherence
    const taken = history.filter(h => !h.skipped).length;
    const overall = history.length > 0 ? Math.round((taken / history.length) * 100) : 0;

    // By medicine
    const byMedicine: Record<string, number> = {};
    medicines.forEach(m => {
      const medicineHistory = history.filter(h => h.medicineId === m.id);
      const medicineTaken = medicineHistory.filter(h => !h.skipped).length;
      byMedicine[m.id] =
        medicineHistory.length > 0 ? Math.round((medicineTaken / medicineHistory.length) * 100) : 0;
    });

    // By week
    const byWeek: number[] = [];
    for (let i = 0; i < Math.ceil(days / 7); i++) {
      const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekHistory = history.filter(
        h => h.scheduledTime >= weekStart.getTime() && h.scheduledTime < weekEnd.getTime()
      );

      const weekTaken = weekHistory.filter(h => !h.skipped).length;
      byWeek.push(weekHistory.length > 0 ? Math.round((weekTaken / weekHistory.length) * 100) : 0);
    }

    // Trend
    const recentWeeks = byWeek.slice(-4);
    const avgRecent = recentWeeks.reduce((a, b) => a + b, 0) / recentWeeks.length;
    const avgPrevious =
      byWeek.slice(-8, -4).reduce((a, b) => a + b, 0) / Math.max(1, byWeek.slice(-8, -4).length);

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (avgRecent > avgPrevious + 5) trend = 'improving';
    if (avgRecent < avgPrevious - 5) trend = 'declining';

    return { overall, byMedicine, byWeek, trend };
  } catch (error) {
    console.error('Failed to calculate adherence stats:', error);
    return { overall: 0, byMedicine: {}, byWeek: [], trend: 'stable' };
  }
}
```

## Testing

```typescript
// __tests__/reports.test.ts
describe('Reports & Exports', () => {
  it('should generate PDF report', async () => {
    const { uri, filename } = await reportManager.exportToPDF(profileId);

    expect(uri).toBeDefined();
    expect(filename).toContain('Doser-Report');
    expect(filename).toContain('.pdf');
  });

  it('should calculate adherence correctly', async () => {
    // Create history with 70% adherence
    const medicines = await medicineManager.getMedicinesByProfile(profileId);
    const medicine = medicines[0];

    for (let i = 0; i < 10; i++) {
      await historyManager.recordDose(profileId, medicine.id, i < 7); // 7 taken, 3 skipped
    }

    const adherence = await historyManager.getAdherence(profileId, 1);
    expect(adherence).toBe(70);
  });

  it('should export valid CSV', async () => {
    const csv = await exportToCSV(profileId, new Date(2024, 0, 1), new Date(2024, 0, 31));

    expect(csv).toContain('Date,Medicine,Status,Notes');
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });
});
```

## Best Practices

1. **Use date ranges** - Always allow filtering by period
2. **Include summary stats** - Adherence, trends, etc.
3. **Format for printing** - Readable PDF layout
4. **Include disclaimers** - Not medical advice
5. **Add metadata** - Generated date, profile name
6. **Support export formats** - PDF, CSV, JSON
7. **Handle large datasets** - Pagination for history
8. **Share securely** - Don't embed sensitive data
9. **Test exports** - Verify PDF/CSV generation
10. **Archive reports** - Keep history of exports
