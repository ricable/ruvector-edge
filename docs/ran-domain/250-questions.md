# 250 RAN Feature Agent Battle Test Questions for 4G LTE

## Overview
This document contains 250 technical questions (5 questions per feature) for 50 specialized RAN AI agents. Each agent specializes in one Ericsson 4G LTE feature and must answer questions using:
- Autonomous state machine (ADR-024)
- OODA loop (Observe-Orient-Decide-Act)
- Q-learning for adaptive responses
- Ericsson RAN Features knowledge base

## Testing Categories
- **Category A (Questions 1-125):** Knowledge Retrieval - Test feature-specific knowledge
- **Category B (Questions 126-200):** Decision Making - Test optimization decisions
- **Category C (Questions 201-250):** Advanced Scenarios - Test complex troubleshooting

---

## 1. MSM - MIMO Sleep Mode (FAJ 121 3094)

### Q1-MSM-K01
"What are the activation prerequisites for MIMO Sleep Mode? Which features must be enabled first?"

### Q2-MSM-K02
"What parameters control the sleepMode, sleepStartTime, and sleepEndTime? What are their valid ranges?"

### Q3-MSM-K03
"What counters monitor MSM performance? How is pmMimoSleepTransition used?"

### Q4-MSM-D01
"When should MSM be activated based on traffic patterns? What KPIs indicate optimal sleep timing?"

### Q5-MSM-A01
"A cell is not exiting MIMO sleep during peak hours. What are the troubleshooting steps and which parameters need adjustment?"

---

## 2. P - Prescheduling (FAJ 121 3085)

### Q6-P-K01
"What is the purpose of prescheduling in LTE? How does it reduce latency?"

### Q7-P-K02
"What parameters control prescheduling behavior? How is prescheduling triggered?"

### Q8-P-K03
"What are the trade-offs between prescheduling and resource utilization?"

### Q9-P-D01
"When should prescheduling be enabled for VoLTE traffic? What QCI settings are recommended?"

### Q10-P-A01
"Prescheduling is causing excessive resource utilization. How do you tune it down while maintaining latency benefits?"

---

## 3. D-PUCCH - Dynamic PUCCH (FAJ 121 4377)

### Q11-DPUCCH-K01
"What does Dynamic PUCCH do? How does it differ from static PUCCH allocation?"

### Q12-DPUCCH-K02
"What parameters control PUCCH resource allocation? What is noOfPucchCqiUsers?"

### Q13-DPUCCH-K03
"How does D-PUCCH handle cell unlocking rejections due to resource shortages?"

### Q14-DPUCCH-D01
"When should Dynamic PUCCH be enabled? What cell capacity thresholds trigger its use?"

### Q15-DPUCCH-A01
"Cells are failing to unlock due to PUCCH resource shortage. How do you resolve this using D-PUCCH parameters?"

---

## 4. CIBLS - Cell ID-Based Location Support (FAJ 121 0735)

### Q16-CIBLS-K01
"What is Cell ID-Based Location Support? How does it differ from GPS-based positioning?"

### Q17-CIBLS-K02
"What parameters control CIBLS accuracy? What is the positioning resolution?"

### Q18-CIBLS-K03
"What MO classes are involved in CIBLS? How is ECID calculated?"

### Q19-CIBLS-D01
"When should CIBLS be used instead of A-GPS? What are the accuracy trade-offs?"

### Q20-CIBLS-A01
"CIBLS positioning accuracy is degrading. What parameters affect this and how do you tune them?"

---

## 5. TMS - TM8 Mode Switching (FAJ 121 4508)

### Q21-TMS-K01
"What is TM8 (Transmission Mode 8)? When does TMS switch to TM8?"

### Q22-TMS-K02
"What parameters control TM8 switching thresholds? What are the CQI requirements?"

### Q23-TMS-K03
"What KPIs indicate TM8 is beneficial? How is rank adaptation involved?"

### Q24-TMS-D01
"Under what channel conditions should TM8 be activated? What RI thresholds are used?"

### Q25-TMS-A01
"TM8 switching is causing instability. How do you adjust the switching hysteresis parameters?"

---

## 6. 5MSC - 5+5 MHz Sector Carrier (FAJ 121 3071)

### Q26-5MSC-K01
"What is 5+5 MHz sector carrier configuration? How does it differ from standard carrier configuration?"

