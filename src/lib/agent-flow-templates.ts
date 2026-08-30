import type { FlowStep, FlowTemplate } from "./agent-flow-types";

function id(n: number) {
  return `step-${n}`;
}

export function defaultStepsForTemplate(template: FlowTemplate): FlowStep[] {
  switch (template) {
    case "restaurant_order":
      return [
        {
          id: id(1),
          type: "greeting",
          title: "Welcome",
          message: "Hello! Thanks for calling {{restaurant_name}}. How can I help you today?",
        },
        {
          id: id(2),
          type: "question",
          title: "Order intent",
          message: "Would you like to place an order for pickup or delivery?",
          branches: { pickup: id(3), delivery: id(3) },
        },
        {
          id: id(3),
          type: "action",
          title: "Take dishes",
          message: "Ask what dishes they'd like. Confirm each item, quantity, and modifiers from the menu.",
          action: "take_order",
        },
        {
          id: id(4),
          type: "action",
          title: "Upsell",
          message: "Suggest one complementary item (drink, dessert, or side) before confirming the total.",
          action: "upsell",
        },
        {
          id: id(5),
          type: "action",
          title: "Payment link",
          message: "Read back the order total and offer to text a secure payment link to their phone.",
          action: "send_payment_link",
        },
        {
          id: id(6),
          type: "closing",
          title: "Thank you",
          message: "Thank them, confirm pickup/delivery timing, and end the call warmly.",
        },
      ];
    case "reservation":
      return [
        {
          id: id(1),
          type: "greeting",
          title: "Welcome",
          message: "Hello! Welcome to {{restaurant_name}}. I can help you book a table.",
        },
        {
          id: id(2),
          type: "question",
          title: "Party size",
          message: "How many guests will be dining with you?",
        },
        {
          id: id(3),
          type: "question",
          title: "Date & time",
          message: "What date and time would you prefer?",
        },
        {
          id: id(4),
          type: "action",
          title: "Confirm reservation",
          message: "Confirm name, phone, party size, and time. Note any special requests.",
          action: "book_table",
        },
        {
          id: id(5),
          type: "closing",
          title: "Confirmation",
          message: "Repeat the reservation details and thank the caller.",
        },
      ];
    case "combined":
      return [
        {
          id: id(1),
          type: "greeting",
          title: "Welcome",
          message: "Hello! Thanks for calling {{restaurant_name}}. Are you looking to order food or book a table?",
        },
        {
          id: id(2),
          type: "branch",
          title: "Intent routing",
          message: "Route to order flow or reservation flow based on caller intent.",
          branches: { order: id(3), reservation: id(7) },
        },
        {
          id: id(3),
          type: "action",
          title: "Take order",
          message: "Collect dishes, quantities, and modifiers.",
          action: "take_order",
        },
        {
          id: id(4),
          type: "action",
          title: "Upsell",
          message: "Offer a drink or dessert add-on.",
          action: "upsell",
        },
        {
          id: id(5),
          type: "action",
          title: "Payment link",
          message: "Confirm total and send payment link via SMS.",
          action: "send_payment_link",
        },
        {
          id: id(6),
          type: "closing",
          title: "Order closing",
          message: "Thank the caller and confirm timing.",
        },
        {
          id: id(7),
          type: "action",
          title: "Book table",
          message: "Collect party size, date, time, and contact details.",
          action: "book_table",
        },
        {
          id: id(8),
          type: "closing",
          title: "Reservation closing",
          message: "Confirm reservation and thank the caller.",
        },
      ];
    default:
      return [
        {
          id: id(1),
          type: "greeting",
          title: "Greeting",
          message: "Welcome the caller and introduce yourself.",
        },
        {
          id: id(2),
          type: "closing",
          title: "Closing",
          message: "Thank the caller and end the conversation.",
        },
      ];
  }
}

export function generatePromptFromFlow(
  flowName: string,
  steps: FlowStep[],
  restaurantName = "the restaurant",
): string {
  const lines: string[] = [
    `You are a voice agent for ${restaurantName}. Follow this conversation flow for "${flowName}":`,
    "",
  ];

  steps.forEach((step, index) => {
    lines.push(`## Step ${index + 1}: ${step.title} (${step.type})`);
    lines.push(step.message.replace(/\{\{restaurant_name\}\}/g, restaurantName));
    if (step.branches && Object.keys(step.branches).length > 0) {
      const opts = Object.keys(step.branches).join(", ");
      lines.push(`Branch options: ${opts}.`);
    }
    if (step.action) {
      lines.push(`Action: ${step.action.replace(/_/g, " ")}.`);
    }
    lines.push("");
  });

  lines.push(
    "Stay concise, friendly, and confirm details before taking actions. Use the restaurant menu and policies when answering questions.",
  );
  return lines.join("\n");
}
