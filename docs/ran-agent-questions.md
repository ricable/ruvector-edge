# 50 RAN Feature Agent Questions for 4G LTE

## Battle Test Questions for Multi-Specialized Agent Swarm

Each question is designed to test the autonomous state machine, OODA loop, and Q-learning capabilities of specialized RAN feature agents.

### Cell Capacity & Configuration

1. **11CS (13-18 Cell Support)**: "How do I configure an eNodeB to support 18 cells with proper PUCCH resource allocation? What are the prerequisites for upgrading from 12 cells?"

2. **12CS (19-24 Cell Support)**: "What is the procedure to enable 24 cell support? Which additional features must be activated first?"

3. **6CS (6 Cell Support)**: "What are the hardware requirements for 6 cell support? Which parameters need adjustment for PUCCH resources?"

4. **71CS (7-12 Cell Support)**: "How does 7-12 cell support differ from 6 cell support in terms of capacity and configuration?"

5. **5MSC (5+5 MHz Sector Carrier)**: "What are the bandwidth implications of using 5+5 MHz sector carriers? How does this affect throughput?"

### Modulation & Throughput

6. **2QD (256-QAM Downlink)**: "Under what conditions should 256-QAM downlink be enabled? What CQI thresholds trigger 256-QAM modulation?"

7. **2QU (256-QAM Uplink)**: "What are the SINR requirements for 256-QAM uplink? How does UE capability affect this?"

8. **6QD (64-QAM Downlink)**: "When should the network fall back from 256-QAM to 64-QAM? What are the performance impacts?"

9. **6QU (64-QAM Uplink)**: "What parameters control 64-QAM uplink activation? How does power headroom affect modulation?"

10. **1QU (16-QAM Uplink)**: "What is the fallback mechanism when 64-QAM uplink cannot be maintained? How does this affect edge users?"

### Carrier Aggregation

11. **3DCAE (3CC DL CA Extension)**: "What are the inter-band CA combinations supported for 3CC? What are the UE category requirements?"

12. **4DCAE (4CC DL CA Extension)**: "How does 4CC CA impact baseband processing? What are the license implications?"

13. **5DCAE (5CC DL CA Extension)**: "What is the maximum throughput achievable with 5CC CA? Which UE categories support this?"

14. **6DCAE (6CC DL CA Extension)**: "What are the power constraints when activating 6CC CA? How does SCC management work?"

15. **7DCAE (7CC DL CA Extension)**: "What is the procedure to activate 7CC CA? What are the fallback mechanisms?"

### MIMO & Antenna

16. **4QADPP (4x2 Quad Antenna DL)**: "How does 4x2 MIMO differ from 4x4 in terms of beamforming capabilities?"

17. **4QADPP (4x4 Quad Antenna DL)**: "What are the channel state information requirements for 4x4 MIMO? How does rank adaptation work?"

18. **4FIRC (4x4 Full IRC)**: "What interference scenarios benefit most from 4x4 IRC? How does it differ from standard IRC?"

19. **ASM (Antenna System Monitoring)**: "What alarms does ASM generate? How does it detect antenna faults?"

20. **ACP (Adjustable CRS Power)**: "What is the impact of CRS power adjustments on cell edge performance? How does this relate to LTE power control?"

### Load Balancing & Offload

21. **ATO (Admission-Triggered Offload)**: "What KPIs trigger ATO? How does it differ from MLB?"

22. **AIFLB (Accelerated IFLB)**: "What is the acceleration factor in AIFLB compared to standard IFLB? When should it be used?"

23. **BLM (Basic Load Management)**: "What are the thresholds for BLM activation? How does it handle cell edge users?"

24. **BNRILLM (Best Neighbor Relations)**: "How does BNRILLM select target cells for load balancing? What parameters influence this decision?"

25. **BRCP (Baseband Resource Cell Prioritization)**: "How does BRCP prioritize cells during baseband resource constraints? What is the impact on voice vs data?"

### AI & Machine Learning

26. **APACS (AI Powered Advanced Cell Supervision)**: "What ML algorithms does APACS use for cell supervision? What are the training data requirements?"

27. **APDLA (AI Powered DL Link Adaptation)**: "How does APDLA improve over traditional link adaptation? What are the CQI prediction mechanisms?"

28. **APP (ASGH Performance Package)**: "What performance improvements does APP provide? How does it interact with scheduling?"

29. **ABATF (ASGH-Based A/B Testing)**: "How do I configure A/B testing framework for parameter optimization? What are the statistical significance requirements?"

30. **ABP (ASGH-Based Prescheduling)**: "What are the prescheduling criteria in ABP? How does it affect latency?"

### Admission Control

31. **BAC (Basic Admission Control)**: "What are the default admission thresholds? How do they vary by QCI?"

32. **DUAC (Dynamic UL Attenuation Control)**: "What scenarios trigger DUAC? How does it affect uplink interference?"

33. **ADRFS (Advanced Differentiation)**: "How does ADRFS differentiate between QCI classes for scheduling? What are the priority weights?"

34. **ASAPAU (Advanced SR for Privileged Users)**: "How do I configure privileged user groups? What QCI mappings are supported?"

35. **ACCE (Automated Cell Capacity Estimation)**: "What metrics does ACCE use for capacity estimation? How often does it update?"

### Neighbor Relations & Mobility

36. **ANR (Automated Neighbor Relations)**: "What are the ANR discovery mechanisms? How does it handle PCI conflicts?"

37. **ARRSA (Automated RACH Root Sequence)**: "How does ARRSA allocate RACH sequences? What is the impact on collision probability?"

38. **ASM (Automatic SCell Management)**: "What are the SCell activation/deactivation timers? How does it handle CA scenarios?"

39. **CFDRU (CS Fallback for Dual-Radio)**: "What is the procedure for CS fallback in dual-radio UEs? How does it affect voice call setup?"

40. **GUPLS (A-GPS User Plane)**: "What are the positioning accuracy requirements? How does GUPLS handle emergency calls?"

### Specialized Features

41. **APACS (AI Powered ACS)**: "How does AI-powered ACS differ from traditional ACS? What are the ML model inputs?"

42. **AQRE (ASGH QCI Range Extension)**: "What QCIs are supported in AQRE? How does it affect QoS mapping?"

43. **ABSEP (ASGH-Based Spectral Efficiency)**: "What spectral efficiency improvements does ABSEP provide? How is it measured?"

44. **ARPR (Adaptive RLC Poll-Retransmission)**: "What conditions trigger RLC poll adaptation? How does it affect throughput?"

45. **ADIR (Atmospheric Duct Interference)**: "What atmospheric conditions cause ducting interference? How does ADIR mitigate this?"

### Advanced Features

46. **AILG (Air Interface Load Generator)**: "How is AILG used for testing? What load patterns can it generate?"

47. **ALBS (LTE Broadcast Subframes)**: "How does ALBS configure broadcast subframes? What is the impact on MBMS?"

48. **ARD (Advanced RAN Defense)**: "What security threats does ARD address? How does it detect attacks?"

49. **AF (ASGH Framework)**: "What is the ASGH framework architecture? How do I integrate custom scheduling algorithms?"

50. **CLO (CPRI Link Observability)**: "What performance metrics does CLO provide? How does it help with capacity planning?"

---

## Testing Categories

### Knowledge Queries (1-20)
- Test feature-specific knowledge
- Verify parameter understanding
- Check prerequisite awareness

### Decision Making (21-35)
- Test optimization decisions
- Verify KPI-based actions
- Check policy compliance

### Advanced Scenarios (36-50)
- Test multi-feature interactions
- Verify complex troubleshooting
- Check recommendation generation
