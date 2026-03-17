import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function oklchToHex(oklchString: string): string {
	const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
	if (!match) return '#3b82f6';
	const l = parseFloat(match[1]);
	const c = parseFloat(match[2]);
	const h = parseFloat(match[3]);
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);
	let x = 0.96422 * l + 0.39529 * a + 0.19852 * b;
	let y = 1.0 * l;
	let z = 1.0885 * l - 0.10527 * b;
	x = x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x;
	y = y > 0.0031308 ? 1.055 * y ** (1 / 2.4) - 0.055 : 12.92 * y;
	z = z > 0.0031308 ? 1.055 * z ** (1 / 2.4) - 0.055 : 12.92 * z;
	const r = Math.round(
		Math.max(0, Math.min(255, x * 3.2406 + y * -1.5372 + z * -0.4986)),
	);
	const g = Math.round(
		Math.max(0, Math.min(255, x * -0.9689 + y * 1.8758 + z * 0.0415)),
	);
	const bVal = Math.round(
		Math.max(0, Math.min(255, x * 0.0557 + y * -0.204 + z * 1.057)),
	);
	return `#${[r, g, bVal].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToOklch(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
	let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	let z = r * 0.0193 + g * 0.1192 + b * 0.9505;
	x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
	y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
	z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
	const l = Math.max(0, 116 * y - 16) / 100;
	const a = (500 * (x - y)) / 100;
	const bVal = (200 * (y - z)) / 100;
	const c = Math.sqrt(a * a + bVal * bVal);
	let h = (Math.atan2(bVal, a) * 180) / Math.PI;
	if (h < 0) h += 360;
	return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`;
}

/** Accepts either a #rrggbb hex string or an oklch(...) string and returns #rrggbb */
export function colorToHex(color: string): string {
	if (!color) return '#3b82f6';
	if (color.startsWith('#')) return color;
	return oklchToHex(color);
}
