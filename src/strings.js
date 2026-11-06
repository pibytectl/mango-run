// Every player-facing line: Egyptian colloquial Arabic first, a short English subtitle second.
// The hero (Radwan) speaks with a light, warm Saidi flavour; Cairenes speak Cairene.
// The joke is the situation, never the hero or where he comes from.

export const HERO = { ar: 'رضوان', en: 'Radwan' };

export const NAMES = {
  hero: { ar: 'رضوان', en: 'Radwan', port: 'p_hero' },
  driver: { ar: 'سوّاق الميكروباص', en: 'Microbus driver', port: 'p_driver' },
  tea: { ar: 'عم سيد، بيّاع الشاي', en: 'Uncle Sayed, tea seller', port: 'p_tea' },
  captain: { ar: 'الريّس عبده', en: 'Captain Abdo', port: 'p_captain' },
  narrator: { ar: '', en: '', port: null },
};

export const INTRO = [
  { who: 'narrator',
    ar: 'العصرية، في موقف الميكروباص. رضوان جاي من الصعيد على فرح ابن أخوه، ومعاه أحلى قفص مانجا من جنينة أبوه.',
    en: 'Late afternoon at the microbus stand. Radwan has come up from Upper Egypt for his nephew\'s wedding, with the finest crate of mangoes from his father\'s orchard.' },
  { who: 'hero',
    ar: 'إيه ده يا جدع؟ الورقة مكتوب فيها موقف إمبابة... بس ده ولا شبه الصورة خالص!',
    en: 'What\'s this, man? The paper says the Imbaba stand... but this looks nothing like the photo!' },
  { who: 'driver',
    ar: 'يا حاج ده آخر الخط! المعدية في الناحية التانية خالص، على النيل. وآخر نقلة قبل المغرب!',
    en: 'Hajj, this is the end of the line! The ferry is way over on the other side, on the Nile. Last crossing is before sunset!' },
  { who: 'tea',
    ar: 'فرح الليلة؟ يبقى اجري يا حاج، الشمس مش هتستناك... وخلّي بالك من التكاتك!',
    en: 'A wedding tonight? Then run, Hajj, the sun won\'t wait for you... and mind the tok-toks!' },
  { who: 'hero',
    ar: 'حاضر يا عم الحاج. دول اتناشر مانجاية من جنينة أبويا، وكلهم هيوصلوا سالمين إن شاء الله. يلا بينا!',
    en: 'Right away, uncle. Twelve mangoes from my father\'s orchard, and every one will arrive safe, God willing. Let\'s go!' },
];

export const FINALE = (mangoes) => [
  { who: 'captain',
    ar: 'لحقتها يا بطل! ده إنت أسرع من المعدية نفسها!',
    en: 'You made it, champ! You\'re faster than the ferry itself!' },
  mangoes === 0
    ? { who: 'hero', ar: 'الحمد لله على السلامة... المانجا وقعت في السكة، بس القفص وصل والفرح مستني!', en: 'Thank God we made it... the mangoes fell along the way, but the crate made it and the wedding awaits!' }
    : mangoes >= 12
    ? { who: 'hero', ar: 'الحمد لله... المانجا وصلت كاملة، ولا واحدة نقصت. يلا على الفرح!',
        en: 'Thank God... every single mango made it. On to the wedding!' }
    : { who: 'hero', ar: `الحمد لله... وصلنا بـ${mangoPhrase(mangoes)}. العريس هيسامحنا إن شاء الله!`,
        en: `Thank God... we made it with ${mangoes} mangoes. The groom will forgive us, God willing!` },
];

export const SEGMENTS = [
  { ar: '١ · الشارع', en: 'The Street' },
  { ar: '٢ · السوق', en: 'The Market' },
  { ar: '٣ · السطوح', en: 'The Rooftops' },
  { ar: '٤ · المرسى', en: 'The Jetty' },
];

