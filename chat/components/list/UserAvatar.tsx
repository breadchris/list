import React from 'react';
import { useUserAvatar } from '@/hooks/list/useUserAvatar';

interface UserAvatarProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  size = 'sm',
  className = ''
}) => {
  const { data: userData, isLoading } = useUserAvatar(userId);

  // Size classes
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const sizeClass = sizeClasses[size];

  // If loading, show placeholder
  if (isLoading) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gray-200 animate-pulse ${className}`}
        title="Loading..."
      />
    );
  }

  // If we have an avatar URL, show it
  if (userData?.avatar_url) {
    return (
      <img
        src={userData.avatar_url}
        alt={userData.full_name || 'User avatar'}
        className={`${sizeClass} rounded-full border border-gray-300 object-cover ${className}`}
        title={userData.full_name || userData.email || 'User'}
      />
    );
  }

  // Fallback: show a default user icon
  return (
    <div
      className={`${sizeClass} rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center ${className}`}
      title="User"
    >
      <svg
        className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
};
