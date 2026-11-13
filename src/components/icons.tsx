import React from "react";
import { theme } from "../theme";

export const Check: React.FC<{ size: number; color?: string; stroke?: number }> = ({
  size,
  color = theme.color.red,
  stroke = 3.4,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4.5 12.5l5 5 10-11" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Halter: React.FC<{ size: number; color?: string }> = ({ size, color = theme.color.red }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill={color}>
    <rect x="18" y="29" width="28" height="6" rx="2" />
    <rect x="11" y="18" width="8" height="28" rx="3" />
    <rect x="45" y="18" width="8" height="28" rx="3" />
    <rect x="4" y="24" width="6" height="16" rx="2.5" />
    <rect x="54" y="24" width="6" height="16" rx="2.5" />
  </svg>
);
