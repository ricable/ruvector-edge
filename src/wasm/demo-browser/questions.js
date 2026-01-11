export const questions = [
  {
    "id": "Q1-MSM-K01",
    "category": "Knowledge Retrieval",
    "text": "What are the activation prerequisites for MIMO Sleep Mode? Which features must be enabled first?"
  },
  {
    "id": "Q2-MSM-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control the sleepMode, sleepStartTime, and sleepEndTime? What are their valid ranges?"
  },
  {
    "id": "Q3-MSM-K03",
    "category": "Knowledge Retrieval",
    "text": "What counters monitor MSM performance? How is pmMimoSleepTransition used?"
  },
  {
    "id": "Q4-MSM-D01",
    "category": "Knowledge Retrieval",
    "text": "When should MSM be activated based on traffic patterns? What KPIs indicate optimal sleep timing?"
  },
  {
    "id": "Q5-MSM-A01",
    "category": "Knowledge Retrieval",
    "text": "A cell is not exiting MIMO sleep during peak hours. What are the troubleshooting steps and which parameters need adjustment?"
  },
  {
    "id": "Q6-P-K01",
    "category": "Knowledge Retrieval",
    "text": "What is the purpose of prescheduling in LTE? How does it reduce latency?"
  },
  {
    "id": "Q7-P-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control prescheduling behavior? How is prescheduling triggered?"
  },
  {
    "id": "Q8-P-K03",
    "category": "Knowledge Retrieval",
    "text": "What are the trade-offs between prescheduling and resource utilization?"
  },
  {
    "id": "Q9-P-D01",
    "category": "Knowledge Retrieval",
    "text": "When should prescheduling be enabled for VoLTE traffic? What QCI settings are recommended?"
  },
  {
    "id": "Q10-P-A01",
    "category": "Knowledge Retrieval",
    "text": "Prescheduling is causing excessive resource utilization. How do you tune it down while maintaining latency benefits?"
  },
  {
    "id": "Q11-DPUCCH-K01",
    "category": "Knowledge Retrieval",
    "text": "What does Dynamic PUCCH do? How does it differ from static PUCCH allocation?"
  },
  {
    "id": "Q12-DPUCCH-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control PUCCH resource allocation? What is noOfPucchCqiUsers?"
  },
  {
    "id": "Q13-DPUCCH-K03",
    "category": "Knowledge Retrieval",
    "text": "How does D-PUCCH handle cell unlocking rejections due to resource shortages?"
  },
  {
    "id": "Q14-DPUCCH-D01",
    "category": "Knowledge Retrieval",
    "text": "When should Dynamic PUCCH be enabled? What cell capacity thresholds trigger its use?"
  },
  {
    "id": "Q15-DPUCCH-A01",
    "category": "Knowledge Retrieval",
    "text": "Cells are failing to unlock due to PUCCH resource shortage. How do you resolve this using D-PUCCH parameters?"
  },
  {
    "id": "Q16-CIBLS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Cell ID-Based Location Support? How does it differ from GPS-based positioning?"
  },
  {
    "id": "Q17-CIBLS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control CIBLS accuracy? What is the positioning resolution?"
  },
  {
    "id": "Q18-CIBLS-K03",
    "category": "Knowledge Retrieval",
    "text": "What MO classes are involved in CIBLS? How is ECID calculated?"
  },
  {
    "id": "Q19-CIBLS-D01",
    "category": "Knowledge Retrieval",
    "text": "When should CIBLS be used instead of A-GPS? What are the accuracy trade-offs?"
  },
  {
    "id": "Q20-CIBLS-A01",
    "category": "Knowledge Retrieval",
    "text": "CIBLS positioning accuracy is degrading. What parameters affect this and how do you tune them?"
  },
  {
    "id": "Q21-TMS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is TM8 (Transmission Mode 8)? When does TMS switch to TM8?"
  },
  {
    "id": "Q22-TMS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control TM8 switching thresholds? What are the CQI requirements?"
  },
  {
    "id": "Q23-TMS-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs indicate TM8 is beneficial? How is rank adaptation involved?"
  },
  {
    "id": "Q24-TMS-D01",
    "category": "Knowledge Retrieval",
    "text": "Under what channel conditions should TM8 be activated? What RI thresholds are used?"
  },
  {
    "id": "Q25-TMS-A01",
    "category": "Knowledge Retrieval",
    "text": "TM8 switching is causing instability. How do you adjust the switching hysteresis parameters?"
  },
  {
    "id": "Q26-5MSC-K01",
    "category": "Knowledge Retrieval",
    "text": "What is 5+5 MHz sector carrier configuration? How does it differ from standard carrier configuration?"
  },
  {
    "id": "Q27-5MSC-K02",
    "category": "Knowledge Retrieval",
    "text": "What are the bandwidth implications of 5MSC? How does it affect throughput?"
  },
  {
    "id": "Q28-5MSC-K03",
    "category": "Knowledge Retrieval",
    "text": "What parameters control sector carrier aggregation? What are the license requirements?"
  },
  {
    "id": "Q29-5MSC-D01",
    "category": "Knowledge Retrieval",
    "text": "When should 5MSC be used? What are the capacity benefits over standard configuration?"
  },
  {
    "id": "Q30-5MSC-A01",
    "category": "Knowledge Retrieval",
    "text": "5MSC is not providing expected throughput gains. What parameters need to be checked and adjusted?"
  },
  {
    "id": "Q31-PIUM-K01",
    "category": "Knowledge Retrieval",
    "text": "What are PM-Initiated UE Measurements? How do they differ from network-initiated measurements?"
  },
  {
    "id": "Q32-PIUM-K02",
    "category": "Knowledge Retrieval",
    "text": "What measurement objects does PIUM support? What are the reporting thresholds?"
  },
  {
    "id": "Q33-PIUM-K03",
    "category": "Knowledge Retrieval",
    "text": "How does PIUM affect UE battery life? What are the measurement intervals?"
  },
  {
    "id": "Q34-PIUM-D01",
    "category": "Knowledge Retrieval",
    "text": "When should PIUM be enabled for mobility optimization? What are the triggering conditions?"
  },
  {
    "id": "Q35-PIUM-A01",
    "category": "Knowledge Retrieval",
    "text": "PIUM reports are causing excessive signaling. How do you optimize the measurement configuration?"
  },
  {
    "id": "Q36-EE-K01",
    "category": "Knowledge Retrieval",
    "text": "What is the Energy Efficiency feature? How does it differ from MSM?"
  },
  {
    "id": "Q37-EE-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control energy efficiency mode? What are the power saving thresholds?"
  },
  {
    "id": "Q38-EE-K03",
    "category": "Knowledge Retrieval",
    "text": "What counters measure energy savings? How is EE performance monitored?"
  },
  {
    "id": "Q39-EE-D01",
    "category": "Knowledge Retrieval",
    "text": "When should EE be activated? What are the optimal traffic thresholds?"
  },
  {
    "id": "Q40-EE-A01",
    "category": "Knowledge Retrieval",
    "text": "Energy Efficiency is causing KPI degradation. How do you balance power savings with performance?"
  },
  {
    "id": "Q41-VFH-K01",
    "category": "Knowledge Retrieval",
    "text": "What is VoLTE Frequency Hopping? How does it improve VoLTE quality?"
  },
  {
    "id": "Q42-VFH-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control frequency hopping patterns? What are the hopping modes?"
  },
  {
    "id": "Q43-VFH-K03",
    "category": "Knowledge Retrieval",
    "text": "What QCI values benefit from VFH? How does it interact with VoLTE scheduling?"
  },
  {
    "id": "Q44-VFH-D01",
    "category": "Knowledge Retrieval",
    "text": "When should VFH be enabled? What interference scenarios benefit most?"
  },
  {
    "id": "Q45-VFH-A01",
    "category": "Knowledge Retrieval",
    "text": "VoLTE quality is degrading despite VFH being enabled. What parameters need to be checked?"
  },
  {
    "id": "Q46-LBECS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is LPPa-based E-CID? How does it enhance positioning accuracy?"
  },
  {
    "id": "Q47-LBECS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control LPPa signaling? What are the measurement reporting types?"
  },
  {
    "id": "Q48-LBECS-K03",
    "category": "Knowledge Retrieval",
    "text": "What MO classes are involved in LBECS? How does it interface with E-SMLC?"
  },
  {
    "id": "Q49-LBECS-D01",
    "category": "Knowledge Retrieval",
    "text": "When should LBECS be used? What are the accuracy benefits over standard ECID?"
  },
  {
    "id": "Q50-LBECS-A01",
    "category": "Knowledge Retrieval",
    "text": "LBECS positioning is failing. What are the common failure modes and how do you troubleshoot them?"
  },
  {
    "id": "Q51-PSS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Prioritized SR Scheduling? How does it differ from standard SR handling?"
  },
  {
    "id": "Q52-PSS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control SR priority? What QCI values are prioritized?"
  },
  {
    "id": "Q53-PSS-K03",
    "category": "Knowledge Retrieval",
    "text": "How does PSS affect latency for priority services? What are the scheduling implications?"
  },
  {
    "id": "Q54-PSS-D01",
    "category": "Knowledge Retrieval",
    "text": "When should PSS be enabled? What service types benefit most?"
  },
  {
    "id": "Q55-PSS-A01",
    "category": "Knowledge Retrieval",
    "text": "PSS is causing starvation for non-priority UEs. How do you tune the priority weights?"
  },
  {
    "id": "Q56-DFSS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Downlink Frequency-Selective Scheduling? How does it differ from wideband scheduling?"
  },
  {
    "id": "Q57-DFSS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control frequency-selective scheduling? What are the CQI reporting requirements?"
  },
  {
    "id": "Q58-DFSS-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs indicate DFSS effectiveness? How does it affect throughput?"
  },
  {
    "id": "Q59-DFSS-D01",
    "category": "Knowledge Retrieval",
    "text": "When should DFSS be enabled? What channel conditions benefit most?"
  },
  {
    "id": "Q60-DFSS-A01",
    "category": "Knowledge Retrieval",
    "text": "DFSS is not improving throughput. What are the potential causes and how do you troubleshoot?"
  },
  {
    "id": "Q61-ARRSA-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Automated RACH Root Sequence Allocation? Why is it needed?"
  },
  {
    "id": "Q62-ARRSA-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control root sequence allocation? How are collisions avoided?"
  },
  {
    "id": "Q63-ARRSA-K03",
    "category": "Knowledge Retrieval",
    "text": "What counters monitor RACH performance? How is pmRachCollision used?"
  },
  {
    "id": "Q64-ARRSA-D01",
    "category": "Knowledge Retrieval",
    "text": "When should ARRSA be enabled? What cell scenarios require automated allocation?"
  },
  {
    "id": "Q65-ARRSA-A01",
    "category": "Knowledge Retrieval",
    "text": "RACH collisions are increasing despite ARRSA. How do you optimize the root sequence configuration?"
  },
  {
    "id": "Q66-IECA-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Inter-eNodeB Carrier Aggregation? How does it differ from intra-eNodeB CA?"
  },
  {
    "id": "Q67-IECA-K02",
    "category": "Knowledge Retrieval",
    "text": "What are the X2 interface requirements for IECA? What parameters control CA between eNodeBs?"
  },
  {
    "id": "Q68-IECA-K03",
    "category": "Knowledge Retrieval",
    "text": "What are the latency implications of IECA? How does it affect throughput?"
  },
  {
    "id": "Q69-IECA-D01",
    "category": "Knowledge Retrieval",
    "text": "When should IECA be used? What are the deployment scenarios?"
  },
  {
    "id": "Q70-IECA-A01",
    "category": "Knowledge Retrieval",
    "text": "IECA throughput is lower than expected. What are the X2 configuration parameters to check?"
  },
  {
    "id": "Q71-DUAC-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Dynamic UE Admission Control? How does it differ from basic admission control?"
  },
  {
    "id": "Q72-DUAC-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control DUAC thresholds? What are the admission criteria?"
  },
  {
    "id": "Q73-DUAC-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs trigger DUAC actions? How does it protect cell performance?"
  },
  {
    "id": "Q74-DUAC-D01",
    "category": "Knowledge Retrieval",
    "text": "When should DUAC be enabled? What are the optimal admission thresholds?"
  },
  {
    "id": "Q75-DUAC-A01",
    "category": "Knowledge Retrieval",
    "text": "DUAC is rejecting too many UEs. How do you tune the admission parameters?"
  },
  {
    "id": "Q76-UIR-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Uplink Interference Reporting? How does it help with interference management?"
  },
  {
    "id": "Q77-UIR-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control interference reporting? What are the interference thresholds?"
  },
  {
    "id": "Q78-UIR-K03",
    "category": "Knowledge Retrieval",
    "text": "What counters measure uplink interference? How is pmUplinkInterference used?"
  },
  {
    "id": "Q79-UIR-D01",
    "category": "Knowledge Retrieval",
    "text": "When should UIR be enabled? What interference scenarios require monitoring?"
  },
  {
    "id": "Q80-UIR-A01",
    "category": "Knowledge Retrieval",
    "text": "Uplink interference is high but UIR is not providing useful data. How do you configure it properly?"
  },
  {
    "id": "Q81-XC-K01",
    "category": "Knowledge Retrieval",
    "text": "What is X2 interface in LTE? What is its purpose?"
  },
  {
    "id": "Q82-XC-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control X2 configuration? What are the setup procedures?"
  },
  {
    "id": "Q83-XC-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs monitor X2 performance? How is X2 throughput measured?"
  },
  {
    "id": "Q84-XC-D01",
    "category": "Knowledge Retrieval",
    "text": "When should X2 be configured? What are the mobility benefits?"
  },
  {
    "id": "Q85-XC-A01",
    "category": "Knowledge Retrieval",
    "text": "X2 interface is not establishing between neighbors. What are the troubleshooting steps?"
  },
  {
    "id": "Q86-PP-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Priority Paging? How does it differ from standard paging?"
  },
  {
    "id": "Q87-PP-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control paging priority? What UE classes are prioritized?"
  },
  {
    "id": "Q88-PP-K03",
    "category": "Knowledge Retrieval",
    "text": "How does PP affect paging capacity? What are the battery implications for UEs?"
  },
  {
    "id": "Q89-PP-D01",
    "category": "Knowledge Retrieval",
    "text": "When should PP be enabled? What service types benefit most?"
  },
  {
    "id": "Q90-PP-A01",
    "category": "Knowledge Retrieval",
    "text": "Priority Paging is causing paging channel congestion. How do you optimize the paging configuration?"
  },
  {
    "id": "Q91-MFBI-K01",
    "category": "Knowledge Retrieval",
    "text": "What are Multiple Frequency Band Indicators? Why are they needed?"
  },
  {
    "id": "Q92-MFBI-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control MFBI configuration? How are bands indicated?"
  },
  {
    "id": "Q93-MFBI-K03",
    "category": "Knowledge Retrieval",
    "text": "What UE capabilities support MFBI? How does it affect inter-frequency mobility?"
  },
  {
    "id": "Q94-MFBI-D01",
    "category": "Knowledge Retrieval",
    "text": "When should MFBI be enabled? What are the deployment scenarios?"
  },
  {
    "id": "Q95-MFBI-A01",
    "category": "Knowledge Retrieval",
    "text": "MFBI is causing UE measurement issues. How do you configure the band indicators properly?"
  },
  {
    "id": "Q96-UTAIFLB-K01",
    "category": "Knowledge Retrieval",
    "text": "What is UE Throughput-Aware IFLB? How does it differ from standard IFLB?"
  },
  {
    "id": "Q97-UTAIFLB-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control throughput-aware offload? What are the throughput thresholds?"
  },
  {
    "id": "Q98-UTAIFLB-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs indicate UTA-IFLB effectiveness? How is UE throughput monitored?"
  },
  {
    "id": "Q99-UTAIFLB-D01",
    "category": "Knowledge Retrieval",
    "text": "When should UTA-IFLB be used instead of standard IFLB? What are the benefits?"
  },
  {
    "id": "Q100-UTAIFLB-A01",
    "category": "Knowledge Retrieval",
    "text": "UTA-IFLB is not offloading UEs effectively. How do you tune the throughput thresholds?"
  },
  {
    "id": "Q101-ECICPLS-K01",
    "category": "Knowledge Retrieval",
    "text": "What is Enhanced Cell ID positioning? How does it differ from basic ECID?"
  },
  {
    "id": "Q102-ECICPLS-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control ECICPLS accuracy? What measurements are used?"
  },
  {
    "id": "Q103-ECICPLS-K03",
    "category": "Knowledge Retrieval",
    "text": "What MO classes are involved in ECICPLS? How does it interface with MME?"
  },
  {
    "id": "Q104-ECICPLS-D01",
    "category": "Knowledge Retrieval",
    "text": "When should ECICPLS be used? What are the accuracy requirements?"
  },
  {
    "id": "Q105-ECICPLS-A01",
    "category": "Knowledge Retrieval",
    "text": "ECICPLS accuracy is below requirements. What parameters affect positioning quality?"
  },
  {
    "id": "Q106-4QADPP4x4-K01",
    "category": "Knowledge Retrieval",
    "text": "What is 4x4 MIMO with Quad Antenna? How does it differ from 4x2?"
  },
  {
    "id": "Q107-4QADPP4x4-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control 4x4 MIMO operation? What are the RI requirements?"
  },
  {
    "id": "Q108-4QADPP4x4-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs indicate 4x4 MIMO benefits? How is throughput measured?"
  },
  {
    "id": "Q109-4QADPP4x4-D01",
    "category": "Knowledge Retrieval",
    "text": "When should 4x4 MIMO be enabled? What are the antenna requirements?"
  },
  {
    "id": "Q110-4QADPP4x4-A01",
    "category": "Knowledge Retrieval",
    "text": "4x4 MIMO is not providing expected throughput gains. What parameters need to be checked?"
  },
  {
    "id": "Q111-UAADRX-K01",
    "category": "Knowledge Retrieval",
    "text": "What is UE-Assisted Adaptive DRX? How does it differ from network-controlled DRX?"
  },
  {
    "id": "Q112-UAADRX-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control adaptive DRX? What are the DRX cycle configurations?"
  },
  {
    "id": "Q113-UAADRX-K03",
    "category": "Knowledge Retrieval",
    "text": "How does UAA-DRX affect UE battery life? What are the latency trade-offs?"
  },
  {
    "id": "Q114-UAADRX-D01",
    "category": "Knowledge Retrieval",
    "text": "When should UAA-DRX be enabled? What UE types benefit most?"
  },
  {
    "id": "Q115-UAADRX-A01",
    "category": "Knowledge Retrieval",
    "text": "Adaptive DRX is causing excessive latency. How do you tune the DRX parameters?"
  },
  {
    "id": "Q116-6QU-K01",
    "category": "Knowledge Retrieval",
    "text": "What is 64-QAM Uplink? How does it improve uplink throughput?"
  },
  {
    "id": "Q117-6QU-K02",
    "category": "Knowledge Retrieval",
    "text": "What are the SINR requirements for 64-QAM UL? What parameters control modulation selection?"
  },
  {
    "id": "Q118-6QU-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs indicate 64-QAM UL effectiveness? How is uplink throughput measured?"
  },
  {
    "id": "Q119-6QU-D01",
    "category": "Knowledge Retrieval",
    "text": "When should 64-QAM UL be enabled? What are the UE capability requirements?"
  },
  {
    "id": "Q120-6QU-A01",
    "category": "Knowledge Retrieval",
    "text": "64-QAM UL is not being used. What parameters affect modulation selection and how do you tune them?"
  },
  {
    "id": "Q121-HSU-K01",
    "category": "Knowledge Retrieval",
    "text": "What is High Speed UE feature? What UE speeds are considered high speed?"
  },
  {
    "id": "Q122-HSU-K02",
    "category": "Knowledge Retrieval",
    "text": "What parameters control high speed UE handling? How is speed estimated?"
  },
  {
    "id": "Q123-HSU-K03",
    "category": "Knowledge Retrieval",
    "text": "What KPIs monitor high speed UE performance? How is handover success affected?"
  },
  {
    "id": "Q124-HSU-D01",
    "category": "Knowledge Retrieval",
    "text": "When should HSU be enabled? What deployment scenarios benefit?"
  },
  {
    "id": "Q125-HSU-A01",
    "category": "Knowledge Retrieval",
    "text": "High speed UEs are experiencing poor performance. How do you optimize the HSU parameters?"
  },
  {
    "id": "Q126-IROWCDMA-K01",
    "category": "Decision Making",
    "text": "What is Inter-RAT Offload to WCDMA? When should it be used?"
  },
  {
    "id": "Q127-IROWCDMA-K02",
    "category": "Decision Making",
    "text": "What parameters control offload thresholds? What are the triggering conditions?"
  },
  {
    "id": "Q128-IROWCDMA-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate successful offload? How is IRAT handover success measured?"
  },
  {
    "id": "Q129-IROWCDMA-D01",
    "category": "Decision Making",
    "text": "When should IRO-WCDMA be activated? What are the load balancing benefits?"
  },
  {
    "id": "Q130-IROWCDMA-A01",
    "category": "Decision Making",
    "text": "Offload to WCDMA is causing high fallback rates. How do you tune the offload parameters?"
  },
  {
    "id": "Q131-RHC-K01",
    "category": "Decision Making",
    "text": "What is Robust Header Compression? How does it improve throughput?"
  },
  {
    "id": "Q132-RHC-K02",
    "category": "Decision Making",
    "text": "What parameters control RoHC operation? What profiles are supported?"
  },
  {
    "id": "Q133-RHC-K03",
    "category": "Decision Making",
    "text": "How much header compression gain can be expected? What protocols benefit?"
  },
  {
    "id": "Q134-RHC-D01",
    "category": "Decision Making",
    "text": "When should RoHC be enabled? What service types benefit most?"
  },
  {
    "id": "Q135-RHC-A01",
    "category": "Decision Making",
    "text": "RoHC is causing packet loss. What are the common issues and how do you troubleshoot?"
  },
  {
    "id": "Q136-2QD-K01",
    "category": "Decision Making",
    "text": "What is 256-QAM Downlink? What are the SINR requirements?"
  },
  {
    "id": "Q137-2QD-K02",
    "category": "Decision Making",
    "text": "What parameters control 256-QAM DL? What are the CQI thresholds?"
  },
  {
    "id": "Q138-2QD-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate 256-QAM DL effectiveness? How is throughput gain measured?"
  },
  {
    "id": "Q139-2QD-D01",
    "category": "Decision Making",
    "text": "When should 256-QAM DL be enabled? What are the deployment requirements?"
  },
  {
    "id": "Q140-2QD-A01",
    "category": "Decision Making",
    "text": "256-QAM DL is not being used. What parameters affect modulation selection?"
  },
  {
    "id": "Q141-UCMPR-K01",
    "category": "Decision Making",
    "text": "What is Uplink CoMP? How does it improve uplink performance?"
  },
  {
    "id": "Q142-UCMPR-K02",
    "category": "Decision Making",
    "text": "What parameters control UL CoMP operation? What are the coordination requirements?"
  },
  {
    "id": "Q143-UCMPR-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate UL CoMP benefits? How is uplink throughput measured?"
  },
  {
    "id": "Q144-UCMPR-D01",
    "category": "Decision Making",
    "text": "When should UL CoMP be enabled? What are the deployment scenarios?"
  },
  {
    "id": "Q145-UCMPR-A01",
    "category": "Decision Making",
    "text": "UL CoMP is not providing expected gains. What are the potential issues?"
  },
  {
    "id": "Q146-MST-K01",
    "category": "Decision Making",
    "text": "What is Micro Sleep Tx? How does it differ from MIMO Sleep Mode?"
  },
  {
    "id": "Q147-MST-K02",
    "category": "Decision Making",
    "text": "What parameters control micro sleep operation? What are the sleep thresholds?"
  },
  {
    "id": "Q148-MST-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate MST effectiveness? How is power saving measured?"
  },
  {
    "id": "Q149-MST-D01",
    "category": "Decision Making",
    "text": "When should MST be enabled? What are the optimal traffic conditions?"
  },
  {
    "id": "Q150-MST-A01",
    "category": "Decision Making",
    "text": "Micro Sleep Tx is causing KPI degradation. How do you balance power savings with performance?"
  },
  {
    "id": "Q151-S-K01",
    "category": "Decision Making",
    "text": "What is the LTE Scheduler? What are its main functions?"
  },
  {
    "id": "Q152-S-K02",
    "category": "Decision Making",
    "text": "What parameters control scheduling behavior? What are the scheduling policies?"
  },
  {
    "id": "Q153-S-K03",
    "category": "Decision Making",
    "text": "What KPIs monitor scheduler performance? How is fairness measured?"
  },
  {
    "id": "Q154-S-D01",
    "category": "Decision Making",
    "text": "When should scheduler parameters be tuned? What are the optimization goals?"
  },
  {
    "id": "Q155-S-A01",
    "category": "Decision Making",
    "text": "Scheduler is causing unfair resource allocation. How do you tune the scheduling weights?"
  },
  {
    "id": "Q156-SSIT-K01",
    "category": "Decision Making",
    "text": "What is Service Specific Inactivity Timer? How does it differ from standard inactivity timer?"
  },
  {
    "id": "Q157-SSIT-K02",
    "category": "Decision Making",
    "text": "What parameters control SSIT per service? What QCI values are supported?"
  },
  {
    "id": "Q158-SSIT-K03",
    "category": "Decision Making",
    "text": "How does SSIT affect signaling and resource release? What are the timer values?"
  },
  {
    "id": "Q159-SSIT-D01",
    "category": "Decision Making",
    "text": "When should SSIT be configured? What services benefit from specific timers?"
  },
  {
    "id": "Q160-SSIT-A01",
    "category": "Decision Making",
    "text": "SSIT is causing early session releases. How do you tune the inactivity timers?"
  },
  {
    "id": "Q161-DUH-K01",
    "category": "Decision Making",
    "text": "What is Differentiated UE Handling? How does it categorize UEs?"
  },
  {
    "id": "Q162-DUH-K02",
    "category": "Decision Making",
    "text": "What parameters control UE differentiation? What are the UE classes?"
  },
  {
    "id": "Q163-DUH-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate DUH effectiveness? How is service quality measured per class?"
  },
  {
    "id": "Q164-DUH-D01",
    "category": "Decision Making",
    "text": "When should DUH be enabled? What deployment scenarios benefit?"
  },
  {
    "id": "Q165-DUH-A01",
    "category": "Decision Making",
    "text": "DUH is causing service degradation for certain UE classes. How do you tune the handling parameters?"
  },
  {
    "id": "Q166-ULOHM-K01",
    "category": "Decision Making",
    "text": "What is UE Level Oscillating Handover Minimization? How does it detect ping-pong handovers?"
  },
  {
    "id": "Q167-ULOHM-K02",
    "category": "Decision Making",
    "text": "What parameters control oscillation detection? What are the ping-pong thresholds?"
  },
  {
    "id": "Q168-ULOHM-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate ULOHM effectiveness? How is handover success measured?"
  },
  {
    "id": "Q169-ULOHM-D01",
    "category": "Decision Making",
    "text": "When should ULOHM be enabled? What scenarios cause oscillating handovers?"
  },
  {
    "id": "Q170-ULOHM-A01",
    "category": "Decision Making",
    "text": "ULOHM is preventing necessary handovers. How do you tune the oscillation parameters?"
  },
  {
    "id": "Q171-71CS-K01",
    "category": "Decision Making",
    "text": "What is 7-12 Cell Support? How does it differ from 6 cell support?"
  },
  {
    "id": "Q172-71CS-K02",
    "category": "Decision Making",
    "text": "What parameters control 7-12 cell configuration? What are the hardware requirements?"
  },
  {
    "id": "Q173-71CS-K03",
    "category": "Decision Making",
    "text": "What counters monitor cell capacity? How are resources allocated?"
  },
  {
    "id": "Q174-71CS-D01",
    "category": "Decision Making",
    "text": "When should 7-12 cell support be enabled? What are the capacity benefits?"
  },
  {
    "id": "Q175-71CS-A01",
    "category": "Decision Making",
    "text": "Cell expansion to 12 cells is failing. What parameters need to be checked and adjusted?"
  },
  {
    "id": "Q176-EUBS-K01",
    "category": "Decision Making",
    "text": "What is End-User Bitrate Shaping? How does it differ from QoS-based rate limiting?"
  },
  {
    "id": "Q177-EUBS-K02",
    "category": "Decision Making",
    "text": "What parameters control bitrate shaping? What are the rate limits?"
  },
  {
    "id": "Q178-EUBS-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate EUBS effectiveness? How is user experience measured?"
  },
  {
    "id": "Q179-EUBS-D01",
    "category": "Decision Making",
    "text": "When should EUBS be enabled? What are the use cases?"
  },
  {
    "id": "Q180-EUBS-A01",
    "category": "Decision Making",
    "text": "Bitrate shaping is causing poor user experience. How do you tune the rate limits?"
  },
  {
    "id": "Q181-UMMIMO-K01",
    "category": "Decision Making",
    "text": "What is Uplink Multiuser MIMO? How does it increase uplink capacity?"
  },
  {
    "id": "Q182-UMMIMO-K02",
    "category": "Decision Making",
    "text": "What parameters control UL MU-MIMO operation? What are the scheduling requirements?"
  },
  {
    "id": "Q183-UMMIMO-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate UL MU-MIMO benefits? How is uplink throughput measured?"
  },
  {
    "id": "Q184-UMMIMO-D01",
    "category": "Decision Making",
    "text": "When should UL MU-MIMO be enabled? What are the deployment requirements?"
  },
  {
    "id": "Q185-UMMIMO-A01",
    "category": "Decision Making",
    "text": "UL MU-MIMO is not providing expected gains. What are the potential issues?"
  },
  {
    "id": "Q186-UCA-K01",
    "category": "Decision Making",
    "text": "What is Uplink Carrier Aggregation? How does it differ from DL CA?"
  },
  {
    "id": "Q187-UCA-K02",
    "category": "Decision Making",
    "text": "What parameters control UL CA operation? What are the UE capability requirements?"
  },
  {
    "id": "Q188-UCA-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate UL CA effectiveness? How is uplink throughput measured?"
  },
  {
    "id": "Q189-UCA-D01",
    "category": "Decision Making",
    "text": "When should UL CA be enabled? What are the deployment scenarios?"
  },
  {
    "id": "Q190-UCA-A01",
    "category": "Decision Making",
    "text": "UL CA is not active. What parameters need to be checked?"
  },
  {
    "id": "Q191-EPLA-K01",
    "category": "Decision Making",
    "text": "What is Enhanced PDCCH Link Adaptation? How does it improve control channel reliability?"
  },
  {
    "id": "Q192-EPLA-K02",
    "category": "Decision Making",
    "text": "What parameters control PDCCH link adaptation? What are the CCE allocation strategies?"
  },
  {
    "id": "Q193-EPLA-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate EPLA effectiveness? How is PDCCH BLER measured?"
  },
  {
    "id": "Q194-EPLA-D01",
    "category": "Decision Making",
    "text": "When should EPLA be enabled? What are the coverage benefits?"
  },
  {
    "id": "Q195-EPLA-A01",
    "category": "Decision Making",
    "text": "PDCCH performance is poor despite EPLA. What parameters need tuning?"
  },
  {
    "id": "Q196-LUAIFLB-K01",
    "category": "Decision Making",
    "text": "What is Limited-Uplink-Aware IFLB? How does it differ from standard IFLB?"
  },
  {
    "id": "Q197-LUAIFLB-K02",
    "category": "Decision Making",
    "text": "What parameters control uplink-aware offload? What are the UL thresholds?"
  },
  {
    "id": "Q198-LUAIFLB-K03",
    "category": "Decision Making",
    "text": "What KPIs indicate LUA-IFLB effectiveness? How is uplink load measured?"
  },
  {
    "id": "Q199-LUAIFLB-D01",
    "category": "Decision Making",
    "text": "When should LUA-IFLB be used? What are the benefits over standard IFLB?"
  },
  {
    "id": "Q200-LUAIFLB-A01",
    "category": "Decision Making",
    "text": "LUA-IFLB is not balancing uplink load effectively. How do you tune the UL thresholds?"
  },
  {
    "id": "Q201-ILI-K01",
    "category": "Advanced Scenarios",
    "text": "What is IP Loopback Interface? What is its purpose in LTE?"
  },
  {
    "id": "Q202-ILI-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control loopback configuration? How are IP addresses assigned?"
  },
  {
    "id": "Q203-ILI-K03",
    "category": "Advanced Scenarios",
    "text": "What are the use cases for IP loopback? How does it aid testing?"
  },
  {
    "id": "Q204-ILI-D01",
    "category": "Advanced Scenarios",
    "text": "When should ILI be configured? What deployment scenarios require it?"
  },
  {
    "id": "Q205-ILI-A01",
    "category": "Advanced Scenarios",
    "text": "IP loopback is not working as expected. What are the troubleshooting steps?"
  },
  {
    "id": "Q206-FTSE-K01",
    "category": "Advanced Scenarios",
    "text": "What is FDD and TDD on Same eNodeB? What are the deployment benefits?"
  },
  {
    "id": "Q207-FTSE-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control FDD/TDD coexistence? What are the interference considerations?"
  },
  {
    "id": "Q208-FTSE-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs monitor FDD/TDD operation? How is performance measured?"
  },
  {
    "id": "Q209-FTSE-D01",
    "category": "Advanced Scenarios",
    "text": "When should FTSE be deployed? What are the planning requirements?"
  },
  {
    "id": "Q210-FTSE-A01",
    "category": "Advanced Scenarios",
    "text": "FDD/TDD coexistence is causing interference. How do you optimize the configuration?"
  },
  {
    "id": "Q211-ACCE-K01",
    "category": "Advanced Scenarios",
    "text": "What is Automated Cell Capacity Estimation? How does it work?"
  },
  {
    "id": "Q212-ACCE-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control capacity estimation? What metrics are used?"
  },
  {
    "id": "Q213-ACCE-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate ACCE accuracy? How is capacity estimated?"
  },
  {
    "id": "Q214-ACCE-D01",
    "category": "Advanced Scenarios",
    "text": "When should ACCE be used? What are the planning benefits?"
  },
  {
    "id": "Q215-ACCE-A01",
    "category": "Advanced Scenarios",
    "text": "Capacity estimation is inaccurate. How do you tune ACCE parameters?"
  },
  {
    "id": "Q216-LB-K01",
    "category": "Advanced Scenarios",
    "text": "What is LTE Broadcast? How does it differ from MBMS?"
  },
  {
    "id": "Q217-LB-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control broadcast operation? What are the resource allocation modes?"
  },
  {
    "id": "Q218-LB-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate LB effectiveness? How is broadcast quality measured?"
  },
  {
    "id": "Q219-LB-D01",
    "category": "Advanced Scenarios",
    "text": "When should LTE Broadcast be used? What are the use cases?"
  },
  {
    "id": "Q220-LB-A01",
    "category": "Advanced Scenarios",
    "text": "LTE Broadcast is experiencing quality issues. What parameters need tuning?"
  },
  {
    "id": "Q221-IFO-K01",
    "category": "Advanced Scenarios",
    "text": "What is Inter-Frequency Offload? How does it differ from IFLB?"
  },
  {
    "id": "Q222-IFO-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control inter-frequency offload? What are the offload thresholds?"
  },
  {
    "id": "Q223-IFO-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate IFO effectiveness? How is offload success measured?"
  },
  {
    "id": "Q224-IFO-D01",
    "category": "Advanced Scenarios",
    "text": "When should IFO be activated? What are the load balancing benefits?"
  },
  {
    "id": "Q225-IFO-A01",
    "category": "Advanced Scenarios",
    "text": "Inter-frequency offload is causing high ping-pong rates. How do you tune the offload parameters?"
  },
  {
    "id": "Q226-ACP-K01",
    "category": "Advanced Scenarios",
    "text": "What is Adjustable CRS Power? How does it affect cell edge performance?"
  },
  {
    "id": "Q227-ACP-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control CRS power adjustment? What are the power boost ranges?"
  },
  {
    "id": "Q228-ACP-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate ACP effectiveness? How is cell edge throughput measured?"
  },
  {
    "id": "Q229-ACP-D01",
    "category": "Advanced Scenarios",
    "text": "When should ACP be used? What deployment scenarios benefit?"
  },
  {
    "id": "Q230-ACP-A01",
    "category": "Advanced Scenarios",
    "text": "CRS power adjustment is causing interference. How do you optimize the power settings?"
  },
  {
    "id": "Q231-PVAB-K01",
    "category": "Advanced Scenarios",
    "text": "What is VoLTE Prioritization in Access Barring? How does it work?"
  },
  {
    "id": "Q232-PVAB-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control VoLTE access priority? What are the barring configurations?"
  },
  {
    "id": "Q233-PVAB-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate PVAB effectiveness? How is VoLTE access success measured?"
  },
  {
    "id": "Q234-PVAB-D01",
    "category": "Advanced Scenarios",
    "text": "When should PVAB be enabled? What congestion scenarios benefit?"
  },
  {
    "id": "Q235-PVAB-A01",
    "category": "Advanced Scenarios",
    "text": "VoLTE access is still failing despite PVAB. How do you tune the barring parameters?"
  },
  {
    "id": "Q236-CFDRU-K01",
    "category": "Advanced Scenarios",
    "text": "What is CS Fallback for Dual-Radio UEs? How does it differ from standard CSFB?"
  },
  {
    "id": "Q237-CFDRU-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control dual-radio CSFB? What are the fallback procedures?"
  },
  {
    "id": "Q238-CFDRU-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate CFDRU effectiveness? How is fallback success measured?"
  },
  {
    "id": "Q239-CFDRU-D01",
    "category": "Advanced Scenarios",
    "text": "When should CFDRU be configured? What are the deployment requirements?"
  },
  {
    "id": "Q240-CFDRU-A01",
    "category": "Advanced Scenarios",
    "text": "CS Fallback is failing for dual-radio UEs. What are the troubleshooting steps?"
  },
  {
    "id": "Q241-4QADPP4x2-K01",
    "category": "Advanced Scenarios",
    "text": "What is 4x2 MIMO with Quad Antenna? How does it differ from 2x2?"
  },
  {
    "id": "Q242-4QADPP4x2-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control 4x2 MIMO operation? What are the antenna requirements?"
  },
  {
    "id": "Q243-4QADPP4x2-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate 4x2 MIMO benefits? How is throughput measured?"
  },
  {
    "id": "Q244-4QADPP4x2-D01",
    "category": "Advanced Scenarios",
    "text": "When should 4x2 MIMO be enabled? What are the deployment scenarios?"
  },
  {
    "id": "Q245-4QADPP4x2-A01",
    "category": "Advanced Scenarios",
    "text": "4x2 MIMO is not providing expected gains. What parameters need checking?"
  },
  {
    "id": "Q246-MCPUSCH-K01",
    "category": "Advanced Scenarios",
    "text": "What is Multi-Clustered PUSCH? How does it improve uplink performance?"
  },
  {
    "id": "Q247-MCPUSCH-K02",
    "category": "Advanced Scenarios",
    "text": "What parameters control PUSCH clustering? What are the allocation strategies?"
  },
  {
    "id": "Q248-MCPUSCH-K03",
    "category": "Advanced Scenarios",
    "text": "What KPIs indicate MC-PUSCH effectiveness? How is uplink throughput measured?"
  },
  {
    "id": "Q249-MCPUSCH-D01",
    "category": "Advanced Scenarios",
    "text": "When should MC-PUSCH be enabled? What are the deployment requirements?"
  },
  {
    "id": "Q250-MCPUSCH-A01",
    "category": "Advanced Scenarios",
    "text": "Multi-Clustered PUSCH is not active. What parameters need configuration?"
  }
];
