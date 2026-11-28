// What the Help dialog says. Plain, and as hedged as the rest of the lab (rule 2): what was measured, what is simulated, what is UNVERIFIED.
export const HELP_SECTIONS = [
  {
    heading: "What this lab is",
    body: "A small, offline demo of how an external guardrail sidecar plugs into an agent gateway. A mock gateway sends the text of an agent or LLM request, and of the model's response, to a sidecar's /inspect endpoint. An empty findings list means allow; a finding at or above its category's block threshold means block; if the sidecar fails, a fail-closed toggle decides between blocking and allowing. This fork adds the Agentic Apps and Agent Registry tabs (mock agent keys, grants, per-key guardrails and a try-a-call flow)."
  },
  {
    heading: "Measured vs UNVERIFIED",
    body: "The /inspect contract and the gateway behaviour are as understood from the demo environment — UNVERIFIED against product documentation. Nothing here says anything about real product detection quality, defaults or licensing. The stand-in detector deliberately misses paraphrased injection and sometimes raises false alarms; those limits are labelled on each scenario (\"STAND-IN MISS\", \"STAND-IN FALSE ALARM\"). The H2 2026 release tab carries Ping's own release claims, marked \"Ping release claim, UNVERIFIED on our tenant\"."
  },
  {
    heading: "How to use the page",
    body: [
      "Views (nav buttons): \"Sidecar demo\", \"Agentic Apps\", \"Agent Registry\", \"H2 2026 release\".",
      "On the Sidecar demo: pick a scenario in the dropdown (e.g. \"Benign prompt\", \"Direct prompt injection\", \"Paraphrased injection the stand-in misses\", \"Benign sentence falsely flagged\", \"PII in a request\", \"PII leaking in a response\", \"A2A message, per-key guardrail\", \"Sidecar outage (502), both modes\") and press \"Run scenario\". Or type your own prompt and press \"Run my text\", or \"Add a hidden character\" to smuggle one in.",
      "Below the result: the Exchange walk-through, Findings, Thresholds (per-category block levels, the detector threshold, fail-closed), Outage (break the sidecar, compare modes) and the Log of recorded decisions. The header has the Mock/Real toggle, theme, Present, talk track, Reset, the story toggle and Help."
    ]
  },
  {
    heading: "Mode honesty",
    body: "Mock mode runs an in-process stand-in sidecar; nothing real is contacted, no model, no network — loopback only. Real mode, when configured, sends the same requests to the configured sidecar; the gateway logic on this page is unchanged and still the lab's own. The window that opens with the page names which mode you are in (MOCK or REAL), and the Mock/Real switch in the header shows it afterwards."
  },
  {
    heading: "Your text and reset",
    body: "Your typed text is only ever shown as text: it is masked for PII and hidden characters are made visible before it is logged or returned. Reset restores the default thresholds, clears the fault and empties the log."
  }
];
