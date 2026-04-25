export function getWebsiteLoginUrl(redirectTo?: string) {
  const websiteUrl = new URL("https://www.nexatech.edu.kg");
  websiteUrl.searchParams.set("mail_login", "1");

  if (redirectTo) {
    websiteUrl.searchParams.set("redirect", redirectTo);
  }

  return websiteUrl.toString();
}
