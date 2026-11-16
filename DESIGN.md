---
name: RandomChatly
description: A simple warm dark app for meeting someone late at night.
colors:
  plum-0: "#140c14"
  plum-1: "#1a1019"
  plum-2: "#21141f"
  plum-3: "#2a1a27"
  plum-4: "#352131"
  plum-5: "#43293d"
  rose: "#f07289"
  rose-hover: "#f4889b"
  rose-ink: "#2a0a12"
  rose-tint: "rgba(240, 114, 137, 0.12)"
  rose-line: "rgba(240, 114, 137, 0.45)"
  live-gold: "#e8c27a"
  danger: "#ff8a8f"
  danger-fill: "#c9374a"
  sky: "#7ea6f6"
  green: "#3fb27f"
  danger-line: "rgba(229, 72, 77, 0.45)"
  white: "#ffffff"
  scrim: "rgba(10, 4, 9, 0.72)"
  google-surface: "#131314"
  google-line: "#8e918f"
  google-text: "#e3e3e3"
  text-primary: "#f5ecef"
  text-secondary: "#c9b6bf"
  text-muted: "#a8939e"
typography:
  display:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.9rem, 6vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  display-stage:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.4rem, min(7.5vw, 4.4svh), 2.75rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.4
  support:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  support-sm:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
  label:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  label-live:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  badge: "4px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  bubble: "18px"
  xl: "24px"
  sheet: "26px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.rose-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.rose-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.plum-4}"
    textColor: "{colors.text-muted}"
  button-match:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.rose-ink}"
    rounded: "{rounded.full}"
    height: "56px"
    width: "100%"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.plum-3}"
  button-selected:
    backgroundColor: "{colors.plum-5}"
    textColor: "{colors.rose}"
    rounded: "{rounded.full}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  panel:
    backgroundColor: "{colors.plum-2}"
    rounded: "{rounded.lg}"
  live-badge:
    textColor: "{colors.live-gold}"
    typography: "{typography.label-live}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  bubble-me:
    backgroundColor: "{colors.rose-tint}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.bubble}"
    padding: "12px 18px"
  bubble-them:
    backgroundColor: "{colors.plum-3}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.bubble}"
    padding: "12px 18px"
  input-composer:
    backgroundColor: "{colors.plum-0}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "14px 20px"
  tab-item:
    textColor: "{colors.text-muted}"
    height: "52px"
  tab-item-active:
    backgroundColor: "{colors.plum-4}"
    textColor: "{colors.rose}"
    rounded: "15px"
  reaction-chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "6px 8px"
---

# Design System: RandomChatly

## Overview

**Creative North Star: "One Rose in a Dark Room"**

RandomChatly is a simple warm dark app, opened on a phone, late, in bed, with the lights off. There is no metaphor and no costume. Warmth comes from two things only: a stepped plum ground that every surface is cut from, and one rose colour that marks what you can do next. Everything else is quiet: warm white text, 1px hairlines, pill buttons, line icons in one muted tone.

Density is low and thumb-led. The Match tab puts one question and one rose pill in reach; searching turns the whole tab into a centred stage sized to the screen, so Cancel never needs a scroll. Motion is the one place the system lets itself be tender: a beating avatar, drifting heart outlines, a phrase that rises in word by word, and a set of one-shot moments that answer the user's own taps. Outside the search stage and the chat's opening heart, only the Match tab's idle invitation moves on its own: a headline that follows the time of day and a Find a Match heart whose beat sends outline rings out from the pill.

The world refuses glassy purple-neon gradients and swipe-card dating clichés. Surfaces are flat; there is no glass, blur or glow.

**Key Characteristics:**
- One six-step plum ramp for every surface, ground plum-1.
- Rose is the single action colour; gold means "live" and nothing else.
- Flat surfaces, 1px hairlines, pill-shaped controls.
- Lucide line icons in one muted colour.
- Rose heart outlines (never filled) are the recurring motif: app icon, search stage, chat intro, tap bursts.
- Every animation is off under reduced motion.

## Colors

A warm, low-light palette: plum for everything that is a place, rose for everything that is an action.

### Primary
- **Night Rose** (rose): the one action colour. Primary pills (Find a Match, send, accept), focus rings, text selection, input carets, heart outlines, the current tab's icon, and unread count badges (rose fill, Rose Ink numerals). Hover lifts to **Rose Hover**. Text on rose is always **Rose Ink**, never white.
- **Rose Tint / Rose Line** (rose-tint, rose-line): rose at 12% and 45%. Your own chat bubble is a rose-tint fill with a rose-line hairline; the same pair marks soft rose notices.

