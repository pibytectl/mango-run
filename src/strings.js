// Menu and how-to text: Egyptian colloquial Arabic first, a short English subtitle second. (The 3D mission's
// voiced lines are in src/3d/lines.js, its HUD and hint texts in src/3d/game3d.js.)
// The hero (Radwan) speaks with a light, warm Saidi flavour; Cairenes speak Cairene.
// The joke is the situation, never the hero or where he comes from.

export const UI = {
  soundOn: 'الصوت: شغّال', soundOff: 'الصوت: مقفول',
  subsOn: 'ترجمة EN: شغّالة', subsOff: 'ترجمة EN: مقفولة',
};

export const HOWTO = [
  { k: 'الهدف', ar: 'وصّل قفص المانجا للمعدية قبل ما الشمس تغيب.', en: 'Get the mango crate to the ferry before sunset.' },
  { k: 'المانجا', ar: 'لو اتخبطت أو وقعت، المانجا بتقع من القفص. لِمّها بسرعة قبل ما تضيع!', en: 'Get hit or fall and mangoes spill. Grab them fast before they\'re gone!' },
  { k: 'الموبايل', ar: 'إبهامك الشمال في أي حتة = عصا التحريك (زقّها للآخر تجري)، واسحب على اليمين تلف الكاميرا. الأزرار: النبّوت، النط، الزحلقة/التفادي، والصدّ.', en: 'Left thumb anywhere is the stick (push it all the way to sprint), drag on the right to look. Buttons: staff, jump, slide/dodge, block.' },
  { k: 'الكيبورد', ar: 'WASD للمشي، الماوس للكاميرا (دوس على الصورة)، Shift جري، Space نط، J أو كليك نبّوت، K أو كليك يمين صدّ، Ctrl أو C زحلقة/تفادي، Q تثبيت على الخصم، Esc استراحة.', en: 'WASD move, mouse look (click the picture), Shift sprint, Space jump, J/click staff, K/right-click block, Ctrl/C slide or dodge, Q lock-on, Esc pause.' },
  { k: 'الشمس', ar: 'كل مرحلة تخلّصها من غير ما تخسر قلب ولا مانجاية بترجّع لك ٧ ثواني شمس (٤ في المهمة ٢). كل إعادة بتاخد منك ١٠ ثواني (٨ في المهمة ٢). والقلوب مش بترجع لوحدها: فيه قُلّة مية واحدة بس على السطوح.', en: 'Each section cleared without losing a heart or a mango gives back 7 s of sun (4 in Mission 2); each retry costs 10 s (8 in Mission 2). Hearts do not come back on their own: there is one water jug, on the rooftops.' },
  { k: 'المهمة ٢', ar: 'خليك ورا سُكّرة: لو استنتك كتير هتطير لبرج زغلول. لما زغلول يصفّر، نادي عليها بزرار النبّوت. ساعد الجيران تلاقي سكك أقصر ودرة، وفي الآخر اطلع فوق برجها ونادي عليها لما تبص لك (مش وزغلول بيصفّر).', en: 'Mission 2: stay on Sukkara; keep her waiting too long and she flies to Zaghloul\'s tower. When he whistles, call her with the staff button. Helping the neighbours opens shortcuts and gives corn. At the end, climb her tower and call her when she looks at you (never while Zaghloul whistles).' },
  { k: 'المهمة ٣', ar: 'أسبوع في كشك عمك: خمس أيام، ولكل يوم وقته. زرار النبّوت هو زرار الشغل: جنب لون حاجة تاخدها، وعند الشبّاك تديها للزبون. شايل أنبوبة؟ مفيش جري ولا نط (والزرار ينزّلها). الاحترام بيتجمع طول الأسبوع.', en: 'Mission 3: a week at your uncle\'s kiosk, five days, each with its own clock. The staff button is the work button: by a colour it takes that item, at the counter it hands it over. Carrying a cylinder: no sprint, no jump (the button sets it down). Respect adds up over the week.' },
  { k: 'النجوم', ar: 'نجمة لو وصّلت الاتناشر مانجاية كلهم، نجمة لو وصلت والشمس لسه فاضل لها دقيقة وربع، ونجمة لو خلّصت المشوار كله من غير ولا إعادة ومن غير ما تخسر أكتر من قلب.', en: 'One star each: all 12 mangoes delivered, a minute and a quarter of sun to spare, the whole run without a retry losing at most one heart.' },
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function num(n) { return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]); }
export function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return num(m) + ':' + num(String(s).padStart(2, '0'));
}
