import { z } from "zod";
import { invokeLLM, type Message } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeConfiguredProvider } from "../aiProviderService";
import {
  assistantMcpTools,
  isAssistantMcpToolName,
  parseAssistantMcpArguments,
  serializeAssistantMcpError,
  serializeAssistantMcpResult,
} from "../aiMcpTools";
import { callTradingViewTool } from "../mcpClient";

const message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4_000) });
const MAX_TOOL_ROUNDS = 3;
type PlainChatMessage = { role: "system" | "user" | "assistant"; content: string };

const assistantSystemPrompt =
  "أنت مساعد AMIC للتحليل الفني. اشرح المؤشرات والسيناريوهات بلغة عربية دقيقة ومباشرة. لا تقدّم توصية استثمارية شخصية، ولا تَعِد بعائد، واذكر بوضوح أن المحتوى تعليمي ومعلوماتي فقط. اعتمد على سياق السوق المرفق ولا تخترع أسعارًا أو بيانات. عند طلب تحليل أو قائمة أو مزاج أو أخبار حديثة، استخدم الأداة المناسبة فورًا بدل طلب توضيح إذا كان الرمز أو المدخلات اللازمة مذكورة؛ واستخدم القيم الافتراضية المعلنة للأداة عند غياب البورصة أو الإطار. بعد الأداة اذكر أن القراءة لحظية وقت الجلب وقد تتغير. لا تطلب أو تستخدم أي أدوات خارج المجموعة المعروضة.";

function textContent(content: unknown) {
  return typeof content === "string" ? content : "";
}

async function executeAssistantToolCall(toolCall: { id: string; function: { name: string; arguments: string } }) {
  const name = toolCall.function.name;
  if (!isAssistantMcpToolName(name)) {
    return { role: "tool" as const, tool_call_id: toolCall.id, content: serializeAssistantMcpError("الأداة المطلوبة غير مسموح بها للمساعد.") };
  }

  const parsed = parseAssistantMcpArguments(name, toolCall.function.arguments);
  if (!parsed.success) {
    return {
      role: "tool" as const,
      tool_call_id: toolCall.id,
      content: serializeAssistantMcpError("وسائط الأداة غير صالحة؛ استخدم فقط الرموز والبورصات والأطر والمدخلات المسموح بها."),
    };
  }

  try {
    const result = await callTradingViewTool(name, parsed.data);
    return { role: "tool" as const, tool_call_id: toolCall.id, content: serializeAssistantMcpResult(result) };
  } catch {
    return {
      role: "tool" as const,
      tool_call_id: toolCall.id,
      content: serializeAssistantMcpError("تعذر الوصول إلى بيانات السوق عبر أداة التحليل الآن. حلل ما هو متاح ولا تخترع بيانات."),
    };
  }
}

export async function runMcpAssistedConversation(initialMessages: Message[]) {
  const conversation = [...initialMessages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      // GPT-5 يحسب reasoning ضمن حد الإكمال؛ لذلك لا نستخدم max_tokens هنا
      // كي لا ينفد الحد قبل صياغة الملخص بعد استدعاء الأداة.
      maxCompletionTokens: 1_600,
      reasoning: { effort: "low" },
      messages: conversation,
      tools: assistantMcpTools,
      toolChoice: "auto",
    });
    const responseMessage = response.choices[0]?.message;
    const content = textContent(responseMessage?.content);
    const toolCalls = responseMessage?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return content || "تعذر إنشاء تفسير في هذه اللحظة.";
    }

    conversation.push({
      role: "assistant",
      content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      conversation.push(await executeAssistantToolCall(toolCall));
    }
  }

  return "استخدم المساعد الحد الأقصى من جولات جلب بيانات السوق لهذه الرسالة. أعد صياغة سؤالك بصورة أكثر تحديدًا للحصول على متابعة تعليمية مختصرة.";
}

export const aiRouter = router({
  explain: protectedProcedure
    .input(
      z.object({
        messages: z.array(message).min(1).max(12),
        marketContext: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const messages: PlainChatMessage[] = [
        {
          role: "system",
          content: assistantSystemPrompt,
        },
        ...(input.marketContext
          ? [{ role: "system" as const, content: `سياق السوق الحالي:\n${JSON.stringify(input.marketContext).slice(0, 10_000)}` }]
          : []),
        ...input.messages,
      ];

      try {
        return { content: await runMcpAssistedConversation(messages) };
      } catch (forgeError) {
        // موفرو لوحة الإدارة الحاليون يدعمون الحوار النصي فقط، لذلك لا نطلب منهم
        // تنفيذ أدوات MCP. يبقى هذا احتياطًا لرسالة تعليمية إذا تعذر النموذج المدمج.
        const configuredResponse = await invokeConfiguredProvider(messages);
        if (configuredResponse) return { content: configuredResponse.content };
        throw forgeError;
      }
    }),
});
