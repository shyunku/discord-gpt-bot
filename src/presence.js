export function buildPresence(version, customActivityType) {
  const text = `Cushion GPT ${version}`;
  return {
    status: "online",
    activities: [
      {
        name: text,
        state: text,
        type: customActivityType,
      },
    ],
  };
}
