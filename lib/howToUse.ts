/**
 * Single source of truth for the "how to use" copy, shared by the popup
 * shown once per app open (components/ui/HowToUsePopup.tsx) and the
 * HOW TO USE entry in the Find screen's settings drawer -- so the two can't
 * drift apart as the app's flow changes.
 */

export const HOW_TO_USE_TITLE = "HOW TO USE";

export interface HowToUseStep {
  /** Short imperative heading, rendered as the step's own line. */
  heading: string;
  /** One sentence of detail underneath it. */
  detail: string;
}

export const HOW_TO_USE_STEPS: HowToUseStep[] = [
  {
    heading: "ADD A FRIEND",
    detail: "Search their username and send a request. They have to accept before either of you can see the other.",
  },
  {
    heading: "PICK WHO TO FIND",
    detail: "On the Find screen, choose a friend from the picker. You can view up to two at once.",
  },
  {
    heading: "WATCH THE GAP CLOSE",
    detail: "You both appear as characters on the road. The space between them is your real distance -- it shrinks as you get closer.",
  },
  {
    heading: "FOLLOW THE HEADING",
    detail: "The arrow points the way to your friend. It's a direction and a distance, not turn-by-turn directions.",
  },
  {
    heading: "YOU CONTROL SHARING",
    detail: "Only confirmed friends ever see your location. Unfriending cuts it off instantly, both ways.",
  },
];
