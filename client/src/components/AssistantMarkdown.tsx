import React from "react";
import { Streamdown } from "streamdown";

type AssistantMarkdownProps = { content: string };

export default function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  return <Streamdown>{content}</Streamdown>;
}
