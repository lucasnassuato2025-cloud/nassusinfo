"use client";

import { ReceiptGeneratorAdapter } from "@/components/receipt-generator-adapter";
import { DocumentsModule as DocumentsCenter } from "./documents-center";

export function DocumentsModule(props: React.ComponentProps<typeof DocumentsCenter>) {
  return (
    <>
      <ReceiptGeneratorAdapter />
      <DocumentsCenter {...props} />
    </>
  );
}
