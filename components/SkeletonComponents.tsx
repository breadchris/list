import React from 'react';

// Skeleton loading animation
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// Header skeleton that matches the real header layout
export const HeaderSkeleton: React.FC = () => (
  <header className="bg-white shadow-sm border-b border-gray-200">
    <div className="max-w-4xl mx-auto px-4 py-3">
      <div className="flex justify-between items-center">
        {/* Left side - Menu button + Group selector skeleton */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <SkeletonPulse className="w-5 h-5 sm:w-6 sm:h-6" />
          <SkeletonPulse className="w-32 h-8" />
        </div>

        {/* Search Bar skeleton */}
        <div className="flex-1 max-w-md mx-2 sm:mx-4">
          <SkeletonPulse className="w-full h-8 rounded-lg" />
        </div>

        {/* Right side - User info skeleton */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <SkeletonPulse className="hidden sm:block w-32 h-4" />
          <SkeletonPulse className="w-6 h-6 sm:hidden rounded-full" />
          <SkeletonPulse className="hidden sm:block w-16 h-4" />
          <SkeletonPulse className="w-4 h-4 sm:hidden" />
        </div>
      </div>
    </div>
  </header>
);

// Content list skeleton that matches the real content layout
export const ContentListSkeleton: React.FC = () => (
  <div className="flex-1 flex flex-col bg-gray-50">
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 sm:p-4 space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center space-x-3">
              <SkeletonPulse className="w-6 h-6" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-4 w-3/4" />
                <SkeletonPulse className="h-3 w-1/2" />
              </div>
              <SkeletonPulse className="w-8 h-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Breadcrumb skeleton
export const BreadcrumbSkeleton: React.FC = () => (
  <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2">
    <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm overflow-x-auto">
      <SkeletonPulse className="w-16 h-4" />
      <SkeletonPulse className="w-3 h-3 sm:w-4 sm:h-4" />
      <SkeletonPulse className="w-20 h-4" />
      <SkeletonPulse className="w-3 h-3 sm:w-4 sm:h-4" />
      <SkeletonPulse className="w-24 h-4" />
    </div>
  </div>
);

// Full app skeleton that maintains layout structure
export const AppSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col transition-all duration-200 ease-in-out">
    <HeaderSkeleton />
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm transition-all duration-200 ease-in-out">
      <BreadcrumbSkeleton />
      <ContentListSkeleton />
    </div>
  </div>
);

// Auth skeleton - minimal loading state for authentication
export const AuthSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="bg-white p-8 rounded-lg shadow-sm border max-w-md w-full mx-4">
      <div className="text-center space-y-4">
        <SkeletonPulse className="w-16 h-16 rounded-full mx-auto" />
        <div className="space-y-2">
          <SkeletonPulse className="h-6 w-32 mx-auto" />
          <SkeletonPulse className="h-4 w-24 mx-auto" />
        </div>
        <div className="space-y-3 pt-4">
          <SkeletonPulse className="h-10 w-full" />
          <SkeletonPulse className="h-10 w-full" />
          <SkeletonPulse className="h-10 w-full" />
        </div>
      </div>
    </div>
  </div>
);

// Selection mode header skeleton
export const SelectionHeaderSkeleton: React.FC = () => (
  <div className="bg-orange-50 border-b border-orange-200 px-3 sm:px-4 py-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <SkeletonPulse className="w-6 h-6" />
        <SkeletonPulse className="w-24 h-5" />
      </div>
      <div className="flex items-center space-x-2">
        <SkeletonPulse className="w-20 h-8" />
        <SkeletonPulse className="w-8 h-8" />
      </div>
    </div>
  </div>
);

// Sharing settings modal skeleton
export const SharingSettingsSkeleton: React.FC = () => (
  <div className="space-y-6 py-4">
    {/* Public Access Toggle Skeleton */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-24" />
        <SkeletonPulse className="h-3 w-48" />
      </div>
      <SkeletonPulse className="h-6 w-11 rounded-full" />
    </div>
    
    {/* Public Link Section Skeleton */}
    <div className="space-y-2">
      <SkeletonPulse className="h-4 w-20" />
      <div className="flex items-center space-x-2">
        <SkeletonPulse className="h-10 flex-1 rounded-lg" />
        <SkeletonPulse className="h-10 w-20 rounded-lg" />
      </div>
    </div>
    
    {/* Note Section Skeleton */}
    <div className="space-y-2">
      <SkeletonPulse className="h-3 w-full" />
      <SkeletonPulse className="h-3 w-3/4" />
    </div>
  </div>
);

// Loading transition component for smooth skeleton-to-content swapping
export const LoadingTransition: React.FC<{ 
  isLoading: boolean; 
  skeleton: React.ReactNode; 
  children: React.ReactNode;
  className?: string;
}> = ({ isLoading, skeleton, children, className = '' }) => (
  <div className={`transition-opacity duration-300 ease-in-out ${className}`}>
    {isLoading ? skeleton : children}
  </div>
);