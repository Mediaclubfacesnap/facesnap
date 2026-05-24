import React from 'react';

declare module '@splinetool/react-spline/dist/react-spline' {
  interface SplineProps {
    scene: string;
    className?: string;
    onLoad?: (e: any) => void;
  }
  const Spline: React.ComponentType<SplineProps>;
  export default Spline;
}
