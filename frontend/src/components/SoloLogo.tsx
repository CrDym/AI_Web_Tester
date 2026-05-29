interface SoloLogoMarkProps {
  className?: string;
}

interface SoloLogoProps {
  className?: string;
  subtitle?: string;
  orientation?: 'horizontal' | 'stacked';
  titleClassName?: string;
  subtitleClassName?: string;
}

const appIconSrc = '/brand/solo-app-icon.png';
const lockupSrc = '/brand/solo-lockup.png';

export function SoloLogoMark({ className = 'w-10 h-10' }: SoloLogoMarkProps) {
  return (
    <img
      src={appIconSrc}
      alt="SOLO"
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}

export default function SoloLogo({
  className = 'flex items-center gap-3 min-w-0',
  subtitle = 'AI 自动化测试助手',
  orientation = 'horizontal',
  titleClassName = 'text-2xl font-semibold leading-none text-zinc-950 dark:text-zinc-50',
  subtitleClassName = 'mt-1 text-xs text-zinc-500 dark:text-zinc-400',
}: SoloLogoProps) {
  if (orientation === 'stacked') {
    return (
      <div className={className}>
        <img src={lockupSrc} alt="SOLO" className="h-16 w-auto object-contain" draggable={false} />
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <SoloLogoMark className="w-12 h-12 shrink-0" />
      <div className="min-w-0">
        <div className={titleClassName}>SOLO</div>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
