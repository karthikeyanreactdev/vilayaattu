import type { Locale } from "./locales";

export type TourCopy = {
  next: string;
  back: string;
  done: string;
  welcomeTitle: string;
  welcome: string;
  soundTitle: string;
  sound: string;
  createTitle: string;
  create: string;
  joinTitle: string;
  join: string;
  gameTitle: string;
  game: string;
  codeTitle: string;
  code: string;
  playersTitle: string;
  players: string;
  pickerTitle: string;
  picker: string;
  startTitle: string;
  start: string;
};

export const TOUR: Record<Locale, TourCopy> = {
  en: {
    next: "Next",
    back: "Back",
    done: "Done",
    welcomeTitle: "Choose a language",
    welcome: "English, Tamil, Hindi, Malayalam, Kannada and Telugu.",
    soundTitle: "Sound and vibration",
    sound: "Effects and vibration start on. Turn either off here.",
    createTitle: "Play with friends",
    create: "Create a room and send the code. You are the host.",
    joinTitle: "Join a room",
    join: "Already have a code? Type it here.",
    gameTitle: "Or start from a game",
    game: "Play vs friends opens a table. Play vs computer stays on this phone.",
    codeTitle: "Invite friends",
    code: "Copy the code, send the link, or open WhatsApp.",
    playersTitle: "Who is playing",
    players: "People show up as they join. The host can add a computer.",
    pickerTitle: "Pick the game",
    picker: "The host chooses. A game stays grey until enough people are here.",
    startTitle: "Start the game",
    start: "When everyone is in, the host taps Start.",
  },
  ta: {
    next: "அடுத்து",
    back: "பின்",
    done: "முடிந்தது",
    welcomeTitle: "மொழியைத் தேர்வு செய்",
    welcome: "ஆங்கிலம், தமிழ், இந்தி, மலையாளம், கன்னடம், தெலுங்கு.",
    soundTitle: "ஒலியும் அதிர்வும்",
    sound: "ஒலி விளைவும் அதிர்வும் ஆரம்பத்தில் இயக்கத்தில் இருக்கும்.",
    createTitle: "நண்பர்களுடன் ஆடு",
    create: "அறையை உருவாக்கி குறியீட்டை அனுப்புங்கள். நீங்களே host.",
    joinTitle: "அறையில் சேர்",
    join: "குறியீடு இருந்தால் இங்கே எழுதுங்கள்.",
    gameTitle: "ஆட்டத்திலிருந்து தொடங்கு",
    game: "நண்பர்களுடன் ஆடு ஒரு மேசையைத் திறக்கும். கணினியுடன் ஆடு இந்த போனில்.",
    codeTitle: "நண்பர்களை அழை",
    code: "குறியீட்டை நகலெடுங்கள், இணைப்பை அனுப்புங்கள், அல்லது WhatsApp.",
    playersTitle: "யார் விளையாடுகிறார்கள்",
    players: "சேரும்போது இங்கே தெரியும். Host கணினியையும் சேர்க்கலாம்.",
    pickerTitle: "ஆட்டத்தைத் தேர்வு செய்",
    picker: "Host தேர்ந்தெடுப்பார். பேர் போதவில்லை என்றால் ஆட்டம் சாம்பலாக இருக்கும்.",
    startTitle: "ஆட்டத்தைத் தொடங்கு",
    start: "எல்லோரும் வந்ததும் Host Start அழுத்துவார்.",
  },
  hi: {
    next: "आगे",
    back: "पीछे",
    done: "हो गया",
    welcomeTitle: "भाषा चुनें",
    welcome: "अंग्रेज़ी, तमिल, हिन्दी, मलयालम, कन्नड़ और तेलुगु।",
    soundTitle: "आवाज़ और वाइब्रेशन",
    sound: "इफ़ेक्ट और वाइब्रेशन शुरू में चालू रहते हैं।",
    createTitle: "दोस्तों से खेलें",
    create: "कमरा बनाएँ और कोड भेजें। आप होस्ट हैं।",
    joinTitle: "कमरे में जुड़ें",
    join: "कोड है? यहाँ लिखें।",
    gameTitle: "खेल से शुरू करें",
    game: "दोस्तों से खेलें टेबल खोलता है। कंप्यूटर से खेलें इसी फ़ोन पर रहता है।",
    codeTitle: "दोस्तों को बुलाएँ",
    code: "कोड कॉपी करें, लिंक भेजें, या WhatsApp खोलें।",
    playersTitle: "कौन खेल रहा है",
    players: "जुड़ते ही यहाँ दिखेंगे। होस्ट कंप्यूटर जोड़ सकता है।",
    pickerTitle: "खेल चुनें",
    picker: "होस्ट चुनता है। खिलाड़ी कम हों तो खेल धूसर रहता है।",
    startTitle: "खेल शुरू करें",
    start: "सब आ जाएँ, तो होस्ट Start दबाता है।",
  },
  ml: {
    next: "അടുത്തത്",
    back: "പിന്നിലേക്ക്",
    done: "കഴിഞ്ഞു",
    welcomeTitle: "ഭാഷ തിരഞ്ഞെടുക്കുക",
    welcome: "ഇംഗ്ലീഷ്, തമിഴ്, ഹിന്ദി, മലയാളം, കന്നഡ, തെലുങ്ക്.",
    soundTitle: "ശബ്ദവും വൈബ്രേഷനും",
    sound: "ഇഫക്റ്റും വൈബ്രേഷനും തുടക്കത്തിൽ ഓണാണ്.",
    createTitle: "കൂട്ടുകാരോട് കളി",
    create: "റൂം ഉണ്ടാക്കി കോഡ് അയയ്ക്കുക. നിങ്ങളാണ് ഹോസ്റ്റ്.",
    joinTitle: "റൂമിൽ ചേരുക",
    join: "കോഡ് ഉണ്ടെങ്കിൽ ഇവിടെ എഴുതുക.",
    gameTitle: "കളിയിൽ നിന്ന് തുടങ്ങുക",
    game: "കൂട്ടുകാരോട് കളി ഒരു ടേബിൾ തുറക്കും. കമ്പ്യൂട്ടറിനോട് കളി ഈ ഫോണിൽ.",
    codeTitle: "കൂട്ടുകാരെ വിളിക്കുക",
    code: "കോഡ് പകർത്തുക, ലിങ്ക് അയയ്ക്കുക, അല്ലെങ്കിൽ WhatsApp.",
    playersTitle: "ആരാണ് കളിക്കുന്നത്",
    players: "ചേരുമ്പോൾ ഇവിടെ കാണാം. ഹോസ്റ്റിന് കമ്പ്യൂട്ടറിനെ ചേർക്കാം.",
    pickerTitle: "കളി തിരഞ്ഞെടുക്കുക",
    picker: "ഹോസ്റ്റ് തിരഞ്ഞെടുക്കും. ആളുകൾ പോരെങ്കിൽ കളി ചാരനിറമാകും.",
    startTitle: "കളി തുടങ്ങുക",
    start: "എല്ലാവരും വന്നാൽ ഹോസ്റ്റ് Start അമർത്തും.",
  },
  kn: {
    next: "ಮುಂದೆ",
    back: "ಹಿಂದೆ",
    done: "ಆಯಿತು",
    welcomeTitle: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ",
    welcome: "ಇಂಗ್ಲಿಷ್, ತಮಿಳು, ಹಿಂದಿ, ಮಲಯಾಳಂ, ಕನ್ನಡ ಮತ್ತು ತೆಲುಗು.",
    soundTitle: "ಧ್ವನಿ ಮತ್ತು ಕಂಪನ",
    sound: "ಎಫೆಕ್ಟ್ ಮತ್ತು ಕಂಪನ ಆರಂಭದಲ್ಲಿ ಆನ್ ಇರುತ್ತವೆ.",
    createTitle: "ಸ್ನೇಹಿತರ ಜೊತೆ",
    create: "ರೂಮ್ ಮಾಡಿ ಕೋಡ್ ಕಳುಹಿಸಿ. ನೀವು ಹೋಸ್ಟ್.",
    joinTitle: "ರೂಮ್ ಸೇರಿ",
    join: "ಕೋಡ್ ಇದ್ದರೆ ಇಲ್ಲಿ ಬರೆಯಿರಿ.",
    gameTitle: "ಆಟದಿಂದ ಶುರು",
    game: "ಸ್ನೇಹಿತರ ಜೊತೆ ಟೇಬಲ್ ತೆರೆಯುತ್ತದೆ. ಕಂಪ್ಯೂಟರ್ ಜೊತೆ ಈ ಫೋನಿನಲ್ಲೇ.",
    codeTitle: "ಸ್ನೇಹಿತರನ್ನು ಕರೆಯಿರಿ",
    code: "ಕೋಡ್ ನಕಲಿಸಿ, ಲಿಂಕ್ ಕಳುಹಿಸಿ, ಅಥವಾ WhatsApp.",
    playersTitle: "ಯಾರು ಆಡುತ್ತಿದ್ದಾರೆ",
    players: "ಸೇರಿದಾಗ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತಾರೆ. ಹೋಸ್ಟ್ ಕಂಪ್ಯೂಟರ್ ಸೇರಿಸಬಹುದು.",
    pickerTitle: "ಆಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    picker: "ಹೋಸ್ಟ್ ಆಯ್ಕೆಮಾಡುತ್ತಾರೆ. ಜನ ಸಾಲದಿದ್ದರೆ ಆಟ ಬೂದು ಬಣ್ಣದಲ್ಲಿರುತ್ತದೆ.",
    startTitle: "ಆಟ ಶುರು",
    start: "ಎಲ್ಲರೂ ಬಂದ ಮೇಲೆ ಹೋಸ್ಟ್ Start ಒತ್ತುತ್ತಾರೆ.",
  },
  te: {
    next: "తర్వాత",
    back: "వెనక్కి",
    done: "అయింది",
    welcomeTitle: "భాష ఎంచుకోండి",
    welcome: "ఇంగ్లీష్, తమిళం, హిందీ, మలయాళం, కన్నడం, తెలుగు.",
    soundTitle: "శబ్దం మరియు వైబ్రేషన్",
    sound: "ఎఫెక్ట్స్ మరియు వైబ్రేషన్ మొదట్లో ఆన్‌లో ఉంటాయి.",
    createTitle: "స్నేహితులతో ఆడండి",
    create: "రూమ్ తెరిచి కోడ్ పంపండి. మీరు హోస్ట్.",
    joinTitle: "రూమ్‌లో చేరండి",
    join: "కోడ్ ఉంటే ఇక్కడ రాయండి.",
    gameTitle: "ఆట నుండి మొదలు",
    game: "స్నేహితులతో ఆడండి టేబుల్ తెరుస్తుంది. కంప్యూటర్‌తో ఆడండి ఈ ఫోన్‌లోనే.",
    codeTitle: "స్నేహితులను పిలవండి",
    code: "కోడ్ కాపీ చేయండి, లింక్ పంపండి, లేదా WhatsApp.",
    playersTitle: "ఎవరు ఆడుతున్నారు",
    players: "చేరగానే ఇక్కడ కనిపిస్తారు. హోస్ట్ కంప్యూటర్‌ను చేర్చవచ్చు.",
    pickerTitle: "ఆట ఎంచుకోండి",
    picker: "హోస్ట్ ఎంచుకుంటారు. మనుషులు చాలకపోతే ఆట బూడిద రంగులో ఉంటుంది.",
    startTitle: "ఆట మొదలు",
    start: "అందరూ వచ్చాక హోస్ట్ Start నొక్కుతారు.",
  },
};
