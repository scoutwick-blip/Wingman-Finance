
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, AIAdvice, BudgetSuggestion, CategorySuggestion, Bill, Goal, Subscription, Account, CategoryType, GoalStatus, BillStatus, SubscriptionStatus, AccountType } from "../types";

export interface FinancialContext {
  transactions: Transaction[];
  categories: Category[];
  bills: Bill[];
  goals: Goal[];
  subscriptions: Subscription[];
  accounts: Account[];
  currency: string;
}

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[]
): Promise<AIAdvice> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summaryData = transactions.map(t => ({
    date: t.date,
    amount: t.amount,
    typeId: t.typeId,
    category: categories.find(c => c.id === t.categoryId)?.name || 'Unknown'
  }));

  const prompt = `
    Act as a professional financial advisor. Analyze the transaction data and provide clear, actionable budgeting advice.
    The tone should be professional, precise, and supportive. If the user has military-specific pay categories (BAH, BAS, etc.), factor those in accordingly.
    
    Categories and their budgets:
    ${categories.map(c => `${c.name}: $${c.budget}`).join('\n')}

    Transaction History:
    ${JSON.stringify(summaryData)}

    Provide a summary of their current state, 3 actionable tips to improve their financial position, and any alerts if they are significantly over budget.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tips: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            alerts: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['summary', 'tips', 'alerts']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as AIAdvice;
  } catch {
    return {
      summary: "Connection to the advisor service is temporarily unavailable. Please check your network and try again.",
      tips: [],
      alerts: []
    };
  }
};

export const getBudgetSuggestions = async (
  transactions: Transaction[],
  categories: Category[]
): Promise<BudgetSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const history = transactions.map(t => ({
    amount: t.amount,
    typeId: t.typeId,
    categoryId: t.categoryId,
    categoryName: categories.find(c => c.id === t.categoryId)?.name || 'Unknown',
    date: t.date
  }));

  const prompt = `
    Based on the transaction history, suggest a realistic monthly budget for each category.
    Encourage improvement without setting unattainable goals.
    
    Current Categories:
    ${categories.map(c => `ID: ${c.id}, Name: ${c.name}, Current Budget: $${c.budget}`).join('\n')}

    Transaction History:
    ${JSON.stringify(history)}

    Return a list of suggestions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING },
              suggestedAmount: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ['categoryId', 'suggestedAmount', 'reason']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result as BudgetSuggestion[];
  } catch {
    return [];
  }
};

export const extractReceiptData = async (
  imageBase64: string
): Promise<{ merchant?: string; amount?: number; date?: string; description?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this receipt image and extract the following information:
    - Merchant/store name
    - Total amount (the final total, not subtotal)
    - Date of transaction (in YYYY-MM-DD format)
    - A brief description of what was purchased

    If any information cannot be determined from the image, return null for that field.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            date: { type: Type.STRING, nullable: true },
            description: { type: Type.STRING, nullable: true }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch {
    throw new Error("Failed to extract receipt data");
  }
};

