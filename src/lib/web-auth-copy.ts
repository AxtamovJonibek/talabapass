/**
 * Sayt kirishi va ro'yxati (`components/auth/web-auth.tsx`) matnlari — uz, ru, en. Sayt marshrutlari hozircha faqat `uz`
 * (`i18n/routing.ts`), shuning uchun bu oqim tilni o'zi tanlaydi (`tp:til`, ilova bilan bir xil kalit nomi) va matnlar
 * `messages/` da emas, shu yerda. `ru` va `en` tipi `uz` bilan tekshiriladi. Matnlar ilovadagi (`mobile/src/i18n`) bilan mos.
 */

export const WEB_LANGS = ["uz", "ru", "en"] as const;
export type WebLang = (typeof WEB_LANGS)[number];
export const LANG_LABEL: Record<WebLang, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };

/** Server xato kodlari (`ApiErrorCode`) → matn. Raqamli qiymatlar: soniya, daqiqa, qolgan urinish. */
type Errors = {
  invalid_phone: string;
  too_soon: (seconds: number) => string;
  daily_limit: string;
  ip_limit: string;
  sms_failed: string;
  wrong_code: string;
  code_expired: string;
  code_locked: (minutes: number) => string;
  account_blocked: string;
  no_business: string;
  step_expired: string;
  wrong_password: (left: number | undefined) => string;
  password_locked: (minutes: number) => string;
  weak_password: string;
  password_mismatch: string;
  tin_taken: string;
  invalid_request: string;
  rate_limited: string;
  social_invalid: string;
  social_unavailable: string;
  social_unreachable: string;
  unknown: string;
  noAccount: string;
  appleFailed: string;
  googleFailed: string;
  upload: string;
};

export type WebAuthCopy = {
  back: string;
  language: string;
  student: string;
  business: string;
  headline: { student: string; business: string };
  lead: { student: string; business: string };
  or: string;
  continue: string;
  methods: { title: string; google: string; apple: string; phone: string; haveAccount: string; signIn: string };
  signin: { title: string; identifier: string; identifierPlaceholder: string; submit: string; submitting: string; forgot: string; noAccount: string; register: string };
  phone: { registerTitle: string; resetTitle: string; resetLead: string; label: string; send: string; sending: string };
  code: { title: string; lead: (phone: string) => string; digit: (n: number) => string; label: string; resendIn: string; resend: string; change: string; confirm: string; checking: string };
  password: {
    loginTitle: string;
    found: string;
    setTitle: string;
    setLead: string;
    resetTitle: string;
    resetLead: string;
    label: string;
    repeat: string;
    show: string;
    hide: string;
    forgot: string;
    signIn: string;
    signingIn: string;
    ruleLength: string;
    ruleMix: string;
    save: string;
    saving: string;
    otherNumber: string;
  };
  studentForm: {
    title: string;
    firstName: string;
    lastName: string;
    university: string;
    universitySearch: string;
    universityOther: string;
    universityOtherLabel: string;
    universityOtherPlaceholder: string;
    universityEmpty: string;
    course: string;
    courses: { value: string; label: string }[];
    submit: string;
    submitting: string;
    fieldError: string;
  };
  businessForm: {
    title: string;
    name: string;
    namePlaceholder: string;
    address: string;
    addressPlaceholder: string;
    tin: string;
    tinPlaceholder: string;
    photo: string;
    photoHint: string;
    photoPick: string;
    photoChange: string;
    phone: string;
    telegram: string;
    telegramPlaceholder: string;
    submit: string;
    submitting: string;
    received: string;
    contact: string;
    status: string;
    pending: string;
    toPanel: string;
    fieldError: string;
  };
  consent: { lead: string; terms: string; and: string; privacy: string; tail: string };
  errors: Errors;
};

