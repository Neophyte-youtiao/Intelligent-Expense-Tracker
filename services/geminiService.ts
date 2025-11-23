import { GoogleGenAI, Type } from "@google/genai";

// Helper to get effective API Key (User > Dev Environment)
export const getEffectiveKey = (): string | null => {
  // 1. Check LocalStorage (User entered)
  const userKey = localStorage.getItem('user_api_key');
  if (userKey) return userKey;

  // 2. Check Environment Variable (Developer provided)
  // Note: Vite replaces process.env.API_KEY at build time
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  
  return null;
};

// Initialize the client
const getAIClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export interface ParsedTransaction {
  amount: number;
  merchant: string;
  date?: string;
  categorySuggestion?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
}

const COMMON_CONFIG = {
  responseMimeType: "application/json",
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      transactions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            merchant: { type: Type.STRING },
            categorySuggestion: { type: Type.STRING },
            date: { type: Type.STRING, nullable: true },
          },
          required: ["amount", "merchant", "categorySuggestion"],
        }
      }
    },
  },
};

// Helper to ensure all amounts are positive
const sanitizeResult = (transactions: ParsedTransaction[]): ParsedTransaction[] => {
  return transactions.map(t => ({
    ...t,
    amount: Math.abs(t.amount) // Force positive number
  }));
};

// Helper to clean JSON from Free AI response (often wrapped in markdown)
const cleanAndParseJSON = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting from markdown code blocks ```json ... ```
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) { /* ignore */ }
    }
    // 3. Try finding the first { or [ and last } or ]
    const firstBrace = text.search(/({|\[)/);
    const lastBrace = text.search(/(}|])([^}\]]*)$/); // Find last closing brace
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
          const substring = text.substring(firstBrace, lastBrace + 1);
          return JSON.parse(substring);
      } catch (e3) { /* ignore */ }
    }
    console.error("JSON Parse Failed:", text);
    throw new Error("Could not parse JSON from AI response");
  }
};

export const parseWeChatText = async (text: string): Promise<ParsedTransaction[]> => {
  const apiKey = getEffectiveKey();

  // --- PRO MODE (Google Gemini) ---
  if (apiKey) {
    try {
      const ai = getAIClient(apiKey);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert financial assistant. Analyze the following text: "${text}"
        Current Date: ${new Date().toISOString().split('T')[0]}
        Task: Extract transactions.
        Rules:
        1. Amount: Absolute positive number only.
        2. Category: Infer one from [Dining, Transport, Shopping, Entertainment, Housing, Medical, Salary, Other].
        3. Return JSON object with "transactions" array.`,
        config: COMMON_CONFIG,
      });

      if (response.text) {
        const result = JSON.parse(response.text) as ParseResult;
        return sanitizeResult(result.transactions || []);
      }
    } catch (error) {
      console.error("Gemini parsing failed, falling back to free mode...", error);
    }
  }

  // --- FREE MODE (Pollinations AI) ---
  try {
    const prompt = `
      You are an API that outputs strictly raw JSON. Do not output markdown.
      Analyze: "${text}"
      Date: ${new Date().toISOString().split('T')[0]}
      Extract: amount (positive number), merchant, date (YYYY-MM-DD), category (Dining, Transport, Shopping, Entertainment, Housing, Medical, Salary, Other).
      Format: {"transactions": [{"amount": 100, "merchant": "Taxi", "categorySuggestion": "Transport", "date": "2023-01-01"}]}
    `;
    const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
    const rawText = await response.text();
    const result = cleanAndParseJSON(rawText);
    return sanitizeResult(result.transactions || []);
  } catch (error) {
    console.error("Free AI parsing failed:", error);
    return [];
  }
};

export const parseScreenshot = async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<ParsedTransaction[]> => {
  const apiKey = getEffectiveKey();

  if (!apiKey) {
    console.warn("Screenshot parsing requires API Key (Pro Mode)");
    return [];
  }

  // --- PRO MODE ONLY (Google Gemini) ---
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: `Analyze this bill/receipt image.
            Current Date: ${new Date().toISOString().split('T')[0]}
            Extract all transactions.
            Rules:
            1. Amount: Absolute positive number only.
            2. Category: Infer from [Dining, Transport, Shopping, Entertainment, Housing, Medical, Salary, Other].
            Return JSON object with "transactions" array.`
          }
        ]
      },
      config: COMMON_CONFIG,
    });

    if (response.text) {
      const result = JSON.parse(response.text) as ParseResult;
      return sanitizeResult(result.transactions || []);
    }
    return [];
  } catch (error: any) {
    console.error("Gemini image parsing failed:", error);
    return [];
  }
};

export const getMonthlyInsight = async (total: number, categories: {name: string, value: number}[]): Promise<string> => {
  const apiKey = getEffectiveKey();
  const prompt = `Analyze monthly spending: Total ${total}, Breakdown: ${JSON.stringify(categories)}. Give 1 encouraging sentence in Simplified Chinese. Max 20 words.`;

  if (apiKey) {
    try {
        const ai = getAIClient(apiKey);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text || "继续保持！";
    } catch (e) { console.error(e); }
  }

  try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
      return await res.text();
  } catch (e) {
      return "消费记录看起来很棒！";
  }
}

export const getBaziFortune = async (birthDate: string, birthTime: string, gender: string): Promise<any> => {
  const apiKey = getEffectiveKey();
  const today = new Date().toISOString().split('T')[0];
  const systemPrompt = `你是一位八字命理大师。根据生辰(${birthDate} ${birthTime}, ${gender === 'male'?'男':'女'})推算${today}运势。
  严格返回JSON格式(不要Markdown)，字段: overallScore(0-100), summary(20字内), luckyColor, luckyDirection, wealthTip, careerTip, loveTip。`;

  if (apiKey) {
    try {
        const ai = getAIClient(apiKey);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: systemPrompt,
            config: { responseMimeType: "application/json" }
        });
        if (response.text) return JSON.parse(response.text);
    } catch (e) { console.error(e); }
  }

  // Free Mode Fallback
  try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(systemPrompt)}`);
      const text = await res.text();
      return cleanAndParseJSON(text);
  } catch (e) {
      console.error("Fortune failed", e);
      return {
          overallScore: 80,
          summary: "今日运势平稳 (免费模式网络波动，请重试)",
          luckyColor: "白色",
          luckyDirection: "北方",
          wealthTip: "宜保守",
          careerTip: "宜静",
          loveTip: "顺其自然"
      };
  }
}