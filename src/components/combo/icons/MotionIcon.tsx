interface MotionIconProps {
	motion: string;
	size?: number;
	color?: string;
	className?: string;
}

interface MotionSVGData {
	children: React.ReactNode;
	viewBox: string;
	alt: string;
	repeat?: number;
}

const MIRROR = 'matrix(-1 0 0 1 383.825 -327.476)';
const MIRROR_CX = -291.825;
const MIRROR_CY = -419.499;

function MirroredCircle() {
	return (
		<circle
			cx={MIRROR_CX}
			cy={MIRROR_CY}
			r={50}
			transform="rotate(180)"
			fill="red"
		/>
	);
}

export const motionSVGMap: Record<string, MotionSVGData> = {
	'236': {
		viewBox: '0 0 184 184',
		children: (
			<>
				<path
					d="M157 92.044V92h-13l20.035-25L184 92h-12v.045c0 31.797-18.593 59.301-40.002 69.281-13.897 8.023-28.7 11.342-42.992 10.774H84.5v-32.915h15v17.501c30.86-3.69 57.5-29.552 57.5-64.642"
					fill="#fff"
				/>
				<circle cx={92} cy={92} r={50} fill="red" />
			</>
		),
		alt: 'QCF',
	},
	'214': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<path
					d="M356.825 419.567v-.044h-13l20.035-25 19.965 25h-12v.045a80 80 0 01-40.002 69.281c-13.897 8.023-28.7 11.342-42.992 10.774h-4.506v-32.915h15v17.501c30.86-3.691 57.499-29.552 57.5-64.642z"
					fill="white"
				/>
				<MirroredCircle />
			</g>
		),
		alt: 'QCB',
	},
	'623': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M254.803 426.976l47.568 54.716h-59.89v12.5l-25-20 25-20v12.5h26.974l-47.568-54.716h69.961v15h-37.045z"
					fill="white"
				/>
			</g>
		),
		alt: 'DP',
	},
	'421': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M328.902 426.975l-47.568 54.716h59.89v12.5l25-20-25-20v12.5H314.25l47.568-54.716h-69.96v15h37.044z"
					fill="white"
				/>
			</g>
		),
		alt: 'RDP',
	},
	'412364': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<path
					d="M338.967 426.975v-15l32.915.001v4.506a78.189 78.189 0 01-2.709 23.748c-12.891 48.946-70.305 75.688-117.347 48.53a80.002 80.002 0 01-40.002-69.282v-.002h.001v-.044h-12l19.965-25 20.035 25h-13v.044c.001 35.09 26.64 60.951 57.5 64.642l.002.003c2.462.294 4.951.447 7.455.453v-.099h.044c5.981 0 11.694-.774 17.075-2.211 5.22-1.446 10.395-3.592 15.425-6.496a64.944 64.944 0 0025.079-26.132 64.964 64.964 0 006.986-22.661z"
					fill="white"
				/>
				<MirroredCircle />
			</g>
		),
		alt: 'HCFB',
	},
	'41236': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<path
					d="M338.967 426.975v-15l32.915.001v4.506a78.189 78.189 0 01-2.709 23.748c-12.891 48.946-70.305 75.688-117.347 48.53a80.002 80.002 0 01-40.002-69.282v-.002h.001v-.044h-12l19.965-25 20.035 25h-13v.044c.001 35.09 26.64 60.951 57.5 64.642l.002.003c2.462.294 4.951.447 7.455.453v-.099h.044c5.981 0 11.694-.774 17.075-2.211 5.22-1.446 10.395-3.592 15.425-6.496a64.944 64.944 0 0025.079-26.132 64.964 64.964 0 006.986-22.661z"
					fill="white"
				/>
				<MirroredCircle />
			</g>
		),
		alt: 'HCF',
	},
	'632146': {
		viewBox: '0 0 184 184.046',
		children: (
			<g transform={MIRROR}>
				<path
					d="M244.682 427.03v-15l-32.915.002v4.506a78.189 78.189 0 0 0 2.71 23.748c12.89 48.946 70.304 75.688 117.346 48.53a80.002 80.002 0 0 0 40.002-69.282v-.046h12l-19.966-25-20.035 25h13v.044c0 35.09-26.64 60.95-57.5 64.642l-.002.003a64.168 64.168 0 0 1-7.455.453v-.1h-.044c-5.98 0-11.694-.773-17.075-2.21-5.22-1.446-10.395-3.592-15.425-6.496a64.944 64.944 0 0 1-25.079-26.132 64.964 64.964 0 0 1-6.986-22.661z"
					fill="white"
				/>
				<circle
					cx={MIRROR_CX}
					cy={MIRROR_CY}
					r={50}
					transform="rotate(180)"
					fill="red"
					pointerEvents="none"
				/>
			</g>
		),
		alt: 'HCBF',
	},
	'63214': {
		viewBox: '0 0 184 184.046',
		children: (
			<g transform={MIRROR}>
				<path
					d="M244.682 427.03v-15l-32.915.002v4.506a78.189 78.189 0 0 0 2.71 23.748c12.89 48.946 70.304 75.688 117.346 48.53a80.002 80.002 0 0 0 40.002-69.282v-.046h12l-19.966-25-20.035 25h13v.044c0 35.09-26.64 60.95-57.5 64.642l-.002.003a64.168 64.168 0 0 1-7.455.453v-.1h-.044c-5.98 0-11.694-.773-17.075-2.21-5.22-1.446-10.395-3.592-15.425-6.496a64.944 64.944 0 0 1-25.079-26.132 64.964 64.964 0 0 1-6.986-22.661z"
					fill="white"
				/>
				<circle
					cx={MIRROR_CX}
					cy={MIRROR_CY}
					r={50}
					transform="rotate(180)"
					fill="red"
					pointerEvents="none"
				/>
			</g>
		),
		alt: 'HCB',
	},
	'236236': {
		viewBox: '0 0 184 184',
		children: (
			<>
				<path
					d="M157 92.044V92h-13l20.035-25L184 92h-12v.045c0 31.797-18.593 59.301-40.002 69.281-13.897 8.023-28.7 11.342-42.992 10.774H84.5v-32.915h15v17.501c30.86-3.69 57.5-29.552 57.5-64.642"
					fill="white"
				/>
				<circle cx={92} cy={92} r={50} fill="red" />
			</>
		),
		alt: 'QCF',
		repeat: 2,
	},
	'214214': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<path
					d="M356.825 419.567v-.044h-13l20.035-25 19.965 25h-12v.045a80 80 0 01-40.002 69.281c-13.897 8.023-28.7 11.342-42.992 10.774h-4.506v-32.915h15v17.501c30.86-3.691 57.499-29.552 57.5-64.642z"
					fill="white"
				/>
				<MirroredCircle />
			</g>
		),
		alt: 'QCB',
		repeat: 2,
	},
	'22': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M284.324 419.453v67.023h-12.5l20 25 20-25h-12.5v-67.023h-15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Down',
		repeat: 2,
	},
	'44': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M291.801 426.976h67.023v12.5l25-20-25-20v12.5h-67.023v15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Back',
		repeat: 2,
	},
	'66': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M291.848 411.976h-67.023v-12.5l-25 20 25 20v-12.5h67.023v-15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Forward',
		repeat: 2,
	},
	'88': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M299.324 419.5v-67.024h12.5l-20-25-20 25h12.5V419.5h15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Up',
		repeat: 2,
	},
	'1': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M286.505 424.763l47.392 47.393-8.839 8.838 31.82 3.536-3.535-31.82-8.84 8.839-47.392-47.393-10.606 10.607z"
					fill="white"
				/>
			</g>
		),
		alt: 'DownBack',
	},
	'2': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M284.324 419.453v67.023h-12.5l20 25 20-25h-12.5v-67.023h-15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Down',
	},
	'3': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M286.538 414.156l-47.393 47.393-8.838-8.84-3.536 31.82 31.82-3.535-8.839-8.839 47.392-47.392-10.606-10.607z"
					fill="white"
				/>
			</g>
		),
		alt: 'DownForward',
	},
	'4': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M291.801 426.976h67.023v12.5l25-20-25-20v12.5h-67.023v15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Back',
	},
	'6': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M291.848 411.976h-67.023v-12.5l-25 20 25 20v-12.5h67.023v-15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Forward',
	},
	'7': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M297.111 424.796l47.392-47.393 8.84 8.84 3.535-31.82-31.82 3.535 8.839 8.839-47.393 47.393 10.607 10.607z"
					fill="white"
				/>
			</g>
		),
		alt: 'UpBack',
	},
	'8': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M299.324 419.5v-67.024h12.5l-20-25-20 25h12.5V419.5h15z"
					fill="white"
				/>
			</g>
		),
		alt: 'Up',
	},
	'9': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<path
					d="M297.144 414.19l-47.393-47.393 8.84-8.839-31.82-3.535 3.535 31.82 8.839-8.84 47.392 47.393 10.607-10.607z"
					fill="white"
				/>
			</g>
		),
		alt: 'UpForward',
	},
	'360': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<circle
					cx={MIRROR_CX}
					cy={MIRROR_CY}
					r={35}
					transform="rotate(180)"
					fill="none"
					stroke="white"
					strokeWidth={8}
				/>
				<path
					d="M299.324 352.5v-15h12.5l-20-25-20 25h12.5v15h15z"
					fill="white"
				/>
			</g>
		),
		alt: '360',
	},
	'720': {
		viewBox: '0 0 184 184',
		children: (
			<g transform={MIRROR}>
				<MirroredCircle />
				<circle
					cx={MIRROR_CX}
					cy={MIRROR_CY}
					r={35}
					transform="rotate(180)"
					fill="none"
					stroke="white"
					strokeWidth={8}
				/>
				<circle
					cx={MIRROR_CX}
					cy={MIRROR_CY}
					r={22}
					transform="rotate(180)"
					fill="none"
					stroke="white"
					strokeWidth={6}
					opacity={0.7}
				/>
				<path
					d="M299.324 352.5v-15h12.5l-20-25-20 25h12.5v15h15z"
					fill="white"
				/>
			</g>
		),
		alt: '720',
	},
};

