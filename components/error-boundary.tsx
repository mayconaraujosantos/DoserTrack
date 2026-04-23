import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={56} color="#E74C3C" />
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.message}>{this.state.error.message}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })}>
          <Text style={styles.btnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16, backgroundColor: '#fff',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#2C3E50' },
  message: { fontSize: 14, color: '#7F8C8D', textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8, backgroundColor: '#4A90D9',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