### Q27-5MSC-K02
"What are the bandwidth implications of 5MSC? How does it affect throughput?"

### Q28-5MSC-K03
"What parameters control sector carrier aggregation? What are the license requirements?"

### Q29-5MSC-D01
"When should 5MSC be used? What are the capacity benefits over standard configuration?"

### Q30-5MSC-A01
"5MSC is not providing expected throughput gains. What parameters need to be checked and adjusted?"

---

## 7. PIUM - PM-Initiated UE Measurements (FAJ 121 0667)

### Q31-PIUM-K01
"What are PM-Initiated UE Measurements? How do they differ from network-initiated measurements?"

### Q32-PIUM-K02
"What measurement objects does PIUM support? What are the reporting thresholds?"

### Q33-PIUM-K03
"How does PIUM affect UE battery life? What are the measurement intervals?"

### Q34-PIUM-D01
"When should PIUM be enabled for mobility optimization? What are the triggering conditions?"

### Q35-PIUM-A01
"PIUM reports are causing excessive signaling. How do you optimize the measurement configuration?"

---

## 8. EE - Energy Efficiency (FAJ 121 4390)

### Q36-EE-K01
"What is the Energy Efficiency feature? How does it differ from MSM?"

### Q37-EE-K02
"What parameters control energy efficiency mode? What are the power saving thresholds?"

### Q38-EE-K03
"What counters measure energy savings? How is EE performance monitored?"

### Q39-EE-D01
"When should EE be activated? What are the optimal traffic thresholds?"

### Q40-EE-A01
"Energy Efficiency is causing KPI degradation. How do you balance power savings with performance?"

---

## 9. VFH - VoLTE Frequency Hopping (FAJ 121 4224)

### Q41-VFH-K01
"What is VoLTE Frequency Hopping? How does it improve VoLTE quality?"

### Q42-VFH-K02
"What parameters control frequency hopping patterns? What are the hopping modes?"

### Q43-VFH-K03
"What QCI values benefit from VFH? How does it interact with VoLTE scheduling?"

### Q44-VFH-D01
"When should VFH be enabled? What interference scenarios benefit most?"

### Q45-VFH-A01
"VoLTE quality is degrading despite VFH being enabled. What parameters need to be checked?"

---

## 10. LBECS - LPPa-based E-CID Support (FAJ 121 3030)

### Q46-LBECS-K01
"What is LPPa-based E-CID? How does it enhance positioning accuracy?"

### Q47-LBECS-K02
"What parameters control LPPa signaling? What are the measurement reporting types?"

### Q48-LBECS-K03
"What MO classes are involved in LBECS? How does it interface with E-SMLC?"

### Q49-LBECS-D01
"When should LBECS be used? What are the accuracy benefits over standard ECID?"

### Q50-LBECS-A01
"LBECS positioning is failing. What are the common failure modes and how do you troubleshoot them?"

---

## 11. PSS - Prioritized SR Scheduling (FAJ 121 4300)

### Q51-PSS-K01
"What is Prioritized SR Scheduling? How does it differ from standard SR handling?"

### Q52-PSS-K02
"What parameters control SR priority? What QCI values are prioritized?"

### Q53-PSS-K03
"How does PSS affect latency for priority services? What are the scheduling implications?"

### Q54-PSS-D01
"When should PSS be enabled? What service types benefit most?"

### Q55-PSS-A01
"PSS is causing starvation for non-priority UEs. How do you tune the priority weights?"

---

## 12. DFSS - Downlink Frequency-Selective Scheduling (FAJ 121 2053)

### Q56-DFSS-K01
"What is Downlink Frequency-Selective Scheduling? How does it differ from wideband scheduling?"

### Q57-DFSS-K02
"What parameters control frequency-selective scheduling? What are the CQI reporting requirements?"

### Q58-DFSS-K03
"What KPIs indicate DFSS effectiveness? How does it affect throughput?"

### Q59-DFSS-D01
"When should DFSS be enabled? What channel conditions benefit most?"

### Q60-DFSS-A01
"DFSS is not improving throughput. What are the potential causes and how do you troubleshoot?"

---

## 13. ARRSA - Automated RACH Root Sequence Allocation (FAJ 121 2026)

