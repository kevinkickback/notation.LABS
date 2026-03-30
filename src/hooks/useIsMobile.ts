import { useState, useEffect } from 'react';

/**
 * Returns true if the current device is a mobile device (based on user agent).
 */
export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const check = () =>
			/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				typeof window !== 'undefined' ? window.navigator.userAgent : '',
			);
		setIsMobile(check());
	}, []);
	return isMobile;
}
