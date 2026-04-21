import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
}

function toDate(val: string): Date {
  const d = new Date(val + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DatePickerInput({ label, value, onChange, placeholder }: Props) {
  const C = useTheme();
  const [show, setShow] = useState(false);

  function handleChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(toStr(selected));
  }

  const display = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR')
    : placeholder ?? 'Selecionar data';

  return (
    <View>
      <Text style={[styles.label, { color: C.sub }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => setShow(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={C.sub} />
        <Text style={[styles.btnText, { color: value ? C.text : C.sub }]}>{display}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          locale="pt-BR"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingHorizontal: 14, height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: 15 },
});
