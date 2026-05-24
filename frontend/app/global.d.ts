declare module '@splinetool/react-spline/dist/react-spline' {
  const Spline: React.ComponentType<{
    scene: string;
    className?: string;
    onLoad?: (e: any) => void;
  }>;
  export default Spline;
}