### Q61-ARRSA-K01
"What is Automated RACH Root Sequence Allocation? Why is it needed?"

### Q62-ARRSA-K02
"What parameters control root sequence allocation? How are collisions avoided?"

### Q63-ARRSA-K03
"What counters monitor RACH performance? How is pmRachCollision used?"

### Q64-ARRSA-D01
"When should ARRSA be enabled? What cell scenarios require automated allocation?"

### Q65-ARRSA-A01
"RACH collisions are increasing despite ARRSA. How do you optimize the root sequence configuration?"

---

## 14. IECA - Inter-eNodeB Carrier Aggregation (FAJ 121 4469)

### Q66-IECA-K01
"What is Inter-eNodeB Carrier Aggregation? How does it differ from intra-eNodeB CA?"

### Q67-IECA-K02
"What are the X2 interface requirements for IECA? What parameters control CA between eNodeBs?"

### Q68-IECA-K03
"What are the latency implications of IECA? How does it affect throughput?"

### Q69-IECA-D01
"When should IECA be used? What are the deployment scenarios?"

### Q70-IECA-A01
"IECA throughput is lower than expected. What are the X2 configuration parameters to check?"

---

## 15. DUAC - Dynamic UE Admission Control (FAJ 121 4301)

### Q71-DUAC-K01
"What is Dynamic UE Admission Control? How does it differ from basic admission control?"

### Q72-DUAC-K02
"What parameters control DUAC thresholds? What are the admission criteria?"

### Q73-DUAC-K03
"What KPIs trigger DUAC actions? How does it protect cell performance?"

### Q74-DUAC-D01
"When should DUAC be enabled? What are the optimal admission thresholds?"

### Q75-DUAC-A01
"DUAC is rejecting too many UEs. How do you tune the admission parameters?"

---

## 16. UIR - Uplink Interference Reporting (FAJ 121 4157)

### Q76-UIR-K01
"What is Uplink Interference Reporting? How does it help with interference management?"

### Q77-UIR-K02
"What parameters control interference reporting? What are the interference thresholds?"

### Q78-UIR-K03
"What counters measure uplink interference? How is pmUplinkInterference used?"

### Q79-UIR-D01
"When should UIR be enabled? What interference scenarios require monitoring?"

### Q80-UIR-A01
"Uplink interference is high but UIR is not providing useful data. How do you configure it properly?"

---

## 17. XC - X2 Configuration (FAJ 121 0484)

### Q81-XC-K01
"What is X2 interface in LTE? What is its purpose?"

### Q82-XC-K02
"What parameters control X2 configuration? What are the setup procedures?"

### Q83-XC-K03
"What KPIs monitor X2 performance? How is X2 throughput measured?"

### Q84-XC-D01
"When should X2 be configured? What are the mobility benefits?"

### Q85-XC-A01
"X2 interface is not establishing between neighbors. What are the troubleshooting steps?"

---

## 18. PP - Priority Paging (FAJ 121 3081)

### Q86-PP-K01
"What is Priority Paging? How does it differ from standard paging?"

### Q87-PP-K02
"What parameters control paging priority? What UE classes are prioritized?"

### Q88-PP-K03
"How does PP affect paging capacity? What are the battery implications for UEs?"

### Q89-PP-D01
"When should PP be enabled? What service types benefit most?"

### Q90-PP-A01
"Priority Paging is causing paging channel congestion. How do you optimize the paging configuration?"

---

## 19. MFBI - Multiple Frequency Band Indicators (FAJ 121 3054)

### Q91-MFBI-K01
"What are Multiple Frequency Band Indicators? Why are they needed?"

### Q92-MFBI-K02
"What parameters control MFBI configuration? How are bands indicated?"

### Q93-MFBI-K03
"What UE capabilities support MFBI? How does it affect inter-frequency mobility?"

### Q94-MFBI-D01
"When should MFBI be enabled? What are the deployment scenarios?"

### Q95-MFBI-A01
"MFBI is causing UE measurement issues. How do you configure the band indicators properly?"

---

## 20. UTA-IFLB - UE Throughput-Aware IFLB (FAJ 121 4219)

### Q96-UTAIFLB-K01
"What is UE Throughput-Aware IFLB? How does it differ from standard IFLB?"