export const suggestCategory = async (
  description: string,
  merchant: string | undefined,
  amount: number,
  categories: Category[],
  recentTransactions: Transaction[]
): Promise<CategorySuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type
  }));

  const recentHistory = recentTransactions
    .slice(0, 50) // Last 50 transactions
    .map(t => ({
      description: t.description,
      merchant: t.merchant,
      categoryId: t.categoryId,
      categoryName: categories.find(c => c.id === t.categoryId)?.name
    }));

  const prompt = `
    Suggest the most appropriate budget category for this transaction.

    Transaction Details:
    - Description: ${description}
    - Merchant: ${merchant || 'Unknown'}
    - Amount: $${amount}

    Available Categories:
    ${JSON.stringify(categoryList)}

    Recent Transaction History (for learning user patterns):
    ${JSON.stringify(recentHistory)}

    Return up to 3 category suggestions ranked by confidence (0-1), with reasoning for each suggestion.
    Consider the merchant name, transaction description, amount, and user's historical categorization patterns.
    Be specific and confident - use the merchant name and common sense to categorize accurately.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ['categoryId', 'confidence', 'reason']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result as CategorySuggestion[];
  } catch {
    return [];
  }
};

// Batch category suggestions for multiple transactions (more efficient)
export const suggestCategoriesBatch = async (
  transactions: Array<{ description: string; merchant?: string; amount: number }>,
  categories: Category[],
  recentTransactions: Transaction[]
): Promise<Map<string, CategorySuggestion[]>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type
  }));

  const recentHistory = recentTransactions
    .slice(0, 30) // Last 30 transactions
    .map(t => ({
      description: t.description,
      merchant: t.merchant,
      categoryId: t.categoryId,
      categoryName: categories.find(c => c.id === t.categoryId)?.name
    }));

  // Create a key for each transaction
  const transactionKeys = transactions.map(t => t.merchant || t.description);

  const prompt = `
    Analyze these transactions and suggest the most appropriate budget category for each.
    Return suggestions as an array where each item contains the transaction key (merchant or description) and up to 2 category suggestions.

    Transactions to categorize:
    ${transactions.map((t, i) => `
    ${i + 1}. Key: "${transactionKeys[i]}"
       - Description: ${t.description}
       - Merchant: ${t.merchant || 'Unknown'}
       - Amount: $${t.amount}
    `).join('\n')}

    Available Categories:
    ${JSON.stringify(categoryList)}

    Recent Transaction History (for learning patterns):
    ${JSON.stringify(recentHistory)}

    Be specific and confident. Use merchant names and common sense. Consider:
    - Starbucks, McDonald's, restaurants → Dining
    - Walmart, Target, grocery stores → Groceries
    - Shell, Chevron, gas stations → Gas/Transportation
    - Netflix, Spotify, streaming → Entertainment
    - Amazon could be Shopping, depending on amount/description
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              transactionKey: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  },
                  required: ['categoryId', 'confidence', 'reason']
                }
              }
            },
            required: ['transactionKey', 'suggestions']
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');

    // Convert to Map for easy lookup
    const suggestionsMap = new Map<string, CategorySuggestion[]>();
    result.forEach((item: { transactionKey: string; suggestions: CategorySuggestion[] }) => {
      suggestionsMap.set(item.transactionKey, item.suggestions);
    });

    return suggestionsMap;
  } catch {
    return new Map();
  }
};

