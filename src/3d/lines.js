// Every voiced line of the 3D mode. Egyptian colloquial Arabic (the hero, Radwan, with a light Saidi
// flavour; Cairenes speak Cairene) plus a short English subtitle. `tts` (optional) is the exact text sent to
// the voice model when it differs from the subtitle (audio tags in brackets are performance hints, not words).
// Round 3 pronunciation pass: words the model misread (found by transcribing every clip back) get full
// Egyptian diacritics in `tts` only, so the subtitle stays clean: الْمِعَدِّيَّة is el-me'ad-DEY-ya (round 2's j2
// came back as المعدة, "the stomach"), صَعيدي, نَبّوت, المِعْزة, ضَهْري, دِماغي, غَسيل, العَرَبِيَّة, وَلَد, المَغْرِب.
// Each id maps to assets/3d/voice/<id>.mp3.

export const CAST = {
  radwan: { ar: 'رضوان', en: 'Radwan', voice: 'erFJevGCT0rMZPhBbaep' },
  thief: { ar: 'الحرامي', en: 'The thief', voice: '5REPlS2Ja1VZ7zNA0ykn' },
  buddy: { ar: 'صاحب الحرامي', en: 'Thief\'s pal', voice: 'QvNF0qyyt1Tuy1YAmnzH' },
  driver: { ar: 'سوّاق الميكروباص', en: 'Microbus driver', voice: 'mXovlg4TtTSUsS5BeRYF' },
  tea: { ar: 'عم سيد، بيّاع الشاي', en: 'Uncle Sayed, tea seller', voice: 'LXrTqFIgiubkrMkwvOUr' },
  vendor: { ar: 'أم حسن، بيّاعة الفاكهة', en: 'Umm Hassan, fruit seller', voice: 'Vu9gRjkR23ZG8EWrSmnj' },
  kid: { ar: 'العيال', en: 'The kids', voice: '6aXW46RTUz6Y2lkBGQ1a' },
  toktok: { ar: 'سوّاق التوكتوك', en: 'Tok-tok driver', voice: 'ckGEQg6YnSVooU5uDRsF' },
  captain: { ar: 'الريّس عبده', en: 'Captain Abdo', voice: 'JTMaHm6sHVI3NZgPaWDz' },
  // Mission 2
  hajja: { ar: 'الحاجة نفيسة', en: 'Hajja Nefisa', voice: 'meAbY2VpJkt1q46qk56T' },
  umm: { ar: 'أم نادية', en: 'Umm Nadia', voice: 'Vu9gRjkR23ZG8EWrSmnj' },
  sika: { ar: 'سيكا', en: 'Sika', voice: 'ckGEQg6YnSVooU5uDRsF' },
  zaghloul: { ar: 'المعلم زغلول', en: 'Zaghloul', voice: 'IES4nrmZdUBHByLBde0P' },
};