/**
 * Pre-computed tight viewBoxes for each motion SVG key.
 * Generated via getBBox() measurement — trims dead transparent space
 * while preserving all visible content (circle + arrow).
 * Format: "minX minY width height"
 */
export const croppedViewBoxMap: Record<string, string> = {
	'1': '22 38 124 124',
	'2': '38 38 108 150',
	'3': '38 38 124 124',
	'4': '0 38 146 109',
	'6': '38 38 151 109',
	'7': '22 22 124 125',
	'8': '38 0 108 147',
	'9': '38 22 124 125',
	'22': '38 38 108 150',
	'44': '0 38 146 109',
	'66': '38 38 151 109',
	'88': '38 0 108 147',
	'214': '0 38 146 139',
	'236': '38 38 150 139',
	'360': '38 0 108 147',
	'421': '13 38 133 133',
	'623': '38 38 133 133',
	'720': '38 0 108 147',
	'41236': '7 38 181 139',
	'63214': '0 38 177 139',
	'214214': '0 38 146 139',
	'236236': '38 38 150 139',
	'412364': '7 38 181 139',
	'632146': '0 38 177 139',
};

export function MotionIcon({
	motion,
	size = 48,
	color = 'currentColor',
	className = '',
}: MotionIconProps) {
	const motionData = motionSVGMap[motion];

	if (motionData) {
		const originalViewBox = motionData.viewBox;
		const viewBox = croppedViewBoxMap[motion] || originalViewBox;
		const motionLabel =
			motionData.alt.trim() || `Motion ${motion.trim() || 'unknown'}`;

		// Scale pixel dimensions to match the cropped viewBox so content stays the
		// same visual size as it was with the full 184×184 viewBox.
		const [, , origW, origH] = originalViewBox.split(' ').map(Number);
		const [, , cropW, cropH] = viewBox.split(' ').map(Number);
		const pxPerUnit = size / Math.max(origW, origH);
		const renderW = Math.round(cropW * pxPerUnit);
		const renderH = Math.round(cropH * pxPerUnit);
		const repeatCount = motionData.repeat || 1;
		const repeatNumbers = Array.from({ length: repeatCount }, (_, n) => n + 1);

		return (
			<div className={`inline-flex items-center gap-0.5 ${className}`}>
				{repeatNumbers.map((repeatNumber) => (
					<svg
						key={`${motion}-${repeatNumber}`}
						width={renderW}
						height={renderH}
						viewBox={viewBox}
						aria-label={motionLabel}
						className="inline-block"
					>
						<title>{motionLabel}</title>
						{motionData.children}
					</svg>
				))}
			</div>
		);
	}

	const fallbackLabel = `Motion ${motion.trim() || 'unknown'}`;

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			stroke={color}
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-label={fallbackLabel}
		>
			<title>{fallbackLabel}</title>
			<circle
				cx="24"
				cy="24"
				r="18"
				opacity="0.15"
				fill={color}
				stroke="none"
			/>
			<text
				x="24"
				y="24"
				textAnchor="middle"
				dominantBaseline="middle"
				fontSize="16"
				fontWeight="600"
				fill={color}
				stroke="none"
			>
				{motion}
			</text>
		</svg>
	);
}
