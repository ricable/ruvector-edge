/**
 * LTE Features Constants
 *
 * Shared feature list used by both LTEFeatureAgentsFactory and QuestionBankLoader
 * to ensure agents and questions are properly aligned.
 *
 * @module ran-battle-test/aggregates/lte-features-constants
 */

export interface LTEFeatureDefinition {
  readonly faj: string;
  readonly acronym: string;
  readonly name: string;
  readonly cxc: string | null;
}

/**
 * 50 LTE Features for specialized agents and questions
 */
export const LTE_50_FEATURES: LTEFeatureDefinition[] = [
  { faj: 'FAJ 121 4242', acronym: '11CS', name: '13-18 Cell Support', cxc: 'CXC4011917' },
  { faj: 'FAJ 121 0488', acronym: '1QU', name: '16-QAM Uplink', cxc: null },
  { faj: 'FAJ 121 4426', acronym: '12CS', name: '19-24 Cell Support', cxc: 'CXC4011974' },
  { faj: 'FAJ 121 4422', acronym: '2QD', name: '256-QAM Downlink', cxc: 'CXC4011969' },
  { faj: 'FAJ 121 5031', acronym: '2QU', name: '256-QAM Uplink', cxc: 'CXC4012344' },
  { faj: 'FAJ 121 3084', acronym: '3DCAE', name: '3CC DL Carrier Aggregation Extension', cxc: 'CXC4011714' },
  { faj: 'FAJ 121 4466', acronym: '4DCAE', name: '4CC DL Carrier Aggregation Extension', cxc: 'CXC4011980' },
  { faj: 'FAJ 121 3041', acronym: '4QADPP', name: '4x2 Quad Antenna DL Performance Package', cxc: 'CXC4011427' },
  { faj: 'FAJ 121 4901', acronym: '4FIRC', name: '4x4 Full Interference Rejection Combining', cxc: 'CXC4012271' },
  { faj: 'FAJ 121 3076', acronym: '4QADPP2', name: '4x4 Quad Antenna DL Performance Package', cxc: 'CXC4011667' },
  { faj: 'FAJ 121 3071', acronym: '5MSC', name: '5+5 MHz Sector Carrier', cxc: null },
  { faj: 'FAJ 121 4467', acronym: '5DCAE', name: '5CC DL Carrier Aggregation Extension', cxc: 'CXC4011981' },
  { faj: 'FAJ 121 1821', acronym: '6CS', name: '6 Cell Support', cxc: 'CXC4011317' },
  { faj: 'FAJ 121 0487', acronym: '6QD', name: '64-QAM Downlink', cxc: null },
  { faj: 'FAJ 121 4363', acronym: '6QU', name: '64-QAM Uplink', cxc: 'CXC4011946' },
  { faj: 'FAJ 121 5032', acronym: '6DCAE', name: '6CC DL Carrier Aggregation Extension', cxc: 'CXC4012345' },
  { faj: 'FAJ 121 3020', acronym: '71CS', name: '7-12 Cell Support', cxc: 'CXC4011356' },
  { faj: 'FAJ 121 5033', acronym: '7DCAE', name: '7CC DL Carrier Aggregation Extension', cxc: 'CXC4012346' },
  { faj: 'FAJ 121 0863', acronym: 'GUPLS', name: 'A-GPS User Plane Location Support', cxc: 'CXC4010963' },
  { faj: 'FAJ 121 5282', acronym: 'APACS', name: 'AI Powered Advanced Cell Supervision', cxc: 'CXC4012522' },
  { faj: 'FAJ 121 5247', acronym: 'APDLA', name: 'AI Powered DL Link Adaptation', cxc: 'CXC4012505' },
  { faj: 'FAJ 121 4795', acronym: 'AF', name: 'ASGH Framework', cxc: null },
  { faj: 'FAJ 121 4796', acronym: 'APP', name: 'ASGH Performance Package', cxc: 'CXC4012199' },
  { faj: 'FAJ 121 5048', acronym: 'AQRE', name: 'ASGH QCI Range Extension', cxc: null },
  { faj: 'FAJ 121 5049', acronym: 'ABATF', name: 'ASGH-Based A/B Testing Framework', cxc: 'CXC4012356' },
  { faj: 'FAJ 121 4797', acronym: 'ABP', name: 'ASGH-Based Prescheduling', cxc: 'CXC4012200' },
  { faj: 'FAJ 121 5315', acronym: 'ABSEP', name: 'ASGH-Based Spectral Efficiency Package', cxc: 'CXC4012546' },
  { faj: 'FAJ 121 5036', acronym: 'AIFLB', name: 'Accelerated Inter-Frequency Load Balancing', cxc: 'CXC4012349' },
  { faj: 'FAJ 121 4570', acronym: 'ARPR', name: 'Adaptive RLC Poll-Retransmission', cxc: 'CXC4012018' },
  { faj: 'FAJ 121 3049', acronym: 'ACP', name: 'Adjustable CRS Power', cxc: null },
  { faj: 'FAJ 121 3100', acronym: 'ATO', name: 'Admission-Triggered Offload', cxc: 'CXC4011814' },
  { faj: 'FAJ 121 0781', acronym: 'ACS', name: 'Advanced Cell Supervision', cxc: 'CXC4010320' },
  { faj: 'FAJ 121 4415', acronym: 'ADRFS', name: 'Advanced Differentiation for Resource Fair Scheduling', cxc: 'CXC4011967' },
  { faj: 'FAJ 121 5403', acronym: 'ARD', name: 'Advanced RAN Defense', cxc: null },
  { faj: 'FAJ 121 4881', acronym: 'ASAPAU', name: 'Advanced SR Allocation for Privileged Access Users', cxc: 'CXC4012281' },
  { faj: 'FAJ 121 0855', acronym: 'AILG', name: 'Air Interface Load Generator', cxc: 'CXC4010955' },
  { faj: 'FAJ 121 3040', acronym: 'ASM', name: 'Antenna System Monitoring', cxc: 'CXC4011422' },
  { faj: 'FAJ 121 5065', acronym: 'ADIR', name: 'Atmospheric Duct Interference Reduction', cxc: 'CXC4012256' },
  { faj: 'FAJ 121 4556', acronym: 'ALBS', name: 'Autoconfiguration of LTE Broadcast Subframes', cxc: 'CXC4012012' },
  { faj: 'FAJ 121 3031', acronym: 'ACCE', name: 'Automated Cell Capacity Estimation', cxc: 'CXC4011373' },
  { faj: 'FAJ 121 0497', acronym: 'ANR', name: 'Automated Neighbor Relations', cxc: 'CXC4010620' },
  { faj: 'FAJ 121 2026', acronym: 'ARRSA', name: 'Automated RACH Root Sequence Allocation', cxc: 'CXC4011246' },
  { faj: 'FAJ 121 4749', acronym: 'ASM2', name: 'Automatic SCell Management', cxc: 'CXC4012123' },
  { faj: 'FAJ 121 4915', acronym: 'BRCP', name: 'Baseband Resource Cell Prioritization', cxc: 'CXC4012275' },
  { faj: 'FAJ 121 1857', acronym: 'BAC', name: 'Basic Admission Control', cxc: null },
  { faj: 'FAJ 121 3092', acronym: 'BLM', name: 'Basic Load Management', cxc: null },
  { faj: 'FAJ 121 1824', acronym: 'BT', name: 'Battery Test', cxc: null },
  { faj: 'FAJ 121 3028', acronym: 'BNRILLM', name: 'Best Neighbor Relations for Intra-LTE Load Management', cxc: 'CXC4011370' },
  { faj: 'FAJ 121 3045', acronym: 'CLO', name: 'CPRI Link Observability', cxc: null },
  { faj: 'FAJ 121 0845', acronym: 'CFDRU', name: 'CS Fallback for Dual-Radio UEs', cxc: 'CXC4010949' }
];

export default LTE_50_FEATURES;
