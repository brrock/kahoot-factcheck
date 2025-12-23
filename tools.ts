import { tool } from "ai";
import z from "zod"
import Exa from "exa-js"
const exa = new Exa(process.env.EXA_API_KEY);

export const webSearch = tool({
      description: 'Search the web',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async ({ query }) => {
        console.log("Starting web search", query);
        const results = await exa.search(
          query,
          {
            numResults: 6,
            moderation: true
          }
        );
        
        return { results };
      }
})