export const HINTS = {
  start: { ar: 'اجري ناحية الشمس... المعدية مستنياك على النيل', en: 'Run toward the sun... the ferry is waiting on the Nile' },
  startKeys: { ar: 'الأسهم للمشي · Space للنط · X للنبّوت', en: 'Arrows to move · Space to jump · X for the staff' },
  laundry: { ar: 'الغسيل واطي! وطّي تحته ▼', en: 'Low laundry! Duck under it' },
  toktok: { ar: 'توك توك جاي! نُط فوقه أو اطلع على عربية الفاكهة', en: 'Tok-tok coming! Jump on it or climb the cart' },
  ball: { ar: 'الكورة جاية! اضربها بالنبّوت أو نُط', en: 'Ball incoming! Bat it with the staff or jump' },
  puddle: { ar: 'حاسب، الأرض مبلولة! نُط من فوقها', en: 'Careful, wet floor! Jump over it' },
  goat: { ar: 'المعزة قافلة الطريق... زُقّها بالنبّوت بالراحة', en: 'The goat is blocking the way... nudge her gently with the staff' },
  vault: { ar: 'الفتحة واسعة! اجري واضغط النبّوت عشان تتسند وتنط بعيد', en: 'Wide gap! Run and press the staff to vault far' },
  ferry: { ar: 'المعدية بتتحرك! اجري ونُط بالنبّوت!', en: 'The ferry is moving! Run and vault!' },
  checkpoint: { ar: 'اتحفظ مكانك', en: 'Checkpoint' },
  crateFull: { ar: 'القفص مليان، الحمد لله', en: 'The crate is full' },
};

export const LINES = {
  tea: { ar: 'شاي يا حاج؟ طب ولا يهمك، لما ترجع!', en: 'Tea, Hajj? Fine, when you\'re back!' },
  toktok: { ar: 'بيب بيب! وسّع يا حاج!', en: 'Beep beep! Make way, Hajj!' },
  kidSorry: { ar: 'معلش يا عمو! الكورة فلتت!', en: 'Sorry, uncle! The ball got away!' },
  kidGoal: { ar: 'جووون! إنت لعّيب يا عمو!', en: 'Goooal! You can play, uncle!' },
  vendorGift: { ar: 'خد دي يا حاج، هدية للعريس... بس ما تقولش لحد!', en: 'Take this one, Hajj, a gift for the groom... don\'t tell anyone!' },
  vendorFull: { ar: 'مانجا صعيدي؟ ريحتها واصلة لحد هنا!', en: 'Mangoes from the South? I can smell them from here!' },
  goatman: { ar: 'معلش يا حاج، المعزة دي دماغها ناشفة شوية', en: 'Sorry, Hajj, this goat is a bit stubborn' },
  goatmanThanks: { ar: 'تسلم إيدك يا حاج، بالراحة عليها', en: 'Bless your hands, Hajj, gently with her' },
  heroGoat: { ar: 'لا مؤاخذة يا ست المعزة... عدّيني بس عاد', en: 'Pardon me, madam goat... just let me through' },
  heroPigeon: { ar: 'الحمامة البيضا دي ناوية على حاجة... ماشي، بعدين نتحاسب', en: 'That white pigeon is up to something... fine, we\'ll settle it later' },
  heroRoof: { ar: 'يا ولدي على العلو ده... بس الطريق من هنا أقصر', en: 'My, that\'s high... but this way is shorter' },
  captain: { ar: 'يلا يا حاج! آخر نقلة قبل المغرب!', en: 'Come on, Hajj! Last crossing before sunset!' },
  captainWait: { ar: 'استنى يا حاج، هنهدّي شوية!', en: 'Hang on, Hajj, we\'ll slow down!' },
  hurt: [
    { ar: 'يا ساتر!', en: 'Good grief!' },
    { ar: 'المانجا! المانجا!', en: 'The mangoes!' },
    { ar: 'على مهلك يا جدع!', en: 'Easy there, man!' },
  ],
  slip: { ar: 'أوبااا! الأرض بتزحلق!', en: 'Whoa! It\'s slippery!' },
  laundry: { ar: 'إيه ده؟ غسيل مين ده!', en: 'Whose laundry is this?!' },
  fall: { ar: 'يا ساتر يا رب!', en: 'Lord, protect us!' },
  splash: { ar: 'هو أنا جاي أعوم ولا أروح الفرح!', en: 'Did I come to swim or to the wedding?!' },
};

