import React from 'react';

type AdaptiveLayoutProps = {
  readonly width: number;
  readonly narrowContent: React.ReactNode;
  readonly wideContent: React.ReactNode;
};

export function AdaptiveLayout({
  width,
  narrowContent,
  wideContent,
}: AdaptiveLayoutProps): React.ReactNode {
  return width >= 100 ? <>{wideContent}</> : <>{narrowContent}</>;
}