### Q97-UTAIFLB-K02
"What parameters control throughput-aware offload? What are the throughput thresholds?"

### Q98-UTAIFLB-K03
"What KPIs indicate UTA-IFLB effectiveness? How is UE throughput monitored?"

### Q99-UTAIFLB-D01
"When should UTA-IFLB be used instead of standard IFLB? What are the benefits?"

### Q100-UTAIFLB-A01
"UTA-IFLB is not offloading UEs effectively. How do you tune the throughput thresholds?"

---

## 21. ECICPLS - Enhanced Cell ID Control Plane Location Support (FAJ 121 1794)

### Q101-ECICPLS-K01
"What is Enhanced Cell ID positioning? How does it differ from basic ECID?"

### Q102-ECICPLS-K02
"What parameters control ECICPLS accuracy? What measurements are used?"

### Q103-ECICPLS-K03
"What MO classes are involved in ECICPLS? How does it interface with MME?"

### Q104-ECICPLS-D01
"When should ECICPLS be used? What are the accuracy requirements?"

### Q105-ECICPLS-A01
"ECICPLS accuracy is below requirements. What parameters affect positioning quality?"

---

## 22. 4QADPP - 4x4 Quad Antenna Downlink Performance Package (FAJ 121 3076)

### Q106-4QADPP4x4-K01
"What is 4x4 MIMO with Quad Antenna? How does it differ from 4x2?"

### Q107-4QADPP4x4-K02
"What parameters control 4x4 MIMO operation? What are the RI requirements?"

### Q108-4QADPP4x4-K03
"What KPIs indicate 4x4 MIMO benefits? How is throughput measured?"

### Q109-4QADPP4x4-D01
"When should 4x4 MIMO be enabled? What are the antenna requirements?"

### Q110-4QADPP4x4-A01
"4x4 MIMO is not providing expected throughput gains. What parameters need to be checked?"

---

## 23. UAA-DRX - UE-Assisted Adaptive DRX (FAJ 121 4429)

### Q111-UAADRX-K01
"What is UE-Assisted Adaptive DRX? How does it differ from network-controlled DRX?"

### Q112-UAADRX-K02
"What parameters control adaptive DRX? What are the DRX cycle configurations?"

### Q113-UAADRX-K03
"How does UAA-DRX affect UE battery life? What are the latency trade-offs?"

### Q114-UAADRX-D01
"When should UAA-DRX be enabled? What UE types benefit most?"

### Q115-UAADRX-A01
"Adaptive DRX is causing excessive latency. How do you tune the DRX parameters?"

---

## 24. 6QU - 64-QAM Uplink (FAJ 121 4363)

### Q116-6QU-K01
"What is 64-QAM Uplink? How does it improve uplink throughput?"

### Q117-6QU-K02
"What are the SINR requirements for 64-QAM UL? What parameters control modulation selection?"

### Q118-6QU-K03
"What KPIs indicate 64-QAM UL effectiveness? How is uplink throughput measured?"

### Q119-6QU-D01
"When should 64-QAM UL be enabled? What are the UE capability requirements?"

### Q120-6QU-A01
"64-QAM UL is not being used. What parameters affect modulation selection and how do you tune them?"

---

## 25. HSU - High Speed UE (FAJ 121 2054)

### Q121-HSU-K01
"What is High Speed UE feature? What UE speeds are considered high speed?"

### Q122-HSU-K02
"What parameters control high speed UE handling? How is speed estimated?"

### Q123-HSU-K03
"What KPIs monitor high speed UE performance? How is handover success affected?"

### Q124-HSU-D01
"When should HSU be enabled? What deployment scenarios benefit?"

### Q125-HSU-A01
"High speed UEs are experiencing poor performance. How do you optimize the HSU parameters?"

---

## 26. IRO-WCDMA - Inter-RAT Offload to WCDMA (FAJ 121 3048)

### Q126-IROWCDMA-K01
"What is Inter-RAT Offload to WCDMA? When should it be used?"

### Q127-IROWCDMA-K02
"What parameters control offload thresholds? What are the triggering conditions?"

### Q128-IROWCDMA-K03
"What KPIs indicate successful offload? How is IRAT handover success measured?"

### Q129-IROWCDMA-D01
"When should IRO-WCDMA be activated? What are the load balancing benefits?"

