import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#5D54FF',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    bg: '#F2F8FF',
    card: '#FFFFFF',
    text: '#000000',
    sub: '#888888',
    border: '#E8EBED',
    navDark: '#1E1B4B',
    navAction: '#0D0B2E',
    // react-navigation compatibility
    background: '#F2F8FF',
    tint: '#5D54FF',
    icon: '#888888',
    tabIconDefault: '#888888',
    tabIconSelected: '#5D54FF',
    notification: '#E74C3C',
  },
  dark: {
    primary: '#7B74FF',
    success: '#2ECC71',
    warning: '#F39C12',
    danger: '#E05252',
    bg: '#0F1117',
    card: '#1C2333',
    text: '#E2E8F0',
    sub: '#8899A6',
    border: '#253047',
    navDark: '#0E0C2B',
    navAction: '#05040F',
    // react-navigation compatibility
    background: '#0F1117',
    tint: '#7B74FF',
    icon: '#8899A6',
    tabIconDefault: '#8899A6',
    tabIconSelected: '#7B74FF',
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
