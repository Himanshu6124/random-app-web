// Content for the static SEO pages (/how-it-works, /talk-to-strangers, ...).
// vite-plugin-seo.js turns each entry into a plain HTML page at build time (and serves it
// in dev), so search engines get real text without running the app.
//
// Section blocks: { heading, paragraphs?: string[], list?: string[], steps?: {title, body}[] }
// Only describe features the app actually has (see PRODUCT.md "Evidence on Hand").

import { STEPS, SAFETY, FAQ } from './landingContent.js';

/** Extra questions shown only on /faq (the landing page shows FAQ.items). */
const MORE_FAQ = [
  {
    question: 'Is there video chat?',
    answer:
      'No. RandomChatly is text-first: you never have to turn on a camera. Words come first, which keeps chats calmer and more private.',
  },
  {
    question: 'What can guests do, and what needs a Google account?',
    answer:
      'Guests can start random chats right away with just a name. Adding friends, private messages with friends, and the Discover tab need a Google account. You can link one in the middle of a chat without losing it.',
  },
  {
    question: 'What happens when I tap Next Stranger?',
    answer: 'Your current chat ends and RandomChatly looks for someone new who is online now.',
  },
  {
    question: 'Can I install RandomChatly like an app?',
    answer:
      'Yes. Open RandomChatly in your phone browser and add it to your home screen. It opens full screen like a regular app.',
  },
  {
    question: 'How do I block or report someone?',
    answer:
      'Use the block button in the chat to end it right away. Signed-in users can also report someone from their match history; they are not told who reported them.',
  },
];

MORE_FAQ.push(
  {
    question: 'Who can use RandomChatly?',
    answer: 'RandomChatly is only for adults aged 18 or older. If you see someone who seems underage, report them and we will remove them.',
  },
  {
    question: 'Am I always talking to a real person?',
    answer:
      'Not always. When nobody is free to match with you, RandomChatly may connect you with an automated chat partner so you are not left waiting. Real people are always matched first.',
  }
);

export const ALL_FAQ = [...FAQ.items, ...MORE_FAQ];

/** Contact address shown on the legal pages. */
export const CONTACT_EMAIL = 'randomchat.startup@gmail.com';
const LEGAL_UPDATED = 'November 19, 2026';

