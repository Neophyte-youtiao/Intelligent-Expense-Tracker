import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const parseWeChatText = async (text: string): Promise<ParsedTransaction[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert financial assistant specialized in parsing transaction notifications from WeChat Pay (微信支付), Alipay (支付宝), or general text lists.
      
      Analyze the following text: "${text}"

      Current Date Reference: ${new Date().toISOString().split('T')[0]}

      Your task is to extract ONE OR MORE transactions into a JSON array.

      Extraction Rules:
      1. **Amount**: Extract numerical value. ALWAYS RETURN POSITIVE ABSOLUTE NUMBERS (e.g. if text is "-50", return 50).
      2. **Merchant/Note**: Identify payee, product, or description.
      3. **Category**: Infer ONE from: [Dining, Transport, Shopping, Entertainment, Housing, Medical, Salary, Other].
      4. **Date**: YYYY-MM-DD. Use Current Date Reference if "Today" or missing.
      5. **Multiple Items**: If the text contains a list (e.g., "Lunch 20, Taxi 15"), extract all of them.

      Return JSON matching this schema:
      {
        "transactions": [
           { "amount": number, "merchant": string, "categorySuggestion": string, "date": string | null }
        ]
      }`,
      config: COMMON_CONFIG,
    });

    if (response.text) {
      const result = JSON.parse(response.text) as ParseResult;
      return sanitizeResult(result.transactions || []);
    }
    return [];
  } catch (error) {
    console.error("Gemini parsing failed:", error);
    return [];
  }
};

export const parseScreenshot = async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<ParsedTransaction[]> => {
  try {
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
            text: `Analyze this image (screenshot of a bill, receipt, or transaction log).
            
            Current Date Reference: ${new Date().toISOString().split('T')[0]}

            Extract ALL visible transactions.
            
            Rules:
            1. Extract the Amount. ALWAYS RETURN POSITIVE NUMBERS (Absolute Value). Ignore negative signs.
            2. Extract the Merchant Name or Description as the 'merchant' field.
            3. Infer the Category (Dining, Transport, Shopping, Entertainment, Housing, Medical, Salary, Other).
            4. Extract Date if visible (YYYY-MM-DD), otherwise null.
            
            Return JSON.`
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
  } catch (error) {
    console.error("Gemini image parsing failed:", error);
    return [];
  }
};

export const getMonthlyInsight = async (total: number, categories: {name: string, value: number}[]): Promise<string> => {
  try {
     const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this monthly spending: Total: ${total}. Breakdown: ${JSON.stringify(categories)}.
      Give a 1-sentence friendly summary/insight in Chinese (Simplified).
      Example: "餐饮消费占比较高，下半月可以尝试在家做饭哦！" or "本月控制得很棒，继续保持！"
      Keep it encouraging.`,
    });
    return response.text || "继续保持记录的好习惯！";
  } catch (e) {
    return "消费记录看起来很棒！";
  }
}

export const getBaziFortune = async (birthDate: string, birthTime: string, gender: string): Promise<any> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `你是一位精通中国传统命理（八字、紫微斗数、风水）的大师。
      
      请根据用户的生辰八字，推算用户在 **${today}** 这一天的运势。
      
      用户信息：
      - 出生日期：${birthDate}
      - 出生时间：${birthTime}
      - 性别：${gender === 'male' ? '男' : '女'}
      
      要求：
      1. **语气**：专业、神秘但亲切，带有传统文化底蕴（如使用“今日气场”、“五行流转”等词汇）。
      2. **内容**：需结合今日的干支与用户的八字进行简单的生克分析（模拟）。
      3. **输出语言**：必须是**简体中文**。
      
      请返回如下 JSON 格式：
      {
        "overallScore": 0-100之间的整数 (今日运势评分),
        "summary": "一句话运势总结 (20字以内)",
        "luckyColor": "今日幸运色 (如：黛蓝)",
        "luckyDirection": "今日财神/贵人方位 (如：正南方)",
        "wealthTip": "财运建议 (针对今日)",
        "careerTip": "事业/学业建议",
        "loveTip": "感情建议"
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            luckyColor: { type: Type.STRING },
            luckyDirection: { type: Type.STRING },
            wealthTip: { type: Type.STRING },
            careerTip: { type: Type.STRING },
            loveTip: { type: Type.STRING }
          },
          required: ["overallScore", "summary", "luckyColor", "luckyDirection", "wealthTip", "careerTip", "loveTip"]
        }
      }
    });
    
    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response");
  } catch (e) {
    console.error("Fortune telling failed", e);
    // Fallback data in Chinese
    return {
      overallScore: 88,
      summary: "紫气东来，今日运势上佳，宜积极进取。",
      luckyColor: "朱红",
      luckyDirection: "正南",
      wealthTip: "正财稳健，偏财运平平，适合稳健理财。",
      careerTip: "工作效率高，易得贵人相助，适合推进重要项目。",
      loveTip: "桃花运旺，单身者通过聚会有机会结识良缘。"
    };
  }
}