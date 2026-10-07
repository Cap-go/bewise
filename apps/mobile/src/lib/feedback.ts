import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { ref } from 'vue'

export const toast = ref<{ id: number, text: string } | null>(null)

export function showToast(text: string) {
  const id = Date.now()
  toast.value = { id, text }
  setTimeout(() => {
    if (toast.value?.id === id)
      toast.value = null
  }, 2200)
}

export const haptic = {
  tap: () => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
  success: () => Haptics.notification({ type: NotificationType.Success }).catch(() => {}),
  select: () => Haptics.selectionChanged().catch(() => {}),
}
