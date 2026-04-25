const SYSTEM_WELCOME_SENDER = "welcome@nexatech.edu.kg";
const SYSTEM_WELCOME_DISPLAY_NAME = "Nexatech University";

export function getSenderDisplayName(fromAddress: string) {
  if (fromAddress === SYSTEM_WELCOME_SENDER) {
    return SYSTEM_WELCOME_DISPLAY_NAME;
  }

  return fromAddress;
}

export { SYSTEM_WELCOME_SENDER, SYSTEM_WELCOME_DISPLAY_NAME };
