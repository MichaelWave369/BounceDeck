interface Window {
  bounceDeck?: {
    companionChat: (payload: unknown) => Promise<{
      configured: boolean;
      text?: string;
      model?: string;
    }>;
  };
}
