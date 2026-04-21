import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#4A90D9',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    bg: '#F0F4F8',
    card: '#FFFFFF',
    text: '#2C3E50',
    sub: '#7F8C8D',
    border: '#E8EBED',
    // react-navigation compatibility
    background: '#F0F4F8',
    tint: '#4A90D9',
    icon: '#7F8C8D',
    tabIconDefault: '#7F8C8D',
    tabIconSelected: '#4A90D9',
    notification: '#E74C3C',
  },
  dark: {
    primary: '#5B9FE6',
    success: '#2ECC71',
    warning: '#F39C12',
    danger: '#E05252',
    bg: '#0F1117',
    card: '#1C2333',
    text: '#E2E8F0',
    sub: '#8899A6',
    border: '#253047',
    // react-navigation compatibility
    background: '#0F1117',
    tint: '#5B9FE6',
    icon: '#8899A6',
    tabIconDefault: '#8899A6',
    tabIconSelected: '#5B9FE6',
    notification: '#E05252',
  },
};

export type ThemeColors = typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