### Secondary
- **Live Gold** (live-gold): marks a live chat only. The LIVE badge, the matched avatar ring and the matched timer on the search stage.

### Tertiary (state and info, confined)
- **Friend Green** (green): online and friend states, used in Friends and Discover (and the "Friends" status chip in a chat header).
- **Info Sky** (sky): links, privacy notes and secondary data in Discover.
- **Danger Coral / Danger Fill** (danger, danger-fill): destructive actions inside confirmation dialogs (sign out, Discover confirmations). Red also marks failed-send bubbles and chat error banners; those are error feedback, never decoration or a call to action.

### Neutral
- **Plum 0, Midnight** (plum-0): inputs, the composer field, app bars (at 86% opacity, no blur).
- **Plum 1, Ground** (plum-1): the page background and the full-screen chat.
- **Plum 2, Card** (plum-2): panels, cards, dialogs, sheets.
- **Plum 3, Raised** (plum-3): their chat bubble, hover fills, the desktop current-tab pill.
- **Plum 4, Line / Lifted** (plum-4): default hairlines, avatar wells, disabled primary fill, the phone's current-tab pill.
- **Plum 5, Strong Line** (plum-5): secondary-button outline, strong hairlines, the selected-choice fill, scrollbar thumb.
- **Warm White** (text-primary): headings and message text.
- **Dusk** (text-secondary): supporting text, status lines, icons at rest.
- **Ash** (text-muted): placeholders, timestamps, idle dots, inactive tab labels.

### Named Rules
**The One Rose Rule.** Rose is the only action colour. If something is pressable and primary, it is rose with Rose Ink; if it is not, it is not rose.

**The Gold Means Live Rule.** Live Gold appears only while a chat is live or a match has locked. It is never decoration and never a second accent.

**The Plum Selection Rule.** A selected or current state is a lifted plum fill with a rose icon or rose hairline, never a solid rose fill. Solid rose is reserved for the action itself.

## Typography

**Display Font:** Outfit (with -apple-system, BlinkMacSystemFont, sans-serif)
**Supporting Font:** Plus Jakarta Sans (with -apple-system, BlinkMacSystemFont, sans-serif)

**Character:** Outfit is the app's voice: rounded, friendly geometric letterforms that carry headings, buttons, navigation and the chat messages themselves. Plus Jakarta Sans is the quieter companion for explanatory and status text, and for the whole Discover tab. Both families are pinned by the user.

### Hierarchy
- **Display** (Outfit 700, clamp 1.9rem to 2.5rem, line-height 1.1, tracking -0.02em): the Match tab headline. It follows the user's local time of day (morning, afternoon, evening, night, late night), opening on the plain question ("Who's up tonight?") and rotating every 6s through two warmer lines for that part of the day, each word rising in like the search phrase. It reserves two lines and sits at their foot, so rotation never shifts the lede. Screen readers get the plain question once.
- **Display Stage** (Outfit 700, clamp 1.4rem to 2.75rem sized against both width and screen height, line-height 1.12): the rotating phrase on the search stage. Reserves two lines on phones, one line on desktop.
- **Title** (Outfit 600–700, 1.25rem): the wordmark and the chat intro line.
- **Body** (Outfit 400, 0.95rem, line-height 1.4): chat messages and default interface text.
- **Support** (Plus Jakarta Sans 400, 1rem, line-height 1.55, max 40ch): ledes and explainers under a headline.
- **Support Small** (Plus Jakarta Sans 400, 0.8125–0.9375rem): status lines, timers, connection state, hints. Tabular numerals wherever a count or clock ticks.
- **Label** (Outfit 600, inherits size): button and tab labels. The Find a Match pill steps up to 1.125rem/700.
- **Live Label** (Outfit 600, 0.75rem, tracking 0.08em, uppercase by content): the LIVE badge only.

### Named Rules
**The Twelve Pixel Floor Rule.** No text on a phone is smaller than 12px (0.75rem); tab labels and count badges sit exactly on the floor. Form fields render at 16px on phones so iOS never zooms.

**Type scale tokens.** Every literal size in the code resolves to one of these steps in `theme.css`: `--fs-xs` 12px (captions, timestamps, badges), `--fs-sm` 13px (hints, meta), `--fs-md` 14px (secondary UI, small buttons), `--fs-body-sm` 15px (supporting body), `--fs-body` 0.95rem (chat body), `--fs-base` 16px (inputs, primary labels), `--fs-lg` 18px, `--fs-xl` 20px (titles), `--fs-2xl` 24px (section headings), `--fs-3xl` 32px (large headings). Radii likewise use `--radius-xs/sm/md/lg/bubble/xl/full`, and colours only the named tokens; the Google button keeps Google's own dark-theme colours as `google-*` tokens.