export const LINES = {
  // ---- intro cutscene: the wrong microbus stand
  i1: { who: 'driver', ar: 'آخر الخط يا حاج! انزل، يلا يلا!', en: 'End of the line, Hajj! Off you get, come on!', tts: '[shouting] آخر الخط يا حاج! انزل، يلا يلا!' },
  i2: { who: 'radwan', ar: 'آخر الخط إزاي يا أسطى؟ ده ولا شبه الصورة خالص!', en: 'End of the line? This looks nothing like the photo!', tts: 'آخِر الخَطّ إزّاي يا أُسْطى؟ دَه وَلا شِبْه الصّورة خالِص!' },
  i3: { who: 'tea', ar: 'المعدية؟ دي في آخر إمبابة خالص يا حاج، على النيل. وآخر نقلة على المغرب.', en: 'The ferry? That\'s at the far end of Imbaba, on the Nile. Last crossing is at sunset.', tts: 'الْمِعَدِّيَّة؟ دي في آخِر إمْبابَة خالِص يا حاجّ، على النّيل. وآخِر نَقْلة على المَغْرِب.' },
  i4: { who: 'radwan', ar: 'والفرح الليلة! يعني المانجا دي لازم توصل قبل المغرب.', en: 'And the wedding is tonight! These mangoes have to get there before sunset.' },
  i5: { who: 'tea', ar: 'يبقى اجري من الشارع ده على طول، وخلّي بالك من التكاتك... وولاد الحرام.', en: 'Then run straight down this street, mind the tok-toks... and the crooks.' },
  i6: { who: 'radwan', ar: 'اتناشر مانجاية من جنينة أبوي، وكلهم هيوصلوا. يلا بينا!', en: 'Twelve mangoes from my father\'s orchard, and every one will make it. Let\'s go!' },

  // ---- the street
  s1: { who: 'driver', ar: 'وسّع يا حاج! بيب بيب!', en: 'Make way, Hajj! Beep beep!', tts: '[shouting] وسّع يا حاج! بيب بيب!' },
  s2: { who: 'driver', ar: 'إنت ماشي في نص الشارع ليه يا عم!', en: 'Why are you walking in the middle of the road!', tts: '[annoyed] إنت ماشي في نص الشارع ليه يا عم!' },
  s3: { who: 'kid', ar: 'الكورة يا عمو! باصيها!', en: 'The ball, uncle! Pass it!', tts: '[excited] الكورة يا عمو! باصيها!' },
  s4: { who: 'kid', ar: 'جوووون! عمو لعّيب!', en: 'Goooal! Uncle can play!', tts: '[excited] جوووون! عمو لعّيب!' },
  s5: { who: 'radwan', ar: 'يا ناس! غسيل مين ده اللي في نص الشارع؟', en: 'People! Whose laundry is this in the middle of the street?', tts: 'يا ناس! غَسيل مين دَه اللي في نُصّ الشّارِع؟' },
  r1: { who: 'radwan', ar: 'هوبّا! زي الريشة!', en: 'Hup! Light as a feather!' },
  r2: { who: 'radwan', ar: 'ولا يهمّك!', en: 'No problem!', tts: 'وَلا يِهِمَّك!' },
  r3: { who: 'radwan', ar: 'آه يا ضهري... يا ساتر!', en: 'Oof, my back... good grief!', tts: 'آه يا ضَهْري... يا ساتِر!' },
  r4: { who: 'radwan', ar: 'المانجا! حاسب على المانجا!', en: 'The mangoes! Mind the mangoes!', tts: '[shouting] المانجا! حاسب على المانجا!' },
  r5: { who: 'radwan', ar: 'لا مؤاخذة يا جماعة! عدّوني!', en: 'Sorry, folks! Let me through!', tts: '[out of breath] لا مُؤاخْذة يا جَماعة! عَدّوني!' },

  // ---- the snatch and the foot chase
  m1: { who: 'vendor', ar: 'مانجا صعيدي؟ يا حلاوتها يا حاج!', en: 'Mangoes from the South? Beautiful, Hajj!', tts: 'مانْجا صَعيدي؟ يا حَلاوِتْها يا حاجّ!' },
  m2: { who: 'thief', ar: 'شكرًا يا حاج! المانجا دي بتاعتي دلوقتي!', en: 'Thanks, Hajj! These mangoes are mine now!', tts: '[laughs] شكرًا يا حاج! المانجا دي بتاعتي دلوقتي!' },
  m3: { who: 'radwan', ar: 'يا حرامي! استنى عندك!', en: 'Thief! Stop right there!', tts: '[shouting] يا حرامي! استنى عندك!' },
  m4: { who: 'vendor', ar: 'إلحقه يا حاج! جري جوّه السوق!', en: 'Get him, Hajj! He ran into the market!' },
  c1: { who: 'thief', ar: 'مش هتلحقني يا عم الحاج!', en: 'You\'ll never catch me, old man!', tts: '[mischievously] مش هتلحقني يا عم الحاج!' },
  c2: { who: 'thief', ar: 'آه! خلاص خلاص، خد واحدة!', en: 'Ow! Fine, fine, have one back!', tts: '[pained] آه! خلاص خلاص، خد واحدة!' },
  c3: { who: 'thief', ar: 'وسّعوا! وسّعوا!', en: 'Out of the way! Move!', tts: '[shouting] وسّعوا! وسّعوا!' },
  c4: { who: 'radwan', ar: 'رجّع المانجا يا ولد!', en: 'Give back the mangoes, boy!', tts: '[shouting] رَجَّع المانْجا يا وَلَد!' },
  c6: { who: 'thief', ar: 'حرامي! حرامي! الحقوا الراجل ده!', en: 'Thief! Thief! Stop that man!', tts: '[shouting] حَرامي! حَرامي! اِلْحَقوا الرّاجِل دَه!' },
  c5: { who: 'radwan', ar: 'لا مؤاخذة يا ستّ المعزة، عدّيني بس!', en: 'Pardon me, madam goat, just let me through!', tts: 'لا مُؤاخْذة يا سِتّ المِعْزة، عَدّيني بَسّ!' },

  // ---- the tok-tok chase
  t1: { who: 'thief', ar: 'سلام يا عم الحاج! سلّم لي على الفرح!', en: 'Bye, old man! Say hi to the wedding for me!', tts: '[laughs] سلام يا عم الحاج! سلّم لي على الفرح!' },
  t2: { who: 'radwan', ar: 'اطلع ورا التوك توك ده بسرعة يا ابني!', en: 'Follow that tok-tok, quick, son!' },
  t3: { who: 'toktok', ar: 'إنت اللي هتسوق يا حاج؟ طب امسك جامد... الفرامل مش أوي!', en: 'You\'re driving, Hajj? Hold on tight then... the brakes aren\'t great!' },
  t4: { who: 'radwan', ar: 'خد دي!', en: 'Take that!', tts: '[shouting] خد دي!' },
  t5: { who: 'thief', ar: 'يا عم بالراحة! التوكتوك مش بتاعي!', en: 'Easy, man! It\'s not even my tok-tok!', tts: '[panicked] يا عم بالراحة! التوكتوك مش بتاعي!' },
  t6: { who: 'toktok', ar: 'التوكتوك يا حاج! ده لسه مقسّط!', en: 'The tok-tok, Hajj! I\'m still paying for it!', tts: '[panicked] التوكتوك يا حاج! ده لسه مقسّط!' },
  t7: { who: 'thief', ar: 'يا نهار أبيض! العربية!', en: 'Oh no! The cart!', tts: '[shouting] يا نَهار أَبْيَض! العَرَبِيَّة!' },

  // ---- the alley fight
  f1: { who: 'thief', ar: 'إنت تاني؟ يا رجالة! الراجل ده مش ناوي يسيبنا!', en: 'You again? Guys! This man won\'t leave us alone!', tts: '[shouting] إنت تاني؟ يا رجالة! الراجل ده مش ناوي يسيبنا!' },
  f2: { who: 'buddy', ar: 'سيبهولنا يا معلّم، إحنا هنعلّمه الأدب.', en: 'Leave him to us, boss. We\'ll teach him some manners.' },
  f3: { who: 'radwan', ar: 'رجّعوا المانجا، وكل واحد يروح لحاله.', en: 'Give back the mangoes, and we all go our own way.' },
  f4: { who: 'radwan', ar: 'اتعلّم الأدب!', en: 'Learn some manners!', tts: '[shouting] اتعلّم الأدب!' },
  f5: { who: 'radwan', ar: 'ده نبّوت أبويا يا ابني، مش لعبة!', en: 'This is my father\'s staff, son, not a toy!', tts: 'دَه نَبّوتْ أَبويا يا ابْني، مِش لِعْبة!' },
  f6: { who: 'buddy', ar: 'آه يا دماغي!', en: 'Ow, my head!', tts: '[pained] آه يا دِماغي!' },
  f7: { who: 'buddy', ar: 'امسكه! امسكه من ورا!', en: 'Grab him! From behind!', tts: '[shouting] امسكه! امسكه من ورا!' },
  f8: { who: 'thief', ar: 'خلاص يا حاج، إحنا آسفين! خد المانجا وروّح.', en: 'Enough, Hajj, we\'re sorry! Take the mangoes and go.', tts: '[out of breath] خلاص يا حاج، إحنا آسفين! خد المانجا وروّح.' },
  f10: { who: 'buddy', ar: 'استلقى وعدك يا عم!', en: 'Here\'s what\'s coming to you!', tts: '[shouting] اِسْتَلَقّى وَعْدَك يا عَمّ!' },
  f9: { who: 'radwan', ar: 'ربنا يهديكم. الشغل الحلال أحلى.', en: 'May God guide you. Honest work tastes sweeter.' },

  // ---- the rooftops
  u1: { who: 'radwan', ar: 'السطوح أقصر سكة للنيل... يا رب سترك.', en: 'The rooftops are the shortest way to the Nile... Lord, keep me safe.' },
  u2: { who: 'radwan', ar: 'الحمامة البيضا دي ناوية على حاجة... بعدين نتحاسب.', en: 'That white pigeon is up to something... we\'ll settle it later.' },
  u3: { who: 'radwan', ar: 'يا ساتر يا رب!', en: 'Lord, protect us!', tts: '[shouting] يا ساتر يا رب!' },
  u4: { who: 'radwan', ar: 'يا خبر! الحتة دي بتقع!', en: 'Oh no! This bit is giving way!', tts: '[shouting] يا خَبَر! الحِتّة دي بِتُقَع!' },
  u5: { who: 'radwan', ar: 'الله! شوية مية ساقعة... ربنا يكرم اللي سابها هنا.', en: 'Ah! Some cold water... God bless whoever left it here.', tts: 'اللَّه! شُوَيَّة مَيَّة سَاقْعَة... رَبِّنا يِكْرِم اللي سابْها هِنا.' },

  // ---- the jetty and the finale
  j1: { who: 'captain', ar: 'يلا يا حاج! آخر نقلة قبل المغرب!', en: 'Come on, Hajj! Last crossing before sunset!', tts: '[shouting] يَلّا يا حاجّ! آخِر نَقْلة قَبْل المَغْرِب!' },
  j2: { who: 'captain', ar: 'يلا يا حاج! اجري ونُط على المعدية!', en: 'Come on, Hajj! Run and jump onto the ferry!', tts: '[shouting] يَلّا يا حاجّ! اِجْري ونُطّ على الْمِعَدِّيَّة!' },
  j3: { who: 'captain', ar: 'لحقتها يا بطل! ده إنت أسرع من المعدية نفسها!', en: 'You made it, champ! You\'re faster than the ferry itself!', tts: '[laughs] لِحِقْتَها يا بَطَل! دَه إنْتَ أَسْرَع مِن الْمِعَدِّيَّة نَفْسَها!' },
  j4: { who: 'radwan', ar: 'الحمد لله... المانجا وصلت كاملة. يلا على الفرح!', en: 'Thank God... every mango made it. On to the wedding!' },
  j5: { who: 'radwan', ar: 'الحمد لله، وصلنا. والعريس هيسامحنا على اللي ناقص.', en: 'Thank God, we made it. The groom will forgive us the missing ones.' },
  j6: { who: 'captain', ar: 'بس خلّي بالك يا حاج... الحمامة البيضا دي واقفة على المعدية من الصبح.', en: 'But watch out, Hajj... that white pigeon has been sitting on the ferry since this morning.', tts: 'بَسّ خَلّي بالَك يا حاجّ... الحَمامة البيْضا دي واقْفة على الْمِعَدِّيَّة مِن الصُّبْح.' },
  x1: { who: 'radwan', ar: 'هرب مني... لا، مش هسيبه!', en: 'He got away... no, I won\'t let him!' },
  // ==== Mission 2, "The Runaway Pigeon" (m: 2 = fetched only for that mission). Sukkara is the white pigeon
  // that followed Radwan onto the ferry at the end of Mission 1; Hajja Nefisa keeps her in the tower on her roof.
  p1: { m: 2, who: 'hajja', ar: 'رجعت يا رضوان؟ طمّني، جناح سُكّرة خفّ؟', en: 'You\'re back, Radwan? Tell me, has Sukkara\'s wing healed?', tts: 'رِجِعْت يا رَضْوان؟ طَمِّنّي، جَناح سُكَّرَة خَفّ؟' },
  p2: { m: 2, who: 'radwan', ar: 'زي الفل يا حاجة. الحمامة اللي نطّت ورايا على المعدية بقت أغلى حاجة عندي.', en: 'Good as new, Hajja. The pigeon that followed me onto the ferry is now the dearest thing I own.', tts: 'زَيّ الفُلّ يا حاجَّة. الحَمامَة اللي نَطِّت وَرايا عَلى الْمِعَدِّيَّة بَقِت أَغْلى حاجَة عَنْدي.' },
  p3: { m: 2, who: 'zaghloul', ar: 'يا سلام! حمامة بيضا زي القشطة... تعالي يا جميلة!', en: 'Well now! A white pigeon like cream... come here, beautiful!', tts: '[calling out] يا سَلام! حَمامَة بيضا زَيّ القِشْطَة... تَعالي يا جَميلَة!' },
  p4: { m: 2, who: 'kid', ar: 'عمو! الحمامة طارت!', en: 'Uncle! The pigeon flew off!', tts: '[shouting] عَمُّو! الحَمامَة طارِت!' },
  p5: { m: 2, who: 'hajja', ar: 'برجها على سطح بيتي آخر الشارع... الحقها قبل ما زغلول ياخدها!', en: 'Her tower is on my roof at the end of the street... catch her before Zaghloul takes her!', tts: '[urgent] بُرْجَها عَلى سَطْح بيتي آخِر الشّارِع... اِلْحَقْها قَبْل ما زَغْلول ياخُدْها!' },
  p6: { m: 2, who: 'radwan', ar: 'سُكّرة! استني يا بت! ...ولا يهمّك يا حاجة، أنا جايبها.', en: 'Sukkara! Wait, girl! ...Don\'t worry, Hajja, I\'ll bring her back.', tts: '[shouting] سُكَّرَة! اِسْتَنّي يا بِتّ! ...وَلا يِهِمِّك يا حاجَّة، أَنا جايِبْها.' },
  q1: { m: 2, who: 'radwan', ar: 'استني يا سُكّرة!', en: 'Wait, Sukkara!', tts: '[shouting] اِسْتَنّي يا سُكَّرَة!' },
  q2: { m: 2, who: 'radwan', ar: 'ارجعي هنا يا بت!', en: 'Come back here, girl!', tts: '[shouting] اِرْجَعي هِنا يا بِتّ!' },
  q3: { m: 2, who: 'zaghloul', ar: 'تعالي يا حلوة، تعالي على برجي!', en: 'Come, pretty one, come to my tower!', tts: 'تَعالي يا حِلْوَة، تَعالي عَلى بُرْجي!' },
  q4: { m: 2, who: 'radwan', ar: 'يا سُكّرة! هنا! هنا!', en: 'Sukkara! Here! Over here!', tts: '[shouting] يا سُكَّرَة! هِنا! هِنا!' },
  n1: { m: 2, who: 'umm', ar: 'الحق يا جدع! سبت الغسيل هيقع!', en: 'Quick, lad! The laundry basket is falling!', tts: '[shouting] اِلْحَق يا جَدَع! سَبَت الغَسيل هَيُقَع!' },
  n2: { m: 2, who: 'umm', ar: 'تسلم إيدك يا ابني! ادخل من باب السطح، أقصر لك.', en: 'Bless your hands, son! Go through the roof door, it\'s shorter.', tts: 'تِسْلَم إيدَك يا اِبْني! اُدْخُل مِن باب السَّطْح، أَقْصَر لَك.' },
  n3: { m: 2, who: 'umm', ar: 'يا خبر! الغسيل كله اتبهدل... معلش يا ابني، اطلع من فوق.', en: 'Oh no! The washing\'s all ruined... never mind, son, go over the top.', tts: 'يا خَبَر! الغَسيل كُلُّه اِتْبَهْدِل... مَعْلِش يا اِبْني، اِطْلَع مِن فوق.' },
  k1: { m: 2, who: 'sika', ar: 'اثبتي يا حلوة... الشبكة جاية أهي!', en: 'Hold still, pretty... here comes the net!', tts: '[sneaky] اُثْبُتي يا حِلْوَة... الشَّبَكَة جايَّة أَهي!' },
  k2: { m: 2, who: 'radwan', ar: 'سيب الحمامة يا ولد!', en: 'Leave the pigeon alone, boy!', tts: '[shouting] سيب الحَمامَة يا وَلَد!' },
  k3: { m: 2, who: 'sika', ar: 'خلاص خلاص! أنا ماشي... بس أبويا مش هيسكت!', en: 'Okay, okay! I\'m going... but my dad won\'t let this go!', tts: '[panicked] خَلاص خَلاص! أَنا ماشي... بَسّ أَبويا مِش هَيِسْكُت!' },
  k4: { m: 2, who: 'sika', ar: 'طارت! جري بقى يا عم!', en: 'She\'s off! Better run, mister!', tts: '[laughs] طارِت! جَرْي بَقى يا عَمّ!' },
  d1: { m: 2, who: 'radwan', ar: 'يا ساتر! الكلب ده بتاع مين؟', en: 'Good grief! Whose dog is this?', tts: '[shouting] يا ساتِر! الكَلْب دَه بِتاع مين؟' },
  g1: { m: 2, who: 'kid', ar: 'عمو! الأنبوبة تقيلة أوي... وستّي مستنياها فوق عشان العشا!', en: 'Uncle! The gas cylinder is so heavy... and Grandma needs it upstairs for dinner!', tts: 'عَمُّو! الأَنْبوبَة تِقيلَة أَوي... وسِتّي مِسْتَنِّياها فوق عَشان العَشا!' },
  g2: { m: 2, who: 'kid', ar: 'شكرًا يا عمو! خد الدرة دي لسُكّرة، والسلم ده يطلّعك البرج على طول!', en: 'Thanks, uncle! Take this corn for Sukkara, and this ladder gets you up the tower!', tts: '[happy] شُكْرًا يا عَمُّو! خُد الدُّرَة دي لِسُكَّرَة، والسِّلِّم دَه يِطَلَّعَك البُرْج عَلى طول!' },
  f21: { m: 2, who: 'radwan', ar: 'تعالي يا سُكّرة... تعالي، ده بيتك.', en: 'Come, Sukkara... come on, this is your home.', tts: 'تَعالي يا سُكَّرَة... تَعالي، دَه بيتِك.' },
  z1: { m: 2, who: 'zaghloul', ar: 'تعالي هنا يا جميلة! عندي درة أحلى!', en: 'Over here, beautiful! I\'ve got sweeter corn!', tts: '[calling out] تَعالي هِنا يا جَميلَة! عَنْدي دُرَة أَحْلى!' },
  e1: { m: 2, who: 'hajja', ar: 'رجعت لبرجها! تسلم يا رضوان، يا ابن الأصول.', en: 'She\'s back in her tower! Bless you, Radwan, you good soul.', tts: '[happy] رِجْعِت لِبُرْجَها! تِسْلَم يا رَضْوان، يا اِبْن الأُصول.' },
  e2: { m: 2, who: 'radwan', ar: 'والمرة الجاية يا معلم زغلول، صفّر لحمامك انت.', en: 'And next time, Zaghloul, whistle for your own pigeons.', tts: 'والمَرَّة الجايَّة يا مِعَلِّم زَغْلول، صَفَّر لِحَمامَك اِنْتَ.' },
  e3: { m: 2, who: 'zaghloul', ar: 'ماشي يا عم... بس الحمامة دي ذوقها عالي!', en: 'Fine, fine... but that pigeon has fine taste!', tts: '[laughs] ماشي يا عَمّ... بَسّ الحَمامَة دي ذوقْها عالي!' },
  x3: { m: 2, who: 'radwan', ar: 'راحت على برج زغلول... لأ، مش هسيبها!', en: 'She went to Zaghloul\'s tower... no, I won\'t give her up!', tts: 'راحِت عَلى بُرْج زَغْلول... لأ، مِش هَسيبْها!' },
  x2: { who: 'radwan', ar: 'راح فين ده؟ ضاع مني في الزحمة!', en: 'Where did he go? I lost him in the crowd!', tts: 'راح فين دَه؟ ضاع مِنّي في الزَّحْمة!' },
};