// Build comprehensive financial context for AI chat
const buildFinancialSystemPrompt = (context: FinancialContext): string => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currency = context.currency || '$';

  // Filter this month's transactions
  const monthlyTxns = context.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Calculate income/expenses from category types
  const monthlyIncome = monthlyTxns
    .filter(t => {
      const cat = context.categories.find(c => c.id === t.categoryId);
      return cat?.type === CategoryType.INCOME;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = monthlyTxns
    .filter(t => {
      const cat = context.categories.find(c => c.id === t.categoryId);
      return cat?.type === CategoryType.SPENDING || cat?.type === CategoryType.DEBT;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Budget utilization
  const budgetLines = context.categories
    .filter(c => c.type === CategoryType.SPENDING && c.budget > 0)
    .map(c => {
      const spent = monthlyTxns
        .filter(t => t.categoryId === c.id)
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = c.budget > 0 ? Math.round((spent / c.budget) * 100) : 0;
      return `  - ${c.name}: ${currency}${spent.toFixed(0)} / ${currency}${c.budget.toFixed(0)} (${pct}%)`;
    }).join('\n');

  // Active goals
  const goalLines = context.goals
    .filter(g => g.status === GoalStatus.IN_PROGRESS)
    .map(g => {
      const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
      return `  - ${g.name}: ${currency}${g.currentAmount.toFixed(0)} / ${currency}${g.targetAmount.toFixed(0)} (${pct}%)${g.deadline ? ` deadline: ${g.deadline}` : ''}`;
    }).join('\n');

  // Upcoming bills
  const upcomingBills = context.bills
    .filter(b => b.status !== BillStatus.PAID)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 10)
    .map(b => {
      const daysUntil = Math.ceil((new Date(b.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `  - ${b.name}: ${currency}${b.amount.toFixed(2)} due ${daysUntil < 0 ? `${Math.abs(daysUntil)} days OVERDUE` : daysUntil === 0 ? 'TODAY' : `in ${daysUntil} days`}`;
    }).join('\n');

  // Subscriptions
  const activeSubs = context.subscriptions
    .filter(s => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.TRIAL);
  const subsLines = activeSubs
    .map(s => `  - ${s.name}: ${currency}${s.cost.toFixed(2)}/${s.billingCycle}`)
    .join('\n');

  const monthlySubCost = activeSubs.reduce((sum, s) => {
    switch (s.billingCycle) {
      case 'Weekly': return sum + s.cost * 4.33;
      case 'Bi-Weekly': return sum + s.cost * 2.17;
      case 'Monthly': return sum + s.cost;
      case 'Yearly': return sum + s.cost / 12;
      default: return sum + s.cost;
    }
  }, 0);

  // Account balances
  const accountLines = context.accounts
    .filter(a => !a.isHidden)
    .map(a => `  - ${a.name} (${a.type}): ${currency}${a.balance.toFixed(2)}`)
    .join('\n');

  const totalAssets = context.accounts
    .filter(a => !a.isHidden && a.type !== AccountType.CREDIT_CARD && a.type !== AccountType.LOAN)
    .reduce((sum, a) => sum + a.balance, 0);

  const totalLiabilities = context.accounts
    .filter(a => !a.isHidden && (a.type === AccountType.CREDIT_CARD || a.type === AccountType.LOAN))
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  // Recent transactions (last 20)
  const recentTxns = context.transactions
    .slice(0, 20)
    .map(t => {
      const cat = context.categories.find(c => c.id === t.categoryId);
      return `  - ${t.date}: ${t.description}${t.merchant ? ` (${t.merchant})` : ''} - ${currency}${t.amount.toFixed(2)} [${cat?.name || 'Unknown'}]`;
    }).join('\n');

  return `You are Wingman AI, a smart and friendly financial advisor built into a personal finance app called Wingman Finance. You have complete access to the user's financial data below. Be conversational, specific, and reference actual numbers from their data. Give concrete, actionable advice. Keep responses concise but thorough. Use the currency symbol ${currency}.

TODAY'S DATE: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

=== THIS MONTH'S OVERVIEW ===
Monthly Income: ${currency}${monthlyIncome.toFixed(2)}
Monthly Expenses: ${currency}${monthlyExpenses.toFixed(2)}
Net: ${currency}${(monthlyIncome - monthlyExpenses).toFixed(2)}
Transactions this month: ${monthlyTxns.length}
Total transactions all-time: ${context.transactions.length}

=== BUDGET STATUS (This Month) ===
${budgetLines || '  No budgets set'}

=== ACTIVE GOALS ===
${goalLines || '  No active goals'}

=== UPCOMING BILLS ===
${upcomingBills || '  No upcoming bills'}

=== ACTIVE SUBSCRIPTIONS (${currency}${monthlySubCost.toFixed(2)}/month total) ===
${subsLines || '  No active subscriptions'}

=== ACCOUNTS ===
${accountLines || '  No accounts'}
Total Assets: ${currency}${totalAssets.toFixed(2)}
Total Liabilities: ${currency}${totalLiabilities.toFixed(2)}
Net Worth: ${currency}${(totalAssets - totalLiabilities).toFixed(2)}

=== RECENT TRANSACTIONS ===
${recentTxns || '  No recent transactions'}

=== ALL CATEGORIES ===
${context.categories.map(c => `  - ${c.name} (${c.type}, budget: ${currency}${c.budget})`).join('\n')}

INSTRUCTIONS:
- Be conversational and use the user's actual data in your responses
- When asked about spending, reference specific categories and dollar amounts
- Provide specific dollar amounts, percentages, and comparisons where relevant
- If something looks concerning (overspending, missed bills, overdue), proactively mention it
- Keep responses focused and readable — use bullet points for lists
- If the user asks something you can't determine from the data, say so honestly
- Never fabricate data — only reference what's actually provided above
- Format with markdown: use **bold** for emphasis, bullet points for lists, and clear sections`;
};

// Conversational AI chat with full financial context
export const chatWithFinancialAdvisor = async (
  message: string,
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }>,
  context: FinancialContext
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemPrompt = buildFinancialSystemPrompt(context);

  // Keep conversation history manageable (last 10 exchanges)
  const recentHistory = conversationHistory.slice(-20);

  const contents = [
    ...recentHistory.map(msg => ({
      role: msg.role as 'user' | 'model',
      parts: [{ text: msg.text }]
    })),
    { role: 'user' as const, parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || "I couldn't generate a response. Please try again.";
  } catch {
    return "I'm having trouble connecting to the advisor service right now. Please check your network connection and API key, then try again.";
  }
};