export const UI = {
  soundOn: 'الصوت: شغّال', soundOff: 'الصوت: مقفول',
  subsOn: 'ترجمة EN: شغّالة', subsOff: 'ترجمة EN: مقفولة',
  timeoutTitle: { ar: 'الشمس غابت... والمعدية مشيت!', en: 'The sun has set... and the ferry left!' },
  timeoutBody: { ar: 'ولا يهمك، الريّس عبده هيعمل نقلة كمان. ارجع لآخر نقطة واجري أسرع.', en: 'Never mind, the captain will do one more crossing. Back to the last checkpoint, and run faster.' },
  heartsTitle: { ar: 'رضوان محتاج ياخد نفسه', en: 'Radwan needs to catch his breath' },
  heartsBody: { ar: 'نرجع لآخر نقطة، والمانجا اللي كانت معاك هناك ترجع لك.', en: 'Back to the last checkpoint, with the mangoes you had there.' },
  ranks: [
    { ar: 'وصلت، وده الأهم. المرة الجاية المانجا كلها!', en: 'You made it, that\'s what counts. Next time, every mango!' },
    { ar: 'شغل محترم! شوية مانجا وقعت في السكة.', en: 'Solid work! A few mangoes fell along the way.' },
    { ar: 'جدع والله! ولا مانجاية وقعت.', en: 'Well done! Not a single mango lost.' },
  ],
};

export const HOWTO = [
  { k: 'الهدف', ar: 'وصّل قفص المانجا للمعدية قبل ما الشمس تغيب.', en: 'Get the mango crate to the ferry before sunset.' },
  { k: 'المانجا', ar: 'لو اتخبطت أو وقعت، المانجا بتقع من القفص. لِمّها بسرعة قبل ما تضيع!', en: 'Get hit or fall and mangoes spill. Grab them fast before they\'re gone!' },
  { k: 'الموبايل', ar: 'إبهامك الشمال في أي حتة = عصا التحريك (زقّها للآخر تجري)، واسحب على اليمين تلف الكاميرا. الأزرار: النبّوت، النط، الزحلقة/التفادي، والصدّ.', en: 'Left thumb anywhere is the stick (push it all the way to sprint), drag on the right to look. Buttons: staff, jump, slide/dodge, block.' },
  { k: 'الكيبورد', ar: 'WASD للمشي، الماوس للكاميرا (دوس على الصورة)، Shift جري، Space نط، J أو كليك نبّوت، K أو كليك يمين صدّ، Ctrl أو C زحلقة/تفادي، Q تثبيت على الخصم، Esc استراحة.', en: 'WASD move, mouse look (click the picture), Shift sprint, Space jump, J/click staff, K/right-click block, Ctrl/C slide or dodge, Q lock-on, Esc pause.' },
  { k: 'النجوم', ar: 'نجمة لـ١٠ مانجايات أو أكتر، نجمة لو وصلت والشمس لسه فاضل لها دقيقة، ونجمة لو كسبت خناقة الحارة من أول مرة.', en: 'One star each: 10+ mangoes, a minute of sun to spare, the alley fight won on the first try.' },
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function num(n) { return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]); }
export function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return num(m) + ':' + num(String(s).padStart(2, '0'));
}

// Arabic counted noun: 1 and 2 have their own forms, 3-10 take the plural, 11+ the singular.
export function mangoPhrase(n) {
  if (n === 0) return 'ولا مانجاية';
  if (n === 1) return 'مانجاية واحدة';
  if (n === 2) return 'مانجايتين';
  if (n <= 10) return num(n) + ' مانجايات';
  return num(n) + ' مانجاية';
}
