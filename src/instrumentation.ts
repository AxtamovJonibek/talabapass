/**
 * Server ishga tushganda bir marta chaqiriladi. Production'da xavfli sozlama (OTP_FIXED_CODE, SMS_PROVIDER=dev,
 * sir yo'qligi) topilsa jarayon xato kodi bilan to'xtaydi — instrumentation-node.ts ga qarang.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvOrExit } = await import("./instrumentation-node");
    checkEnvOrExit();
  }
}