### Q130-IROWCDMA-A01
"Offload to WCDMA is causing high fallback rates. How do you tune the offload parameters?"

---

## 27. RHC - Robust Header Compression (FAJ 121 0892)

### Q131-RHC-K01
"What is Robust Header Compression? How does it improve throughput?"

### Q132-RHC-K02
"What parameters control RoHC operation? What profiles are supported?"

### Q133-RHC-K03
"How much header compression gain can be expected? What protocols benefit?"

### Q134-RHC-D01
"When should RoHC be enabled? What service types benefit most?"

### Q135-RHC-A01
"RoHC is causing packet loss. What are the common issues and how do you troubleshoot?"

---

## 28. 2QD - 256-QAM Downlink (FAJ 121 4422)

### Q136-2QD-K01
"What is 256-QAM Downlink? What are the SINR requirements?"

### Q137-2QD-K02
"What parameters control 256-QAM DL? What are the CQI thresholds?"

### Q138-2QD-K03
"What KPIs indicate 256-QAM DL effectiveness? How is throughput gain measured?"

### Q139-2QD-D01
"When should 256-QAM DL be enabled? What are the deployment requirements?"

### Q140-2QD-A01
"256-QAM DL is not being used. What parameters affect modulation selection?"

---

## 29. UCMPR - Uplink Coordinated Multi-Point Reception (FAJ 121 3043)

### Q141-UCMPR-K01
"What is Uplink CoMP? How does it improve uplink performance?"

### Q142-UCMPR-K02
"What parameters control UL CoMP operation? What are the coordination requirements?"

### Q143-UCMPR-K03
"What KPIs indicate UL CoMP benefits? How is uplink throughput measured?"

### Q144-UCMPR-D01
"When should UL CoMP be enabled? What are the deployment scenarios?"

### Q145-UCMPR-A01
"UL CoMP is not providing expected gains. What are the potential issues?"

---

## 30. MST - Micro Sleep Tx (FAJ 121 3089)

### Q146-MST-K01
"What is Micro Sleep Tx? How does it differ from MIMO Sleep Mode?"

### Q147-MST-K02
"What parameters control micro sleep operation? What are the sleep thresholds?"

### Q148-MST-K03
"What KPIs indicate MST effectiveness? How is power saving measured?"

### Q149-MST-D01
"When should MST be enabled? What are the optimal traffic conditions?"

### Q150-MST-A01
"Micro Sleep Tx is causing KPI degradation. How do you balance power savings with performance?"

---

## 31. S - Scheduler (FAJ 121 1447)

### Q151-S-K01
"What is the LTE Scheduler? What are its main functions?"

### Q152-S-K02
"What parameters control scheduling behavior? What are the scheduling policies?"

### Q153-S-K03
"What KPIs monitor scheduler performance? How is fairness measured?"

### Q154-S-D01
"When should scheduler parameters be tuned? What are the optimization goals?"

### Q155-S-A01
"Scheduler is causing unfair resource allocation. How do you tune the scheduling weights?"

---

## 32. SSIT - Service Specific Inactivity Timer (FAJ 121 4246)

### Q156-SSIT-K01
"What is Service Specific Inactivity Timer? How does it differ from standard inactivity timer?"

### Q157-SSIT-K02
"What parameters control SSIT per service? What QCI values are supported?"

### Q158-SSIT-K03
"How does SSIT affect signaling and resource release? What are the timer values?"

### Q159-SSIT-D01
"When should SSIT be configured? What services benefit from specific timers?"

### Q160-SSIT-A01
"SSIT is causing early session releases. How do you tune the inactivity timers?"

---

## 33. DUH - Differentiated UE Handling (FAJ 121 4368)

### Q161-DUH-K01
"What is Differentiated UE Handling? How does it categorize UEs?"

### Q162-DUH-K02
"What parameters control UE differentiation? What are the UE classes?"

### Q163-DUH-K03
"What KPIs indicate DUH effectiveness? How is service quality measured per class?"

### Q164-DUH-D01
"When should DUH be enabled? What deployment scenarios benefit?"

### Q165-DUH-A01
"DUH is causing service degradation for certain UE classes. How do you tune the handling parameters?"

---

## 34. ULOHM - UE Level Oscillating Handover Minimization (FAJ 121 1885)