## Layout

Mobile-first, single column, thumb-led. The phone breakpoint is 768px: at or below it the document locks to the viewport, each screen scrolls internally, the header becomes a 56px top bar (plus safe area) and a bottom tab bar appears. Above 768px the header carries the tab navigation instead and the bottom bar is hidden; a 640px step shortens chat-header labels to icons.

Spacing moves in a small rhythm of 8, 12, 16, 24 and 32px. Content columns are capped: the Match tab at 560px, the desktop chat feed at 720px, profile at 680px.

**The Thumb Reach Rule.** On a phone the primary action sits at the foot of the screen, full width, directly above the tab bar (Find a Match, Cancel). On desktop it moves up under the content it acts on.

**The No Scroll To Cancel Rule.** The search stage sizes itself to screen height (avatar stage capped at 32svh, phrase scaled by svh) so every element, including Cancel, is visible without scrolling.

**The Quiet Header Rule.** The header never shows Upgrade and never says "Online". It shows the connection state only when something is wrong ("Connecting..." or "Offline"). Upgrading lives in Profile, the locked tabs and the upgrade sheet. A live chat goes full screen on phones, hiding header and tab bar.

**The Touch Size Rule.** On phones, interactive targets are at least 44px (chat-header actions, composer send, profile buttons; tab items are 52px tall; reaction chips 40px within the 44px row).

## Elevation & Depth

The system is flat. Depth comes from stepping up the plum ramp (ground plum-1, card plum-2, raised plum-3, lifted plum-4/5) and from 1px hairlines in plum-4. There are no gradients, no glass, no backdrop blur and no glow; the legacy glow tokens are remapped to transparent or none.

The single exception is overlay: a dialog or sheet that floats over the app carries one soft, dark ambient shadow so it separates from the dimmed screen behind it.

### Shadow Vocabulary
- **Overlay Card** (`box-shadow: 0 8px 24px -8px rgba(10, 4, 9, 0.6)`): Discover confirmation dialog.
- **Overlay Pop** (`box-shadow: 0 16px 40px -12px rgba(10, 4, 9, 0.75)`): sign-out confirmation and other modal dialogs.

### Named Rules
**The Step Not Shadow Rule.** To lift a surface, take one step up the plum ramp. Shadows belong only to overlays; in-flow cards and bars never cast one.

## Shapes

Soft and round. Controls are pills (full radius): primary, secondary and danger buttons, the composer input, reaction chips, the current-tab pill. Containers use gently curved corners: 16px for panels and cards, 12px for inner wells, segmented controls and phone chat-header buttons, 8px for small chips. Chat bubbles round 18px with one 4px corner as the tail on the speaker's side (bottom-right for you, bottom-left for them). Phone sheets round 26px at the top only, with a 38×5px grab handle. The LIVE badge alone is near-square (4px) with a 1.5px gold outline, like a broadcast tag.

Hairlines are 1px. The only heavier strokes are deliberate: the 1.5px selected-choice edge and LIVE outline, and the 2px rose ring around the searching avatar.

Hearts are always outlines (stroke 1.4–1.8, round joins), never filled.

## Components

### Buttons
Calm, round and certain.
- **Shape:** full pill (rounded.full).
- **Primary:** rose fill, Rose Ink label, Outfit 600, 12px 24px padding. The Find a Match pill is full width, 56px tall, 1.125rem/700, led by a Rose Ink heart outline.
- **Find a Match invitation:** the heart in the pill beats lub-dub on a 2.4s loop, and each beat sends a 2px rose outline ring out from the pill (it widens slightly and grows taller, fading by three quarters of the loop), echoing the radar it opens. Outlines only, never a glow. The pill rises 12px into place once when the tab opens (movement only, never faded from invisible). The echoes stop while it is pressed. The status line under the headline names the moment ("Sunday night · ready when you are").
- **Hover / Focus / Press:** hover steps to Rose Hover over 0.18s; press scales to 0.98 (0.96 on touch, with a slight darken); focus shows a 2px rose outline offset 2px. Disabled drops to plum-4 with Ash text.
- **Secondary:** transparent with a plum-5 hairline and warm-white label; hover fills plum-3. Cancel on the search stage is a full-width secondary pill.
- **Selected choice:** plum-5 fill, 1.5px rose edge, rose label (The Plum Selection Rule).
- **Danger:** transparent, coral label, translucent red hairline; hover takes a 12% red tint. Dialog-only.
- **Send:** a 48px rose circle (44px on phones) with a paper-plane icon that nudges up and right on press.

