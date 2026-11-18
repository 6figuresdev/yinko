export type Verdict = "allow" | "warn" | "block";

export interface CheckRequest {
  from: string;
  to: string;
  amount?: string;
  token?: string;
  kind: "transfer" | "approval";
  calldata?: string;          // approvals: 0x-prefixed tx data
  agentName?: string;         // optional .ai Agent ID name of the recipient
  knownAddresses?: string[];  // wallet's address book; merged with on-chain history
  attest?: boolean;           // write the verdict on-chain (needs GUARD_PRIVATE_KEY)
}

export interface Reason { code: string; severity: Verdict; message: string }

export interface CheckResponse {
  verdict: Verdict;
  reasons: Reason[];
  suggestedCap: string | null;
  attestationTx?: string | null;
}

export interface AgentRecord {
  name: string;
  owner: string;
  erc8004AgentId?: string;
  backLinkedName?: string;   // name the agent's own registration file points back to
  endpoint?: string;
}

export interface ChainContext {
  history(from: string): Promise<string[]>;
  knownSpenders(from: string): Promise<string[]>;
  registeredNames(): Promise<string[]>;
  resolveName(name: string): Promise<AgentRecord | null>;
}
