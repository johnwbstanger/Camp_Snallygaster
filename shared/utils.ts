export function generateRoomCode(): string {
  const words = [
    "PINE",
    "ASPEN",
    "BIRCH",
    "OAK",
    "MAPLE",
    "SPRUCE",
    "CEDAR",
    "WILLOW",
    "CEDAR",
    "FERN",
  ];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${word}-${num}`;
}
