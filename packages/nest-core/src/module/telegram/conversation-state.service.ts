import { Injectable } from '@nestjs/common';

interface ConversationState {
  projectId: string | null;
  planId: string | null;
}

@Injectable()
export class ConversationStateService {
  private readonly state = new Map<string, ConversationState>();

  getState(conversationId: string): ConversationState {
    return this.state.get(conversationId) ?? { projectId: null, planId: null };
  }

  setProjectId(conversationId: string, projectId: string): void {
    const current = this.getState(conversationId);
    this.state.set(conversationId, { ...current, projectId });
  }

  setPlanId(conversationId: string, planId: string | null): void {
    const current = this.getState(conversationId);
    this.state.set(conversationId, { ...current, planId });
  }

  setProjectAndPlan(conversationId: string, projectId: string, planId: string): void {
    this.state.set(conversationId, { projectId, planId });
  }

  clearPlan(conversationId: string): void {
    const current = this.getState(conversationId);
    this.state.set(conversationId, { ...current, planId: null });
  }

  clear(conversationId: string): void {
    this.state.delete(conversationId);
  }
}
