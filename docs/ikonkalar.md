# Ikonkalar xaritasi

Sayt va ilova — bitta to'plam: **Phosphor Icons**, **bold** vazn (faol/belgilangan holat — `fill`).

- Sayt: `@phosphor-icons/react` (SSR import `@phosphor-icons/react/dist/ssr`), `src/components/ui/icons.ts` + `ui/icon.tsx` (`<Icon name size />`).
- Ilova: `phosphor-react-native`, `mobile/src/ui/icons.tsx` (`<Icon name size color />`) — **bir xil nomlar va xarita** (biri o'zgarsa, ikkinchisi ham).
- O'lcham shkalasi: **16 / 20 / 24** — `iconSize()` 32 dan kichik o'lchamni eng yaqiniga yaxlitlaydi (16 — matn yonida, 20 — oddiy, 24 — sarlavha/navigatsiya); 32 va kattasi — bezak (karta plitasi, bo'sh holat) o'zgarmaydi.
- Rang — `currentColor` (saytda) yoki `color` (ilovada); qalinlik bitta (eski `strokeWidth` e'tiborga olinmaydi).
- DB'dagi `Category.icon` / `Discount.icon` kalitlari shu nomlardan (`all`, `bowl`, `cup`, …).
- **Brend belgilari** to'plamda emas — faqat rasmiy fayllar: Telegram, Instagram, Yandex Xaritalar, Yandex Go, Google Maps (`public/brands/*.png` = `mobile/assets/brands/*.png`, manba `mobile/assets/brands/SOURCE.md`), Google "G" (rasmiy ranglar, `GoogleG`), Apple (rasmiy tugma). Footer'dagi YouTube va X — rasmiy fayli yo'q, Phosphor brend gliflari (`youtube`, `xBrand`).

| Bo'lim | Nom | Phosphor |
|---|---|---|
| kategoriya / chegirma | `all` | SquaresFour |
| kategoriya / chegirma | `bowl` | BowlFood |
| kategoriya / chegirma | `cup` | Coffee |
| kategoriya / chegirma | `book` | BookOpen |
| kategoriya / chegirma | `print` | Printer |
| kategoriya / chegirma | `gym` | Barbell |
| kategoriya / chegirma | `cut` | Scissors |
| kategoriya / chegirma | `film` | FilmSlate |
| kategoriya / chegirma | `wrap` | Hamburger |
| navigatsiya | `home` | House |
| navigatsiya | `house` | HouseLine |
| navigatsiya | `ticket` | Ticket |
| navigatsiya | `clock` | Clock |
| navigatsiya | `time` | Timer |
| navigatsiya | `user` | User |
| navigatsiya | `users` | Users |
| navigatsiya | `scan` | Scan |
| navigatsiya | `chart` | ChartBar |
| navigatsiya | `receipt` | Receipt |
| navigatsiya | `store` | Storefront |
| navigatsiya | `student` | Student |
| navigatsiya | `bell` | Bell |
| navigatsiya | `gear` | Gear |
| navigatsiya | `grid` | GridFour |
| navigatsiya | `menu` | List |
| harakat | `arrowRight` | ArrowRight |
| harakat | `arrowLeft` | ArrowLeft |
| harakat | `chevronRight` | CaretRight |
| harakat | `chevronLeft` | CaretLeft |
| harakat | `chevronDown` | CaretDown |
| harakat | `close` | X |
| harakat | `plus` | Plus |
| harakat | `minus` | Minus |
| harakat | `check` | Check |
| harakat | `tick` | Check |
| harakat | `checkCircle` | CheckCircle |
| harakat | `edit` | PencilSimple |
| harakat | `copy` | Copy |
| harakat | `share` | ShareNetwork |
| harakat | `search` | MagnifyingGlass |
| harakat | `refresh` | ArrowClockwise |
| harakat | `upload` | UploadSimple |
| harakat | `download` | DownloadSimple |
| harakat | `logout` | SignOut |
| harakat | `trash` | Trash |
| harakat | `send` | PaperPlaneTilt |
| harakat | `sliders` | SlidersHorizontal |
| joy | `pin` | MapPin |
| joy | `map` | MapTrifold |
| joy | `locate` | Crosshair |
| joy | `navigate` | NavigationArrow |
| joy | `globe` | GlobeSimple |
| holat va ma'lumot | `bolt` | Lightning |
| holat va ma'lumot | `info` | Info |
| holat va ma'lumot | `ban` | Prohibit |
| holat va ma'lumot | `lock` | Lock |
| holat va ma'lumot | `shield` | Shield |
| holat va ma'lumot | `shieldCheck` | ShieldCheck |
| holat va ma'lumot | `eye` | Eye |
| holat va ma'lumot | `eyeOff` | EyeSlash |
| holat va ma'lumot | `sun` | Sun |
| holat va ma'lumot | `torch` | Flashlight |
| holat va ma'lumot | `tag` | Tag |
| holat va ma'lumot | `bag` | Bag |
| holat va ma'lumot | `bookmark` | BookmarkSimple |
| holat va ma'lumot | `verified` | SealCheck |
| hujjat va qurilma | `idCard` | IdentificationCard |
| hujjat va qurilma | `file` | File |
| hujjat va qurilma | `doc` | FileText |
| hujjat va qurilma | `image` | Image |
| hujjat va qurilma | `camera` | Camera |
| hujjat va qurilma | `qr` | QrCode |
| hujjat va qurilma | `keyboard` | Keyboard |
| hujjat va qurilma | `message` | ChatText |
| hujjat va qurilma | `phone` | Phone |
| hujjat va qurilma | `mobile` | DeviceMobile |
| ijtimoiy tarmoqlar (rasmiy fayli yo'qlari; Telegram va Instagram — public/brands) | `youtube` | YoutubeLogo |
| ijtimoiy tarmoqlar (rasmiy fayli yo'qlari; Telegram va Instagram — public/brands) | `xBrand` | XLogo |
