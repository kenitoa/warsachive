import type { ArchiveRecord } from "../../../web/lib/archive-types.ts";

export type AdapterEnvironment = Record<string, string | undefined>;
export type ServiceDefinition={description:string;audience:string;deliverables:string[];rightsStatement:string;deliveryDays:number;supportPolicy:string};
export type PaymentProduct = { id: string; title: string; amountMinor: number; currency: string;serviceDefinition?:ServiceDefinition };
export type PaymentEvent = { eventId: string; type: string; orderId: string; sessionId: string; status: "paid" | "partially-refunded" | "refunded" | "failed" | "cancelled" | "refund-pending"; amountMinor: number; currency: string; refundedMinor?: number; liveMode?: boolean };
export interface PaymentAdapter {
  enabled: boolean;
  createCheckout(input: { orderId: string; userId: string; product: PaymentProduct; successUrl: string; cancelUrl: string }): Promise<{ sessionId: string; url: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent | null>;
  refund(input: { orderId: string; sessionId: string; amountMinor: number; idempotencyKey: string }): Promise<{ refundId: string; status: "pending" | "refunded"; refundedMinor?: number }>;
}
export type AiAnswer = { text: string; citations: { recordId: string; sectionId: string }[]; model?: string; usage?: { inputTokens: number; outputTokens: number };evaluationId?:string;answerId?:string;citationDetails?:{recordId:string;sectionId:string;recordVersion:string;contentHash:string;excerpt:string;sourceIds:string[]}[] };
export interface AiAdapter {
  enabled: boolean;
  publicEnabled?: boolean;
  evaluationContentHash?: string;
  evaluationId?: string;
  promptHash?: string;
  answer(input: { question: string; records: ArchiveRecord[]; mode: "answer" | "assist" }): Promise<AiAnswer>;
}
export interface NotificationAdapter {
  enabled: boolean;
  send(input: { eventId: string; event: "correction_received" | "correction_updated" | "password_reset"; recipient?: string; data: Record<string, string> }): Promise<void>;
}
export type Adapters = { payments: PaymentAdapter; ai: AiAdapter; notifications: NotificationAdapter };

export function disabledAdapters(): Adapters {
  const unavailable = async (): Promise<never> => { throw new Error("External adapter is not configured."); };
  return {
    payments: { enabled: false, createCheckout: unavailable, verifyWebhook: unavailable, refund: unavailable },
    ai: { enabled: false, answer: unavailable },
    notifications: { enabled: false, send: unavailable }
  };
}
