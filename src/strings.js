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
  { k: 'النجوم', ar: 'نجمة لو وصّلت الاتناشر مانجاية كلهم، نجمة لو وصلت والشمس لسه فاضل لها دقيقة، ونجمة لو كسبت خناقة الحارة من أول مرة ومن غير ما تخسر أكتر من قلب.', en: 'One star each: all 12 mangoes delivered, a minute of sun to spare, the alley fight won first try losing at most one heart.' },
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function num(n) { return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]); }
export function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return num(m) + ':' + num(String(s).padStart(2, '0'));
}
