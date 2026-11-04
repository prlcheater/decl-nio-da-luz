// Traduz o modelo de login "nome do Elementalista + PIN" para o formato e-mail/senha que o
// Supabase Auth exige por baixo dos panos. Nada disso e enviado por e-mail de
// verdade - e so como o Supabase identifica a conta internamente.

// example.com e reservado pela IANA justamente para isso (RFC 2606) — nunca
// recebe e-mail de verdade, mas e um dominio valido, entao o Supabase aceita.
// Um dominio inventado (ex: "vigias.declinio.app") e rejeitado como invalido.
const EMAIL_DOMAIN = 'example.com'

// Sufixo fixo so para satisfazer o minimo de 6 caracteres do Supabase Auth.
// Nao e uma camada extra de seguranca: um PIN de 4 digitos tem so 10.000
// combinacoes possiveis. Razoavel para uma mesa fechada de amigos (o Supabase ja
// limita tentativas de login por padrao), mas vale ter isso em mente.
const PIN_SUFFIX = '-vigia-declinio'

export function slugifyUsername(username: string) {
  return username
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function usernameToEmail(username: string) {
  return `${slugifyUsername(username)}@${EMAIL_DOMAIN}`
}

export function pinToPassword(pin: string) {
  return `${pin}${PIN_SUFFIX}`
}