const uz: WebAuthCopy = {
  back: "Orqaga",
  language: "Til",
  student: "Talaba",
  business: "Biznes",
  headline: { student: "Talaba bo'lish endi arzonroq.", business: "Talabalarni biznesingizga olib keling." },
  lead: { student: "Kafe, kitob do'koni, sport zal va boshqa joylarda talabalar uchun chegirmalar.", business: "Chegirma joylang, talabalar QR bilan keladi." },
  or: "yoki",
  continue: "Davom etish",
  methods: {
    title: "Ro'yxatdan o'tish",
    google: "Google bilan davom etish",
    apple: "Apple bilan davom etish",
    phone: "Telefon raqam bilan",
    haveAccount: "Hisobingiz bormi?",
    signIn: "Kirish",
  },
  signin: {
    title: "Kirish",
    identifier: "Telefon raqam yoki email",
    identifierPlaceholder: "90 123 45 67 yoki siz@pochta.uz",
    submit: "Kirish",
    submitting: "Kirilmoqda…",
    forgot: "Parolni unutdim",
    noAccount: "Hisobingiz yo'qmi?",
    register: "Ro'yxatdan o'tish",
  },
  phone: {
    registerTitle: "Telefon raqam",
    resetTitle: "Parolni tiklash",
    resetLead: "Raqamingizni kiriting — SMS kod yuboramiz.",
    label: "Telefon raqam",
    send: "Kod yuborish",
    sending: "Yuborilmoqda…",
  },
  code: {
    title: "Kodni kiriting",
    lead: (phone) => `${phone} raqamiga 6 xonali kod yubordik.`,
    digit: (n) => `${n}-raqam`,
    label: "SMS kodi",
    resendIn: "Qayta yuborish:",
    resend: "Qayta yuborish",
    change: "Raqamni o'zgartirish",
    confirm: "Tasdiqlash",
    checking: "Tekshirilmoqda…",
  },
  password: {
    loginTitle: "Parolni kiriting",
    found: "Hisobingiz topildi.",
    setTitle: "Parol o'rnating",
    setLead: "Keyingi safar shu parol bilan kirasiz.",
    resetTitle: "Yangi parol",
    resetLead: "Boshqa qurilmalardagi kirishlar yopiladi.",
    label: "Parol",
    repeat: "Parolni takrorlang",
    show: "Parolni ko'rsatish",
    hide: "Parolni yashirish",
    forgot: "Parolni unutdim",
    signIn: "Kirish",
    signingIn: "Kirilmoqda…",
    ruleLength: "Kamida 8 ta belgi",
    ruleMix: "Harf va raqam birga",
    save: "Davom etish",
    saving: "Saqlanmoqda…",
    otherNumber: "Boshqa raqam bilan",
  },
  studentForm: {
    title: "Ma'lumotlaringiz",
    firstName: "Ism",
    lastName: "Familiya",
    university: "Universitet",
    universitySearch: "Nomi yoki qisqartmasi",
    universityOther: "Ro'yxatda yo'q",
    universityOtherLabel: "Universitet nomi",
    universityOtherPlaceholder: "To'liq nomini yozing",
    universityEmpty: "Hech narsa topilmadi.",
    course: "Kurs",
    courses: [
      { value: "C1", label: "1" },
      { value: "C2", label: "2" },
      { value: "C3", label: "3" },
      { value: "C4", label: "4" },
      { value: "MASTER", label: "Mag." },
    ],
    submit: "Davom etish",
    submitting: "Saqlanmoqda…",
    fieldError: "Maydonni to'g'ri to'ldiring.",
  },
  businessForm: {
    title: "Biznes ma'lumotlari",
    name: "Biznes yoki brend nomi",
    namePlaceholder: "Masalan, Kofe Bar",
    address: "Manzil",
    addressPlaceholder: "Toshkent, Chilonzor 9",
    tin: "STIR",
    tinPlaceholder: "9 ta raqam",
    photo: "Rasm",
    photoHint: "Ixtiyoriy",
    photoPick: "Rasm tanlash",
    photoChange: "Boshqa rasm",
    phone: "Telefon",
    telegram: "Telegram",
    telegramPlaceholder: "@username",
    submit: "Yuborish",
    submitting: "Yuborilmoqda…",
    received: "Arizangiz qabul qilindi.",
    contact: "Siz bilan bog'lanamiz.",
    status: "Holat",
    pending: "Kutilmoqda",
    toPanel: "Biznes sahifasiga",
    fieldError: "Maydonni to'g'ri to'ldiring.",
  },
  consent: { lead: "Davom etib, ", terms: "Foydalanish shartlari", and: " va ", privacy: "Maxfiylik siyosati", tail: "ga rozilik bildirasiz." },
  errors: {
    invalid_phone: "Telefon raqamni to'liq kiriting: 9 ta raqam.",
    too_soon: (s) => `Kod yaqinda yuborilgan. ${s} soniyadan keyin qayta so'rang.`,
    daily_limit: "Bu raqamga bugun kod yuborish chegarasi tugadi. Ertaga urinib ko'ring.",
    ip_limit: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring.",
    sms_failed: "SMS yuborib bo'lmadi. Birozdan keyin urinib ko'ring.",
    wrong_code: "Kod noto'g'ri.",
    code_expired: "Kodning muddati tugadi. Yangi kod so'rang.",
    code_locked: (m) => `Juda ko'p xato urinish. ${m} daqiqadan keyin qayta urinib ko'ring.`,
    account_blocked: "Hisob bloklangan.",
    no_business: "Hisob biznesga biriktirilmagan.",
    step_expired: "Tasdiqlash muddati o'tdi. Raqamni qayta tasdiqlang.",
    wrong_password: (left) => (left === undefined ? "Parol noto'g'ri." : `Parol noto'g'ri. Yana ${left} ta urinish qoldi.`),
    password_locked: (m) => `Juda ko'p xato urinish. ${m} daqiqadan keyin qayta urinib ko'ring.`,
    weak_password: "Parol kamida 8 ta belgi bo'lsin, harf va raqam birga.",
    password_mismatch: "Parollar bir xil emas.",
    tin_taken: "Bu STIR bilan ariza allaqachon bor.",
    invalid_request: "Maydonlarni to'g'ri to'ldiring.",
    rate_limited: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
    social_invalid: "Kirib bo'lmadi. Qayta urinib ko'ring.",
    social_unavailable: "Bu usul hozir ishlamaydi. Telefon raqam bilan kiring.",
    social_unreachable: "Ulanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
    unknown: "Nimadir xato ketdi. Birozdan keyin urinib ko'ring.",
    noAccount: "Bu raqam ro'yxatda yo'q.",
    appleFailed: "Apple orqali kirib bo'lmadi. Google yoki telefon raqam bilan kiring.",
    googleFailed: "Google bilan kirib bo'lmadi. Apple yoki telefon raqam bilan kiring.",
    upload: "Rasm yuklanmadi. Boshqa rasm tanlang yoki shunchaki yuboring.",
  },
};