### Q166-ULOHM-K01
"What is UE Level Oscillating Handover Minimization? How does it detect ping-pong handovers?"

### Q167-ULOHM-K02
"What parameters control oscillation detection? What are the ping-pong thresholds?"

### Q168-ULOHM-K03
"What KPIs indicate ULOHM effectiveness? How is handover success measured?"

### Q169-ULOHM-D01
"When should ULOHM be enabled? What scenarios cause oscillating handovers?"

### Q170-ULOHM-A01
"ULOHM is preventing necessary handovers. How do you tune the oscillation parameters?"

---

## 35. 71CS - 7-12 Cell Support (FAJ 121 3020)

### Q171-71CS-K01
"What is 7-12 Cell Support? How does it differ from 6 cell support?"

### Q172-71CS-K02
"What parameters control 7-12 cell configuration? What are the hardware requirements?"

### Q173-71CS-K03
"What counters monitor cell capacity? How are resources allocated?"

### Q174-71CS-D01
"When should 7-12 cell support be enabled? What are the capacity benefits?"

### Q175-71CS-A01
"Cell expansion to 12 cells is failing. What parameters need to be checked and adjusted?"

---

## 36. EUBS - End-User Bitrate Shaping (FAJ 121 1745)

### Q176-EUBS-K01
"What is End-User Bitrate Shaping? How does it differ from QoS-based rate limiting?"

### Q177-EUBS-K02
"What parameters control bitrate shaping? What are the rate limits?"

### Q178-EUBS-K03
"What KPIs indicate EUBS effectiveness? How is user experience measured?"

### Q179-EUBS-D01
"When should EUBS be enabled? What are the use cases?"

### Q180-EUBS-A01
"Bitrate shaping is causing poor user experience. How do you tune the rate limits?"

---

## 37. UM-MIMO - Uplink Multiuser MIMO (FAJ 121 4330)

### Q181-UMMIMO-K01
"What is Uplink Multiuser MIMO? How does it increase uplink capacity?"

### Q182-UMMIMO-K02
"What parameters control UL MU-MIMO operation? What are the scheduling requirements?"

### Q183-UMMIMO-K03
"What KPIs indicate UL MU-MIMO benefits? How is uplink throughput measured?"

### Q184-UMMIMO-D01
"When should UL MU-MIMO be enabled? What are the deployment requirements?"

### Q185-UMMIMO-A01
"UL MU-MIMO is not providing expected gains. What are the potential issues?"

---

## 38. UCA - Uplink Carrier Aggregation (FAJ 121 4425)

### Q186-UCA-K01
"What is Uplink Carrier Aggregation? How does it differ from DL CA?"

### Q187-UCA-K02
"What parameters control UL CA operation? What are the UE capability requirements?"

### Q188-UCA-K03
"What KPIs indicate UL CA effectiveness? How is uplink throughput measured?"

### Q189-UCA-D01
"When should UL CA be enabled? What are the deployment scenarios?"

### Q190-UCA-A01
"UL CA is not active. What parameters need to be checked?"

---

## 39. EPLA - Enhanced PDCCH Link Adaptation (FAJ 121 3051)

### Q191-EPLA-K01
"What is Enhanced PDCCH Link Adaptation? How does it improve control channel reliability?"

### Q192-EPLA-K02
"What parameters control PDCCH link adaptation? What are the CCE allocation strategies?"

### Q193-EPLA-K03
"What KPIs indicate EPLA effectiveness? How is PDCCH BLER measured?"

### Q194-EPLA-D01
"When should EPLA be enabled? What are the coverage benefits?"

### Q195-EPLA-A01
"PDCCH performance is poor despite EPLA. What parameters need tuning?"

---

## 40. LUA-IFLB - Limited-Uplink-Aware IFLB (FAJ 121 4406)

### Q196-LUAIFLB-K01
"What is Limited-Uplink-Aware IFLB? How does it differ from standard IFLB?"

### Q197-LUAIFLB-K02
"What parameters control uplink-aware offload? What are the UL thresholds?"

### Q198-LUAIFLB-K03
"What KPIs indicate LUA-IFLB effectiveness? How is uplink load measured?"

### Q199-LUAIFLB-D01
"When should LUA-IFLB be used? What are the benefits over standard IFLB?"

