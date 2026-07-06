import { useTheme } from '@/hooks/use-theme';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

export type TextVariant = 'heading' | 'title' | 'body' | 'label' | 'caption' | 'sub';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

const STYLES: Record<TextVariant, { fontSize: number; fontWeight?: string; lineHeight: number }> = {
  heading: { fontSize: 26, fontWeight: '700', lineHeight: 34 },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  sub: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
};

export function Text({ variant = 'body', color, style, children, ...rest }: TextProps) {
  const C = useTheme();

  const defaultColor: Record<TextVariant, string> = {
    heading: C.text,
    title: C.text,
    body: C.text,
    label: C.sub,
    caption: C.sub,
    sub: C.sub,
  };

  return (
    <RNText
      maxFontSizeMultiplier={1.3}
      style={[STYLES[variant] as object, { color: color ?? defaultColor[variant] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
