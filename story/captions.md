<!--
  The WORDING for the AI Guard Demo walk-through. The lab serves this file at GET /api/story;
  the live Story reads that one copy. Edit the text under each heading — nothing else changes.

  Rules kept here:
  - The first page names the demo (rule 29): keep "## Header" on the Opening Slide and on sample_note.
  - Keep the "# Opening Slide" / "# Closing Slide" / "# Slide: <key>" / "# Step: <key>" headings as they are.
  - Keep each bullet on its own line starting with "- ".
  - Live values go in {braces}; the page fills them from the DOM.
  - Public-safe: no internal hostnames, tenant ids, keys or customer names.
  - Say only what the run proved: a bubble that claims a block is shown only when the run blocked.
-->

# Opening Slide

## Header
AI Guard: the guardrail, the apps and the keys

## Title
One call through the guard

## Lead
An agent presents a registry key, the grant decides what it may reach, and a per-key guardrail screens the text before anything is forwarded.

## Column A: Without it
- Every agent holds hard-coded credentials
- Nothing screens what agents send or receive
- No one place to see a block

## Column B: These demos: the agent gateway
- One access key IS the agent's identity
- An external guardrail inspects every unit of text
- One place to see the verdict, and the refusals

## Verdict
Everything here is simulated: a stand-in detector, a mock gateway and mock keys. The contract is as understood from the demo environment, UNVERIFIED against product documentation.

---

# Slide: part2

## Title
Part 2: the Agent Registry

## Lead
One key carries the whole identity: scopes, the apps it may reach, the tools it may call, and its own guardrail.

## Column A: On the key
- Scopes: llm, mcp, a2a
- Custodian: the person who answers for it
- Allowed apps and a tool filter

## Column B: What to watch for
- A call that is permitted
- A call refused with a named reason
- A guardrail block on an allowed call

## Verdict
The key value shown is mock-issued and labelled vk-mock-…; it is never a real credential.

---

# Step: intro

## Title
The demo in one picture

## Text
The flow runs client to gateway to sidecar, and the gateway applies the answer. Simulate makes a real run and plays its hops back.

---

# Step: pick

## Title
Pick something to try

## Text
Ten scripted scenarios, or your own prompt in the box. The picker names what each one teaches before you run it.

---

# Step: run

## Title
Run a scenario

## Text
Press Run scenario. The gateway sends the request text to the stand-in sidecar, applies the findings, and records the decision.

---

# Step: exchange

## Title
The exact /inspect exchange

## Text
This is the JSON the gateway sent and the answer it got, per direction, with PII masked. An empty findings list means allow; a finding at or above the category's block threshold means block.

---

# Step: thresholds

## Title
Thresholds decide

## Text
A slider per category. Moving one flips the recorded decision live — the same rule the server applies, pinned by tests. A calling agent key brings its own thresholds, which these sliders do not change.

---

# Step: fail_closed

## Title
When the sidecar fails

## Text
The Fail Closed toggle and the fault injector. A 502 or a timeout follows the toggle: fail closed blocks even harmless text, fail open lets even an attack through. Run the side-by-side comparison to see both.

---

# Step: stand_in

## Title
What the stand-in misses

## Text
A deterministic keyword stand-in, not a classifier. It misses a paraphrased attack and flags a harmless sentence that quotes the attack phrase. Detection quality is a property of the model you deploy, not of this contract.

---

# Step: log

## Title
The decision log

## Text
Every run lands here: caller, policy, outcome and reason. Reset clears it and restores the defaults.

---

# Slide: apps_intro

## Title
Agentic Apps: the doors

## Lead
One application per backend MCP server. The client route is derived from the application name.

## Column A: On the app
- Name: banking, travel, notes
- Backend: the MCP server URL
- Published tools

## Column B: The trap
- An app created outside the proper wizard gets no working route
- Publishing alone configures nothing that runs

## Verdict
The route is /<application-name>/mcp — the name is the route.

---

# Step: apps_route

