import React from 'react';

export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-ws-card border border-ws-border rounded-lg p-4 card-load-in skeleton-breathe"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg skeleton-enhanced loading-wave loading-wave-delay-${i}`} />
            <div className="flex-1">
              <div className="h-4 w-28 rounded skeleton-enhanced mb-2" />
              <div className="h-3 w-56 rounded skeleton-enhanced" />
            </div>
            <div className="h-4 w-36 rounded skeleton-enhanced" />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
      </div>
    </div>
  );
}

export default LoadingSkeleton;
