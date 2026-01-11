---
description: Verify the live simulation features of the AI Swarm Demo
---

# Live Simulation Verification

To verify the new "Live Simulation" features:

1.  **Open the Browser Demo**
    Open `src/wasm/demo-browser/index.html` in your web browser. You can usually do this by right-clicking the file in your VS Code explorer and selecting "Open in Browser" or using a live server extension.

2.  **Locate the "LIVE" Button**
    Look for the new **"🌊 LIVE"** button in the top control panel, next to the "RUN BATCH" button.

3.  **Start Simulation**
    Click the **"🌊 LIVE"** button. The button text should change to **"🛑 STOP"**, and it should start pulsing.

4.  **Observe the Live Feed**
    Look at the right-side panel for the **"Live RAN Traffic"** card. You should see new query items appearing every 4 seconds. 
    Each item should display:
    *   Timestamp (e.g., `14:30:05`)
    *   Question ID (e.g., `Q042`)
    *   Feature Name (e.g., `FAJ 121 3094`)
    *   Question Text (truncated if long)

5.  **Watch the Main Interface**
    *   The "Query" input field should automatically update with the current simulated question.
    *   The agents in the central pool should activate (highlight border) as they process the queries.
    *   The "System Logs" should show incoming queries and agent responses.
    *   The "Global Stats" (latency, queries, success rate) should update in real-time.

6.  **Stop Simulation**
    Click the **"🛑 STOP"** button. The simulation should pause, and no new items should be added to the feed.
