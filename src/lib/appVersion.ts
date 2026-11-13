// Versão do app web. `__APP_VERSION__` é injetado pelo Vite a partir do
// package.json (uma fonte só); fora do Vite (ex.: testes) cai no fallback.
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
export const APP_CHANNEL = 'beta'
export const APP_LABEL = `${APP_CHANNEL} ${APP_VERSION}`.toUpperCase()
