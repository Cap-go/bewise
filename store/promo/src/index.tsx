import { Composition, registerRoot } from 'remotion'
import { DURATION, Promo } from './Promo'
import { Creative, DUO_SIZES, DuoShot, LOOP, STILL_FRAME } from './Store'

// App Store app preview: 6.9"/6.5" iPhone portrait size, 15-30 s, 30 fps.
// Website: 16:9.
function Root() {
  return (
    <>
      <Composition id="AppStore" component={Promo} width={886} height={1920} fps={30} durationInFrames={DURATION} defaultProps={{ platform: 'appstore' as const }} />
      <Composition id="Website" component={Promo} width={1920} height={1080} fps={30} durationInFrames={DURATION} defaultProps={{ platform: 'web' as const }} />
      {/* iPhone Duo screenshots, rendered as stills at STILL_FRAME by scripts/store-assets.ts. */}
      <Composition id="DuoOuter" component={DuoShot} width={DUO_SIZES.outer.w} height={DUO_SIZES.outer.h} fps={30} durationInFrames={STILL_FRAME + 1} defaultProps={{ display: 'outer' as const, shot: 'today-en', top: 'One wise quote,', bottom: 'every morning.' }} />
      <Composition id="DuoInner" component={DuoShot} width={DUO_SIZES.inner.w} height={DUO_SIZES.inner.h} fps={30} durationInFrames={STILL_FRAME + 1} defaultProps={{ display: 'inner' as const, shot: 'today-en', top: 'One wise quote,', bottom: 'every morning.' }} />
      <Composition id="IPhoneShot" component={DuoShot} width={DUO_SIZES.iphone.w} height={DUO_SIZES.iphone.h} fps={30} durationInFrames={STILL_FRAME + 1} defaultProps={{ display: 'iphone' as const, shot: 'widget-en', top: 'Right on your', bottom: 'home screen.' }} />
      <Composition id="IPadShot" component={DuoShot} width={DUO_SIZES.ipad.w} height={DUO_SIZES.ipad.h} fps={30} durationInFrames={STILL_FRAME + 1} defaultProps={{ display: 'ipad' as const, shot: 'widget-en', top: 'Right on your', bottom: 'home screen.' }} />
      {/* App Store creative assets: product page header (21:9) and search results (3:2), looping videos + stills. */}
      <Composition id="Header" component={Creative} width={3840} height={1646} fps={30} durationInFrames={LOOP} defaultProps={{ layout: 'header' as const }} />
      <Composition id="Search" component={Creative} width={2880} height={1920} fps={30} durationInFrames={LOOP} defaultProps={{ layout: 'search' as const }} />
    </>
  )
}

registerRoot(Root)
