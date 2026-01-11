export type InsertClientDocumentInput = {
  userId: string;
  cargoId: string;
  documentType: string;
  driveUrl: string;
};

export async function insertClientDocument(input: InsertClientDocumentInput): Promise<{ id: string }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_API_BASE_URL is not set");
  }

  const res = await fetch(`${baseUrl}/client/documents`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: input.userId,
      cargo_id: input.cargoId,
      document_type: input.documentType,
      drive_url: input.driveUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`insertClientDocument failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  if (!data?.id) {
    throw new Error("insertClientDocument: missing id");
  }
  return { id: data.id };
}
