import type { RouteLocationNormalized, Router } from 'vue-router'
import type { TabId } from './tabs'
// Native chrome: the tab bar and nav bar are real UIKit / Android views from
// @capgo/capacitor-native-navigation. Page bodies animate with
// @capgo/capacitor-transitions. One animation layer per navigation:
//   - tab switch   -> native snapshot cross-fade ('tab'), web transition off
//   - push / back  -> web page slide from capacitor-transitions
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { NativeNavigation } from '@capgo/capacitor-native-navigation'
import { setDirection } from '@capgo/capacitor-transitions/vue'
import { nextTick } from 'vue'
import { i18n, onLocaleChange } from '~/i18n'
import { TABS } from './tabs'

export const isNative = Capacitor.isNativePlatform()
const isAndroid = Capacitor.getPlatform() === 'android'
// iOS draws system Liquid Glass; Android bars need an explicit dark surface.
const SURFACE = isAndroid ? { background: '#0b1016' } : {}

const BRAND = '#00c0ff'

const BACK_ITEM = {
  id: 'back',
  title: 'Back',
  icon: {
    ios: { sfSymbol: 'chevron.backward' },
    android: { svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' },
  },
}

function tabOf(route: RouteLocationNormalized): TabId {
  return (route.meta.tab as TabId | undefined) ?? 'today'
}

async function renderChrome(route: RouteLocationNormalized) {
  const t = i18n.global.t
  const tab = tabOf(route)
  const isRoot = route.path === TABS.find(x => x.id === tab)?.path

  await NativeNavigation.setNavbar({
    hidden: route.meta.navbar === false,
    title: route.meta.title ? t(route.meta.title as string) : '',
    large: isRoot,
    transparent: true,
    // Android has a native back arrow; the iOS text back button would be empty, so use a chevron item.
    backButton: { visible: isAndroid && !isRoot },
    leftItems: isRoot || isAndroid ? [] : [BACK_ITEM],
    colors: { tint: BRAND, foreground: '#ffffff', ...SURFACE },
  })

  await NativeNavigation.setTabbar({
    hidden: route.meta.tabbar === false,
    selectedId: tab,
    labelVisibilityMode: 'labeled',
    colors: { tint: BRAND, inactiveTint: '#9aa4b2', ...SURFACE },
    tabs: TABS.map(x => ({
      id: x.id,
      title: t(`tabs.${x.id}`),
      icon: { ios: { sfSymbol: x.sfSymbol }, android: { svg: x.svg } },
      selectedIcon: { ios: { sfSymbol: x.sfSymbolSelected }, android: { svg: x.svg } },
    })),
  })
}

export async function setupChrome(router: Router) {
  if (!isNative)
    return

  await NativeNavigation.configure({
    contentInsetMode: 'css',
    animationDuration: 320,
    colors: { tint: BRAND, inactiveTint: '#8a94a3' },
    glass: { effect: 'liquidGlass', blurRadius: 20, surfaceAlpha: 0.55 },
  })

  router.afterEach(to => void renderChrome(to))
  await renderChrome(router.currentRoute.value)

  await NativeNavigation.addListener('tabSelect', ({ id }) => {
    const tab = TABS.find(x => x.id === id)
    if (!tab)
      return
    if (router.currentRoute.value.path === tab.path) {
      // Tapping the active tab scrolls the page back to the top, like iOS.
      document.querySelector<HTMLElement>(`[data-tab-root="${id}"]`)?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    void switchTab(router, tab.path)
  })

  await NativeNavigation.addListener('navbarItemTap', ({ id }) => {
    if (id === 'back')
      back(router)
  })

  await NativeNavigation.addListener('navbarBack', () => back(router))

  // bewise://archive, https://bewise.love/today ... open the matching screen.
  await App.addListener('appUrlOpen', ({ url }) => {
    const path = `/${url.replace(/^[a-z]+:\/\/(bewise\.love\/)?/, '').replace(/^\/+/, '')}`
    const tab = TABS.find(x => path === x.path || path.startsWith(`${x.path}/`))
    if (!tab)
      return
    if (path === tab.path)
      void switchTab(router, path)
    else
      void push(router, path)
  })

  // Re-render bars after a language change.
  onLocaleChange(() => void renderChrome(router.currentRoute.value))
}

export async function switchTab(router: Router, path: string) {
  setDirection('none')
  if (!isNative) {
    await router.push(path)
    return
  }
  const transition = await NativeNavigation.beginTransition({ direction: 'tab' })
  await router.push(path)
  await nextTick()
  await NativeNavigation.finishTransition({ id: transition.id, direction: 'tab' })
}

export function push(router: Router, path: string) {
  setDirection('forward')
  return router.push(path)
}

export function back(router: Router) {
  setDirection('back')
  // Deep links open detail pages without history: fall back to the tab root.
  if (window.history.state?.back)
    router.back()
  else
    void router.replace(TABS.find(x => x.id === tabOf(router.currentRoute.value))?.path ?? '/today')
}
