export function getUsernameFromEmail(emailAddress: string | null | undefined) {
  if (!emailAddress) {
    return "";
  }

  return emailAddress.split("@")[0] ?? "";
}
