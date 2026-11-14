import type { FC } from 'react';
import { Users } from 'lucide-react';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isGroup?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AVATAR_TONES = [
  '#3D5A6C',
  '#4F6D7A',
  '#47787B',
  '#303841',
  '#5A6672',
  '#5F7470',
  '#76ABAE',
];

function pickTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export const Avatar: FC<AvatarProps> = ({
  name,
  avatarUrl,
  isOnline = false,
  isGroup = false,
  size = 'md',
}) => {
  const dim =
    size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  const dotSize = size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  const tone = pickTone(name);

  return (
    <div className={`relative shrink-0 ${dim}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Foto profil ${name}`}
          width={size === 'lg' ? 56 : size === 'sm' ? 36 : 40}
          height={size === 'lg' ? 56 : size === 'sm' ? 36 : 40}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-semibold select-none"
          style={{
            backgroundColor: tone,
            color: tone === '#76ABAE' ? '#181D23' : '#F5F5F5',
          }}
          aria-hidden="true"
        >
          {isGroup ? <Users className="w-4 h-4" strokeWidth={1.75} /> : getInitials(name)}
        </div>
      )}

      {isOnline && !isGroup && (
        <span
          title="Sedang online"
          aria-label="Online"
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full bg-[var(--status-e2ee)] ring-2 ring-[var(--bg-sidebar)]`}
        />
      )}
    </div>
  );
};
