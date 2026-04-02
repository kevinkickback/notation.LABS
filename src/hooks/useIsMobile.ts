import { useState, useEffect } from 'react';

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(
		() => window.matchMedia('(max-width: 768px)').matches,
	);
	useEffect(() => {
		const mq = window.matchMedia('(max-width: 768px)');
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, []);
	return isMobile;
}