## Title
The route comes from the name

## Text
The card shows the client route the gateway derives: /<name>/mcp. Change the name and the route changes with it.

---

# Step: apps_edit

## Title
Edit or add an app

## Text
Add Application (MCP Server) creates a door with its backend URL and its published tools. In the product, policy edits take about four minutes to reach the gateway.

---

# Step: keys

## Title
The keys

## Text
Three mock keys ship: payments-agent (mcp, banking, tool-filtered), research-agent (llm, no app grant) and orchestrator (mcp + a2a, two apps). One key IS the agent's whole identity.

---

# Step: key_scopes

## Title
Scopes are the reach

## Text
llm reaches models, mcp reaches tools, a2a reaches agents. Give only what the agent uses: a three-scope key is one secret that reaches everything.

---

# Step: key_grant

## Title
What Privilege did

## Text
Press Grant on a key. Selecting the apps IS the grant — the product auto-creates the policy issued to the key's custodian. The card shows the apps and the tool filter that grant carries.

---

# Step: call_intro

## Title
Try a call as a key

## Text
Pick a key, an app and a tool. The registry decides access first: identity, then the grant, then the tool filter.

---

# Step: call_allowed

## Title
Permitted, then screened

## Text
payments-agent calling banking.get_my_accounts is permitted. The key's own guardrail then screens the call text with the same sidecar contract, and a behavioral-risk evaluation from PingOne Protect rides along as a second, real signal — it informs, it never decides.

---

# Step: call_refused

## Title
Refused, and it says why

## Text
research-agent has no mcp scope, so the call is refused: 403, key not scoped for mcp access — the only refusal that describes itself. Every other refusal is a bare 403; the gateway log is where the reason lives.

---

# Step: call_blocked

## Title
The guardrail blocks on its own

## Text
With Block Agreement off — ML blocks alone, a sidecar finding blocks the call even though the key and the grant were fine. That is the point of a per-key guardrail: the identity layer and the screening layer are independent.

---

# Closing Slide

## Title
Three layers, one call

## Lead
Identity (the key), authorisation (the grant) and screening (the per-key guardrail) fail independently, and every decision is logged.

## Column A: What this demo showed
- The /inspect contract, end to end
- Apps whose name is their route
- Keys whose grant and guardrail hang off one identity

## Column B: What is simulated
- The detector is a keyword stand-in, not a model
- The keys and apps are mock data; nothing is sent anywhere
- The contract is UNVERIFIED against product documentation

## Verdict
Detection quality, defaults and licensing are properties of the real product, not of this demo.

---

# Slide: sample_note

## Header
AI Guard: the guardrail, the apps and the keys

## Title
This is the simulated walk-through

## Lead
Mock mode: the mock gateway sends text to an embedded stand-in sidecar.

## Column A: What is real here
- The page, the flow, the decision shapes

## Column B: What is simulated
- The detector is a keyword stand-in, not a model
- No tenant, no network, no credentials

## Verdict
The live wording of every run step is replaced by its simulated variant.

---

# Step: sample_p1_intro

## Title
Simulated: the demo in one picture

## Text
The simulated flow runs client to gateway to stand-in sidecar. Simulate makes a run and plays its hops back.

---

# Step: sample_exchange

## Title
Simulated: the /inspect exchange

## Text
The simulated exchange shows the same shapes: the request the gateway sent and the stand-in's findings, with PII masked.

---

# Step: sample_call_allowed

## Title
Simulated: permitted, then screened

## Text
In this simulated run the access check and the guardrail both run locally; the verdict shapes are the same as a live gateway's.

---

# Step: sample_call_refused

## Title
Simulated: refused, and it says why

## Text
The simulated registry refuses with the same wording a live gateway logs: the only self-describing refusal is the missing scope.

---

# Step: sample_call_blocked

## Title
Simulated: the guardrail blocks on its own

## Text
The simulated stand-in scored the text above its threshold, so the call is blocked at the guardrail — nothing reached the backend.
