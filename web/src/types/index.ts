export type Message = { role: "user" | "assistant"; content: string };

export type Interrupt =
  | { type: "questions"; questions: string[] }
  | {
      type: "approval";
      symptoms: string[];
      red_flags: string[];
      urgency: string;
      reasoning: string;
      response: string;
    };
