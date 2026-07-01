import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  label: string;
  value: string; // HH:MM
  onChange: (val: string) => void;
}

function toDate(val: string): Date {
  const [h, m] = val.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isNaN(h) ? 8 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function toStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimePickerInput({ label, value, onChange }: Props) {
  const C = useTheme();
  const [show, setShow] = useState(false);

  function handleChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(toStr(selected));
  }

  return (
    <View>
      <Text style={[styles.label, { color: C.sub }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => setShow(true)}
      >
        <Ionicons name="time-outline" size={18} color={C.sub} />
        <Text style={[styles.btnText, { color: C.text }]}>{value || '08:00'}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: 15, fontWeight: '500' },
});
