import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import { useColorScheme } from 'react-native';

const GRID_SIZE = 22; // px — fine grid cell size

export function AuthBackground({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const  colorScheme  = useColorScheme();
  //console.log('Color scheme:', colorScheme); 
  const isDark = colorScheme === 'dark';

  // ── Token-derived colors ────────────────────────────────────────────────
  // Light: --foreground 10 10 10 · --primary 23 23 23
  // Dark:  --foreground 250 250 250 · --primary 255 245 245
  const gridLine = isDark ? 'rgba(250,250,250,0.05)' : 'rgba(10,10,10,0.045)';
  const glow = isDark ? 'rgba(255,245,245,0.045)' : 'rgba(23,23,23,0.04)';
  const glowSoft = isDark ? 'rgba(255,245,245,0.03)' : 'rgba(23,23,23,0.028)';

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          <Defs>
            <Pattern
              id="auth-grid"
              width={GRID_SIZE}
              height={GRID_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <Path
                d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                fill="none"
                stroke={gridLine}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#auth-grid)" />
        </Svg>

        <View
          style={{
            position: 'absolute',
            top: -90,
            left: -70,
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: glow,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: height * 0.32,
            right: -110,
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: glowSoft,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -120,
            left: width * 0.15,
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: glow,
          }}
        />
      </View>

      {children}
    </View>
  );
}