const ru: WebAuthCopy = {
  back: "Назад",
  language: "Язык",
  student: "Студент",
  business: "Бизнес",
  headline: { student: "Быть студентом теперь дешевле.", business: "Приведите студентов в свой бизнес." },
  lead: { student: "Скидки для студентов в кафе, книжных, спортзалах и других местах.", business: "Добавьте скидку — студенты придут с QR-кодом." },
  or: "или",
  continue: "Продолжить",
  methods: {
    title: "Регистрация",
    google: "Продолжить с Google",
    apple: "Продолжить с Apple",
    phone: "По номеру телефона",
    haveAccount: "Уже есть аккаунт?",
    signIn: "Войти",
  },
  signin: {
    title: "Вход",
    identifier: "Номер телефона или email",
    identifierPlaceholder: "90 123 45 67 или you@mail.uz",
    submit: "Войти",
    submitting: "Входим…",
    forgot: "Забыли пароль?",
    noAccount: "Нет аккаунта?",
    register: "Зарегистрироваться",
  },
  phone: {
    registerTitle: "Номер телефона",
    resetTitle: "Восстановление пароля",
    resetLead: "Введите номер — отправим код в SMS.",
    label: "Номер телефона",
    send: "Отправить код",
    sending: "Отправляем…",
  },
  code: {
    title: "Введите код",
    lead: (phone) => `Мы отправили 6-значный код на номер ${phone}.`,
    digit: (n) => `Цифра ${n}`,
    label: "Код из SMS",
    resendIn: "Повторно через:",
    resend: "Отправить снова",
    change: "Изменить номер",
    confirm: "Подтвердить",
    checking: "Проверяем…",
  },
  password: {
    loginTitle: "Введите пароль",
    found: "Аккаунт найден.",
    setTitle: "Задайте пароль",
    setLead: "В следующий раз вы войдёте с этим паролем.",
    resetTitle: "Новый пароль",
    resetLead: "Входы на других устройствах будут закрыты.",
    label: "Пароль",
    repeat: "Повторите пароль",
    show: "Показать пароль",
    hide: "Скрыть пароль",
    forgot: "Забыли пароль?",
    signIn: "Войти",
    signingIn: "Входим…",
    ruleLength: "Не менее 8 символов",
    ruleMix: "Буквы и цифры вместе",
    save: "Продолжить",
    saving: "Сохраняем…",
    otherNumber: "С другим номером",
  },
  studentForm: {
    title: "Ваши данные",
    firstName: "Имя",
    lastName: "Фамилия",
    university: "Вуз",
    universitySearch: "Название или аббревиатура",
    universityOther: "Нет в списке",
    universityOtherLabel: "Название вуза",
    universityOtherPlaceholder: "Полное название",
    universityEmpty: "Ничего не найдено.",
    course: "Курс",
    courses: [
      { value: "C1", label: "1" },
      { value: "C2", label: "2" },
      { value: "C3", label: "3" },
      { value: "C4", label: "4" },
      { value: "MASTER", label: "Маг." },
    ],
    submit: "Продолжить",
    submitting: "Сохраняем…",
    fieldError: "Заполните поле правильно.",
  },
  businessForm: {
    title: "Данные бизнеса",
    name: "Название бизнеса или бренда",
    namePlaceholder: "Например, Кофе Бар",
    address: "Адрес",
    addressPlaceholder: "Ташкент, Чиланзар 9",
    tin: "ИНН",
    tinPlaceholder: "9 цифр",
    photo: "Фото",
    photoHint: "Необязательно",
    photoPick: "Выбрать фото",
    photoChange: "Другое фото",
    phone: "Телефон",
    telegram: "Telegram",
    telegramPlaceholder: "@username",
    submit: "Отправить",
    submitting: "Отправляем…",
    received: "Ваша заявка принята.",
    contact: "Мы свяжемся с вами.",
    status: "Статус",
    pending: "Ожидает",
    toPanel: "К странице бизнеса",
    fieldError: "Заполните поле правильно.",
  },
  consent: { lead: "Продолжая, вы соглашаетесь с ", terms: "Условиями использования", and: " и ", privacy: "Политикой конфиденциальности", tail: "." },
  errors: {
    invalid_phone: "Введите номер полностью: 9 цифр.",
    too_soon: (s) => `Код недавно отправлен. Запросите снова через ${s} с.`,
    daily_limit: "На этот номер сегодня больше нельзя отправить код. Попробуйте завтра.",
    ip_limit: "Слишком много запросов. Попробуйте позже.",
    sms_failed: "Не удалось отправить SMS. Попробуйте позже.",
    wrong_code: "Неверный код.",
    code_expired: "Срок действия кода истёк. Запросите новый.",
    code_locked: (m) => `Слишком много неверных попыток. Попробуйте через ${m} мин.`,
    account_blocked: "Аккаунт заблокирован.",
    no_business: "Аккаунт не привязан к бизнесу.",
    step_expired: "Время подтверждения истекло. Подтвердите номер снова.",
    wrong_password: (left) => (left === undefined ? "Неверный пароль." : `Неверный пароль. Осталось попыток: ${left}.`),
    password_locked: (m) => `Слишком много неверных попыток. Попробуйте через ${m} мин.`,
    weak_password: "Пароль — не менее 8 символов, буквы и цифры вместе.",
    password_mismatch: "Пароли не совпадают.",
    tin_taken: "Заявка с этим ИНН уже есть.",
    invalid_request: "Заполните поля правильно.",
    rate_limited: "Слишком много попыток. Попробуйте позже.",
    social_invalid: "Не удалось войти. Попробуйте снова.",
    social_unavailable: "Этот способ сейчас недоступен. Войдите по номеру телефона.",
    social_unreachable: "Не удалось подключиться. Попробуйте позже.",
    unknown: "Что-то пошло не так. Попробуйте позже.",
    noAccount: "Этот номер не зарегистрирован.",
    appleFailed: "Не удалось войти через Apple. Войдите через Google или по номеру телефона.",
    googleFailed: "Не удалось войти через Google. Войдите через Apple или по номеру телефона.",
    upload: "Фото не загрузилось. Выберите другое или просто отправьте заявку.",
  },
};

