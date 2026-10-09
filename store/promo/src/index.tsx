import { Composition, registerRoot } from 'remotion'
import { DURATION, Promo } from './Promo'

// App Store app preview: 6.9"/6.5" iPhone portrait size, 15-30 s, 30 fps.
// Website: 16:9.
function Root() {
  return (
    <>
      <Composition id="AppStore" component={Promo} width={886} height={1920} fps={30} durationInFrames={DURATION} defaultProps={{ platform: 'appstore' as const }} />
      <Composition id="Website" component={Promo} width={1920} height={1080} fps={30} durationInFrames={DURATION} defaultProps={{ platform: 'web' as const }} />
    </>
  )
}

registerRoot(Root)
