export function appErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('timeout')) {
    return '네트워크가 불안정합니다. 연결을 확인한 뒤 다시 시도해주세요.';
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('unauthorized') || lower.includes('403') || lower.includes('401')) {
    return '권한 또는 로그인 상태를 확인해야 합니다. 다시 로그인 후 시도해주세요.';
  }
  if (lower.includes('file') || lower.includes('image') || lower.includes('formdata') || lower.includes('upload')) {
    return '이미지 업로드 중 문제가 생겼습니다. 이미지 용량과 네트워크 상태를 확인해주세요.';
  }
  return fallback;
}

export function slowNetworkHint() {
  return '반응이 오래 걸리면 중복으로 누르지 말고 잠시 기다린 뒤 재시도해주세요.';
}