### Chips
- **Reaction chips:** bare muted line icons, no fill at rest; hover or press fills plum-3 and brightens to warm white. A tap springs the icon (scale 1.35, briefly rose).

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** plum-2.
- **Shadow Strategy:** none in flow (see Elevation & Depth).
- **Border:** 1px plum-4.
- **Internal Padding:** 16–32px; on phones Profile drops the card entirely and fills the screen.

### Inputs / Fields
- **Style:** plum-0 well, 1px plum-4 hairline, pill radius, 14px 20px padding; Ash placeholder ("Say something sweet…"), rose caret.
- **Focus:** the global 2px rose focus ring.
- **Disabled:** 60% opacity.

### Navigation
- **Phone tab bar:** four items (Match, Discover, Friends, Profile), 52px tall, on the 86% plum-0 bar with a 1px top hairline. Inactive items are Ash; the current item gets a 60×30 plum-4 pill behind a rose icon (heavier stroke) and a white label. Profile shows the user's avatar with a 2px rose ring when current. Locked tabs (guests) dim to 70% with a small lock. A tap settles the icon in once.
- **Desktop header nav:** secondary pills with no outline; inactive is Dusk, hover and current fill plum-3, the current tab's icon turns rose.
- **Header:** wordmark left (Outfit 700, 1.25rem); a neutral connection state (dot plus label in Dusk, rose while connecting) right, hidden on the Match tab.

### LIVE Badge
A small gold broadcast tag: Outfit 600 0.75rem, 0.08em tracking, 1.5px gold outline, 4px corners, a 6px gold dot before the word. It sits under the stranger's name in the chat header for as long as the chat is live.

### Chat Bubbles
Yours: rose tint with a rose hairline, aligned right, tail bottom-right. Theirs: plum-3 with a plum-4 hairline, aligned left, tail bottom-left. Max width 75%. Timestamps and read state sit under the bubble in Ash. Before the first message, the feed centres the **chat intro**: a 44px rose heart outline beating lub-dub, "It's just the two of you now." in Outfit 600, and a Dusk hint.

### Search Stage (signature)
The whole Match tab while searching. Your avatar (plum-4 well, 2px rose ring) beats lub-dub on a 2.4s loop while small rose heart outlines drift up and fade (5s, staggered). Below it, a large phrase rotates every 4s ("Finding a new soul…"), each word rising in from 0.2em below at 70ms intervals. Under that, a quiet "Searching · 0:12" timer in tabular numerals, then a full-width Cancel pill. When a match locks, the drifting hearts stop, the avatar pops (scale 1.18 then settles at 1.08), its ring and the timer turn gold, and a bigger burst of eight heart outlines flies out.

### Motion Moments
One-shot replies to the user's own action, all on the ease-out curve and all off under reduced motion:
- **Search start burst:** eight rose heart outlines fly outward once from the avatar (0.7s).
- **Match pop:** avatar pop plus a bigger burst (0.9s).
- **New message pop-in:** a newly arrived bubble rises 8px and scales from 0.92 out of its own corner (0.32s). History and batches of more than two never animate.
- **Send nudge**, **reaction spring**, **tab settle** (0.2s, 0.35s, 0.38s).

### Discover Tabs

The Discover segmented control follows the Plum Selection rule: the current segment is a plum-4 fill with ink text and a 2px rose underline, never a solid rose fill.

## Do's and Don'ts

### Do:
- **Do** cut every surface from the plum ramp; lift by stepping one plum step up, not by adding a shadow.
- **Do** keep rose for the action and put Rose Ink (#2a0a12) on it.
- **Do** show selected and current states as a plum fill with a rose icon or rose hairline.
- **Do** reserve Live Gold for a live chat or a locked match.
- **Do** use Lucide line icons in one muted colour (Dusk), turning rose only for the current tab or an action.
- **Do** draw hearts as rose outlines, never filled.
- **Do** keep phone touch targets at 44px and text at 12px or larger.
- **Do** make every new animation a one-shot reply to a user action, and switch it off under prefers-reduced-motion.

### Don't:
- **Don't** use gradients, glass, backdrop blur or glow on any surface.
- **Don't** fill a selected or current state with solid rose.
- **Don't** use gold as a decorative accent or a second brand colour.
- **Don't** bring green or sky into the Match flow as decoration; they are Friends and Discover state colours.
- **Don't** use emoji as icons.
- **Don't** add ambient looping motion outside the search stage, the chat intro heart and the Match tab's idle invitation (rotating headline, beating Find a Match heart and its echo rings), which the user asked for to make the home screen feel alive.
- **Don't** animate message history; only messages that arrive while the thread is open pop in.
- **Don't** put Upgrade or a plain "Online" in the header on any tab.
