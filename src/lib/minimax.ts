import OpenAI from "openai";

const apiKey = "sk-api-FZ9HPLas0n8jMyk4UEoLxjrYC7ZFc1-CVkylUpklpVmqsmQU6QRH_-qpuH2cfYkPuOulQBxFAs9cqri2I7g01r2HD5aUURidQis29gT8PGzgeycEY57p2ro";

export const minimax = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.minimax.io/v1",
});