export const SEO_PAGES = [
  {
    slug: 'how-it-works',
    navLabel: 'How it works',
    title: 'How RandomChatly Works: Random Chat in 3 Steps',
    description:
      'Start a random chat in seconds: continue as a guest or with Google, get matched one-on-one, and keep the people you click with as friends.',
    h1: 'How random chat works on RandomChatly',
    intro:
      'RandomChatly matches you with one random stranger for a private, real-time text chat. Here is everything from your first hello to your first friend.',
    sections: [
      { heading: 'Three steps to your first chat', steps: STEPS.items },
      {
        heading: 'Guest or Google account?',
        list: [
          'Guest: enter with just a name and start chatting in seconds. No email needed.',
          'Google account: claim a username, add a photo and bio, add friends, and keep your chats.',
          'Started as a guest? You can link a Google account in the middle of a chat without losing anything.',
        ],
      },
      {
        heading: 'Inside a chat',
        list: [
          'You talk one-on-one with a single person, never a crowded room.',
          'Typing indicators and "Seen" receipts show when the other person is there.',
          'Stuck for words? Tap an icebreaker for a conversation starter.',
          'Tap Next Stranger whenever you want to meet someone else.',
        ],
      },
      {
        heading: 'After the chat',
        paragraphs: [
          'Friends can message each other anytime, send a wave to say hi, and look back at everyone they have met. With location sharing turned on, you can also see friends nearby, shown only as a rounded area.',
        ],
      },
    ],
  },
  {
    slug: 'talk-to-strangers',
    navLabel: 'Talk to strangers',
    title: 'Talk to Strangers Online: Free Text Chat',
    description:
      'Talk to strangers online in a free, anonymous one-on-one text chat. No signup needed, and if you click with someone you can keep them as a friend.',
    h1: 'Talk to strangers online, and maybe make a friend',
    intro:
      'Some nights you just want someone new to talk to. RandomChatly connects you with one stranger who is online now, in a private text chat that starts in seconds.',
    sections: [
      {
        heading: 'Why talk to a stranger?',
        paragraphs: [
          'A stranger has no history with you and no expectations. That makes it easier to be honest, try a new topic, or just pass the time with someone who is also awake and wants to talk.',
          'And sometimes a random chat turns into someone you want to keep talking to. RandomChatly is built for that moment: send a friend request and the conversation can continue tomorrow.',
        ],
      },
      {
        heading: 'How to start a good conversation',
        list: [
          'Open with a question, not just "hi". An icebreaker prompt helps if you are stuck.',
          'Ask about something they enjoy: music, food, a show, their city.',
          'Share a little about yourself too, without personal details.',
          'If the chat is not going anywhere, it is fine to tap Next Stranger.',
        ],
      },
      {
        heading: 'Stay comfortable',
        paragraphs: [
          'Strangers never see your location, and you choose what to share. If someone makes you uncomfortable, block them to end the chat right away.',
        ],
      },
    ],
  },
  {
    slug: 'anonymous-chat',
    navLabel: 'Anonymous chat',
    title: 'Anonymous Chat with Strangers, No Signup',
    description:
      'Chat anonymously with strangers on RandomChatly. Guests need no email, you choose your display name, and strangers never see your location.',
    h1: 'Anonymous chat with strangers',
    intro:
      'On RandomChatly you decide who you are in a chat. Start without an email, pick a display name, and share only what you want to share.',
    sections: [
      {
        heading: 'What stays private',
        list: [
          'Guests do not need an email address or a password.',
          'You choose your display name.',
          'Strangers never see your location.',
          'Friends only see a rounded area, never your exact spot, and only if you choose to share it.',
        ],
      },
      {
        heading: 'Anonymous does not mean anything goes',
        paragraphs: [
          'You can block anyone to end a chat right away, and signed-in users can report someone from their match history. The person is not told who reported them.',
        ],
      },
      {
        heading: 'When you want to stay in touch',
        paragraphs: [
          'Anonymity is the starting point, not a wall. If you click with someone, sign in with Google and send a friend request. You still control what you share on your profile.',
        ],
      },
    ],
  },
  {
    slug: 'omegle-alternative',
    navLabel: 'Omegle alternative',
    title: 'Omegle Alternative: Text-First Random Chat',
    description:
      'Looking for an Omegle alternative? RandomChatly is free, text-first random chat: one-on-one with strangers, no webcam, and a way to keep new friends.',
    h1: 'A text-first Omegle alternative',
    intro:
      'Omegle shut down in November 2023. If you miss meeting someone new at random, RandomChatly keeps that feeling and leaves the webcam out.',
    sections: [
      {
        heading: 'What feels familiar',
        list: [
          'One click to meet a random stranger who is online now.',
          'One-on-one chats, not group rooms.',
          'No account needed to start.',
        ],
      },
      {
        heading: 'What is different',
        list: [
          'Text only: no camera, so chats stay calmer and more private.',
          'Friend requests: a good chat does not have to end when you close the tab.',
          'Location privacy: strangers never see where you are.',
          'Block and report tools built into the app.',
        ],
      },
      {
        heading: 'Is it right for you?',
        paragraphs: [
          'If you want video chat, RandomChatly is not it. If you want real conversations with new people, and a chance that one of them becomes a friend, give it a try.',
        ],
      },
    ],
  },
  {
    slug: 'safety',
    navLabel: 'Safety',
    title: 'Random Chat Safety Tips',
    description:
      'How to stay safe when you chat with strangers: keep personal details private, use block and report, and take your time before trusting someone.',
    h1: 'Safety tips for random chat',
    intro:
      'Most random chats are friendly. These habits keep the rest from becoming a problem.',
    sections: [
      { heading: 'Built into RandomChatly', steps: SAFETY.items },
      {
        heading: 'Good habits when you talk to strangers',
        list: [
          'Do not share your full name, phone number, address, school or workplace with someone you just met.',
          'Never send money or gift cards to someone you met online, whatever the story.',
          'Be careful when someone pushes you to move to another app quickly.',
          'If a chat makes you uncomfortable, leave. You do not owe anyone an explanation.',
          'If you decide to meet a friend in person, choose a public place and tell someone you trust.',
        ],
      },
    ],
  },
  {
    slug: 'faq',
    navLabel: 'FAQ',
    title: 'Random Chat FAQ: Questions About RandomChatly',
    description:
      'Answers about RandomChatly: is it free, do you need an account, is it anonymous, how friend requests work, and how to block or report someone.',
    h1: 'Random chat FAQ',
    intro: 'Quick answers about chatting with strangers on RandomChatly.',
    faq: ALL_FAQ,
    sections: [],
  },

  {
    slug: 'terms',
    navLabel: 'Terms',
    title: 'Terms of Service',
    description:
      'The rules for using RandomChatly: you must be 18 or older, treat people with respect, and follow these terms. Read what we allow and what we remove.',
    h1: 'Terms of Service',
    intro: `Last updated ${LEGAL_UPDATED}. By using RandomChatly you agree to these terms. If you do not agree, please do not use the service.`,
    sections: [
      {
        heading: 'Who can use RandomChatly',
        list: [
          'You must be at least 18 years old. RandomChatly is not for children or teenagers.',
          'By starting a chat, as a guest or with Google, you confirm that you are 18 or older.',
          'We remove accounts that we believe belong to someone under 18.',
        ],
      },
      {
        heading: 'What RandomChatly is',
        paragraphs: [
          'RandomChatly matches you with a random person for a one-on-one text chat, and lets you keep the people you click with as friends. The service is free and provided "as is". We may change, pause or stop features at any time.',
          'When nobody is free to match with you, you may be connected with an automated chat partner (a bot) instead of a real person. Real people are always matched first.',
        ],
      },
      {
        heading: 'Rules you agree to follow',
        list: [
          'Be respectful. No harassment, threats, hate speech or bullying.',
          'No sexual content involving anyone under 18, ever. We report it to the authorities.',
          'No sending sexual content to people who did not ask for it.',
          'No spam, scams, advertising, or asking people for money.',
          'No sharing other people’s private information without their permission.',
          'No pretending to be someone else, and no use of the service for anything illegal.',
          'No attempts to break, overload, scrape or get around the security of the service.',
        ],
      },
      {
        heading: 'Your content',
        paragraphs: [
          'You are responsible for what you send. You keep ownership of your messages, photos and voice notes, and you give us permission to store and deliver them so the service works.',
          'Other people are strangers. We do not check who they are, and we are not responsible for what they say or do. Use block and report whenever something feels wrong.',
        ],
      },
      {
        heading: 'Blocking, reports and removal',
        paragraphs: [
          'We review reports and may warn, suspend or remove any account that breaks these rules, without notice. Guest accounts are deleted automatically 24 hours after they are created.',
        ],
      },
      {
        heading: 'Limits of our responsibility',
        paragraphs: [
          'To the extent the law allows, RandomChatly is not liable for any loss or harm that comes from using the service or from contact with other users.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update these terms. If you keep using RandomChatly after a change, you accept the new terms. See also our Privacy Policy at /privacy/.',
          `Questions or concerns: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    navLabel: 'Privacy',
    title: 'Privacy Policy',
    description:
      'What RandomChatly collects, why, who it is shared with, how long it is kept, and how to ask us to delete your data.',
    h1: 'Privacy Policy',
    intro: `Last updated ${LEGAL_UPDATED}. This page explains what information RandomChatly collects and what we do with it. RandomChatly is only for people aged 18 or older.`,
    sections: [
      {
        heading: 'What we collect',
        list: [
          'Guest entry: the name and gender you enter.',
          'Google sign-in: your Google account email, name and profile photo, plus the username, display name, bio and photo you choose.',
          'Your chats: messages, photos and voice notes you send, so they can be delivered and, for friends, kept as chat history.',
          'Friends and matches: who you are friends with, who you block, and the people you have met recently.',
          'Location, only if you turn on location sharing: used to show nearby friends. Other people only ever see a rounded area, never your exact spot. Strangers never see it.',
          'Reports you send, and reports about you.',
          'Usage data: which screens you open and buttons you tap, your device and browser type, and technical logs, to keep the service working and improve it.',
        ],
      },
      {
        heading: 'Automated chat partners',
        paragraphs: [
          'When nobody is free to match with you, you may chat with an automated partner. Messages you send to it are processed by Google Gemini to write the replies.',
        ],
      },
      {
        heading: 'Services we use',
        list: [
          'Google Firebase: sign-in and file storage.',
          'Cloudinary: storing and delivering photos and voice notes.',
          'Google Gemini: replies from automated chat partners.',
          'Google Analytics and Microsoft Clarity: understanding how people find and use the site, using cookies or similar technology. Clarity records clicks, scrolling and page layout; text inside the signed-in app, including your chats, is hidden from it.',
          'Vercel: hosting the website.',
        ],
      },
      {
        heading: 'What we do not do',
        list: [
          'We do not sell your personal information.',
          'We do not show strangers your location, email or real name unless you choose to share it.',
          'We do not knowingly collect information from anyone under 18. If we learn we have, we delete it.',
        ],
      },
      {
        heading: 'How long we keep it',
        list: [
          'Guest accounts, with their chats and friendships, are deleted 24 hours after they are created.',
          'Your list of people you have met is kept for 30 days.',
          'Usage data in our own analytics is kept for 90 days.',
          'Google account data and chats with friends are kept until you delete them or ask us to delete your account.',
        ],
      },
      {
        heading: 'Your choices',
        list: [
          'Turn location sharing off at any time.',
          'Delete messages, or turn on disappearing messages in a chat with a friend.',
          'Block anyone, at any time.',
          'Delete your account at any time from your Profile. This removes your profile, friends and chats.',
          `Ask us for a copy of your data or to correct it by emailing ${CONTACT_EMAIL} from the email linked to your account.`,
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update this policy and will change the date at the top when we do. See also our Terms of Service at /terms/.',
          `Questions about your privacy: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
];
