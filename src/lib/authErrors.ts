/** Traduz mensagens de erro de autenticação/backend para português. */
const MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha inválidos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
  [/user already registered|already been registered/i, "Este e-mail já possui uma conta."],
  [/password should be at least (\d+)/i, "A senha precisa ter ao menos 6 caracteres."],
  [/password.*(weak|strength)/i, "Escolha uma senha mais forte."],
  [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
  [/unable to validate email address|invalid email/i, "Digite um e-mail válido."],
  [/email rate limit exceeded|over_email_send_rate_limit/i, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [/for security purposes.*(\d+) seconds/i, "Aguarde alguns segundos antes de tentar novamente."],
  [/rate limit|too many requests/i, "Muitas tentativas. Tente novamente mais tarde."],
  [/token has expired|invalid or has expired|otp_expired/i, "O link expirou. Solicite um novo."],
  [/auth session missing|session_not_found|jwt expired/i, "Sua sessão expirou. Entre novamente."],
  [/user not found/i, "Não encontramos uma conta com esse e-mail."],
  [/signups not allowed|signup is disabled/i, "O cadastro está indisponível no momento."],
  [/current password/i, "A senha atual está incorreta."],
  [/network|failed to fetch/i, "Falha de conexão. Verifique sua internet e tente novamente."],
  [/permission denied|not authorized|unauthorized/i, "Você não tem permissão para esta ação."],
];

export function traduzErro(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  if (!raw) return fallback;
  for (const [re, msg] of MAP) if (re.test(raw)) return msg;
  // Mensagem já em português (vinda das funções do banco)
  if (/[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(raw) || /\b(comprovante|obrigat|senha|usu)/i.test(raw)) return raw;
  return fallback;
}
