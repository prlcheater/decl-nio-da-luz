import PixelBlast from '@/components/PixelBlast'

export default function SiteBackground() {
  return (
    <div className="site-bg">
      <PixelBlast
        variant="square"
        pixelSize={2}
        color="#B497CF"
        patternScale={4}
        patternDensity={0.35}
        enableRipples
        rippleSpeed={0.25}
        rippleThickness={0.1}
        rippleIntensityScale={1}
        speed={0.5}
        transparent
        edgeFade={0.5}
      />
    </div>
  )
}
