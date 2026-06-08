import React from 'react';
import { cn } from '../utils/theme';

interface SkeletonProps {
    className?: string;
}

// Base skeleton pulse animation
const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
    <div className={cn("animate-pulse bg-mono-surface-2 rounded", className)} />
);

// Message bubble skeleton
const MessageSkeleton: React.FC<{ isOwn?: boolean }> = ({ isOwn = false }) => (
    <div className={cn("flex gap-3 mb-4", isOwn ? "flex-row-reverse" : "flex-row")}>
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className={cn("flex flex-col gap-2", isOwn ? "items-end" : "items-start")}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className={cn("h-12 rounded-xl", isOwn ? "w-48" : "w-64")} />
        </div>
    </div>
);

// Full message list skeleton
export const MessageListSkeleton: React.FC = () => (
    <div className="flex-1 p-4 overflow-hidden">
        <MessageSkeleton isOwn={false} />
        <MessageSkeleton isOwn={true} />
        <MessageSkeleton isOwn={false} />
        <MessageSkeleton isOwn={true} />
        <MessageSkeleton isOwn={false} />
    </div>
);

// Sidebar skeleton
export const SidebarSkeleton: React.FC = () => (
    <div className="w-80 border-r border-mono-glass-border p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        {/* Tabs */}
        <Skeleton className="h-10 w-full rounded-xl" />

        {/* Room list */}
        {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                </div>
            </div>
        ))}
    </div>
);

export default Skeleton;