const en: WebAuthCopy = {
  back: "Back",
  language: "Language",
  student: "Student",
  business: "Business",
  headline: { student: "Being a student just got cheaper.", business: "Bring students to your business." },
  lead: { student: "Student discounts at cafés, bookstores, gyms and more.", business: "Post a discount — students arrive with a QR code." },
  or: "or",
  continue: "Continue",
  methods: {
    title: "Sign up",
    google: "Continue with Google",
    apple: "Continue with Apple",
    phone: "With phone number",
    haveAccount: "Have an account?",
    signIn: "Sign in",
  },
  signin: {
    title: "Sign in",
    identifier: "Phone number or email",
    identifierPlaceholder: "90 123 45 67 or you@mail.uz",
    submit: "Sign in",
    submitting: "Signing in…",
    forgot: "Forgot password?",
    noAccount: "No account?",
    register: "Sign up",
  },
  phone: {
    registerTitle: "Phone number",
    resetTitle: "Reset password",
    resetLead: "Enter your number — we'll text you a code.",
    label: "Phone number",
    send: "Send code",
    sending: "Sending…",
  },
  code: {
    title: "Enter the code",
    lead: (phone) => `We sent a 6-digit code to ${phone}.`,
    digit: (n) => `Digit ${n}`,
    label: "SMS code",
    resendIn: "Resend in:",
    resend: "Resend",
    change: "Change number",
    confirm: "Confirm",
    checking: "Checking…",
  },
  password: {
    loginTitle: "Enter your password",
    found: "Account found.",
    setTitle: "Set a password",
    setLead: "You'll sign in with it next time.",
    resetTitle: "New password",
    resetLead: "Other devices will be signed out.",
    label: "Password",
    repeat: "Repeat password",
    show: "Show password",
    hide: "Hide password",
    forgot: "Forgot password?",
    signIn: "Sign in",
    signingIn: "Signing in…",
    ruleLength: "At least 8 characters",
    ruleMix: "Letters and digits together",
    save: "Continue",
    saving: "Saving…",
    otherNumber: "Use another number",
  },
  studentForm: {
    title: "Your details",
    firstName: "First name",
    lastName: "Last name",
    university: "University",
    universitySearch: "Name or abbreviation",
    universityOther: "Not in the list",
    universityOtherLabel: "University name",
    universityOtherPlaceholder: "Full name",
    universityEmpty: "Nothing found.",
    course: "Year",
    courses: [
      { value: "C1", label: "1" },
      { value: "C2", label: "2" },
      { value: "C3", label: "3" },
      { value: "C4", label: "4" },
      { value: "MASTER", label: "Mst." },
    ],
    submit: "Continue",
    submitting: "Saving…",
    fieldError: "Fill in this field correctly.",
  },
  businessForm: {
    title: "Business details",
    name: "Business or brand name",
    namePlaceholder: "e.g. Coffee Bar",
    address: "Address",
    addressPlaceholder: "Tashkent, Chilonzor 9",
    tin: "TIN",
    tinPlaceholder: "9 digits",
    photo: "Photo",
    photoHint: "Optional",
    photoPick: "Choose photo",
    photoChange: "Another photo",
    phone: "Phone",
    telegram: "Telegram",
    telegramPlaceholder: "@username",
    submit: "Submit",
    submitting: "Submitting…",
    received: "Your application has been received.",
    contact: "We will contact you.",
    status: "Status",
    pending: "Pending",
    toPanel: "To business page",
    fieldError: "Fill in this field correctly.",
  },
  consent: { lead: "By continuing, you agree to the ", terms: "Terms of Use", and: " and ", privacy: "Privacy Policy", tail: "." },
  errors: {
    invalid_phone: "Enter the full number: 9 digits.",
    too_soon: (s) => `A code was sent recently. Request again in ${s}s.`,
    daily_limit: "Daily code limit for this number reached. Try again tomorrow.",
    ip_limit: "Too many requests. Try again later.",
    sms_failed: "Could not send the SMS. Try again later.",
    wrong_code: "Wrong code.",
    code_expired: "The code has expired. Request a new one.",
    code_locked: (m) => `Too many wrong attempts. Try again in ${m} min.`,
    account_blocked: "This account is blocked.",
    no_business: "This account is not linked to a business.",
    step_expired: "Verification expired. Confirm the number again.",
    wrong_password: (left) => (left === undefined ? "Wrong password." : `Wrong password. ${left} attempts left.`),
    password_locked: (m) => `Too many wrong attempts. Try again in ${m} min.`,
    weak_password: "Password: at least 8 characters, letters and digits together.",
    password_mismatch: "Passwords do not match.",
    tin_taken: "An application with this TIN already exists.",
    invalid_request: "Fill in the fields correctly.",
    rate_limited: "Too many attempts. Try again later.",
    social_invalid: "Could not sign in. Try again.",
    social_unavailable: "This method is unavailable right now. Sign in with your phone number.",
    social_unreachable: "Could not connect. Try again later.",
    unknown: "Something went wrong. Try again later.",
    noAccount: "This number is not registered.",
    appleFailed: "Could not sign in with Apple. Use Google or your phone number.",
    googleFailed: "Could not sign in with Google. Use Apple or your phone number.",
    upload: "The photo was not uploaded. Pick another or just submit.",
  },
};

export const WEB_AUTH_COPY: Record<WebLang, WebAuthCopy> = { uz, ru, en };
