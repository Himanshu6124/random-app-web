---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/views/MatchView.jsx","src/views/LoginView.jsx"]
---

# RandomChatly app shell (all signed-in tabs, login, dialogs)

Mode: Operate. Mobile-first PWA; used mostly late at night, in bed, in a dark room.
Scope: full visual replacement. Product truth, flows and copy stay. Friends first, open to romance; warm and intimate, never cutesy or corporate.
Pinned: fonts stay Outfit (display) + Plus Jakarta Sans (body).

## Direction contract

THESIS: A simple warm dark app for meeting someone late at night. No metaphor or costume; warmth comes from the plum ground and one rose colour. It refuses glassy purple-neon gradients and swipe-card dating clichés.

OWN-WORLD: One stepped plum ramp (#140c14 → #43293d) for every surface, ground #1a1019. Rose #f07289 is the single action colour (ink #2a0a12 on it). Warm gold #e8c27a marks only a live chat (LIVE badge). Text warm white #f5ecef, secondary #c9b6bf, muted #a8939e. Flat surfaces, 1px hairlines, pill buttons, lucide line icons in one muted colour; no gradients, glass, blur, glow or emoji icons.

STORY: Open the app at night, see at once how to find someone, talk, and keep the people you click with as friends, and maybe more.

FIRST VIEWPORT: Match tab on a phone. Header: RandomChatly wordmark left, neutral connection state right. Headline "Who's up tonight?" with a one-line explainer top-left; a quiet status line (dot + "Ready when you are" / "Searching · 0:12"). Full-width rose "Find a Match" pill in thumb reach above the bottom tab bar.
SEARCH STATE: the Match tab becomes a centred stage sized to the screen height (no scrolling to Cancel): beating avatar with drifting hearts, large rotating phrase ("Finding a new soul…"), quiet secondary "Searching · 0:12", neutral Cancel pill. The header hides Online and Upgrade while searching.
CHAT: LIVE badge in gold; your messages in a rose-tint bubble with a rose hairline, theirs in plum-3; before the first message a beating rose heart outline with "It's just the two of you now."; placeholder "Say something sweet…".

FORM: Simple warm dark, pinned by the user. seed: none (pinned) — the user chose "Simple warm dark: No metaphor: plain dark plum background with one rose button colour. Simplest." Later user requests reshaped two surfaces: "make the search animation interesting cool by adding texts like getting new soul and changeable text", "make it main part of screen", "scrolling is not need to find cancel button", "remove online and upgrade from search screen", and "make the chat screen more romantic too". Signature motion: the search stage (your avatar beating lub-dub with small rose heart outlines drifting up, plus a rotating phrase whose words rise in) and the chat's opening heart. Then the user asked to "make more animations which user find addictive and engaging": so a set of one-shot moments, each a reply to the user's own action, never ambient or nagging — a burst of heart outlines as the search starts, the avatar pop plus a bigger burst when a match locks, new message bubbles popping in from their side (history never animates), the send icon nudging forward on press, a reaction icon springing on tap, and a tab icon bouncing once after a tap. All are off under reduced motion. Nothing else moves.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
