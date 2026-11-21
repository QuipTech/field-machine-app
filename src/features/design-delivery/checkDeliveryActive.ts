const checkDeliveryActive = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error('Design delivery stopped.');
  }
};

export default checkDeliveryActive;