### Q200-LUAIFLB-A01
"LUA-IFLB is not balancing uplink load effectively. How do you tune the UL thresholds?"

---

## 41. ILI - IP Loopback Interface (FAJ 121 4411)

### Q201-ILI-K01
"What is IP Loopback Interface? What is its purpose in LTE?"

### Q202-ILI-K02
"What parameters control loopback configuration? How are IP addresses assigned?"

### Q203-ILI-K03
"What are the use cases for IP loopback? How does it aid testing?"

### Q204-ILI-D01
"When should ILI be configured? What deployment scenarios require it?"

### Q205-ILI-A01
"IP loopback is not working as expected. What are the troubleshooting steps?"

---

## 42. FTSE - FDD and TDD on Same eNodeB (FAJ 121 4274)

### Q206-FTSE-K01
"What is FDD and TDD on Same eNodeB? What are the deployment benefits?"

### Q207-FTSE-K02
"What parameters control FDD/TDD coexistence? What are the interference considerations?"

### Q208-FTSE-K03
"What KPIs monitor FDD/TDD operation? How is performance measured?"

### Q209-FTSE-D01
"When should FTSE be deployed? What are the planning requirements?"

### Q210-FTSE-A01
"FDD/TDD coexistence is causing interference. How do you optimize the configuration?"

---

## 43. ACCE - Automated Cell Capacity Estimation (FAJ 121 3031)

### Q211-ACCE-K01
"What is Automated Cell Capacity Estimation? How does it work?"

### Q212-ACCE-K02
"What parameters control capacity estimation? What metrics are used?"

### Q213-ACCE-K03
"What KPIs indicate ACCE accuracy? How is capacity estimated?"

### Q214-ACCE-D01
"When should ACCE be used? What are the planning benefits?"

### Q215-ACCE-A01
"Capacity estimation is inaccurate. How do you tune ACCE parameters?"

---

## 44. LB - LTE Broadcast (FAJ 121 3021)

### Q216-LB-K01
"What is LTE Broadcast? How does it differ from MBMS?"

### Q217-LB-K02
"What parameters control broadcast operation? What are the resource allocation modes?"

### Q218-LB-K03
"What KPIs indicate LB effectiveness? How is broadcast quality measured?"

### Q219-LB-D01
"When should LTE Broadcast be used? What are the use cases?"

### Q220-LB-A01
"LTE Broadcast is experiencing quality issues. What parameters need tuning?"

---

## 45. IFO - Inter-Frequency Offload (FAJ 121 3061)

### Q221-IFO-K01
"What is Inter-Frequency Offload? How does it differ from IFLB?"

### Q222-IFO-K02
"What parameters control inter-frequency offload? What are the offload thresholds?"

### Q223-IFO-K03
"What KPIs indicate IFO effectiveness? How is offload success measured?"

### Q224-IFO-D01
"When should IFO be activated? What are the load balancing benefits?"

### Q225-IFO-A01
"Inter-frequency offload is causing high ping-pong rates. How do you tune the offload parameters?"

---

## 46. ACP - Adjustable CRS Power (FAJ 121 3049)

### Q226-ACP-K01
"What is Adjustable CRS Power? How does it affect cell edge performance?"

### Q227-ACP-K02
"What parameters control CRS power adjustment? What are the power boost ranges?"

### Q228-ACP-K03
"What KPIs indicate ACP effectiveness? How is cell edge throughput measured?"

### Q229-ACP-D01
"When should ACP be used? What deployment scenarios benefit?"

### Q230-ACP-A01
"CRS power adjustment is causing interference. How do you optimize the power settings?"

---

## 47. PVAB - Prioritization of VoLTE in Access Barring (FAJ 121 4329)

### Q231-PVAB-K01
"What is VoLTE Prioritization in Access Barring? How does it work?"

### Q232-PVAB-K02
"What parameters control VoLTE access priority? What are the barring configurations?"

### Q233-PVAB-K03
"What KPIs indicate PVAB effectiveness? How is VoLTE access success measured?"

### Q234-PVAB-D01
"When should PVAB be enabled? What congestion scenarios benefit?"

### Q235-PVAB-A01
"VoLTE access is still failing despite PVAB. How do you tune the barring parameters?"

---

## 48. CFDRU - CS Fallback for Dual-Radio UEs (FAJ 121 0845)

### Q236-CFDRU-K01
"What is CS Fallback for Dual-Radio UEs? How does it differ from standard CSFB?"

### Q237-CFDRU-K02
"What parameters control dual-radio CSFB? What are the fallback procedures?"

### Q238-CFDRU-K03
"What KPIs indicate CFDRU effectiveness? How is fallback success measured?"

### Q239-CFDRU-D01
"When should CFDRU be configured? What are the deployment requirements?"

### Q240-CFDRU-A01
"CS Fallback is failing for dual-radio UEs. What are the troubleshooting steps?"

---

## 49. 4QADPP-4x2 - 4x2 Quad Antenna Downlink Performance Package (FAJ 121 3041)

### Q241-4QADPP4x2-K01
"What is 4x2 MIMO with Quad Antenna? How does it differ from 2x2?"

### Q242-4QADPP4x2-K02
"What parameters control 4x2 MIMO operation? What are the antenna requirements?"

### Q243-4QADPP4x2-K03
"What KPIs indicate 4x2 MIMO benefits? How is throughput measured?"

### Q244-4QADPP4x2-D01
"When should 4x2 MIMO be enabled? What are the deployment scenarios?"

### Q245-4QADPP4x2-A01
"4x2 MIMO is not providing expected gains. What parameters need checking?"

---

## 50. MC-PUSCH - Multi-Clustered PUSCH (FAJ 121 4468)

### Q246-MCPUSCH-K01
"What is Multi-Clustered PUSCH? How does it improve uplink performance?"

### Q247-MCPUSCH-K02
"What parameters control PUSCH clustering? What are the allocation strategies?"

### Q248-MCPUSCH-K03
"What KPIs indicate MC-PUSCH effectiveness? How is uplink throughput measured?"

### Q249-MCPUSCH-D01
"When should MC-PUSCH be enabled? What are the deployment requirements?"

### Q250-MCPUSCH-A01
"Multi-Clustered PUSCH is not active. What parameters need configuration?"

---

## Battle Test Scenarios

### Category A: Knowledge Retrieval (Q1-Q125)
Tests the agent's ability to retrieve accurate feature information from the Ericsson knowledge base.

**Success Criteria:**
- Accurate parameter names and values
- Correct FAJ/CXC codes
- Proper prerequisite identification
- Accurate counter/KPI mappings

### Category B: Decision Making (Q126-Q200)
Tests the agent's ability to make optimization decisions based on KPIs and network conditions.

**Success Criteria:**
- Correct activation/deactivation decisions
- Appropriate parameter tuning recommendations
- KPI-based threshold optimization
- Policy-compliant actions

### Category C: Advanced Troubleshooting (Q201-Q250)
Tests the agent's ability to handle complex multi-parameter scenarios and cross-feature dependencies.

**Success Criteria:**
- Root cause identification
- Multi-parameter optimization
- Cross-feature impact analysis
- Step-by-step troubleshooting procedures

---

## Scoring System

### Knowledge Score (0-40 points per feature)
- Q-K01: Basic feature knowledge (5 points)
- Q-K02: Parameter understanding (5 points)
- Q-K03: Counter/KPI knowledge (5 points)
- Q-D01: Decision criteria (5 points)
- Q-A01: Advanced scenario (5 points)

### Overall Agent Score (0-200 points)
- Knowledge Retrieval: 80 points (125 questions)
- Decision Making: 60 points (75 questions)
- Advanced Troubleshooting: 60 points (50 questions)

### Bonus Points
- OODA Loop Efficiency: +20 points
- Q-Learning Convergence: +20 points
- Cross-Feature Coordination: +20 points

---

## Implementation Notes

1. **Agent Initialization**: Each agent loads its feature data from the Ericsson knowledge base
2. **State Representation**: 64-dim state vector from parameters, counters, and KPIs
3. **Action Space**: Parameter adjustments within safe zones
4. **Reward Function**: Based on KPI improvements and policy compliance
5. **Learning Rate**: α=0.1, γ=0.95, ε-decay for exploration

---

## References
- ADR-004: One Agent Per Feature Specialization
- ADR-024: Autonomous State Machine
- ADR-107: Domain-Driven Design Structure
- ADR-108: Ericsson Feature Ontology Integration
- Ericsson RAN Features Knowledge Base
